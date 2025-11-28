<?php
/**
 * Preview PDF generator — outputs a test PDF using the preview design
 * Usage: http://localhost:8000/preview_grade_report_pdf.php
 */

// Allow this script to include helper files that check for direct access.
if (!defined('PREVENT_DIRECT_ACCESS')) {
    define('PREVENT_DIRECT_ACCESS', true);
}

// Ensure Composer autoloader is available (mPDF, etc.). Composer was installed in app/.
$autoload = __DIR__ . '/app/vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}

require_once __DIR__ . '/app/helpers/pdf_helper.php';

// Sample data (same as preview)
$student = [
    'student_id' => 'MCC2023-00805',
    'first_name' => 'SORIANO, NIK STEPHEN',
    'last_name' => 'A.',
    'email' => 'ana.ortega@mcc.edu.ph',
    'year_level' => 'FIRST YEAR - 1S'
];

$grades = [
    ['course_code'=>'ENG 001','course_name'=>'GRAMMAR AND COMPOSITION 1','credits'=>3,'midterm_grade'=>'1.75','final_grade'=>'1.75','final_grade_num'=>85.00,'remarks'=>'PASSED'],
    ['course_code'=>'FIL 111','course_name'=>'KONTEKSTWALISADONG KOMUNIKASYON SA PILIPINO','credits'=>3,'midterm_grade'=>'1.75','final_grade'=>'1.75','final_grade_num'=>85.00,'remarks'=>'PASSED'],
    ['course_code'=>'ITC 111','course_name'=>'INTRO TO COMPUTING','credits'=>3,'midterm_grade'=>'1.75','final_grade'=>'1.75','final_grade_num'=>85.00,'remarks'=>'PASSED'],
    ['course_code'=>'ITC 112','course_name'=>'COMPUTER PROGRAMMING 1','credits'=>3,'midterm_grade'=>'1.75','final_grade'=>'1.75','final_grade_num'=>85.00,'remarks'=>'PASSED'],
    ['course_code'=>'LIT 111','course_name'=>'PHILIPPINE LITERATURE','credits'=>3,'midterm_grade'=>'1.75','final_grade'=>'1.75','final_grade_num'=>85.00,'remarks'=>'PASSED'],
    ['course_code'=>'SOC SCI 111','course_name'=>'PAG-UNAWA SA SARILI','credits'=>3,'midterm_grade'=>'1.75','final_grade'=>'1.75','final_grade_num'=>85.00,'remarks'=>'PASSED']
];

$period = ['school_year' => '2023-2024','semester'=>'First Semester'];

// helper to embed image as data URI (mPDF handles data URIs well)
function embed_image_datauri($path)
{
    $full = __DIR__ . DIRECTORY_SEPARATOR . ltrim($path, '/\\');
    if (!file_exists($full)) return '';
    $type = mime_content_type($full) ?: 'image/png';
    $data = base64_encode(file_get_contents($full));
    return 'data:' . $type . ';base64,' . $data;
}

$logo = embed_image_datauri('public/EduTrack_Logo.png');
$seal = embed_image_datauri('public/MinSU_logo.png');

// Calculate GWA
$totalUnits = 0; $totalGradePoints = 0;
foreach ($grades as $g) {
    $fg = floatval($g['final_grade_num'] ?? 0);
    if ($fg > 0) {
        $units = floatval($g['credits'] ?? 3);
        $totalUnits += $units;
        $totalGradePoints += ($fg * $units);
    }
}
$gwaNumeric = $totalUnits > 0 ? $totalGradePoints / $totalUnits : 0;
// transmute-like conversion
if ($gwaNumeric >= 97) $gwaLetter = "1.00";
elseif ($gwaNumeric >= 94) $gwaLetter = "1.25";
elseif ($gwaNumeric >= 91) $gwaLetter = "1.50";
elseif ($gwaNumeric >= 88) $gwaLetter = "1.75";
elseif ($gwaNumeric >= 85) $gwaLetter = "2.00";
elseif ($gwaNumeric >= 82) $gwaLetter = "2.25";
elseif ($gwaNumeric >= 79) $gwaLetter = "2.50";
elseif ($gwaNumeric >= 76) $gwaLetter = "2.75";
elseif ($gwaNumeric >= 75) $gwaLetter = "3.00";
else $gwaLetter = "5.00";

