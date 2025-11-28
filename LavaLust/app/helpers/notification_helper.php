<?php
/**
 * Notification Helper
 * - Sends Firebase Cloud Messaging (FCM) push notifications to users
 * - Integrates with firebase_helper for credentials
 */

if (!function_exists('send_fcm_to_token')) {
    /**
     * Send an FCM notification to a specific device token using Google's FCM API.
     * Requires curl and a valid Google API access token.
     *
     * @param string $device_token The FCM device token
     * @param string $title Notification title
     * @param string $body Notification body
     * @param array $data Additional data payload
     * @return bool True if successful, false otherwise
     */
    function send_fcm_to_token(string $device_token, string $title, string $body, array $data = []): bool
    {
        if (empty($device_token)) {
            return false;
        }

        $projectId = get_firebase_project_id();
        if (!$projectId) {
            trigger_error('Firebase project_id not configured', E_USER_WARNING);
            return false;
        }

        // Build the FCM message payload
        $message = [
            'token' => $device_token,
            'notification' => [
                'title' => $title,
                'body' => $body,
            ],
        ];

        // Add data payload if provided
        if (!empty($data)) {
            $message['data'] = [];
            foreach ($data as $key => $value) {
                // FCM data values must be strings
                $message['data'][$key] = (string)$value;
            }
        }

        // Wrap in { "message": {...} } for Google FCM API v1
        $payload = ['message' => $message];

        // Get an access token for Firebase
        $accessToken = get_firebase_access_token();
        if (!$accessToken) {
            trigger_error('Failed to obtain Firebase access token', E_USER_WARNING);
            return false;
        }

        // Send via Firebase Cloud Messaging API
        $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        $options = [
            'http' => [
                'method' => 'POST',
                'header' => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $accessToken,
                ],
                'content' => json_encode($payload),
                'ignore_errors' => true,
            ],
        ];

        try {
            $context = stream_context_create($options);
            $response = @file_get_contents($url, false, $context);

            if ($response === false) {
                error_log('FCM API request failed for token: ' . substr($device_token, 0, 20));
                return false;
            }

            $result = json_decode($response, true);
            $success = isset($result['name']); // Google FCM returns a 'name' field on success

            if (!$success) {
                error_log('FCM API error: ' . json_encode($result));
            }

            return $success;
        } catch (Exception $e) {
            error_log('Exception sending FCM: ' . $e->getMessage());
            return false;
        }
    }
}

if (!function_exists('get_firebase_access_token')) {
    /**
     * Obtain a Google access token using the Firebase service account.
     * Tokens are valid for ~1 hour and should be cached in production.
     *
     * @return string|null Access token on success, null on failure
     */
    function get_firebase_access_token(): ?string
    {
        $serviceAccount = load_firebase_service_account();
        if (!$serviceAccount || !isset($serviceAccount['private_key'])) {
            return null;
        }

        // Create a JWT signed with the service account private key
        if (!function_exists('create_firebase_custom_token')) {
            return null;
        }

        $now = time();
        $payload = [
            'iss' => $serviceAccount['client_email'],
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token',
            'exp' => $now + 3600,
            'iat' => $now,
        ];

        try {
            if (!class_exists('Firebase\\JWT\\JWT')) {
                return null;
            }

            $jwt = \Firebase\JWT\JWT::encode($payload, $serviceAccount['private_key'], 'RS256');

            // Exchange JWT for access token
            $options = [
                'http' => [
                    'method' => 'POST',
                    'header' => 'Content-Type: application/x-www-form-urlencoded',
                    'content' => http_build_query([
                        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                        'assertion' => $jwt,
                    ]),
                    'ignore_errors' => true,
                ],
            ];

            $context = stream_context_create($options);
            $response = @file_get_contents('https://oauth2.googleapis.com/token', false, $context);

            if ($response === false) {
                error_log('Failed to obtain Firebase access token');
                return null;
            }

            $data = json_decode($response, true);
            return $data['access_token'] ?? null;
        } catch (Throwable $e) {
            trigger_error('Failed to obtain Firebase access token: ' . $e->getMessage(), E_USER_WARNING);
            return null;
        }
    }
}

// Fetch tokens helper for convenience (optional)
if (!function_exists('fetch_user_fcm_tokens')) {
    /**
     * Placeholder - tokens should be fetched from model/controller context
     * This helper is kept for reference but actual fetching should be done via MessageModel::get_user_fcm_tokens()
     *
     * @param int $user_id
     * @return array Empty array - use controller/model method instead
     */
    function fetch_user_fcm_tokens(int $user_id): array
    {
        return [];
    }
}

?>
