<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Helper: pdf_helper.php
 * 
 * Provides reusable functions for generating PDF reports using mPDF library.
 * Supports student grade reports with customizable HTML templates.
 * 
 * mPDF features used:
 * - CSS stylesheets (inline and external via writeHTML)
 * - HTML to PDF conversion
 * - Multi-page documents
 * - Metadata and document properties
 */

use Mpdf\Mpdf;

/**
 * Convert image file to base64 data URI for reliable PDF embedding.
 * mPDF handles data URIs reliably across all configurations.
 * 
 * @param string $filePath Path to image relative to LavaLust root (e.g., 'public/EduTrack_Logo.png')
 * @return string Data URI (data:image/png;base64,...) or empty string if file not found
 */
function get_image_data_uri($filePath)
{
    $root = dirname(dirname(__DIR__));
    $full = $root . DIRECTORY_SEPARATOR . ltrim($filePath, '/\\');
    
    if (!file_exists($full)) {
        return '';
    }
    
    $type = mime_content_type($full) ?: 'image/png';
    $data = base64_encode(file_get_contents($full));
    return 'data:' . $type . ';base64,' . $data;
}

/**
 * Generate a PDF from HTML content and return the binary content.
 * 
 * @param string $html HTML content to render (can include inline CSS)
 * @param string $filename Output filename (without .pdf extension)
 * @param array $options mPDF configuration options (mode, format, margins, etc.)
 * @param bool $download If true, force download; if false, display in browser
 * @return string Binary PDF content
 * @throws Exception if mPDF is not available or generation fails
 */
function generate_pdf_from_html($html, $filename = 'document', $options = [], $download = false)
{
    // Check if mPDF is available
    if (!class_exists('Mpdf\Mpdf')) {
        throw new Exception('mPDF library not found. Please run `composer install` in the LavaLust app directory.');
    }

    try {
        // Default mPDF configuration
        $defaultConfig = [
            'mode' => 'utf-8',
            'format' => 'A4',
            'margin_left' => 15,
            'margin_right' => 15,
            'margin_top' => 15,
            'margin_bottom' => 15,
            'margin_header' => 9,
            'margin_footer' => 9,
            'tempDir' => sys_get_temp_dir(),
        ];

        // Merge with provided options
        $config = array_merge($defaultConfig, $options);

        // Initialize mPDF
        $mpdf = new Mpdf($config);

        // Set document properties
        $mpdf->SetCreator('EduTrack System');
        $mpdf->SetAuthor('EduTrack');
        $mpdf->SetTitle($filename);
        $mpdf->SetDefaultFont('Helvetica');

        // Write HTML to PDF (mPDF renders inline CSS automatically)
        $mpdf->WriteHTML($html);

        // Return PDF as binary string
        return $mpdf->Output('', 'S');

    } catch (Exception $e) {
        throw new Exception('PDF generation failed: ' . $e->getMessage());
    }
}

/**
 * Output PDF to browser (display inline or download)
 * 
 * @param string $pdfContent Binary PDF content from generate_pdf_from_html()
 * @param string $filename Filename for download (without .pdf)
 * @param bool $download If true, force download; if false, display in browser
 */
function output_pdf_to_browser($pdfContent, $filename = 'document', $download = false)
{
    // Clear output buffers FIRST to prevent corrupting the PDF
    while (ob_get_level()) {
        ob_end_clean();
    }

    header('Content-Type: application/pdf');
    header('Cache-Control: public, must-revalidate, max-age=0');
    header('Pragma: public');
    header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');
    
    if ($download) {
        header('Content-Disposition: attachment; filename="' . $filename . '.pdf"');
    } else {
        header('Content-Disposition: inline; filename="' . $filename . '.pdf"');
    }
    
    echo $pdfContent;
    exit;
}

/**
 * Build HTML for a student grade report using polished two-column template design
 * 
 * @param array $student Student data (student_id, first_name, last_name, email, year_level, etc.)
 * @param array $grades Array of grade records (course_code, course_name, credits, midterm_grade, final_grade, final_grade_num, remarks)
 * @param array $period Academic period data (school_year, semester, etc.)
 * @param string $template Template type: 'standard' (polished 2-column), 'simple' (legacy simple layout)
 * @return string HTML content ready for PDF generation
 */
