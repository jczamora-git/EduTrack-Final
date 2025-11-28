<?php
/**
 * Test script for the refactored pdf_helper
 * Usage: php test_pdf_helper.php
 * 
 * This script tests the new polished template PDF generation
 * with mocked student and grade data.
 */

// Load composer autoloader for mPDF
require_once __DIR__ . '/app/vendor/autoload.php';
require_once __DIR__ . '/app/helpers/pdf_helper.php';

// Mock student data
$student = [
    'id' => 1,
    'student_id' => '2024-0001',
    'first_name' => 'John',
    'last_name' => 'Doe',
    'email' => 'john.doe@msu.edu',
    'year_level' => 'Third Year - BS Computer Science',
];

// Mock grade data (with both numeric 0-100 and letter grade 1.00-5.00)
$grades = [
    [
        'course_code' => 'CS301',
        'course_name' => 'Data Structures and Algorithms',
        'credits' => 3,
        'midterm_grade' => '88',
        'final_grade' => '1.75',
        'final_grade_num' => 88.5,
        'remarks' => 'PASSED'
    ],
    [
        'course_code' => 'CS302',
        'course_name' => 'Database Management Systems',
        'credits' => 3,
        'midterm_grade' => '92',
        'final_grade' => '1.25',
        'final_grade_num' => 92.0,
        'remarks' => 'PASSED'
    ],
    [
        'course_code' => 'CS303',
        'course_name' => 'Web Development',
        'credits' => 4,
        'midterm_grade' => '85',
        'final_grade' => '2.00',
        'final_grade_num' => 85.5,
        'remarks' => 'PASSED'
    ],
    [
        'course_code' => 'PE101',
        'course_name' => 'Physical Fitness',
        'credits' => 1,
        'midterm_grade' => '78',
        'final_grade' => '2.50',
        'final_grade_num' => 78.0,
        'remarks' => 'PASSED'
    ],
];

// Mock period data
$period = [
    'id' => 21,
    'school_year' => '2023-2024',
    'semester' => 'Second Semester',
    'period_type' => 'Final Period',
];

try {
    // Test 1: Generate polished template (standard)
    echo "[TEST 1] Generating polished template PDF (standard)...\n";
    $html = build_student_report_html($student, $grades, $period, 'standard');
    if (strpos($html, 'Times New Roman') !== false && strpos($html, 'STUDENT GRADE REPORT') !== false) {
        echo "✓ HTML generated successfully with polished design\n";
    } else {
        echo "✗ HTML missing expected elements\n";
    }
    
    // Test 2: Generate PDF from HTML
    echo "\n[TEST 2] Generating PDF from HTML (standard)...\n";
    try {
        $pdf = generate_pdf_from_html($html, 'test_standard');
        if (!empty($pdf) && strlen($pdf) > 100) {
            echo "✓ PDF generated successfully (" . strlen($pdf) . " bytes)\n";
            
            // Save for manual inspection
            $outputPath = __DIR__ . '/runtime/test_output_standard.pdf';
            file_put_contents($outputPath, $pdf);
            echo "  Saved to: $outputPath\n";
        } else {
            echo "✗ PDF generation failed or returned empty\n";
        }
    } catch (Exception $e) {
        echo "✗ PDF generation error: " . $e->getMessage() . "\n";
    }
    
    // Test 3: Test simple/legacy template
    echo "\n[TEST 3] Generating legacy template PDF (simple)...\n";
    $htmlSimple = build_student_report_html($student, $grades, $period, 'simple');
    if (strpos($htmlSimple, 'Helvetica') !== false) {
        echo "✓ Simple template generated successfully\n";
    } else {
        echo "✗ Simple template missing expected elements\n";
    }
    
    // Test 4: Verify GWA calculation
    echo "\n[TEST 4] Verifying GWA summary...\n";
    $summaryHtml = build_gwa_summary_polished_html($grades);
    if (strpos($summaryHtml, 'General Weighted Average') !== false && strpos($summaryHtml, 'font-style:italic') !== false) {
        echo "✓ GWA summary with italic styling generated\n";
    } else {
        echo "✗ GWA summary missing expected elements\n";
    }
    
    // Test 5: Test empty grades
    echo "\n[TEST 5] Testing with empty grades array...\n";
    $htmlEmpty = build_student_report_html($student, [], $period, 'standard');
    if (strpos($htmlEmpty, 'STUDENT GRADE REPORT') !== false) {
        echo "✓ HTML generated successfully with empty grades\n";
    } else {
        echo "✗ HTML missing expected elements with empty grades\n";
    }
    
    echo "\n[SUMMARY] All tests completed!\n";
    echo "Check runtime/ folder for generated PDFs and logs.\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
?>
