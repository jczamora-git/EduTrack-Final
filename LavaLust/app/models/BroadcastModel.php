<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Broadcast Model
 * Handles all broadcast-related database operations
 */
class BroadcastModel extends Model
{
    protected $table = 'broadcasts';

    /**
     * Create a new broadcast
     */
    public function create_broadcast($teacher_id, $body, $attachments = null, $teacher_subject_id = null, $section_id = null, $status = 'sent')
    {
        $attachments_json = !empty($attachments) ? json_encode($attachments) : null;
        
        $sql = "INSERT INTO {$this->table} (teacher_id, teacher_subject_id, section_id, body, attachments, status, sent_at, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())";
        
        // Use the Database table insert helper to perform the insert
        $this->db->table($this->table);
        $insertId = $this->db->insert([
            'teacher_id' => $teacher_id,
            'teacher_subject_id' => $teacher_subject_id,
            'section_id' => $section_id,
            'body' => $body,
            'attachments' => $attachments_json,
            'status' => $status,
            'sent_at' => date('Y-m-d H:i:s'),
            'created_at' => date('Y-m-d H:i:s')
        ]);

        return $insertId ?: false;
    }

    /**
     * Get all broadcasts for a teacher
     */
    public function get_teacher_broadcasts($teacher_id, $limit = 50, $offset = 0)
    {
        $sql = "SELECT b.*, COUNT(m.id) as message_count
                FROM {$this->table} b
                LEFT JOIN messages m ON b.id = m.broadcast_id
                WHERE b.teacher_id = ?
                GROUP BY b.id
                ORDER BY b.created_at DESC
                LIMIT ? OFFSET ?";
        
        $stmt = $this->db->raw($sql, [$teacher_id, $limit, $offset]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get single broadcast by ID
     */
    public function get_broadcast($broadcast_id)
    {
        $sql = "SELECT b.*, COUNT(m.id) as message_count
                FROM {$this->table} b
                LEFT JOIN messages m ON b.id = m.broadcast_id
                WHERE b.id = ?
                GROUP BY b.id";
        
        $stmt = $this->db->raw($sql, [$broadcast_id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Get broadcasts for a specific teacher_subject
     */
    public function get_broadcasts_by_subject($teacher_subject_id, $limit = 50)
    {
        $sql = "SELECT b.*, COUNT(m.id) as message_count
                FROM {$this->table} b
                LEFT JOIN messages m ON b.id = m.broadcast_id
                WHERE b.teacher_subject_id = ?
                GROUP BY b.id
                ORDER BY b.created_at DESC
                LIMIT ?";
        
        $stmt = $this->db->raw($sql, [$teacher_subject_id, $limit]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Update broadcast status
     */
    public function update_status($broadcast_id, $status)
    {
        $sql = "UPDATE {$this->table} SET status = ?, updated_at = NOW() WHERE id = ?";
        $stmt = $this->db->raw($sql, [$status, $broadcast_id]);
        return $stmt->rowCount();
    }

    /**
     * Update recipients count for a broadcast
     */
    public function update_recipients_count($broadcast_id)
    {
        $sql = "UPDATE {$this->table} SET recipients_count = (SELECT COUNT(*) FROM messages WHERE broadcast_id = ?) WHERE id = ?";
        $stmt = $this->db->raw($sql, [$broadcast_id, $broadcast_id]);
        return $stmt->rowCount();
    }

    /**
     * Delete a broadcast (cascades to messages via foreign key)
     */
    public function delete_broadcast($broadcast_id)
    {
        $sql = "DELETE FROM {$this->table} WHERE id = ?";
        $stmt = $this->db->raw($sql, [$broadcast_id]);
        return $stmt->rowCount();
    }

    /**
     * Get broadcasts for a section
     */
    public function get_broadcasts_by_section($section_id, $limit = 50)
    {
        $sql = "SELECT b.*, COUNT(m.id) as message_count
                FROM {$this->table} b
                LEFT JOIN messages m ON b.id = m.broadcast_id
                WHERE b.section_id = ?
                GROUP BY b.id
                ORDER BY b.created_at DESC
                LIMIT ?";
        
        $stmt = $this->db->raw($sql, [$section_id, $limit]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get all broadcasts (admin or system wide)
     */
    public function get_all_broadcasts($limit = 100, $offset = 0)
    {
        $sql = "SELECT b.*, u.first_name, u.last_name, u.email, COUNT(m.id) as message_count
                FROM {$this->table} b
                JOIN users u ON b.teacher_id = u.id
                LEFT JOIN messages m ON b.id = m.broadcast_id
                GROUP BY b.id
                ORDER BY b.created_at DESC
                LIMIT ? OFFSET ?";
        
        $stmt = $this->db->raw($sql, [$limit, $offset]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
