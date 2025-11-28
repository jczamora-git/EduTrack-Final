<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * MessageController
 * Handles direct messaging between teachers and students
 * API endpoints for fetching, sending, and managing messages
 */
class MessageController extends Controller
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * GET /api/messages
     * Fetch inbox for current authenticated user
     */
    public function api_get_inbox()
    {
        api_set_json_headers();

        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->session->userdata('user_id');
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

            $messages = $this->MessageModel->get_inbox($user_id, $limit, $offset);
            $unread_count = $this->MessageModel->get_unread_count($user_id);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'messages' => $messages,
                'unread_count' => $unread_count,
                'count' => is_array($messages) ? count($messages) : 0
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/messages/:id
     * Get single message by ID
     */
    public function api_get_message($message_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $message = $this->MessageModel->get_message($message_id);

            if (!$message) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Message not found']);
                return;
            }

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => $message]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/messages
     * Send a direct message
     * Body: { receiver_id, body, teacher_subject_id?, section_id?, attachments? }
     */
    public function api_send_message()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validate required fields
            if (empty($data['receiver_id']) || empty($data['body'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing required fields: receiver_id, body']);
                return;
            }

            $sender_id = $this->session->userdata('user_id');
            $receiver_id = (int)$data['receiver_id'];
            $body = $data['body'];
            $teacher_subject_id = isset($data['teacher_subject_id']) ? (int)$data['teacher_subject_id'] : null;
            $section_id = isset($data['section_id']) ? (int)$data['section_id'] : null;
            $attachments = isset($data['attachments']) ? $data['attachments'] : null;

            // Create the message
            $message_id = $this->MessageModel->create_message($sender_id, $receiver_id, $body, $attachments, $teacher_subject_id, $section_id);

            if ($message_id) {
                // Fetch sender name for notification
                $sender = $this->db->table('users')->select('first_name, last_name')->where('id', $sender_id)->get();
                $senderName = '';
                if (!empty($sender)) {
                    $senderName = trim(($sender['first_name'] ?? '') . ' ' . ($sender['last_name'] ?? ''));
                }
                $senderName = $senderName ?: "User #{$sender_id}";

                // Load notification helper and send FCM push
                $this->call->helper('notification_helper');
                
                // Get FCM tokens for receiver
                $tokens = $this->MessageModel->get_user_fcm_tokens($receiver_id);
                
                if (!empty($tokens)) {
                    // Send push notifications
                    foreach ($tokens as $token) {
                        send_fcm_to_token($token, 'New Message', $senderName . ': ' . substr($body, 0, 50), [
                            'type' => 'direct_message',
                            'message_id' => (string)$message_id,
                            'sender_id' => (string)$sender_id,
                            'action' => 'open_conversation',
                        ]);
                    }
                } else {
                    error_log("No FCM tokens found for receiver {$receiver_id}");
                }

                http_response_code(201);
                echo json_encode(['success' => true, 'message' => 'Message sent successfully', 'message_id' => $message_id]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to send message']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * PUT /api/messages/:id/read
     * Mark message as read
     */
    public function api_mark_as_read($message_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->session->userdata('user_id');
            $result = $this->MessageModel->mark_as_read($message_id, $user_id);

            if ($result) {
                http_response_code(200);
                echo json_encode(['success' => true, 'message' => 'Message marked as read']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to mark message as read']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/messages/conversation/:user_id
     * Get conversation between two users
     */
    public function api_get_conversation($other_user_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $user_id = $this->session->userdata('user_id');
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

            $messages = $this->MessageModel->get_conversation($user_id, $other_user_id, $limit, $offset);

            // Mark all received messages as read
            $this->MessageModel->mark_all_as_read($user_id, $other_user_id);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'messages' => $messages,
                'count' => is_array($messages) ? count($messages) : 0
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * DELETE /api/messages/:id
     * Delete a message
     */
    public function api_delete_message($message_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $result = $this->MessageModel->delete_message($message_id);

            if ($result) {
                http_response_code(200);
                echo json_encode(['success' => true, 'message' => 'Message deleted successfully']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to delete message']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }
}
