<?php
// Settings for save.php (live saving).
// 1. Open hash-password.php in your browser (over https), choose a username and password.
// 2. Paste the generated values below, upload this file, then DELETE hash-password.php.
return [
    'username'      => 'admin',
    'password_hash' => '',     // from hash-password.php
    'secret'        => '',     // from hash-password.php (long random string)
    'require_https' => true,   // refuse to log in over plain http
    'session_days'  => 30,     // how long you stay logged in
    'keep_backups'  => 10,     // rolling copies kept in backups/
];
