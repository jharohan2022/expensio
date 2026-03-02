<?php
// api/profile.php — Get and update user profile
require_once 'config.php';
require_once 'auth.php';

$db     = getDB();
$user   = getAuthUser($db);
$method = $_SERVER['REQUEST_METHOD'];

if (!$user) { http_response_code(401); echo json_encode(['error' => 'Not logged in']); exit; }

if ($method === 'GET') {
    $stmt = $db->prepare(
        "SELECT id, name, email, role, phone, date_of_birth, gender,
                company, department, job_title, employee_id,
                address, city, state, postal_code, country,
                default_currency, approval_threshold, email_notifications,
                onboarding_complete, created_at, last_login_at
         FROM users WHERE id = ?"
    );
    $stmt->bind_param('i', $user['id']);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();
    echo json_encode($profile);

} elseif ($method === 'POST') {
    $d        = json_decode(file_get_contents('php://input'), true);
    $name     = trim($d['name']       ?? '');
    $phone    = $d['phone']           ?? '';
    $jobTitle = $d['jobTitle']        ?? '';
    $company  = $d['company']         ?? '';
    $dept     = $d['department']      ?? '';
    $empId    = $d['employeeID']      ?? '';
    $currency = $d['currency']        ?? 'EUR (€)';
    $thresh   = floatval($d['threshold'] ?? 500);
    $uid      = $user['id'];

    $fields = [];
    $params = [];
    $types  = '';

    if ($name)     { $fields[] = 'name = ?';                $params[] = $name;     $types .= 's'; }
    if ($phone)    { $fields[] = 'phone = ?';               $params[] = $phone;    $types .= 's'; }
    if ($jobTitle) { $fields[] = 'job_title = ?';           $params[] = $jobTitle; $types .= 's'; }
    if ($company)  { $fields[] = 'company = ?';             $params[] = $company;  $types .= 's'; }
    if ($dept)     { $fields[] = 'department = ?';          $params[] = $dept;     $types .= 's'; }
    if ($empId)    { $fields[] = 'employee_id = ?';         $params[] = $empId;    $types .= 's'; }
                     $fields[] = 'default_currency = ?';    $params[] = $currency; $types .= 's';
                     $fields[] = 'approval_threshold = ?';  $params[] = $thresh;   $types .= 'd';
                     $fields[] = 'updated_at = NOW()';

    $params[] = $uid;
    $types   .= 'i';

    $sql  = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Failed to update profile: ' . $stmt->error]);
    }
    $stmt->close();
}

$db->close();
?>
