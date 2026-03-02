<?php
require_once 'config.php';
require_once 'auth.php';

$db     = getDB();
$user   = getAuthUser($db);
$method = $_SERVER['REQUEST_METHOD'];

if (!$user) { http_response_code(401); echo json_encode(['error' => 'Not logged in']); exit; }

if ($method === 'GET') {
    // Employees see their own; managers see all
    if ($user['role'] === 'manager') {
        $stmt = $db->prepare(
            'SELECT e.*, u.name AS employee_name, u.email AS employee_email
             FROM expenses e JOIN users u ON u.id = e.user_id
             ORDER BY e.expense_date DESC'
        );
        $stmt->execute();
    } else {
        $stmt = $db->prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC');
        $stmt->bind_param('i', $user['id']);
        $stmt->execute();
    }
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));

} elseif ($method === 'POST') {
    $data     = json_decode(file_get_contents('php://input'), true);
    $subject  = $data['subject']  ?? '';
    $category = $data['category'] ?? 'Other';
    $amount   = floatval($data['amount'] ?? 0);
    $date     = $data['date']     ?? '';
    $receipt  = $data['receipt']  ?? null; // base64 data URL

    if (!$subject || !$amount || !$date) { echo json_encode(['error' => 'Missing required fields']); exit; }
    if (!$receipt) { echo json_encode(['error' => 'Receipt is required']); exit; }

    $stmt = $db->prepare(
        'INSERT INTO expenses (user_id, subject, category, amount, expense_date, receipt_data)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('issdss', $user['id'], $subject, $category, $amount, $date, $receipt);
    $stmt->execute();
    echo json_encode(['success' => true, 'id' => $stmt->insert_id]);

} elseif ($method === 'DELETE') {
    $id = intval($_GET['id'] ?? 0);
    $stmt = $db->prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?');
    $stmt->bind_param('ii', $id, $user['id']);
    $stmt->execute();
    echo json_encode(['success' => true]);

} elseif ($method === 'PATCH') {
    // Manager approves/rejects
    if ($user['role'] !== 'manager') { http_response_code(403); echo json_encode(['error' => 'Forbidden']); exit; }
    $id     = intval($_GET['id'] ?? 0);
    $action = $_GET['action'] ?? '';
    $reason = json_decode(file_get_contents('php://input'), true)['reason'] ?? '';
    $status = $action === 'approve' ? 'approved' : 'rejected';
    $mgr    = $user['name'];
    $stmt   = $db->prepare('UPDATE expenses SET status = ?, reject_reason = ?, action_by = ?, reviewed_at = NOW() WHERE id = ?');
    $stmt->bind_param('sssi', $status, $reason, $mgr, $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
}
$db->close();
?>
