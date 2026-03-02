<?php
// api/logout.php
require_once 'config.php';
$headers = getallheaders();
$token   = str_replace('Bearer ', '', $headers['Authorization'] ?? '');
if ($token) {
    $db   = getDB();
    $stmt = $db->prepare('UPDATE user_sessions SET is_valid = FALSE WHERE session_token = ?');
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $stmt->close();
    $db->close();
}
echo json_encode(['success' => true]);
?>
