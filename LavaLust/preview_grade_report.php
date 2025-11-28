<?php
/**
 * Grade Report Web Preview
 * 
 * This file displays a formatted student grade report matching the A4 PDF design.
 * Use this to adjust styling before applying to the PDF generator.
 * 
 * Access: http://localhost:8000/preview_grade_report.php
 */

// Sample student data
$student = [
    'student_id' => 'MCC2023-00805',
    'first_name' => 'SORIANO, NIK STEPHEN',
    'last_name' => 'A.',
    'email' => 'ana.ortega@mcc.edu.ph',
    'year_level' => 'FIRST YEAR - 1S'
];

// Sample grades data
$grades = [
    [
        'course_code' => 'ENG 001',
        'course_name' => 'GRAMMAR AND COMPOSITION 1',
        'credits' => 3,
        'midterm_grade' => '1.75',
        'final_grade' => '1.75',
        'final_grade_num' => 85.00,
        'remarks' => 'PASSED'
    ],
    [
        'course_code' => 'FIL 111',
        'course_name' => 'KONTEKSTWALISADONG KOMUNIKASYON SA PILIPINO',
        'credits' => 3,
        'midterm_grade' => '1.75',
        'final_grade' => '1.75',
        'final_grade_num' => 85.00,
        'remarks' => 'PASSED'
    ],
    [
        'course_code' => 'ITC 111',
        'course_name' => 'INTRO TO COMPUTING',
        'credits' => 3,
        'midterm_grade' => '1.75',
        'final_grade' => '1.75',
        'final_grade_num' => 85.00,
        'remarks' => 'PASSED'
    ],
    [
        'course_code' => 'ITC 112',
        'course_name' => 'COMPUTER PROGRAMMING 1',
        'credits' => 3,
        'midterm_grade' => '1.75',
        'final_grade' => '1.75',
        'final_grade_num' => 85.00,
        'remarks' => 'PASSED'
    ],
    [
        'course_code' => 'LIT 111',
        'course_name' => 'PHILIPPINE LITERATURE',
        'credits' => 3,
        'midterm_grade' => '1.75',
        'final_grade' => '1.75',
        'final_grade_num' => 85.00,
        'remarks' => 'PASSED'
    ],
    [
        'course_code' => 'SOC SCI 111',
        'course_name' => 'PAG-UNAWA SA SARILI',
        'credits' => 3,
        'midterm_grade' => '1.75',
        'final_grade' => '1.75',
        'final_grade_num' => 85.00,
        'remarks' => 'PASSED'
    ]
];

$period = [
    'school_year' => '2023-2024',
    'semester' => 'First Semester'
];

// Calculate GWA
$totalUnits = 0;
$totalGradePoints = 0;
foreach ($grades as $grade) {
    $finalGradeNum = floatval($grade['final_grade_num'] ?? 0);
    if ($finalGradeNum > 0) {
        $units = floatval($grade['credits'] ?? 3);
        $totalUnits += $units;
        $totalGradePoints += ($finalGradeNum * $units);
    }
}

$gwaNumeric = $totalUnits > 0 ? $totalGradePoints / $totalUnits : 0;

// Convert to letter grade
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

