<?php
/**
 * save.php — live-save endpoint for the games library (needs PHP 7.3+).
 *
 *   GET  save.php?action=status   -> login state, CSRF token, current games.json version
 *   POST save.php?action=login    -> {username, password}
 *   POST save.php?action=logout
 *   POST save.php?action=save     -> {games: [...], version: "<from status>"}
 *
 * Setup: see config.php and hash-password.php.
 */

ini_set('display_errors', '0');
error_reporting(E_ALL);
ini_set('serialize_precision', '-1');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

define('COOKIE_NAME', 'gl_auth');
define('GAMES_FILE', __DIR__ . '/games.json');
define('DATA_DIR', __DIR__ . '/data');
define('BACKUP_DIR', __DIR__ . '/backups');
define('MAX_BODY', 8 * 1024 * 1024);
define('MAX_GAMES', 20000);
define('MAX_FAILS', 5);
define('LOCK_SECONDS', 900);

$cfg = is_file(__DIR__ . '/config.php') ? include __DIR__ . '/config.php' : array();
if (!is_array($cfg)) {
    $cfg = array();
}
$cfg += array(
    'username'      => '',
    'password_hash' => '',
    'secret'        => '',
    'require_https' => true,
    'session_days'  => 30,
    'keep_backups'  => 10,
);
$configured = $cfg['username'] !== ''
    && $cfg['password_hash'] !== ''
    && strlen((string)$cfg['secret']) >= 32;

// ───────────── helpers ─────────────

function respond($code, array $data)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($code, $message)
{
    respond($code, array('ok' => false, 'error' => $message));
}

function is_https()
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) {
        return true;
    }
    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') {
        return true;
    }
    if (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_SSL']) === 'on') {
        return true;
    }
    if (!empty($_SERVER['HTTP_CF_VISITOR']) && strpos((string)$_SERVER['HTTP_CF_VISITOR'], 'https') !== false) {
        return true;
    }
    return false;
}

function is_local()
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    return $ip === '127.0.0.1' || $ip === '::1';
}

function b64u_enc($s)
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

function b64u_dec($s)
{
    return base64_decode(strtr($s, '-_', '+/'));
}

function make_token($user, $exp, $secret)
{
    $body = b64u_enc(json_encode(array('u' => $user, 'exp' => $exp)));
    return $body . '.' . hash_hmac('sha256', $body, $secret);
}

function read_token($secret)
{
    $raw = isset($_COOKIE[COOKIE_NAME]) ? $_COOKIE[COOKIE_NAME] : '';
    if (!is_string($raw) || strpos($raw, '.') === false) {
        return null;
    }
    list($body, $sig) = explode('.', $raw, 2);
    if (!hash_equals(hash_hmac('sha256', $body, $secret), $sig)) {
        return null;
    }
    $data = json_decode((string)b64u_dec($body), true);
    if (!is_array($data) || empty($data['u']) || empty($data['exp']) || $data['exp'] < time()) {
        return null;
    }
    return array('user' => (string)$data['u'], 'raw' => $raw);
}

function csrf_for($raw, $secret)
{
    return hash_hmac('sha256', 'csrf|' . $raw, $secret);
}

function cookie_path()
{
    $script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/';
    $p = str_replace('\\', '/', dirname($script));
    return ($p === '' || $p === '.') ? '/' : $p;
}

function set_auth_cookie($value, $expires)
{
    setcookie(COOKIE_NAME, $value, array(
        'expires'  => $expires,
        'path'     => cookie_path(),
        'secure'   => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ));
}

function ensure_dir($dir)
{
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (is_dir($dir) && !is_file($dir . '/.htaccess')) {
        @file_put_contents(
            $dir . '/.htaccess',
            "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n"
        );
    }
    return is_dir($dir) && is_writable($dir);
}

function file_version()
{
    return is_file(GAMES_FILE) ? (string)sha1_file(GAMES_FILE) : '';
}

