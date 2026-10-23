<?php
// hash-password.php — run ONCE, paste the result into config.php, then DELETE this file.
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

$result = '';
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = trim((string)(isset($_POST['username']) ? $_POST['username'] : ''));
    $pass = (string)(isset($_POST['password']) ? $_POST['password'] : '');
    if ($user === '' || strlen($user) > 100) {
        $error = 'Enter a username.';
    } elseif (strlen($pass) < 10) {
        $error = 'Use a password of at least 10 characters.';
    } else {
        $result = "<?php\nreturn [\n"
            . "    'username'      => " . var_export($user, true) . ",\n"
            . "    'password_hash' => " . var_export(password_hash($pass, PASSWORD_DEFAULT), true) . ",\n"
            . "    'secret'        => " . var_export(bin2hex(random_bytes(32)), true) . ",\n"
            . "    'require_https' => true,\n"
            . "    'session_days'  => 30,\n"
            . "    'keep_backups'  => 10,\n"
            . "];\n";
    }
}
function h($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Create config.php</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 520px; margin: 24px auto; padding: 0 16px; line-height: 1.45; }
  input, textarea, button { width: 100%; box-sizing: border-box; font-size: 16px; padding: 10px; margin: 6px 0 14px; }
  textarea { height: 220px; font-family: monospace; font-size: 13px; }
  .err { color: #b00020; }
  .warn { background: #fff3cd; padding: 10px; border-radius: 6px; }
</style>
</head>
<body>
<h1>Create config.php</h1>
<p class="warn">Use this page over <strong>https</strong>. Delete <code>hash-password.php</code> from the server when you are done.</p>
<?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
<?php if ($result): ?>
  <p>Copy everything below into <code>config.php</code> (replace its contents), upload it, then delete this file.</p>
  <textarea readonly onclick="this.select()"><?= h($result) ?></textarea>
<?php else: ?>
  <form method="post">
    <label>Username<input name="username" value="admin" autocomplete="username"></label>
    <label>Password (10+ characters)<input name="password" type="password" autocomplete="new-password"></label>
    <button type="submit">Generate</button>
  </form>
<?php endif; ?>
</body>
</html>
