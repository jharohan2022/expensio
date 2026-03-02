<?php
require_once 'config.php';

$data     = json_decode(file_get_contents('php://input'), true);
$name     = trim($data['name']     ?? '');
$email    = trim($data['email']    ?? '');
$password = $data['password']      ?? '';
$role     = $data['role']          ?? 'employee';
$code     = trim($data['mgrCode']  ?? '');

// Validation
if (!$name || !$email || !$password) { echo json_encode(['error' => 'All fields required']); exit; }
if (strlen($password) < 6)           { echo json_encode(['error' => 'Password must be at least 6 characters']); exit; }
if (!in_array($role, ['employee','manager'])) $role = 'employee';

// Manager code check
if ($role === 'manager' && $code !== MGR_SECRET_CODE) {
    echo json_encode(['error' => 'Invalid manager access code']); exit;
}

$db = getDB();

// Check duplicate
$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) { echo json_encode(['error' => 'Email already registered']); exit; }
$stmt->close();

$hash = password_hash($password, PASSWORD_BCRYPT);
$onboard = ($role === 'manager') ? 1 : 0; // managers skip onboarding

$stmt = $db->prepare('INSERT INTO users (name, email, password_hash, role, onboarding_complete) VALUES (?, ?, ?, ?, ?)');
$stmt->bind_param('ssssi', $name, $email, $hash, $role, $onboard);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'userId' => $stmt->insert_id, 'role' => $role]);
} else {
    echo json_encode(['error' => 'Signup failed, try again']);
}
$stmt->close();
$db->close();
?>