// Build HTML (matching preview design exactly)
$html = '<!doctype html><html><head><meta charset="utf-8"><style>';
$html .= 'body{font-family: "Times New Roman", Times, serif; font-size:12px; color:#222;}';
$html .= '.page{width:210mm;min-height:297mm;}';
$html .= '.header{display:flex;justify-content:space-between;align-items:center;flex-wrap:nowrap;padding-bottom:12px;margin-bottom:10px;border-bottom:2px solid #003399;}';
$html .= '.logo{width:160px;flex-shrink:0;display:block;} .logo img{display:block;height:auto;max-height:50px;width:auto;}';
$html .= '.seal{width:70px;flex-shrink:0;display:block;} .seal img{display:block;height:auto;max-height:60px;width:auto;}';
$html .= '.report-header{margin-bottom:10px;border-bottom:2px solid #003399;}';
$html .= '.report-title{text-align:center;font-size:20px;font-weight:bold;color:#333;text-transform:uppercase;}';
$html .= '.report-period{text-align:center;font-size:12px;color:#666;margin-bottom:10px;}';
    $html .= '.student-info{margin-bottom:20px;font-size:13px;}';
    $html .= '.info-row{display:flex;justify-content:space-between;margin-bottom:6px;align-items:flex-start;font-size:13px;}';
    $html .= '.info-label{font-weight:bold;color:#333;min-width:150px;}';
    $html .= '.info-value{flex:1;color:#555;}';
    $html .= '.student-info-table{width:100%;margin-bottom:20px;border-collapse:collapse;font-size:13px;}';
    $html .= '.student-info-table td{padding:6px 8px;vertical-align:top;}';
    $html .= '.student-info-table .col{width:50%;}';
    $html .= '.info-line{margin-bottom:6px;}';
    $html .= '.info-label{font-weight:bold;color:#333;margin-right:6px;display:inline-block;width:120px;}';
    $html .= '.info-value{color:#555;display:inline-block;}';
    $html .= '.grades-table{width:100%;margin-bottom:20px;font-size:12px;border-collapse:collapse; border-top:2px solid #003399; border-bottom:2px solid #003399;}';
    $html .= '.grades-table thead{color:#003399;}';
    $html .= '.grades-table th{padding:12px 10px;text-align:center;font-weight:bold;border-bottom:2px solid #003399;text-transform:uppercase;letter-spacing:0.5px;color:#0b3b73;}';
    $html .= '.grades-table td{padding:12px 10px;vertical-align:middle;}';
    $html .= '.grades-table td:first-child,.grades-table th:first-child{text-align:left;padding-left:14px;}';
    $html .= '.grades-table td:nth-child(2),.grades-table th:nth-child(2){text-align:left;padding-left:20px;}';
    $html .= '.grades-table td:nth-child(3),.grades-table th:nth-child(3){text-align:center;width:10%;}';
    $html .= '.grades-table td:nth-child(4),.grades-table th:nth-child(4),.grades-table td:nth-child(5),.grades-table th:nth-child(5){text-align:center;width:14%;}';
    $html .= '.grades-table td:nth-child(6),.grades-table th:nth-child(6){text-align:right;padding-right:14px;width:14%;}';
$html .= '.grade-code{font-weight:bold;color:#003399;}';
$html .= '.remarks{font-weight:bold;}';
$html .= '.remarks.passed{color:#28a745;}';
$html .= '.remarks.failed{color:#dc3545;}';
        $html .= '.summary{padding:15px;font-size:13px;line-height:0.7;font-style:italic;}';
        $html .= '.summary-row{margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;}';
        $html .= '.summary-label{font-weight:bold;color:#003399;font-style:italic;margin-right:6px;}';
        $html .= '.summary-value{font-weight:bold;color:#333;font-style:normal;}';
$html .= '.footer{text-align:center;font-size:10px;color:#999;border-top:2px dashed #999;padding-top:10px;margin-top:20px;}';
$html .= '</style></head><body>';