function read_json_body()
{
    $ct = strtolower(isset($_SERVER['CONTENT_TYPE']) ? (string)$_SERVER['CONTENT_TYPE'] : '');
    if (strpos($ct, 'application/json') === false) {
        fail(415, 'Expected a JSON request');
    }
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
    if ($raw === false || $raw === '') {
        fail(400, 'Empty request');
    }
    if (strlen($raw) > MAX_BODY) {
        fail(413, 'Request too large');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail(400, 'Invalid JSON');
    }
    return $data;
}

function require_auth(array $cfg, $configured)
{
    if (!$configured) {
        fail(503, 'Live saving is not configured yet (see config.php)');
    }
    $t = read_token($cfg['secret']);
    if (!$t || !hash_equals((string)$cfg['username'], $t['user'])) {
        fail(401, 'Not logged in');
    }
    return $t;
}

// ───────────── login rate limit (per IP) ─────────────

function attempts_path()
{
    return DATA_DIR . '/attempts.json';
}

function rl_load()
{
    $f = attempts_path();
    if (!is_file($f)) {
        return array();
    }
    $d = json_decode((string)@file_get_contents($f), true);
    return is_array($d) ? $d : array();
}

function rl_save(array $d)
{
    $now = time();
    foreach ($d as $k => $v) {
        $until = isset($v['until']) ? $v['until'] : 0;
        $last = isset($v['last']) ? $v['last'] : 0;
        if ($until < $now && $last < $now - LOCK_SECONDS) {
            unset($d[$k]);
        }
    }
    @file_put_contents(attempts_path(), json_encode($d), LOCK_EX);
}

function rl_key()
{
    return sha1(isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown');
}

function rl_locked_for()
{
    $d = rl_load();
    $k = rl_key();
    if (!empty($d[$k]['until']) && $d[$k]['until'] > time()) {
        return $d[$k]['until'] - time();
    }
    return 0;
}

function rl_fail()
{
    $d = rl_load();
    $k = rl_key();
    $now = time();
    $e = isset($d[$k]) ? $d[$k] : array('fails' => 0, 'until' => 0, 'last' => 0);
    if ($e['last'] < $now - LOCK_SECONDS) {
        $e['fails'] = 0;
    }
    $e['fails']++;
    $e['last'] = $now;
    if ($e['fails'] >= MAX_FAILS) {
        $e['until'] = $now + LOCK_SECONDS;
        $e['fails'] = 0;
    }
    $d[$k] = $e;
    rl_save($d);
}

function rl_clear()
{
    $d = rl_load();
    unset($d[rl_key()]);
    rl_save($d);
}

// ───────────── validation ─────────────

function clean_str($v, $max)
{
    if (is_int($v) || is_float($v)) {
        $v = (string)$v;
    }
    if (!is_string($v)) {
        return '';
    }
    $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v);
    if ($v === null) {
        return '';
    }
    $v = trim($v);
    return function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
}

function summary_for($score)
{
    if ($score <= 0) {
        return 'No user reviews';
    }
    if ($score >= 90) {
        return 'Overwhelmingly Positive';
    }
    if ($score >= 80) {
        return 'Very Positive';
    }
    if ($score >= 70) {
        return 'Mostly Positive';
    }
    if ($score >= 50) {
        return 'Mixed';
    }
    return 'Mostly Negative';
}

