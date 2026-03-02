<?php
// api/support.php — Submit a support message
require_once 'config.php';
require_once 'auth.php';

$db     = getDB();
$user   = getAuthUser($db);
$method = $_SERVER['REQUEST_METHOD'];

// Support can be used by logged-in or anonymous users
$uid   = $user ? $user['id'] : null;
$email = $user ? $user['email'] : null;

if ($method === 'POST') {
    $d        = json_decode(file_get_contents('php://input'), true);
    $subject  = trim($d['subject']  ?? '');
    $category = $d['category']      ?? 'General Inquiry';
    $message  = trim($d['message']  ?? '');

    if (!$subject || !$message) {
        echo json_encode(['error' => 'Subject and message are required']);
        exit;
    }

    $stmt = $db->prepare(
        'INSERT INTO support_messages (user_id, subject, category, message, sender_email) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('issss', $uid, $subject, $category, $message, $email);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'id' => $stmt->insert_id]);
    } else {
        echo json_encode(['error' => 'Failed to send message']);
    }
    $stmt->close();

} elseif ($method === 'GET' && $user && $user['role'] === 'manager') {
    // Managers can view all support messages
    $stmt = $db->prepare(
        'SELECT sm.*, u.name AS user_name FROM support_messages sm
         LEFT JOIN users u ON u.id = sm.user_id
         ORDER BY sm.created_at DESC LIMIT 50'
    );
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    $stmt->close();

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$db->close();
?>
