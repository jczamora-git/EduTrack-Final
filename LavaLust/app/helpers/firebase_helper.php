<?php
/**
 * Firebase helper
 * - Loads `app/config/service-account.json` safely
 * - Provides accessors for keys and a helper to create Firebase custom tokens
 */

use Firebase\JWT\JWT;

if (!function_exists('get_firebase_service_account_path')) {
    function get_firebase_service_account_path(): string
    {
        // app/helpers/firebase_helper.php -> app/helpers/../../config/service-account.json
        $path = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'service-account.json';
        return realpath($path) ?: $path;
    }
}

if (!function_exists('load_firebase_service_account')) {
    function load_firebase_service_account(): ?array
    {
        $path = get_firebase_service_account_path();
        if (!file_exists($path)) {
            trigger_error('Firebase service account not found at: ' . $path, E_USER_WARNING);
            return null;
        }

        $json = file_get_contents($path);
        if ($json === false) {
            trigger_error('Failed to read Firebase service account file: ' . $path, E_USER_WARNING);
            return null;
        }

        $data = json_decode($json, true);
        if ($data === null) {
            trigger_error('Invalid JSON in Firebase service account file: ' . $path, E_USER_WARNING);
            return null;
        }

        return $data;
    }
}

if (!function_exists('get_firebase_client_email')) {
    function get_firebase_client_email(): ?string
    {
        $sa = load_firebase_service_account();
        return $sa['client_email'] ?? null;
    }
}

if (!function_exists('get_firebase_private_key')) {
    function get_firebase_private_key(): ?string
    {
        $sa = load_firebase_service_account();
        return $sa['private_key'] ?? null;
    }
}

if (!function_exists('get_firebase_project_id')) {
    function get_firebase_project_id(): ?string
    {
        $sa = load_firebase_service_account();
        return $sa['project_id'] ?? null;
    }
}

if (!function_exists('create_firebase_custom_token')) {
    /**
     * Create a Firebase custom token for a given UID.
     * Requires `firebase/php-jwt` to be installed.
     *
     * @param string $uid
     * @param array $additionalClaims
     * @param int $expireSeconds
     * @return string|null JWT on success or null on failure
     */
    function create_firebase_custom_token(string $uid, array $additionalClaims = [], int $expireSeconds = 3600): ?string
    {
        $clientEmail = get_firebase_client_email();
        $privateKey = get_firebase_private_key();

        if (!$clientEmail || !$privateKey) {
            trigger_error('Firebase service account client_email or private_key missing', E_USER_WARNING);
            return null;
        }

        $now = time();
        $payload = [
            'iss' => $clientEmail,
            'sub' => $clientEmail,
            'aud' => 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
            'iat' => $now,
            'exp' => $now + $expireSeconds,
            'uid' => $uid,
        ];

        if (!empty($additionalClaims)) {
            // Nest custom claims under 'claims' to align with Firebase custom token format
            $payload['claims'] = $additionalClaims;
        }

        try {
            // firebase/php-jwt v6 uses static JWT::encode
            if (!class_exists('Firebase\\JWT\\JWT')) {
                trigger_error('firebase/php-jwt is not installed; please composer require firebase/php-jwt', E_USER_WARNING);
                return null;
            }

            return JWT::encode($payload, $privateKey, 'RS256');
        } catch (Throwable $e) {
            trigger_error('Failed to create Firebase custom token: ' . $e->getMessage(), E_USER_WARNING);
            return null;
        }
    }
}

// Optional: expose a lightweight check function
if (!function_exists('firebase_credentials_valid')) {
    function firebase_credentials_valid(): bool
    {
        $sa = load_firebase_service_account();
        return is_array($sa) && !empty($sa['client_email']) && !empty($sa['private_key']);
    }
}

?>
