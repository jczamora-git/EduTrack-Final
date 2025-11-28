<?php
// Public wrapper to allow the webserver (public docroot) to serve
// the preview PDF generator located at the project root.

// Adjust path if your project layout differs.
$rootGenerator = __DIR__ . '/../preview_grade_report_pdf.php';
if (file_exists($rootGenerator)) {
    require_once $rootGenerator;
    exit;
}

header('HTTP/1.1 404 Not Found');
echo 'Preview generator not found.';
exit;