// Function to render one report block
$renderReport = function() use($student,$grades,$period,$logo,$seal,$totalUnits,$gwaLetter,$status){
    $out = '<div class="page">';
    
    // Header with logo and seal (table layout for mPDF compatibility)
    // Use explicit valign and inline-block images so mPDF centers them vertically.
    $out .= '<table width="100%" style="border-collapse: collapse;  margin-bottom: 10px; border-bottom: 2px solid #003399;">';
    // give the row an explicit height to make vertical centering predictable in mPDF
    $out .= '<tr style="height:72px;">';
    // left cell: use HTML valign attribute for compatibility
    $out .= '<td width="60%" valign="middle" style="padding: 0;">';
    // make the image inline-block and vertically aligned middle
    $out .= ($logo ? '<img src="' . $logo . '" alt="EduTrack Logo" style="display:inline-block; vertical-align:middle; max-height:50px; width:auto;" />' : '');
    $out .= '</td>';
    $out .= '<td width="40%" valign="middle" style="padding: 0; text-align: right;">';
    $out .= ($seal ? '<img src="' . $seal . '" alt="MinSU Seal" style="display:inline-block; vertical-align:middle; max-height:60px; width:auto;" />' : '');
    $out .= '</td>';
    $out .= '</tr>';
    $out .= '</table>';

    // Report title and period
    $out .= '<div class="report-header">';
    $out .= '<div class="report-title">STUDENT GRADE REPORT</div>';
    $out .= '<div class="report-period">' . htmlspecialchars($period['semester']) . ', AY ' . htmlspecialchars($period['school_year']) . '</div>';
    $out .= '</div>';

    // Student information (two-column layout: left and right columns with stacked label/value lines)
    $out .= '<table class="student-info-table">';
    $out .= '<tr>';
    // Left column (ID, Full Name, Year & Section)
    $out .= '<td class="col" style="padding-right:20px;">';
    $out .= '<div class="info-line"><span class="info-label">ID Number: </span><span class="info-value">' . htmlspecialchars($student['student_id']) . '</span></div>';
    $out .= '<div class="info-line"><span class="info-label">Full Name: </span><span class="info-value">' . htmlspecialchars($student['first_name'] . (isset($student['last_name']) ? ' ' . $student['last_name'] : '')) . '</span></div>';
    $out .= '<div class="info-line"><span class="info-label">Year & Section: </span><span class="info-value">' . htmlspecialchars($student['year_level']) . '</span></div>';
    $out .= '</td>';
    // Right column (Email, Report Generated)
    $out .= '<td class="col" style="padding-left:20px;">';
    $out .= '<div class="info-line" style="text-align:right;"><span class="info-label">Email: </span><span class="info-value">' . htmlspecialchars($student['email']) . '</span></div>';
    $out .= '<div class="info-line" style="text-align:right;"><span class="info-label">Report Generated: </span><span class="info-value">' . date('F d, Y H:i A') . '</span></div>';
    $out .= '</td>';
    $out .= '</tr>';
    $out .= '</table>';

    // Grades table
    $out .= '<table class="grades-table"><thead><tr>';
    $out .= '<th style="width:12%">CODE</th>';
    $out .= '<th style="width:48%">COURSE NAME</th>';
    $out .= '<th style="width:8%">UNITS</th>';
    $out .= '<th style="width:10%">MIDTERM</th>';
    $out .= '<th style="width:10%">FINAL</th>';
    $out .= '<th style="width:12%">REMARKS</th>';
    $out .= '</tr></thead><tbody>';
    
    foreach($grades as $g){
        $out .= '<tr>';
        $out .= '<td><span class="grade-code">' . htmlspecialchars($g['course_code']) . '</span></td>';
        $out .= '<td>' . htmlspecialchars(strtoupper($g['course_name'])) . '</td>';
        $out .= '<td>' . htmlspecialchars($g['credits']) . '</td>';
        $out .= '<td>' . htmlspecialchars($g['midterm_grade']) . '</td>';
        $out .= '<td>' . htmlspecialchars($g['final_grade']) . '</td>';
        $remarkClass = strtolower($g['remarks']) === 'passed' ? 'passed' : 'failed';
        $out .= '<td><span class="remarks ' . $remarkClass . '">' . htmlspecialchars($g['remarks']) . '</span></td>';
        $out .= '</tr>';
    }
    $out .= '</tbody></table>';

    // Summary section
    $out .= '<div class="summary">';
    $out .= '<div class="summary-row">';
    $out .= '<span class="summary-label">Total Units: </span>';
    $out .= '<span class="summary-value">' . number_format($totalUnits, 2) . '</span>';
    $out .= '</div>';
    $out .= '<div class="summary-row">';
    $out .= '<span class="summary-label">General Weighted Average (GWA): </span>';
    $out .= '<span class="summary-value">' . htmlspecialchars($gwaLetter) . '</span>';
    $out .= '</div>';
    $out .= '<div class="summary-row">';
    $out .= '<span class="summary-label">Status: </span>';
    $out .= '<span class="summary-value">' . htmlspecialchars($status ?? 'Very Good Performance') . '</span>';
    $out .= '</div>';
    $out .= '</div>';

    // Footer
    $out .= '<div class="footer">';
    $out .= 'This is a computer-generated document from EduTrack. No signature required.<br>';
    $out .= '© ' . date('Y') . ' Mindoro State University - Calapan City Campus. All rights reserved.';
    $out .= '</div>';

    $out .= '</div>'; // .page
    return $out;
};

// Build HTML with two copies stacked
$html .= $renderReport();

$html .= '</body></html>';

try {
    $pdf = generate_pdf_from_html($html, 'Grade_Report_Test', ['format' => 'A4']);
    // Clear any output buffers that may have been started to avoid sending
    // stray bytes before the PDF binary (which breaks PDF viewers).
    while (ob_get_level()) {
        ob_end_clean();
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="Grade_Report_Test.pdf"');
    header('Cache-Control: public, must-revalidate, max-age=0');
    header('Pragma: public');
    header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');
    echo $pdf;
    exit;
} catch (Exception $e) {
    // Log exception for debugging
    $logDir = __DIR__ . '/runtime';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logFile = $logDir . '/preview-debug.log';
    $msg = '[' . date('Y-m-d H:i:s') . '] ' . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n\n";
    @file_put_contents($logFile, $msg, FILE_APPEND | LOCK_EX);

    header('Content-Type: text/plain');
    echo "PDF generation failed: " . $e->getMessage();
    exit(1);
}
