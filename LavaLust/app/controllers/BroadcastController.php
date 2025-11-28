<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * BroadcastController
 * Handles teacher broadcasts to students/sections
 * API endpoints for creating, managing, and sending broadcasts
 */
class BroadcastController extends Controller
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * GET /api/broadcasts/my
     * Get broadcasts created by the current teacher
     */
    public function api_get_my_broadcasts()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $teacher_id = $this->session->userdata('user_id');
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

            $broadcasts = $this->BroadcastModel->get_teacher_broadcasts($teacher_id, $limit, $offset);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'broadcasts' => $broadcasts,
                'count' => is_array($broadcasts) ? count($broadcasts) : 0
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/broadcasts/:id
     * Get single broadcast by ID with message count
     */
    public function api_get_broadcast($broadcast_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $broadcast = $this->BroadcastModel->get_broadcast($broadcast_id);

            if (!$broadcast) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Broadcast not found']);
                return;
            }

            // Fetch expanded messages for this broadcast
            $messages = $this->MessageModel->get_broadcast_messages($broadcast_id);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'broadcast' => $broadcast,
                'messages' => $messages,
                'message_count' => is_array($messages) ? count($messages) : 0
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * POST /api/broadcasts
     * Create and send a broadcast to students in a section/course
     * Body: { body, teacher_subject_id?, section_id?, receiver_ids, attachments? }
     */
    public function api_create_broadcast()
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
            if (empty($data['body']) || empty($data['receiver_ids']) || !is_array($data['receiver_ids'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing required fields: body, receiver_ids (array)']);
                return;
            }

            $teacher_id = $this->session->userdata('user_id');
            $body = $data['body'];
            $receiver_ids = $data['receiver_ids'];
            $teacher_subject_id = isset($data['teacher_subject_id']) ? (int)$data['teacher_subject_id'] : null;
            $section_id = isset($data['section_id']) ? (int)$data['section_id'] : null;
            $attachments = isset($data['attachments']) ? $data['attachments'] : null;

            // If receiver_ids not provided, attempt to resolve recipients from section_id and/or teacher_subject_id
            if (empty($receiver_ids) && !empty($section_id)) {
                $receiver_ids = [];

                // If teacher_subject_id provided, resolve subject_id then find students enrolled in that subject and section
                if (!empty($teacher_subject_id)) {
                    $ts = $this->db->table('teacher_subjects')->select('subject_id')->where('id', $teacher_subject_id)->get();
                    $subject_id = $ts['subject_id'] ?? null;
                    if ($subject_id) {
                        // find student_subjects entries for this subject and join to students table to filter by section
                        $rows = $this->db->raw("SELECT s.user_id FROM student_subjects ss JOIN students s ON ss.student_id = s.id WHERE ss.subject_id = ? AND s.section_id = ?", [$subject_id, $section_id])->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($rows as $r) {
                            if (!empty($r['user_id'])) $receiver_ids[] = (int)$r['user_id'];
                        }
                    }
                }

                // Fallback: if still empty, fetch all students in the section
                if (empty($receiver_ids)) {
                    $rows = $this->db->raw("SELECT u.id as user_id FROM students s JOIN users u ON s.user_id = u.id WHERE s.section_id = ?", [$section_id])->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($rows as $r) {
                        if (!empty($r['user_id'])) $receiver_ids[] = (int)$r['user_id'];
                    }
                }
            }

            // 1. Create broadcast record
            $broadcast_id = $this->BroadcastModel->create_broadcast(
                $teacher_id,
                $body,
                $attachments,
                $teacher_subject_id,
                $section_id,
                'sent'
            );

            if (!$broadcast_id) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create broadcast']);
                return;
            }

            // 2. Expand broadcast to individual messages for each receiver
            $inserted = $this->MessageModel->create_broadcast_messages(
                $broadcast_id,
                $teacher_id,
                $receiver_ids,
                $body,
                $attachments,
                $teacher_subject_id,
                $section_id
            );

            // 3. Update recipients_count in broadcast
            $this->BroadcastModel->update_recipients_count($broadcast_id);

            // 4. Send Firebase notifications to all recipients
            if (!empty($receiver_ids)) {
                $this->call->helper('notification_helper');

                // Fetch teacher name for notification
                $teacher = $this->db->table('users')->select('first_name, last_name')->where('id', $teacher_id)->get();
                $teacherName = '';
                if (!empty($teacher)) {
                    $teacherName = trim(($teacher['first_name'] ?? '') . ' ' . ($teacher['last_name'] ?? ''));
                }
                $teacherName = $teacherName ?: "Teacher #{$teacher_id}";

                // Send push notifications to all receivers
                foreach ($receiver_ids as $receiver_id) {
                    $tokens = $this->MessageModel->get_user_fcm_tokens($receiver_id);
                    foreach ($tokens as $token) {
                        send_fcm_to_token($token, 'New Announcement', $teacherName . ' sent a broadcast', [
                            'type' => 'broadcast',
                            'broadcast_id' => (string)$broadcast_id,
                            'sender_id' => (string)$teacher_id,
                            'action' => 'view_broadcast',
                        ]);
                    }
                }
            }

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Broadcast sent successfully',
                'broadcast_id' => $broadcast_id,
                'recipients_count' => $inserted
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/broadcasts/subject/:subject_id
     * Get broadcasts for a specific teacher_subject
     */
    public function api_get_broadcasts_by_subject($teacher_subject_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $broadcasts = $this->BroadcastModel->get_broadcasts_by_subject($teacher_subject_id, $limit);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'broadcasts' => $broadcasts,
                'count' => is_array($broadcasts) ? count($broadcasts) : 0
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/broadcasts/section/:section_id
     * Get broadcasts for a specific section
     */
    public function api_get_broadcasts_by_section($section_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $broadcasts = $this->BroadcastModel->get_broadcasts_by_section($section_id, $limit);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'broadcasts' => $broadcasts,
                'count' => is_array($broadcasts) ? count($broadcasts) : 0
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * DELETE /api/broadcasts/:id
     * Delete a broadcast (admin or creator only)
     */
    public function api_delete_broadcast($broadcast_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $broadcast = $this->BroadcastModel->get_broadcast($broadcast_id);

            if (!$broadcast) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Broadcast not found']);
                return;
            }

            // Check if user is the creator or admin
            $user_id = $this->session->userdata('user_id');
            $user_role = $this->session->userdata('role');
            if ($broadcast['teacher_id'] != $user_id && $user_role !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Forbidden: You can only delete your own broadcasts']);
                return;
            }

            $result = $this->BroadcastModel->delete_broadcast($broadcast_id);

            if ($result) {
                http_response_code(200);
                echo json_encode(['success' => true, 'message' => 'Broadcast deleted successfully']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to delete broadcast']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }
}
