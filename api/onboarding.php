<?php
// api/onboarding.php — Save employee profile after onboarding
require_once 'config.php';
require_once 'auth.php';

$db   = getDB();
$user = getAuthUser($db);

if (!$user) { http_response_code(401); echo json_encode(['error' => 'Not logged in']); exit; }
if ($user['role'] !== 'employee') { echo json_encode(['error' => 'Only employees complete onboarding']); exit; }

$d = json_decode(file_get_contents('php://input'), true);

$phone     = $d['phone']      ?? '';
$dob       = $d['dob']        ?? null;
$gender    = $d['gender']     ?? null;
$company   = $d['company']    ?? '';
$dept      = $d['department'] ?? null;
$jobTitle  = $d['jobTitle']   ?? '';
$empId     = $d['employeeID'] ?? '';
$address   = $d['address']    ?? '';
$city      = $d['city']       ?? '';
$state     = $d['state']      ?? '';
$postal    = $d['postal']     ?? '';
$country   = $d['country']    ?? '';
$currency  = $d['currency']   ?? 'EUR (€)';
$threshold = floatval($d['threshold'] ?? 500);
$notif     = isset($d['emailNotif']) ? (bool)$d['emailNotif'] : true;
$uid       = $user['id'];

$stmt = $db->prepare(
    "UPDATE users SET
        phone = ?, date_of_birth = ?, gender = ?,
        company = ?, department = ?, job_title = ?, employee_id = ?,
        address = ?, city = ?, state = ?, postal_code = ?, country = ?,
        default_currency = ?, approval_threshold = ?, email_notifications = ?,
        onboarding_complete = TRUE, updated_at = NOW()
     WHERE id = ?"
);

$stmt->bind_param(
    'sssssssssssssdi i',
    $phone, $dob, $gender,
    $company, $dept, $jobTitle, $empId,
    $address, $city, $state, $postal, $country,
    $currency, $threshold, $notif,
    $uid
);

if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['error' => 'Failed to save profile: ' . $stmt->error]);
}

$stmt->close();
$db->close();
?>