function build_student_report_html($student, $grades = [], $period = [], $template = 'standard')
{
    if ($template === 'simple') {
        return build_student_report_html_simple($student, $grades, $period);
    }

    // Standard/polished template with two-column layout and mPDF-optimized styling
    $html = '<!doctype html><html><head><meta charset="utf-8"><style>';
    $html .= 'body{font-family: "Times New Roman", Times, serif; font-size:12px; color:#222;}';
    $html .= '.page{width:210mm;min-height:297mm;}';
    $html .= '.report-header{margin-bottom:10px;border-bottom:2px solid #003399;margin-top:10px;padding-bottom:10px;}';
    $html .= '.report-title{text-align:center;font-size:20px;font-weight:bold;color:#333;text-transform:uppercase;}';
    $html .= '.report-period{text-align:center;font-size:12px;color:#666;margin-bottom:10px;}';
    $html .= '.student-info-table{width:100%;margin-bottom:20px;border-collapse:collapse;font-size:13px;}';
    $html .= '.student-info-table td{padding:6px 8px;vertical-align:top;}';
    $html .= '.student-info-table .col{width:50%;}';
    $html .= '.info-line{margin-bottom:6px;}';
    $html .= '.info-label{font-weight:bold;color:#333;margin-right:6px;display:inline-block;width:120px;}';
    $html .= '.info-value{color:#555;display:inline-block;}';
    $html .= '.grades-table{width:100%;margin-bottom:20px;font-size:12px;border-collapse:collapse;border-top:2px solid #003399;border-bottom:2px solid #003399;}';
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
    $html .= '.summary{padding:15px;font-size:13px;line-height:1.3;font-style:italic;}';
    $html .= '.summary-row{margin-bottom:8px;}';
    $html .= '.summary-label{font-weight:bold;color:#003399;font-style:normal;margin-right:6px;}';
    $html .= '.summary-value{font-weight:bold;color:#333;font-style:italic;}';
    $html .= '.footer{text-align:center;font-size:10px;color:#999;border-top:2px dashed #999;padding-top:10px;margin-top:20px;}';
    $html .= '</style></head><body>';

    $html .= '<div class="page">';

    // Prepare header logos (use data URIs for reliable embedding)
    $logo = get_image_data_uri('public/EduTrack_Logo.png');
    $seal = get_image_data_uri('public/MinSU_logo.png');

    // Report header with title, period and logos (left logo, centered title, right seal)
    $html .= '<div class="report-header">';
    $html .= '<table style="width:100%;border-collapse:collapse;">';
    $html .= '<tr>';
    // Left logo
    $html .= '<td style="width:20%;vertical-align:middle;padding:0;">';
    if ($logo) {
        $html .= '<img src="' . $logo . '" alt="logo" style="max-height:60px;width:auto;display:inline-block;" />';
    }
    $html .= '</td>';


    // Right seal
    $html .= '<td style="width:20%;vertical-align:middle;padding:0;text-align:right;">';
    if ($seal) {
        $html .= '<img src="' . $seal . '" alt="seal" style="max-height:60px;width:auto;display:inline-block;" />';
    }
    $html .= '</td>';

    $html .= '</tr>';
    $html .= '</table>';
    $html .= '</div>';

    
    // Center title + period
    $html .= '<div class="report-header">';
    $html .= '<div class="report-title">STUDENT GRADE REPORT</div>';
    $html .= '<div class="report-period">' . htmlspecialchars($period['semester']) . ', AY ' . htmlspecialchars($period['school_year']) . '</div>';
    $html .= '</div>';

    // Student information (two-column layout)
    $html .= '<table class="student-info-table">';
    $html .= '<tr>';
    // Left column
    $html .= '<td class="col" style="padding-right:20px;">';
    $html .= '<div class="info-line"><span class="info-label">ID Number: </span><span class="info-value">' . htmlspecialchars($student['student_id'] ?? 'N/A') . '</span></div>';
    $fullName = trim(($student['first_name'] ?? '') . (isset($student['last_name']) && $student['last_name'] ? ' ' . $student['last_name'] : ''));
    $html .= '<div class="info-line"><span class="info-label">Full Name: </span><span class="info-value">' . htmlspecialchars($fullName ?: 'N/A') . '</span></div>';
    $html .= '<div class="info-line"><span class="info-label">Year & Section: </span><span class="info-value">' . htmlspecialchars($student['year_level'] ?? 'N/A') . '</span></div>';
    $html .= '</td>';
    // Right column
    $html .= '<td class="col" style="padding-left:20px;">';
    $html .= '<div class="info-line"><span class="info-label">Email: </span><span class="info-value">' . htmlspecialchars($student['email'] ?? 'N/A') . '</span></div>';
    $html .= '<div class="info-line"><span class="info-label">Report Generated: </span><span class="info-value">' . date('F d, Y H:i A') . '</span></div>';
    $html .= '</td>';
    $html .= '</tr>';
    $html .= '</table>';

    // Grades table
    if (!empty($grades)) {
        $html .= '<table class="grades-table"><thead><tr>';
        $html .= '<th style="width:12%">CODE</th>';
        $html .= '<th style="width:48%">COURSE NAME</th>';
        $html .= '<th style="width:8%">UNITS</th>';
        $html .= '<th style="width:10%">MIDTERM</th>';
        $html .= '<th style="width:10%">FINAL</th>';
        $html .= '<th style="width:12%">REMARKS</th>';
        $html .= '</tr></thead><tbody>';
        
        foreach ($grades as $g) {
            $html .= '<tr>';
            $html .= '<td><span class="grade-code">' . htmlspecialchars($g['course_code'] ?? '') . '</span></td>';
            $html .= '<td>' . htmlspecialchars(strtoupper($g['course_name'] ?? '')) . '</td>';
            $html .= '<td>' . htmlspecialchars($g['credits'] ?? '3') . '</td>';
            $html .= '<td>' . htmlspecialchars($g['midterm_grade'] ?? '-') . '</td>';
            $html .= '<td>' . htmlspecialchars($g['final_grade'] ?? '-') . '</td>';
            $remarkClass = strtolower($g['remarks'] ?? 'pending') === 'passed' ? 'passed' : 'failed';
            $html .= '<td><span class="remarks ' . $remarkClass . '">' . htmlspecialchars($g['remarks'] ?? 'N/A') . '</span></td>';
            $html .= '</tr>';
        }
        
        $html .= '</tbody></table>';
        
        // Summary section
        $html .= build_gwa_summary_polished_html($grades);
    }

    // Footer
    $html .= '<div class="footer">';
    $html .= 'This is a computer-generated document from EduTrack. No signature required.<br>';
    $html .= '© ' . date('Y') . ' Mindoro State University - Calapan City Campus. All rights reserved.';
    $html .= '</div>';

    $html .= '</div>'; // .page
    $html .= '</body></html>';

    return $html;
}

