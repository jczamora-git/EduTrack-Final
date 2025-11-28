<?php
/**
 * Quick test to verify image paths are working
 */

require_once __DIR__ . '/app/helpers/pdf_helper.php';

echo "Testing image path resolution:\n";
echo "==============================\n\n";

// Test paths
$testPaths = [
    '/public/EduTrack_Logo.png',
    '/public/MinSU_logo.png',
    'public/EduTrack_Logo.png',
    'public/MinSU_logo.png',
];

foreach ($testPaths as $path) {
    echo "Testing: $path\n";
    $uri = get_image_data_uri($path);
    if ($uri) {
        $size = strlen($uri);
        echo "  ✓ SUCCESS - Data URI generated (" . $size . " bytes)\n";
        echo "  URI starts with: " . substr($uri, 0, 50) . "...\n";
    } else {
        echo "  ✗ FAILED - Could not find or load image\n";
    }
    echo "\n";
}

// Check actual file locations
echo "\nChecking actual file locations:\n";
echo "==============================\n";

$root = dirname(dirname(dirname(__DIR__))) . DIRECTORY_SEPARATOR . 'LavaLust';
echo "Expected root: $root\n";

$files = [
    'public/EduTrack_Logo.png',
    'public/MinSU_logo.png',
    'public/logo.png'
];

foreach ($files as $file) {
    $full = $root . DIRECTORY_SEPARATOR . $file;
    $exists = file_exists($full) ? 'EXISTS' : 'NOT FOUND';
    echo "  $file - $exists\n";
    if (file_exists($full)) {
        $size = filesize($full);
        echo "    Size: " . $size . " bytes\n";
    }
}
?>
