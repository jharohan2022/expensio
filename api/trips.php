<?php
require_once 'config.php';
require_once 'auth.php';

$db   = getDB();
$user = getAuthUser($db);
$method = $_SERVER['REQUEST_METHOD'];

if (!$user) { http_response_code(401); echo json_encode(['error' => 'Not logged in']); exit; }

if ($method === 'GET') {
    $stmt = $db->prepare('SELECT * FROM trips WHERE user_id = ? ORDER BY start_date ASC');
    $stmt->bind_param('i', $user['id']);
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));

} elseif ($method === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true);
    $stmt = $db->prepare('INSERT INTO trips (user_id, destination, purpose, start_date, end_date, budget) VALUES (?, ?, ?, ?, ?, ?)');
    $dest = $d['destination'] ?? ''; $purp = $d['purpose'] ?? '';
    $s = $d['startDate'] ?? ''; $e = $d['endDate'] ?? '';
    $b = floatval($d['budget'] ?? 0);
    $stmt->bind_param('issssd', $user['id'], $dest, $purp, $s, $e, $b);
    $stmt->execute();
    echo json_encode(['success' => true, 'id' => $stmt->insert_id]);

} elseif ($method === 'DELETE') {
    $id = intval($_GET['id'] ?? 0);
    $stmt = $db->prepare('DELETE FROM trips WHERE id = ? AND user_id = ?');
    $stmt->bind_param('ii', $id, $user['id']);
    $stmt->execute();
    echo json_encode(['success' => true]);
}
$db->close();
?>
