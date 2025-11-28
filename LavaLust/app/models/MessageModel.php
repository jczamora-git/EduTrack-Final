<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Message Model
 * Handles all message-related database operations (direct messages and broadcast-expanded messages)
 */
class MessageModel extends Model
{
    protected $table = 'messages';

    /**
     * Create a direct message between sender and receiver
     */
    public function create_message($sender_id, $receiver_id, $body, $attachments = null, $teacher_subject_id = null, $section_id = null, $broadcast_id = null)
    {
        $attachments_json = !empty($attachments) ? json_encode($attachments) : null;
        // Use query builder insert and return the inserted ID
        $this->db->table($this->table);
        $insertId = $this->db->insert([
            'sender_id' => $sender_id,
            'receiver_id' => $receiver_id,
            'broadcast_id' => $broadcast_id,
            'teacher_subject_id' => $teacher_subject_id,
            'section_id' => $section_id,
            'body' => $body,
            'attachments' => $attachments_json,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);

        return $insertId ?: false;
    }

    /**
     * Get messages for a user (inbox - messages where user is receiver)
     */
    public function get_inbox($receiver_id, $limit = 50, $offset = 0)
    {
        $sql = "SELECT m.*, u.first_name, u.last_name, u.email 
                FROM {$this->table} m
                JOIN users u ON m.sender_id = u.id
                WHERE m.receiver_id = ?
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?";
        $stmt = $this->db->raw($sql, [$receiver_id, $limit, $offset]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get unread message count for a user
     */
    public function get_unread_count($receiver_id)
    {
        $sql = "SELECT COUNT(*) as count FROM {$this->table} WHERE receiver_id = ? AND is_read = 0";
        $stmt = $this->db->raw($sql, [$receiver_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? (int)$result['count'] : 0;
    }

    /**
     * Get single message by ID
     */
    public function get_message($message_id)
    {
        $sql = "SELECT m.*, u.first_name, u.last_name, u.email 
                FROM {$this->table} m
                JOIN users u ON m.sender_id = u.id
                WHERE m.id = ?";
        $stmt = $this->db->raw($sql, [$message_id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Mark message as read
     */
    public function mark_as_read($message_id, $receiver_id)
    {
        $sql = "UPDATE {$this->table} SET is_read = 1, updated_at = NOW() WHERE id = ? AND receiver_id = ?";
        $stmt = $this->db->raw($sql, [$message_id, $receiver_id]);
        return $stmt->rowCount();
    }

    /**
     * Mark all messages from a sender as read (for a receiver)
     */
    public function mark_all_as_read($receiver_id, $sender_id = null)
    {
        if ($sender_id) {
            $sql = "UPDATE {$this->table} SET is_read = 1, updated_at = NOW() WHERE receiver_id = ? AND sender_id = ? AND is_read = 0";
            $stmt = $this->db->raw($sql, [$receiver_id, $sender_id]);
            return $stmt->rowCount();
        } else {
            $sql = "UPDATE {$this->table} SET is_read = 1, updated_at = NOW() WHERE receiver_id = ? AND is_read = 0";
            $stmt = $this->db->raw($sql, [$receiver_id]);
            return $stmt->rowCount();
        }
    }

    /**
     * Get conversation between two users (paginated)
     */
    public function get_conversation($user_id, $other_user_id, $limit = 50, $offset = 0)
    {
        $sql = "SELECT m.*, 
                CASE WHEN m.sender_id = ? THEN 'sent' ELSE 'received' END as direction,
                u.first_name, u.last_name, u.email
                FROM {$this->table} m
                JOIN users u ON m.sender_id = u.id
                WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
                AND m.broadcast_id IS NULL
                ORDER BY m.created_at ASC
                LIMIT ? OFFSET ?";
            $stmt = $this->db->raw($sql, [$user_id, $user_id, $other_user_id, $other_user_id, $user_id, $limit, $offset]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get FCM tokens for a user
     * Returns array of active FCM tokens for sending push notifications
     */
    public function get_user_fcm_tokens($user_id)
    {
        $sql = "SELECT token FROM user_fcm_tokens WHERE user_id = ? AND is_active = 1";
        $stmt = $this->db->raw($sql, [$user_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $tokens = [];
        foreach ($rows as $row) {
            if (!empty($row['token'])) {
                $tokens[] = $row['token'];
            }
        }
        return $tokens;
    }

    /**
     * Delete a message by ID
     */
    public function delete_message($message_id)
    {
        $sql = "DELETE FROM {$this->table} WHERE id = ?";
        $stmt = $this->db->raw($sql, [$message_id]);
        return $stmt->rowCount();
    }

    /**
     * Get messages for a broadcast (to see all expanded recipients)
     */
    public function get_broadcast_messages($broadcast_id)
    {
        $sql = "SELECT m.* FROM {$this->table} m WHERE m.broadcast_id = ? ORDER BY m.created_at ASC";
        $stmt = $this->db->raw($sql, [$broadcast_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Create bulk messages from broadcast (expand to recipients)
     */
    public function create_broadcast_messages($broadcast_id, $sender_id, $receiver_ids, $body, $attachments = null, $teacher_subject_id = null, $section_id = null)
    {
        $attachments_json = !empty($attachments) ? json_encode($attachments) : null;
        $inserted = 0;

        foreach ($receiver_ids as $receiver_id) {
            // Use table insert helper per-recipient
            $this->db->table($this->table);
            $insertId = $this->db->insert([
                'sender_id' => $sender_id,
                'receiver_id' => $receiver_id,
                'broadcast_id' => $broadcast_id,
                'teacher_subject_id' => $teacher_subject_id,
                'section_id' => $section_id,
                'body' => $body,
                'attachments' => $attachments_json,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);

            if ($insertId) {
                $inserted++;
            }
        }

        return $inserted;
    }
}
