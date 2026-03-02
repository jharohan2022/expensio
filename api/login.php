<?php
require_once 'config.php';

$data     = json_decode(file_get_contents('php://input'), true);
$email    = trim($data['email']    ?? '');
$password = $data['password']      ?? '';
$role     = $data['role']          ?? 'employee';

if (!$email || !$password) { echo json_encode(['error' => 'Email and password required']); exit; }

$db = getDB();

$stmt = $db->prepare(
    'SELECT id, name, email, password_hash, role, onboarding_complete
     FROM users WHERE email = ? AND role = ? AND is_active = TRUE'
);
$stmt->bind_param('ss', $email, $role);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user || !password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email/password or wrong role selected']);
    exit;
}

// Update last login
$uid = $user['id'];
$db->query("UPDATE users SET last_login_at = NOW() WHERE id = $uid");

// Create session token (24 hour)
$token = bin2hex(random_bytes(64));
$ip    = $_SERVER['REMOTE_ADDR'];
$stmt  = $db->prepare(
    "INSERT INTO user_sessions (user_id, session_token, ip_address, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))"
);
$stmt->bind_param('iss', $uid, $token, $ip);
$stmt->execute();
$stmt->close();
$db->close();

echo json_encode([
    'success' => true,
    'token'   => $token,
    'user'    => [
        'id'                 => $user['id'],
        'name'               => $user['name'],
        'email'              => $user['email'],
        'role'               => $user['role'],
        'onboardingComplete' => (bool)$user['onboarding_complete'],
    ]
]);
?>