function normalize_game($g, $i, array &$errors)
{
    $n = $i + 1;
    if (!is_array($g)) {
        $errors[] = "Game #$n is not an object";
        return null;
    }

    $name = clean_str(isset($g['Name']) ? $g['Name'] : '', 200);
    if ($name === '') {
        $errors[] = "Game #$n: Name is required";
        return null;
    }
    $platform = clean_str(isset($g['Platform']) ? $g['Platform'] : '', 60);
    if ($platform === '') {
        $errors[] = "\"$name\": Platform is required";
        return null;
    }

    $region = strtoupper(clean_str(isset($g['Region']) ? $g['Region'] : 'WW', 10));
    if ($region === '') {
        $region = 'WW';
    }
    if (!preg_match('/^[A-Z]{2,6}$/', $region)) {
        $errors[] = "\"$name\": invalid region \"$region\"";
        return null;
    }

    $yearRaw = isset($g['Release Year']) ? $g['Release Year'] : 0;
    if ($yearRaw === '' || $yearRaw === null) {
        $yearRaw = 0;
    }
    if (!is_numeric($yearRaw)) {
        $errors[] = "\"$name\": Release Year must be a number";
        return null;
    }
    $year = (int)$yearRaw;
    if ($year !== 0 && ($year < 1950 || $year > (int)date('Y') + 3)) {
        $errors[] = "\"$name\": Release Year $year is out of range";
        return null;
    }

    $scoreRaw = isset($g['Score']) ? $g['Score'] : 0;
    if ($scoreRaw === '' || $scoreRaw === null) {
        $scoreRaw = 0;
    }
    if (!is_numeric($scoreRaw)) {
        $errors[] = "\"$name\": Score must be a number";
        return null;
    }
    $score = (float)$scoreRaw;
    if ($score < 0 || $score > 100) {
        $errors[] = "\"$name\": Score must be between 0 and 100";
        return null;
    }
    $score = round($score, 2);
    if ($score == floor($score)) {
        $score = (int)$score;
    }

    $link = clean_str(isset($g['Link']) ? $g['Link'] : '', 500);
    if ($link !== '' && !(preg_match('#^https?://[^\s<>"\']+$#iu', $link) && parse_url($link, PHP_URL_HOST))) {
        $errors[] = "\"$name\": Link must start with http:// or https://";
        return null;
    }

    $out = array(
        'Name'           => $name,
        'Platform'       => $platform,
        'Region'         => $region,
        'Release Year'   => $year,
        'Score'          => $score,
        'Review Summary' => summary_for($score),
        'Developer'      => clean_str(isset($g['Developer']) ? $g['Developer'] : '', 200),
        'Link'           => $link,
        'ProductID'      => clean_str(isset($g['ProductID']) ? $g['ProductID'] : '', 40),
    );
    $note = clean_str(isset($g['Note']) ? $g['Note'] : '', 500);
    if ($note !== '') {
        $out['Note'] = $note;
    }
    return $out;
}

// ───────────── routes ─────────────

$action = isset($_GET['action']) ? (string)$_GET['action'] : 'status';
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

if ($action === 'status') {
    if ($method !== 'GET') {
        fail(405, 'Use GET');
    }
    $t = $configured ? read_token($cfg['secret']) : null;
    $ok = $t && hash_equals((string)$cfg['username'], $t['user']);
    respond(200, array(
        'ok'         => true,
        'server'     => 'games-library',
        'configured' => $configured,
        'loggedIn'   => (bool)$ok,
        'user'       => $ok ? $t['user'] : null,
        'csrf'       => $ok ? csrf_for($t['raw'], $cfg['secret']) : null,
        'version'    => file_version(),
    ));
}

if ($action === 'login') {
    if ($method !== 'POST') {
        fail(405, 'Use POST');
    }
    if (!$configured) {
        fail(503, 'Live saving is not configured yet (see config.php)');
    }
    if ($cfg['require_https'] && !is_https() && !is_local()) {
        fail(403, 'Open the site over https:// to log in (a password over plain http is not safe)');
    }
    if (!ensure_dir(DATA_DIR)) {
        fail(500, 'The server cannot write to the data/ folder');
    }
    $wait = rl_locked_for();
    if ($wait > 0) {
        fail(429, 'Too many failed attempts. Try again in ' . (int)ceil($wait / 60) . ' min');
    }

    $body = read_json_body();
    $u = substr((string)(isset($body['username']) ? $body['username'] : ''), 0, 100);
    $p = substr((string)(isset($body['password']) ? $body['password'] : ''), 0, 200);

    $okUser = hash_equals((string)$cfg['username'], $u);
    $okPass = password_verify($p, (string)$cfg['password_hash']);
    if (!($okUser && $okPass)) {
        rl_fail();
        usleep(500000);
        fail(401, 'Wrong username or password');
    }

    rl_clear();
    $exp = time() + max(1, (int)$cfg['session_days']) * 86400;
    $token = make_token($u, $exp, $cfg['secret']);
    set_auth_cookie($token, $exp);
    respond(200, array(
        'ok'      => true,
        'user'    => $u,
        'csrf'    => csrf_for($token, $cfg['secret']),
        'version' => file_version(),
    ));
}

