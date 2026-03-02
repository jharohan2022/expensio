<?php
// api/auth.php — Token verification helper
function getAuthUser($db) {
    $headers = getallheaders();
    $auth    = $headers['Authorization'] ?? '';
    $token   = str_replace('Bearer ', '', $auth);
    if (!$token) return null;

    $stmt = $db->prepare(
        "SELECT u.id, u.name, u.email, u.role
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.session_token = ?
           AND s.is_valid = TRUE
           AND s.expires_at > NOW()
           AND u.is_active = TRUE"
    );
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $user;
}
?>
