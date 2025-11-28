<?php
// Test image path resolution from helper perspective

echo "Testing Image Path Resolution\n";
echo "==============================\n\n";

// Simulate being in the helper file
$helperDir = dirname(__FILE__);
echo "Helper location: $helperDir\n\n";

// Test the CORRECTED path calculation (2 levels up)
$root = dirname(dirname($helperDir));
echo "Root calculated (2 levels up): $root\n\n";

// Test image paths
$images = [
    'public/EduTrack_Logo.png',
    'public/MinSU_logo.png',
    'public/logo.png'
];

echo "Image file checks:\n";
foreach ($images as $img) {
    $fullPath = $root . DIRECTORY_SEPARATOR . $img;
    $exists = file_exists($fullPath) ? '✓ EXISTS' : '✗ NOT FOUND';
    echo "  $img: $exists\n";
    if (file_exists($fullPath)) {
        echo "    Full path: $fullPath\n";
        echo "    Size: " . filesize($fullPath) . " bytes\n";
    }
}
?>