// Status interpretation
if ($gwaLetter <= 1.50) {
    $status = 'Excellent Performance';
} elseif ($gwaLetter <= 2.00) {
    $status = 'Very Good Performance';
} elseif ($gwaLetter <= 2.50) {
    $status = 'Good Performance';
} elseif ($gwaLetter <= 3.00) {
    $status = 'Satisfactory Performance';
} else {
    $status = 'Below Average Performance';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Student Grade Report - Preview</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Times New Roman', Times, serif;
            background-color: #f5f5f5;
            padding: 40px 20px;
        }

        .container {
            max-width: 8.5in;
            min-height: 11in;
            background-color: white;
            margin: 0 auto;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
            page-break-after: always;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 15px;
            margin-bottom: 10px;
            border-bottom: 2px solid #003399;
        }

        .logo {
            width: 200px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .logo img {
            max-width: 100%;
            max-height: 100%;
        }

        .school-info {
            flex: 1;
            text-align: center;
            padding: 0 20px;
        }

        .school-name {
            font-size: 18px;
            font-weight: bold;
            color: #003399;
            margin-bottom: 5px;
        }

        .school-subtitle {
            font-size: 12px;
            color: #666;
        }

        .seal {
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .seal img {
            max-width: 100%;
            max-height: 100%;
        }
        .report-header {
            margin-bottom: 10px;
            border-bottom: 2px solid #003399;
        }

        .report-title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            color: #333;
            text-transform: uppercase;
        }

        .report-period {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin-bottom: 10px;
        }

        .student-info {
            margin-bottom: 20px;
            font-size: 13px;
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            align-items: flex-start;
        }

        .info-label {
            font-weight: bold;
            color: #333;
            min-width: 150px;
        }

        .info-value {
            flex: 1;
            color: #555;
        }

        .info-section {
            display: flex;
        }

        .grades-table {
            width: 100%;
            margin-bottom: 20px;
            font-size: 12px;
            border-collapse: collapse;
        }

        .grades-table thead {
            color: #003399;
        }

        .grades-table th {
            padding: 10px 8px;
            text-align: left;
            font-weight: bold;
            border-top: 2px solid #003399;
            border-bottom: 2px solid #003399;
        }

        .grades-table td {
            padding: 10px 8px;
            text-align: center;
        }

        .grades-table td:first-child {
            text-align: left;
        }

        .grades-table td:nth-child(2) {
            text-align: left;
        }

        .grades-table tbody tr:nth-child(odd) {
            background-color: #f9f9f9;
        }

        .grades-table tbody tr:hover {
            background-color: #f0f0f0;
        }

        .remarks {
            font-weight: bold;
        }

        .remarks.passed {
            color: #28a745;
        }

        .remarks.failed {
            color: #dc3545;
        }

        .summary {
            border-top: 2px solid #003399;
            padding: 15px;
            font-size: 13px;
        }

        .summary-row {
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
        }

        .summary-label {
            font-weight: bold;
            color: #003399;
        }

        .summary-value {
            font-weight: bold;
            color: #333;
        }

        .footer {
            text-align: center;
            font-size: 10px;
            color: #999;
            border-top: 2px dashed #002266;
            padding-top: 10px;
        }

        .page-break {
            page-break-after: always;
            margin: 40px 0;
            border-top: 2px dashed #999;
            padding-top: 40px;
        }

        /* Print styles */
        @media print {
            body {
                background-color: white;
                padding: 0;
            }

            .container {
                box-shadow: none;
                margin: 0;
                padding: 40px;
            }

            .page-break {
                page-break-after: always;
            }

            .print-button {
                display: none;
            }
        }

        .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #003399;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            z-index: 1000;
        }

        .print-button:hover {
            background-color: #002266;
        }

        .controls {
            position: fixed;
            top: 20px;
            left: 20px;
            background-color: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            font-size: 13px;
        }

        .controls label {
            display: block;
            margin-bottom: 10px;
            cursor: pointer;
        }

        .controls input[type="text"],
        .controls input[type="number"],
        .controls select {
            width: 100%;
            padding: 5px;
            margin-bottom: 10px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-family: 'Times New Roman', Times, serif;
        }

        .grade-code {
            font-weight: bold;
            color: #003399;
        }

        .course-name {
            max-width: 300px;
            text-align: left;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <button class="print-button" onclick="window.print()">Print / Save as PDF</button>

    <div class="controls">
        <h3 style="margin-bottom: 10px; color: #003399;">Report Preview</h3>
        <label for="studentId">
            Student ID:
        </label>
        <input type="text" id="studentId" name="studentId" value="<?php echo htmlspecialchars($student['student_id']); ?>">

        <label for="studentName">
            Student Name:
        </label>
        <input type="text" id="studentName" name="studentName" value="<?php echo htmlspecialchars($student['first_name']); ?>">

        <label for="studentEmail">
            Email:
        </label>
        <input type="text" id="studentEmail" name="studentEmail" value="<?php echo htmlspecialchars($student['email']); ?>">

        <label for="yearSection">
            Year & Section:
        </label>
        <input type="text" id="yearSection" name="yearSection" value="<?php echo htmlspecialchars($student['year_level']); ?>">

        <label for="schoolYear">
            School Year:
        </label>
        <input type="text" id="schoolYear" name="schoolYear" value="<?php echo htmlspecialchars($period['school_year']); ?>">

        <label for="semester">
            Semester:
        </label>
        <input type="text" id="semester" name="semester" value="<?php echo htmlspecialchars($period['semester']); ?>">
    </div>

    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="logo">
                <img src="public/EduTrack_Logo.png" alt="EduTrack Logo">
            </div>
            <div class="seal">
                <img src="public/MinSU_logo.png" alt="School Seal">
            </div>
        </div>

        <!-- Report Title -->
        <div class="report-header">
        <div class="report-title">STUDENT GRADE REPORT</div>
        <div class="report-period" id="reportPeriod">
            <?php echo htmlspecialchars($period['semester']); ?>, AY <?php echo htmlspecialchars($period['school_year']); ?>
        </div>
        </div>

        <!-- Student Information -->
        <div class="student-info">
            <div class="info-row">
                <span class="info-label">ID Number:</span>
                <span class="info-value" id="displayStudentId"><?php echo htmlspecialchars($student['student_id']); ?></span>
                <span class="info-label" style="margin-left: 40px;">Email:</span>
                <span class="info-value" id="displayEmail"><?php echo htmlspecialchars($student['email']); ?></span>
            </div>
            <div class="info-row">
                <span class="info-label">Full Name:</span>
                <span class="info-value" id="displayStudentName"><?php echo htmlspecialchars($student['first_name']); ?></span>
                <span class="info-label" style="margin-left: 40px;">Report Generated:</span>
                <span class="info-value"><?php echo date('F d, Y H:i A'); ?></span>
            </div>
            <div class="info-row">
                <span class="info-label">Year & Section:</span>
                <span class="info-value" id="displayYearSection"><?php echo htmlspecialchars($student['year_level']); ?></span>
            </div>
        </div>

        <!-- Grades Table -->
        <table class="grades-table">
            <thead>
                <tr>
                    <th style="width: 12%;">CODE</th>
                    <th style="width: 48%;">COURSE NAME</th>
                    <th style="width: 8%;">UNITS</th>
                    <th style="width: 10%;">MIDTERM</th>
                    <th style="width: 10%;">FINAL</th>
                    <th style="width: 12%;">REMARKS</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($grades as $grade): ?>
                <tr>
                    <td class="grade-code"><?php echo htmlspecialchars($grade['course_code']); ?></td>
                    <td class="course-name"><?php echo htmlspecialchars(strtoupper($grade['course_name'])); ?></td>
                    <td><?php echo htmlspecialchars($grade['credits']); ?></td>
                    <td><?php echo htmlspecialchars($grade['midterm_grade']); ?></td>
                    <td><?php echo htmlspecialchars($grade['final_grade']); ?></td>
                    <td class="remarks <?php echo strtolower($grade['remarks']) === 'passed' ? 'passed' : 'failed'; ?>">
                        <?php echo htmlspecialchars($grade['remarks']); ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

        <!-- Summary -->
        <div class="summary">
            <div class="summary-row">
                <span class="summary-label">Total Units:</span>
                <span class="summary-value"><?php echo number_format($totalUnits, 2); ?></span>
            </div>
            <div class="summary-row">
                <span class="summary-label">General Weighted Average (GWA):</span>
                <span class="summary-value"><?php echo htmlspecialchars($gwaLetter); ?></span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Status:</span>
                <span class="summary-value"><?php echo htmlspecialchars($status); ?></span>
            </div>
        </div>
        <!-- Separator and second copy -->
        <div class="page-break" style=" border-top: 2px dashed #2563eb; padding-top: 24px;">
            <!-- second copy starts here -->
            <!-- Header -->
            <div class="header">
                <div class="logo">
                    <img src="public/EduTrack_Logo.png" alt="EduTrack Logo">
                </div>
                <div class="seal">
                    <img src="public/MinSU_logo.png" alt="School Seal">
                </div>
            </div>

            <!-- Report Title -->
            <div class="report-header">
            <div class="report-title">STUDENT GRADE REPORT</div>
            <div class="report-period">
                <?php echo htmlspecialchars($period['semester']); ?>, AY <?php echo htmlspecialchars($period['school_year']); ?>
            </div>
            </div>

            <!-- Student Information -->
            <div class="student-info">
                <div class="info-row">
                    <span class="info-label">ID Number:</span>
                    <span class="info-value"><?php echo htmlspecialchars($student['student_id']); ?></span>
                    <span class="info-label" style="margin-left: 40px;">Email:</span>
                    <span class="info-value"><?php echo htmlspecialchars($student['email']); ?></span>
                </div>
                <div class="info-row">
                    <span class="info-label">Full Name:</span>
                    <span class="info-value"><?php echo htmlspecialchars($student['first_name']); ?></span>
                    <span class="info-label" style="margin-left: 40px;">Report Generated:</span>
                    <span class="info-value"><?php echo date('F d, Y H:i A'); ?></span>
                </div>
                <div class="info-row">
                    <span class="info-label">Year & Section:</span>
                    <span class="info-value"><?php echo htmlspecialchars($student['year_level']); ?></span>
                </div>
            </div>

            <!-- Grades Table -->
            <table class="grades-table">
                <thead>
                    <tr>
                        <th style="width: 12%;">CODE</th>
                        <th style="width: 48%;">COURSE NAME</th>
                        <th style="width: 8%;">UNITS</th>
                        <th style="width: 10%;">MIDTERM</th>
                        <th style="width: 10%;">FINAL</th>
                        <th style="width: 12%;">REMARKS</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($grades as $grade): ?>
                    <tr>
                        <td class="grade-code"><?php echo htmlspecialchars($grade['course_code']); ?></td>
                        <td class="course-name"><?php echo htmlspecialchars(strtoupper($grade['course_name'])); ?></td>
                        <td><?php echo htmlspecialchars($grade['credits']); ?></td>
                        <td><?php echo htmlspecialchars($grade['midterm_grade']); ?></td>
                        <td><?php echo htmlspecialchars($grade['final_grade']); ?></td>
                        <td class="remarks <?php echo strtolower($grade['remarks']) === 'passed' ? 'passed' : 'failed'; ?>">
                            <?php echo htmlspecialchars($grade['remarks']); ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <!-- Summary -->
            <div class="summary">
                <div class="summary-row">
                    <span class="summary-label">Total Units:</span>
                    <span class="summary-value"><?php echo number_format($totalUnits, 2); ?></span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">General Weighted Average (GWA):</span>
                    <span class="summary-value"><?php echo htmlspecialchars($gwaLetter); ?></span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Status:</span>
                    <span class="summary-value"><?php echo htmlspecialchars($status); ?></span>
                </div>
            </div>

            <!-- Footer duplicate -->
            <div class="footer">
                <p>This is a computer-generated document from EduTrack. No signature required.</p>
                <p>© <?php echo date('Y'); ?> Mindoro State University - Calapan City Campus. All rights reserved.</p>
            </div>
        </div>

    <script>
        // Live update for editable fields
        document.getElementById('studentId').addEventListener('change', function() {
            document.getElementById('displayStudentId').textContent = this.value;
        });

        document.getElementById('studentName').addEventListener('change', function() {
            document.getElementById('displayStudentName').textContent = this.value;
        });

        document.getElementById('studentEmail').addEventListener('change', function() {
            document.getElementById('displayEmail').textContent = this.value;
        });

        document.getElementById('yearSection').addEventListener('change', function() {
            document.getElementById('displayYearSection').textContent = this.value;
        });

        document.getElementById('reportPeriod').addEventListener('change', function() {
            document.getElementById('reportPeriod').textContent = document.getElementById('semester').value + ', AY ' + document.getElementById('schoolYear').value;
        });

        document.getElementById('semester').addEventListener('change', function() {
            const schoolYear = document.getElementById('schoolYear').value;
            document.getElementById('reportPeriod').textContent = this.value + ', AY ' + schoolYear;
        });

        document.getElementById('schoolYear').addEventListener('change', function() {
            const semester = document.getElementById('semester').value;
            document.getElementById('reportPeriod').textContent = semester + ', AY ' + this.value;
        });
    </script>
</body>
</html>