/**
 * Build simple/legacy HTML template for backward compatibility
 */
function build_student_report_html_simple($student, $grades = [], $period = [])
{
    // Force images to data URIs for reliable mPDF embedding in PDF output
    $logo = get_image_data_uri('public/EduTrack_Logo.png');
    $seal = get_image_data_uri('public/MinSU_logo.png');
    
    $html = '<html><head><meta charset="utf-8"><style>
        body { 
            font-family: "Helvetica", "Arial", sans-serif; 
            line-height: 1.6;
            color: #333;
        }
        h2 { 
            color: #1e40af; 
            font-size: 14px; 
            margin-top: 20px; 
            margin-bottom: 10px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 5px;
        }
        .header { 
            text-align: center; 
            margin-bottom: 25px; 
            border-bottom: 3px solid #2563eb; 
            padding-bottom: 15px;
        }
        .logo-header {
            border-bottom: 2px solid #003399;
            margin-bottom: 10px;
            padding-bottom: 12px;
        }
        .logo-header table {
            width: 100%;
            border-collapse: collapse;
        }
        .logo-header img {
            display: inline-block;
            vertical-align: middle;
        }
        .info-section { 
            margin-bottom: 20px;
            padding: 0;
        }
        .info-row { 
            margin: 6px 0; 
            font-size: 11px;
        }
        .info-label { 
            font-weight: bold; 
            color: #374151; 
            width: 150px; 
            display: inline-block;
        }
        table.grades { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 12px;
            font-size: 10px;
        }
        table.grades th { 
            background-color: #2563eb; 
            color: white; 
            padding: 8px; 
            text-align: left;
            font-weight: bold;
        }
        table.grades td { 
            padding: 6px 8px; 
            border-bottom: 1px solid #e5e7eb;
        }
        .passed { color: #10b981; font-weight: bold; }
        .failed { color: #ef4444; font-weight: bold; }
        .summary { margin-top: 20px; padding: 12px; background-color: #eff6ff; border-left: 4px solid #2563eb; font-size: 11px; }
        .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #6b7280; border-top: 1px solid #d1d5db; padding-top: 10px; }
    </style></head><body>';
    
    // Logo and seal header
    $html .= '<div class="logo-header">';
    $html .= '<table width="100%" style="height:72px;">';
    $html .= '<tr style="height:72px;">';
    $html .= '<td width="60%" valign="middle" style="padding: 0;">';
    if ($logo) {
        $html .= '<img src="' . $logo . '" alt="EduTrack Logo" style="max-height:50px; width:auto;" />';
    }
    $html .= '</td>';
    $html .= '<td width="40%" valign="middle" style="padding: 0; text-align: right;">';
    if ($seal) {
        $html .= '<img src="' . $seal . '" alt="MinSU Seal" style="max-height:60px; width:auto;" />';
    }
    $html .= '</td>';
    $html .= '</tr>';
    $html .= '</table>';
    $html .= '</div>';
    
    $html .= '<div class="header"><h1>Student Grade Report</h1></div>';
    $html .= '<div class="info-section"><h2>Student Information</h2>';
    $html .= '<div class="info-row"><span class="info-label">Student ID:</span> ' . htmlspecialchars($student['student_id'] ?? 'N/A') . '</div>';
    $html .= '<div class="info-row"><span class="info-label">Full Name:</span> ' . htmlspecialchars(trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? ''))) . '</div>';
    $html .= '<div class="info-row"><span class="info-label">Email:</span> ' . htmlspecialchars($student['email'] ?? 'N/A') . '</div>';
    $html .= '<div class="info-row"><span class="info-label">Year Level:</span> ' . htmlspecialchars($student['year_level'] ?? 'N/A') . '</div>';
    $html .= '</div>';

    if (!empty($grades)) {
        $html .= '<div class="info-section"><h2>Academic Performance</h2>';
        $html .= build_grades_table($grades);
        $html .= build_gwa_summary($grades);
        $html .= '</div>';
    }

    $html .= '<div class="footer">This is a computer-generated document from EduTrack.</div>';
    return $html;
}

/**
 * Build GWA summary as HTML for polished template (italic styling, mPDF-compatible)
 */
function build_gwa_summary_polished_html($grades)
{
    $totalUnits = 0;
    $totalGradePoints = 0;

    foreach ($grades as $g) {
        $fg = floatval($g['final_grade_num'] ?? 0);
        if ($fg > 0) {
            $units = floatval($g['credits'] ?? 3);
            $totalUnits += $units;
            $totalGradePoints += ($fg * $units);
        }
    }

    $html = '<div class="summary">';
    
    if ($totalUnits > 0) {
        $gwaNumeric = $totalGradePoints / $totalUnits;
        
        // Transmute to 1.00-5.00 scale
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
        
        $html .= '<div class="summary-row">';
        $html .= '<span class="summary-label">Total Units:</span> ';
        $html .= '<span class="summary-value">' . number_format($totalUnits, 2) . '</span>';
        $html .= '</div>';
        $html .= '<div class="summary-row">';
        $html .= '<span class="summary-label">General Weighted Average (GWA):</span> ';
        $html .= '<span class="summary-value">' . $gwaLetter . '</span>';
        $html .= '</div>';
        $html .= '<div class="summary-row">';
        $html .= '<span class="summary-label">Status:</span> ';
        $html .= '<span class="summary-value">Very Good Performance</span>';
        $html .= '</div>';
    }
    
    $html .= '</div>';
    return $html;
}

/**
 * Build grades table HTML
 * 
 * @param array $grades Grade records
 * @return string HTML table
 */
function build_grades_table($grades)
{
    $html = '<table class="grades">';
    $html .= '<thead><tr>';
    $html .= '<th style="width: 12%;">Code</th>';
    $html .= '<th style="width: 35%;">Course Name</th>';
    $html .= '<th style="width: 8%;">Units</th>';
    $html .= '<th style="width: 12%;">Midterm</th>';
    $html .= '<th style="width: 12%;">Final</th>';
    $html .= '<th style="width: 10%;">Remarks</th>';
    $html .= '</tr></thead>';
    $html .= '<tbody>';

    foreach ($grades as $grade) {
        $html .= '<tr>';
        $html .= '<td>' . htmlspecialchars($grade['course_code'] ?? '') . '</td>';
        $html .= '<td>' . htmlspecialchars($grade['course_name'] ?? '') . '</td>';
        $html .= '<td>' . htmlspecialchars($grade['credits'] ?? '3') . '</td>';
        
        // Display midterm (numeric percent from midterm_num stored as midterm_grade display)
        $midtermDisplay = (isset($grade['midterm_grade'])) ? htmlspecialchars($grade['midterm_grade']) : '-';
        $html .= '<td>' . $midtermDisplay . '</td>';
        
        // Display final (letter grade 1.00-5.00 from transmute() stored in final_grade)
        $finalGrade = $grade['final_grade'] ?? '-';
        $finalDisplay = (is_string($finalGrade) && strlen($finalGrade) > 0) ? htmlspecialchars($finalGrade) : '-';
        $html .= '<td>' . $finalDisplay . '</td>';
        
        // Remarks based on the numeric average (final_grade_num)
        $finalGradeNum = floatval($grade['final_grade_num'] ?? 0);
        $remarks = ($finalGradeNum >= 75) ? 'PASSED' : (($finalGradeNum > 0) ? 'FAILED' : 'INC');
        $remarkClass = ($remarks === 'PASSED') ? 'passed' : 'failed';
        
        $html .= '<td class="' . $remarkClass . '">' . $remarks . '</td>';
        $html .= '</tr>';
    }

    $html .= '</tbody>';
    $html .= '</table>';

    return $html;
}

/**
 * Build GWA (General Weighted Average) summary HTML
 * 
 * @param array $grades Grade records (final_grade_num is numeric 0-100 average, final_grade is 1.00-5.00 letter grade)
 * @return string HTML summary
 */
function build_gwa_summary($grades)
{
    $totalUnits = 0;
    $totalGradePoints = 0;

    foreach ($grades as $grade) {
        // Use final_grade_num which is the numeric 0-100 average
        $finalGradeNum = floatval($grade['final_grade_num'] ?? 0);
        if ($finalGradeNum > 0) {
            $units = floatval($grade['credits'] ?? 3);
            $totalUnits += $units;
            $totalGradePoints += ($finalGradeNum * $units);
        }
    }

    $html = '<div class="summary">';
    
    if ($totalUnits > 0) {
        // GWA is calculated on 0-100 scale
        $gwaNumeric = $totalGradePoints / $totalUnits;
        
        // Convert GWA to 1.00-5.00 letter grade scale using same transmute logic
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
        
        $html .= '<div class="summary-row"><span class="label">Total Units:</span> ' . number_format($totalUnits, 2) . '</div>';
        $html .= '<div class="summary-row"><span class="label">General Weighted Average (GWA):</span> <strong>' . $gwaLetter . '</strong></div>';
        
        // GWA interpretation based on 1.00-5.00 scale
        if ($gwaLetter <= "1.50") {
            $interpretation = 'Excellent Performance';
        } elseif ($gwaLetter <= "2.00") {
            $interpretation = 'Very Good Performance';
        } elseif ($gwaLetter <= "2.50") {
            $interpretation = 'Good Performance';
        } elseif ($gwaLetter <= "3.00") {
            $interpretation = 'Satisfactory Performance';
        } else {
            $interpretation = 'Below Average Performance';
        }
        $html .= '<div class="summary-row"><span class="label">Status:</span> ' . $interpretation . '</div>';
    } else {
        $html .= '<p class="no-data">Insufficient data to calculate GWA.</p>';
    }
    
    $html .= '</div>';

    return $html;
}

/**
 * Generate a single student PDF report
 * 
 * @param array $student Student data
 * @param array $grades Grade records (can be empty)
 * @param array $period Academic period data (can be empty)
 * @param string $template Report template type
 * @param bool $download If true, force download; if false, display in browser
 * @return string Binary PDF content
 * @throws Exception on generation failure
 */
function generate_student_pdf($student, $grades = [], $period = [], $template = 'standard', $download = false)
{
    $html = build_student_report_html($student, $grades, $period, $template);
    return generate_pdf_from_html($html, 'Grade_Report_' . ($student['student_id'] ?? 'report'));
}

/**
 * Generate bulk PDF reports as a ZIP archive
 * 
 * @param array $students Array of student records
 * @param array $gradesMap Keyed array where each key is student_id and value is array of grades
 * @param array $period Academic period data
 * @param string $template Report template type
 * @return string Binary ZIP content
 * @throws Exception on generation failure
 */
function generate_bulk_pdf_zip($students, $gradesMap = [], $period = [], $template = 'standard')
{
    if (!class_exists('ZipArchive')) {
        throw new Exception('ZipArchive extension not available.');
    }

    $zip = new ZipArchive();
    $zipFilename = tempnam(sys_get_temp_dir(), 'reports_') . '.zip';

    if ($zip->open($zipFilename, ZipArchive::CREATE) !== TRUE) {
        throw new Exception('Could not create ZIP archive.');
    }

    try {
        foreach ($students as $student) {
            $studentId = $student['id'] ?? null;
            $grades = $gradesMap[$studentId] ?? [];

            $pdf = generate_student_pdf($student, $grades, $period, $template);
            $filename = 'Grade_Report_' . ($student['student_id'] ?? $student['id']) . '.pdf';
            $zip->addFromString($filename, $pdf);
        }

        $zip->close();

        // Read ZIP content and return as binary
        $zipContent = file_get_contents($zipFilename);
        unlink($zipFilename);

        return $zipContent;

    } catch (Exception $e) {
        $zip->close();
        if (file_exists($zipFilename)) {
            unlink($zipFilename);
        }
        throw $e;
    }
}
?>