if ($action === 'logout') {
    if ($method !== 'POST') {
        fail(405, 'Use POST');
    }
    set_auth_cookie('', time() - 3600);
    respond(200, array('ok' => true));
}

if ($action === 'save') {
    if ($method !== 'POST') {
        fail(405, 'Use POST');
    }
    $t = require_auth($cfg, $configured);
    $csrf = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? (string)$_SERVER['HTTP_X_CSRF_TOKEN'] : '';
    if (!hash_equals(csrf_for($t['raw'], $cfg['secret']), $csrf)) {
        fail(403, 'Security token rejected. Reload the page and log in again');
    }

    $body = read_json_body();
    $games = isset($body['games']) ? $body['games'] : null;
    $clientVersion = isset($body['version']) ? (string)$body['version'] : '';
    if (!is_array($games) || count($games) === 0) {
        fail(422, 'There are no games to save');
    }
    if (count($games) > MAX_GAMES) {
        fail(422, 'Too many games in one save');
    }

    $errors = array();
    $out = array();
    foreach (array_values($games) as $i => $g) {
        $row = normalize_game($g, $i, $errors);
        if ($row !== null) {
            $out[] = $row;
        }
        if (count($errors) >= 5) {
            break;
        }
    }
    if ($errors) {
        fail(422, implode('; ', $errors));
    }

    if (!ensure_dir(DATA_DIR) || !ensure_dir(BACKUP_DIR)) {
        fail(500, 'The server cannot write to the data/ or backups/ folder');
    }
    $lock = fopen(DATA_DIR . '/save.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) {
        fail(500, 'Could not lock the library file');
    }

    if ($clientVersion !== file_version()) {
        fail(409, 'The library changed on the server since you loaded it. Load it again, then save');
    }

    // Safety net: never silently drop a big part of the library
    $oldCount = 0;
    if (is_file(GAMES_FILE)) {
        $old = json_decode((string)file_get_contents(GAMES_FILE), true);
        $oldCount = is_array($old) ? count($old) : 0;
    }
    if ($oldCount > 0 && count($out) < floor($oldCount * 0.9)) {
        fail(422, 'Refusing to save: this would remove ' . ($oldCount - count($out)) . ' games');
    }

    $json = json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        fail(500, 'Could not encode the library');
    }

    $backupName = null;
    if (is_file(GAMES_FILE)) {
        $backupName = 'games-' . gmdate('Ymd-His') . '.json';
        if (!@copy(GAMES_FILE, BACKUP_DIR . '/' . $backupName)) {
            fail(500, 'Could not write a backup, nothing was saved');
        }
    }

    $tmp = GAMES_FILE . '.tmp' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $json, LOCK_EX) !== strlen($json)) {
        @unlink($tmp);
        fail(500, 'Could not write games.json (check folder permissions)');
    }
    $check = json_decode((string)file_get_contents($tmp), true);
    if (!is_array($check) || count($check) !== count($out)) {
        @unlink($tmp);
        fail(500, 'Written file failed verification, nothing was saved');
    }
    @chmod($tmp, 0644);
    if (!@rename($tmp, GAMES_FILE)) {
        @unlink($tmp);
        fail(500, 'Could not replace games.json');
    }
    clearstatcache();

    // Keep only the newest backups
    $files = glob(BACKUP_DIR . '/games-*.json');
    if (is_array($files)) {
        sort($files);
        $keep = max(1, (int)$cfg['keep_backups']);
        while (count($files) > $keep) {
            @unlink(array_shift($files));
        }
    }

    respond(200, array(
        'ok'      => true,
        'count'   => count($out),
        'version' => file_version(),
        'backup'  => $backupName,
    ));
}

fail(404, 'Unknown action');
