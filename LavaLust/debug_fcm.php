<?php
/**
 * Debug script to verify FCM token registration and notification flow
 * Run from browser: http://localhost/EduTrack/LavaLust/debug_fcm.php
 * Or from CLI: php debug_fcm.php
 */

// Load environment and config
require_once __DIR__ . '/app/config/config.php';

echo "=== FCM Debug Script ===\n\n";

// Check 1: Verify Firebase configuration is loaded
echo "1. Checking Firebase Configuration:\n";
if (function_exists('get_firebase_project_id')) {
    $projectId = get_firebase_project_id();
    echo "   ✓ Project ID: " . ($projectId ?: "NOT FOUND") . "\n";
} else {
    echo "   ✗ get_firebase_project_id() function not found\n";
}

if (function_exists('load_firebase_service_account')) {
    $serviceAccount = load_firebase_service_account();
    if ($serviceAccount) {
        echo "   ✓ Service Account loaded\n";
        echo "     - Client Email: " . ($serviceAccount['client_email'] ?? 'NOT FOUND') . "\n";
        echo "     - Private Key: " . (isset($serviceAccount['private_key']) ? "YES (length: " . strlen($serviceAccount['private_key']) . ")" : "NOT FOUND") . "\n";
    } else {
        echo "   ✗ Service Account not loaded\n";
    }
} else {
    echo "   ✗ load_firebase_service_account() function not found\n";
}

echo "\n2. Checking Database Connection:\n";
try {
    // Create a simple test DB connection
    $config = require __DIR__ . '/app/config/database.php';
    $dsn = "mysql:host=" . $config['host'] . ";dbname=" . $config['database'];
    $db = new PDO($dsn, $config['user'], $config['password']);
    echo "   ✓ Database connected\n";
    
    // Check if user_fcm_tokens table exists
    $stmt = $db->query("SHOW TABLES LIKE 'user_fcm_tokens'");
    if ($stmt->rowCount() > 0) {
        echo "   ✓ user_fcm_tokens table exists\n";
        
        // Check table structure
        $columns = $db->query("DESCRIBE user_fcm_tokens")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($columns as $col) {
            echo "     - " . $col['Field'] . " (" . $col['Type'] . ")\n";
        }
        
        // Count registered tokens
        $tokenCount = $db->query("SELECT COUNT(*) as count FROM user_fcm_tokens WHERE is_active = 1")->fetch(PDO::FETCH_ASSOC);
        echo "\n   ✓ Active tokens in DB: " . $tokenCount['count'] . "\n";
        
        // List sample tokens (anonymized)
        if ($tokenCount['count'] > 0) {
            $samples = $db->query("SELECT user_id, token, created_at FROM user_fcm_tokens WHERE is_active = 1 LIMIT 3")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($samples as $sample) {
                echo "     - User {$sample['user_id']}: " . substr($sample['token'], 0, 20) . "... (registered: {$sample['created_at']})\n";
            }
        }
    } else {
        echo "   ✗ user_fcm_tokens table NOT found\n";
    }
} catch (Exception $e) {
    echo "   ✗ Database error: " . $e->getMessage() . "\n";
}

echo "\n3. Testing Firebase Access Token Generation:\n";
if (function_exists('get_firebase_access_token')) {
    echo "   Attempting to generate access token...\n";
    $token = get_firebase_access_token();
    if ($token) {
        echo "   ✓ Access token generated successfully\n";
        echo "     Length: " . strlen($token) . " characters\n";
        echo "     First 20 chars: " . substr($token, 0, 20) . "...\n";
    } else {
        echo "   ✗ Failed to generate access token\n";
    }
} else {
    echo "   ✗ get_firebase_access_token() function not found\n";
}

echo "\n4. Checking Message Model Methods:\n";
echo "   (This requires framework context, skipping standalone)\n";

echo "\n=== Debug Summary ===\n";
echo "If all checks pass, the issue is likely:\n";
echo "  1. Frontend token not registering (check browser console)\n";
echo "  2. Notification permission denied by user\n";
echo "  3. Service worker not properly registered\n";
echo "  4. Firebase credentials issues (check error logs)\n";
echo "\nCheck PHP error logs:\n";
$logPath = ini_get('error_log');
echo "  " . ($logPath ?: "Using default PHP error logging") . "\n";
?>
