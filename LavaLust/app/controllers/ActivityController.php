<?php

/**
 * ActivityController - Manage activities and grades
 * Handles CRUD operations for activities and grade input/viewing for transparency
 */
class ActivityController extends Controller
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Get all activities for a course
     * GET /api/activities?course_id=6&section_id=1&type=assignment&academic_period_id=6&status=published
     */
    public function api_get_activities()
    {
        api_set_json_headers();

        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $filters = [];
            
            if (!empty($_GET['course_id'])) {
                $filters['course_id'] = $_GET['course_id'];
            }
            if (!empty($_GET['section_id'])) {
                $filters['section_id'] = $_GET['section_id'];
            }
            if (!empty($_GET['type'])) {
                $filters['type'] = $_GET['type'];
            }
            if (!empty($_GET['academic_period_id'])) {
                $filters['academic_period_id'] = $_GET['academic_period_id'];
            }
            if (!empty($_GET['status'])) {
                $filters['status'] = $_GET['status'];
            }
            if (!empty($_GET['search'])) {
                $filters['search'] = $_GET['search'];
            }

            $activities = $this->ActivityModel->get_all($filters);

            // Enrich with grading stats and current period context
            if (is_array($activities)) {
                foreach ($activities as &$activity) {
                    $activity['grading_stats'] = $this->ActivityModel->get_grading_stats($activity['id']);
                }
            }

            // Include current academic period context
            $gradingContext = $this->AcademicPeriodModel->get_grading_context();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $activities,
                'count' => is_array($activities) ? count($activities) : 0,
                'grading_context' => $gradingContext
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get single activity by ID
     * GET /api/activities/{id}
     */
    public function api_get_activity($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $activity = $this->ActivityModel->get_activity($id);

            if (!$activity) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Activity not found'
                ]);
                return;
            }

            // Enrich with grading stats
            $activity['grading_stats'] = $this->ActivityModel->get_grading_stats($activity['id']);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $activity
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Create a new activity (teacher only)
     * POST /api/activities
     * Body: { course_id, title, type, academic_period_id?, max_score, due_at, section_id? }
     */
    public function api_create_activity()
    {
        api_set_json_headers();

        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        // Only teachers can create activities (adjust role check as needed)
        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher' && $userRole !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden: only teachers/admins can create activities'
            ]);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validation
            if (empty($data['course_id']) || empty($data['title']) || empty($data['type'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required fields: course_id, title, type'
                ]);
                return;
            }

            // Get current academic period if not provided
            $academicPeriodId = $data['academic_period_id'] ?? null;
            if (!$academicPeriodId) {
                $activePeriod = $this->AcademicPeriodModel->get_active_period();
                $academicPeriodId = $activePeriod ? $activePeriod['id'] : null;
            }

            // Prepare activity data
            $activityData = [
                'course_id' => $data['course_id'],
                'title' => $data['title'],
                'type' => $data['type'],
                'academic_period_id' => $academicPeriodId,
                'max_score' => $data['max_score'] ?? 100,
                'due_at' => $data['due_at'] ?? null,
                'section_id' => $data['section_id'] ?? null,
            ];

            $newId = $this->ActivityModel->create($activityData);

            if ($newId) {
                $activity = $this->ActivityModel->get_activity($newId);
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Activity created successfully',
                    'data' => $activity
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create activity'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Update activity (teacher only)
     * PUT /api/activities/{id}
     */
    public function api_update_activity($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher' && $userRole !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden: only teachers/admins can update activities'
            ]);
            return;
        }

        try {
            $activity = $this->ActivityModel->get_activity($id);
            if (!$activity) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Activity not found'
                ]);
                return;
            }

            $data = json_decode(file_get_contents('php://input'), true);
            $updateData = [];

            // Only allow certain fields to be updated
            if (!empty($data['title'])) $updateData['title'] = $data['title'];
            if (!empty($data['type'])) $updateData['type'] = $data['type'];
            if (isset($data['academic_period_id'])) $updateData['academic_period_id'] = $data['academic_period_id'];
            if (isset($data['max_score'])) $updateData['max_score'] = $data['max_score'];
            if (isset($data['due_at'])) $updateData['due_at'] = $data['due_at'];

            $result = $this->ActivityModel->update($id, $updateData);

            if ($result) {
                $updated = $this->ActivityModel->get_activity($id);
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Activity updated successfully',
                    'data' => $updated
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update activity'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Delete activity (teacher/admin only)
     * DELETE /api/activities/{id}
     */
    public function api_delete_activity($id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher' && $userRole !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden'
            ]);
            return;
        }

        try {
            $activity = $this->ActivityModel->get_activity($id);
            if (!$activity) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Activity not found'
                ]);
                return;
            }

            $result = $this->ActivityModel->delete($id);

            if ($result) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Activity deleted successfully'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to delete activity'
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Get grades for an activity (all students)
     * GET /api/activities/{id}/grades
     */
    public function api_get_activity_grades($activityId)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $grades = $this->db->table('activity_grades')
                               ->where('activity_id', $activityId)
                               ->get_all();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $grades,
                'count' => is_array($grades) ? count($grades) : 0
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Generic query for activity_grades
     * GET /api/activity-grades?activity_id=123&student_id=45
     * Returns grade rows filtered by activity_id and/or student_id
     */
    public function api_get_activity_grades_by_params()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $activityId = isset($_GET['activity_id']) ? (int)$_GET['activity_id'] : null;
            $studentId = isset($_GET['student_id']) ? (int)$_GET['student_id'] : null;

            if (!$activityId && !$studentId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'At least one filter required: activity_id or student_id']);
                return;
            }

            $sql = "SELECT * FROM activity_grades WHERE 1=1";
            $params = [];

            if ($activityId) {
                $sql .= " AND activity_id = ?";
                $params[] = $activityId;
            }
            if ($studentId) {
                $sql .= " AND student_id = ?";
                $params[] = $studentId;
            }

            $sql .= " ORDER BY id DESC";

            $stmt = $this->db->raw($sql, $params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => $rows, 'count' => is_array($rows) ? count($rows) : 0]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
    }

    /**
     * Input / Update grade for a student on an activity (teacher only)
     * POST /api/activities/{id}/grades
     * Body: { student_id, grade, status }
     */
    public function api_set_grade($activityId)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        $userRole = $this->session->userdata('role');
        if ($userRole !== 'teacher' && $userRole !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden: only teachers/admins can input grades'
            ]);
            return;
        }

        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Validation
            if (empty($data['student_id'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required field: student_id'
                ]);
                return;
            }

            // Check if grade record exists
            $existing = $this->db->table('activity_grades')
                                 ->where('activity_id', $activityId)
                                 ->where('student_id', $data['student_id'])
                                 ->get();

            $gradeData = [
                'grade' => $data['grade'] ?? null,
                'status' => $data['status'] ?? 'Pending',
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            if ($existing) {
                // Update existing record
                $result = $this->db->table('activity_grades')
                                   ->where('activity_id', $activityId)
                                   ->where('student_id', $data['student_id'])
                                   ->update($gradeData);

                if ($result) {
                    $updated = $this->db->table('activity_grades')
                                        ->where('activity_id', $activityId)
                                        ->where('student_id', $data['student_id'])
                                        ->get();
                    http_response_code(200);
                    echo json_encode([
                        'success' => true,
                        'message' => 'Grade updated successfully',
                        'data' => $updated
                    ]);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Failed to update grade'
                    ]);
                }
            } else {
                // Create new record
                $gradeData['activity_id'] = $activityId;
                $gradeData['student_id'] = $data['student_id'];
                $gradeData['created_at'] = date('Y-m-d H:i:s');

                $result = $this->db->table('activity_grades')
                                   ->insert($gradeData);

                if ($result) {
                    $created = $this->db->table('activity_grades')
                                        ->where('activity_id', $activityId)
                                        ->where('student_id', $data['student_id'])
                                        ->get();
                    http_response_code(201);
                    echo json_encode([
                        'success' => true,
                        'message' => 'Grade created successfully',
                        'data' => $created
                    ]);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Failed to create grade'
                    ]);
                }
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Export class record to CSV
     * GET /api/activities/export-class-record?course_id=6&section_id=1&academic_period_id=21
     */
    public function api_export_class_record()
    {
        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            // Load helper
            $this->call->helper('classrecord');
            
            // Get parameters
            $courseId = $_GET['course_id'] ?? null;
            $sectionId = $_GET['section_id'] ?? null;
            $academicPeriodId = $_GET['academic_period_id'] ?? null;

            if (!$courseId || !$sectionId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameters: course_id and section_id'
                ]);
                return;
            }

            // Get course info with teacher name
            $course = $this->db->table('teacher_subjects ts')
                ->select('s.course_code, s.course_name, s.year_level, u.first_name as teacher_first_name, u.last_name as teacher_last_name')
                ->join('subjects s', 's.id = ts.subject_id')
                ->join('teachers t', 't.id = ts.teacher_id')
                ->join('users u', 'u.id = t.user_id')
                ->where('ts.id', $courseId)
                ->get();

            if (!$course) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Course not found'
                ]);
                return;
            }

            // Get section info
            $section = $this->db->table('sections')
                ->where('id', $sectionId)
                ->get();

            if (!$section) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Section not found'
                ]);
                return;
            }

            // Get academic period info
            $periodInfo = '';
            if ($academicPeriodId) {
                $period = $this->db->table('academic_periods')
                    ->where('id', $academicPeriodId)
                    ->get();
                if ($period) {
                    $periodInfo = $period['school_year'] . ' - ' . $period['semester'] . ' (' . $period['period_type'] . ')';
                }
            }

            // Get activities
            $activityFilters = [
                'course_id' => $courseId,
                'section_id' => $sectionId
            ];
            if ($academicPeriodId) {
                $activityFilters['academic_period_id'] = $academicPeriodId;
            }
            $activities = $this->ActivityModel->get_all($activityFilters);

            // Categorize activities
            $written = [];
            $performance = [];
            $exam = [];
            foreach ($activities as $act) {
                $type = strtolower($act['type'] ?? '');
                if (in_array($type, ['quiz', 'assignment', 'other'])) {
                    $written[] = $act;
                } elseif (in_array($type, ['project', 'laboratory', 'performance'])) {
                    $performance[] = $act;
                } elseif ($type === 'exam') {
                    $exam[] = $act;
                }
            }

            // Get students with grades
            $yearLevel = $course['year_level'] ?? null;
            $studentsQuery = $this->db->table('students st')
                ->select('st.id, st.student_id, u.first_name, u.last_name, u.email')
                ->join('users u', 'u.id = st.user_id')
                ->where('st.section_id', $sectionId);
            
            if ($yearLevel) {
                $studentsQuery->where('st.year_level', $yearLevel);
            }
            
            $students = $studentsQuery->get_all();

            // Get all grades for these students and activities
            $activityIds = array_column($activities, 'id');
            $studentIds = array_column($students, 'id');
            
            $grades = [];
            if (!empty($activityIds) && !empty($studentIds)) {
                // Build IN clauses manually since LavaLust doesn't have where_in()
                $activityPlaceholders = implode(',', array_fill(0, count($activityIds), '?'));
                $studentPlaceholders = implode(',', array_fill(0, count($studentIds), '?'));
                
                $query = "SELECT * FROM activity_grades 
                          WHERE activity_id IN ($activityPlaceholders) 
                          AND student_id IN ($studentPlaceholders)";
                
                $bindValues = array_merge($activityIds, $studentIds);
                $gradesData = $this->db->raw($query, $bindValues)->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($gradesData as $grade) {
                    $key = $grade['student_id'] . '_' . $grade['activity_id'];
                    $grades[$key] = $grade['grade'];
                }
            }

            // Build student rows data
            $studentRows = [];
            
            // Calculate max scores
            $writtenMax = array_sum(array_column($written, 'max_score'));
            $performanceMax = array_sum(array_column($performance, 'max_score'));
            $examMax = array_sum(array_column($exam, 'max_score'));

            foreach ($students as $idx => $student) {
                $row = [
                    $idx + 1,
                    $student['student_id'],
                    trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
                ];

                // Written Works
                $writtenTotal = 0;
                foreach ($written as $act) {
                    $key = $student['id'] . '_' . $act['id'];
                    $grade = $grades[$key] ?? 0;
                    $writtenTotal += $grade;
                    $row[] = $grade;
                }
                $row[] = $writtenTotal;
                $row[] = $writtenMax > 0 ? round(($writtenTotal / $writtenMax) * 100, 2) : 0;
                $row[] = $writtenMax > 0 ? round(($writtenTotal / $writtenMax) * 30, 2) : 0;

                // Performance Tasks
                $performanceTotal = 0;
                foreach ($performance as $act) {
                    $key = $student['id'] . '_' . $act['id'];
                    $grade = $grades[$key] ?? 0;
                    $performanceTotal += $grade;
                    $row[] = $grade;
                }
                $row[] = $performanceTotal;
                $row[] = $performanceMax > 0 ? round(($performanceTotal / $performanceMax) * 100, 2) : 0;
                $row[] = $performanceMax > 0 ? round(($performanceTotal / $performanceMax) * 40, 2) : 0;

                // Exam
                $examTotal = 0;
                foreach ($exam as $act) {
                    $key = $student['id'] . '_' . $act['id'];
                    $grade = $grades[$key] ?? 0;
                    $examTotal += $grade;
                }
                if (!empty($exam)) {
                    $row[] = $examTotal;
                    $row[] = $examMax > 0 ? round(($examTotal / $examMax) * 100, 2) : 0;
                    $row[] = $examMax > 0 ? round(($examTotal / $examMax) * 30, 2) : 0;
                }

                // Final Grade
                $writtenWS = $writtenMax > 0 ? ($writtenTotal / $writtenMax) * 30 : 0;
                $performanceWS = $performanceMax > 0 ? ($performanceTotal / $performanceMax) * 40 : 0;
                $examWS = $examMax > 0 ? ($examTotal / $examMax) * 30 : 0;
                $initialGrade = $writtenWS + $performanceWS + $examWS;
                
                $row[] = round($initialGrade, 2);
                $row[] = $this->transmute($initialGrade);

                $studentRows[] = $row;
            }

            // Prepare data for helper
            $courseInfo = [
                'course_code' => $course['course_code'] ?? '',
                'course_name' => $course['course_name'] ?? '',
                'teacher_name' => trim(($course['teacher_first_name'] ?? '') . ' ' . ($course['teacher_last_name'] ?? '')),
                'section_name' => $section['name'] ?? 'N/A',
                'period_info' => $periodInfo
            ];

            $categorizedActivities = [
                'written' => $written,
                'performance' => $performance,
                'exam' => $exam
            ];

            // Generate filename
            $courseCode = $course['course_code'] ?? 'Course';
            $sectionName = $section['name'] ?? 'Section';
            $timestamp = date('Ymd_His');
            $filename = "ClassRecord_{$courseCode}_{$sectionName}_{$timestamp}.csv";

            // Call helper to export CSV (this will exit)
            export_class_record_csv($courseInfo, $studentRows, $categorizedActivities, $filename);

        } catch (Exception $e) {
            // Log the error for debugging
            error_log('Export class record error: ' . $e->getMessage());
            
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Export failed: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Export class record to Excel with styling and formulas
     * GET /api/activities/export-class-record-excel?course_id=6&section_id=1&academic_period_id=21
     */
    public function api_export_class_record_excel()
    {
        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            // Load helper
            $this->call->helper('classrecord_excel');
            
            // Get parameters
            $courseId = $_GET['course_id'] ?? null;
            $sectionId = $_GET['section_id'] ?? null;
            $academicPeriodId = $_GET['academic_period_id'] ?? null;

            if (!$courseId || !$sectionId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameters: course_id and section_id'
                ]);
                return;
            }

            // Get course info with teacher name
            $course = $this->db->table('teacher_subjects ts')
                ->select('s.course_code, s.course_name, s.year_level, u.first_name as teacher_first_name, u.last_name as teacher_last_name')
                ->join('subjects s', 's.id = ts.subject_id')
                ->join('teachers t', 't.id = ts.teacher_id')
                ->join('users u', 'u.id = t.user_id')
                ->where('ts.id', $courseId)
                ->get();

            if (!$course) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Course not found'
                ]);
                return;
            }

            // Get section info
            $section = $this->db->table('sections')
                ->where('id', $sectionId)
                ->get();

            if (!$section) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Section not found'
                ]);
                return;
            }

            // Get academic period info
            $periodInfo = '';
            if ($academicPeriodId) {
                $period = $this->db->table('academic_periods')
                    ->where('id', $academicPeriodId)
                    ->get();
                if ($period) {
                    $periodInfo = $period['school_year'] . ' - ' . $period['semester'] . ' (' . $period['period_type'] . ')';
                }
            }

            // Get activities
            $activityFilters = [
                'course_id' => $courseId,
                'section_id' => $sectionId
            ];
            if ($academicPeriodId) {
                $activityFilters['academic_period_id'] = $academicPeriodId;
            }
            $activities = $this->ActivityModel->get_all($activityFilters);

            // Categorize activities
            $written = [];
            $performance = [];
            $exam = [];
            foreach ($activities as $act) {
                $type = strtolower($act['type'] ?? '');
                if (in_array($type, ['quiz', 'assignment', 'other'])) {
                    $written[] = $act;
                } elseif (in_array($type, ['project', 'laboratory', 'performance'])) {
                    $performance[] = $act;
                } elseif ($type === 'exam') {
                    $exam[] = $act;
                }
            }

            // Get students
            $yearLevel = $course['year_level'] ?? null;
            $studentsQuery = $this->db->table('students st')
                ->select('st.id, st.student_id, u.first_name, u.last_name, u.email')
                ->join('users u', 'u.id = st.user_id')
                ->where('st.section_id', $sectionId);
            
            if ($yearLevel) {
                $studentsQuery->where('st.year_level', $yearLevel);
            }
            
            $students = $studentsQuery->get_all();

            // Get all grades
            $activityIds = array_column($activities, 'id');
            $studentIds = array_column($students, 'id');
            
            $grades = [];
            if (!empty($activityIds) && !empty($studentIds)) {
                $activityPlaceholders = implode(',', array_fill(0, count($activityIds), '?'));
                $studentPlaceholders = implode(',', array_fill(0, count($studentIds), '?'));
                
                $query = "SELECT * FROM activity_grades 
                          WHERE activity_id IN ($activityPlaceholders) 
                          AND student_id IN ($studentPlaceholders)";
                
                $bindValues = array_merge($activityIds, $studentIds);
                $gradesData = $this->db->raw($query, $bindValues)->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($gradesData as $grade) {
                    $key = $grade['student_id'] . '_' . $grade['activity_id'];
                    $grades[$key] = $grade['grade'];
                }
            }

            // Prepare data for helper
            $courseInfo = [
                'course_code' => $course['course_code'] ?? '',
                'course_name' => $course['course_name'] ?? '',
                'teacher_name' => trim(($course['teacher_first_name'] ?? '') . ' ' . ($course['teacher_last_name'] ?? '')),
                'section_name' => $section['name'] ?? 'N/A',
                'period_info' => $periodInfo
            ];

            $categorizedActivities = [
                'written' => $written,
                'performance' => $performance,
                'exam' => $exam
            ];

            // Generate filename
            $courseCode = $course['course_code'] ?? 'Course';
            $sectionName = $section['name'] ?? 'Section';
            $timestamp = date('Ymd_His');
            $filename = "ClassRecord_{$courseCode}_{$sectionName}_{$timestamp}.xlsx";

            // Call helper to export Excel (this will exit)
            export_class_record_excel($courseInfo, $students, $categorizedActivities, $grades, $filename);

        } catch (Exception $e) {
            // Log the error for debugging
            error_log('Export class record Excel error: ' . $e->getMessage());
            
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Export failed: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Transmute percentage to grade equivalent
     */
    private function transmute($percentage)
    {
        if ($percentage >= 97) return "1.00";
        if ($percentage >= 94) return "1.25";
        if ($percentage >= 91) return "1.50";
        if ($percentage >= 88) return "1.75";
        if ($percentage >= 85) return "2.00";
        if ($percentage >= 82) return "2.25";
        if ($percentage >= 79) return "2.50";
        if ($percentage >= 76) return "2.75";
        if ($percentage >= 75) return "3.00";
        return "5.00";
    }

    /**
     * OPTIMIZED: Get activities with grades for a specific student
     * GET /api/activities/student-grades?course_id=6&section_id=1&student_id=32
     * 
     * Returns activities with the student's grade embedded in each activity
     * This eliminates N+1 query problem by using a single JOIN query
     */
    public function api_get_student_activities_with_grades()
    {
        api_set_json_headers();

        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $courseId = $_GET['course_id'] ?? null;
            $sectionId = $_GET['section_id'] ?? null;
            $studentId = $_GET['student_id'] ?? null;

            if (!$courseId || !$studentId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameters: course_id and student_id'
                ]);
                return;
            }

            // Build query with LEFT JOIN to get activities and student's grades in one query
            // Note: Using raw query to ensure proper SQL syntax with LEFT JOIN
            $studentIdInt = (int)$studentId;
            $courseIdInt = (int)$courseId;
            
                $sql = "SELECT a.*, ag.grade as student_grade, ag.status as grade_status, ag.id as grade_id, ag.created_at as grade_created_at 
                    FROM activities a 
                    LEFT JOIN activity_grades ag ON a.id = ag.activity_id AND ag.student_id = ? 
                    WHERE a.course_id = ?";
            
            $params = [$studentIdInt, $courseIdInt];
            
            if ($sectionId) {
                $sql .= " AND a.section_id = ?";
                $params[] = (int)$sectionId;
            }

            // Optional filters
            if (!empty($_GET['type'])) {
                $sql .= " AND a.type = ?";
                $params[] = $_GET['type'];
            }
            if (!empty($_GET['academic_period_id'])) {
                $sql .= " AND a.academic_period_id = ?";
                $params[] = (int)$_GET['academic_period_id'];
            }

            $sql .= " ORDER BY a.due_at ASC";

            // Execute raw query - LavaLust's raw() method returns PDOStatement
            $stmt = $this->db->raw($sql, $params);
            $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Transform the result to match expected frontend format
            $result = [];
            if (is_array($activities)) {
                foreach ($activities as $activity) {
                    $result[] = [
                        'id' => $activity['id'],
                        'course_id' => $activity['course_id'],
                        'academic_period_id' => $activity['academic_period_id'],
                        'title' => $activity['title'],
                        'type' => $activity['type'],
                        'max_score' => $activity['max_score'],
                        'due_at' => $activity['due_at'],
                        'section_id' => $activity['section_id'],
                        'created_at' => $activity['created_at'],
                        // Student's grade info (null if not graded yet)
                        'student_grade' => $activity['student_grade'],
                        'grade_status' => $activity['grade_status'] ?? 'Pending',
                        'grade_id' => $activity['grade_id'],
                        'grade_created_at' => $activity['grade_created_at'] ?? null,
                        // Grading stats (optional, can be added if needed)
                        'grading_stats' => $this->ActivityModel->get_grading_stats($activity['id'])
                    ];
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result,
                'count' => count($result)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * OPTIMIZED: Get teacher's activities with graded counts (single request)
     * GET /api/teacher/activities/with-grades
     * 
     * Returns activities for the logged-in teacher's courses with graded_count 
     * This eliminates N+1 query problem for Activities page by counting grades in one batch query
     */
    public function api_get_teacher_activities_with_graded_counts()
    {
        api_set_json_headers();

        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $userId = $this->session->userdata('user_id');
            $userRole = $this->session->userdata('role');

            // Get teacher's courses
            if ($userRole === 'admin') {
                // Admins see all activities
                $sql = "SELECT DISTINCT a.* FROM activities a ORDER BY a.due_at DESC";
                $stmt = $this->db->raw($sql, []);
                $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } else {
                // Teachers see only their assigned courses
                $sql = "SELECT DISTINCT a.* FROM activities a 
                        INNER JOIN teacher_subjects ts ON a.course_id = ts.id 
                        INNER JOIN teachers t ON ts.teacher_id = t.id 
                        WHERE t.user_id = ? 
                        ORDER BY a.due_at DESC";
                $stmt = $this->db->raw($sql, [(int)$userId]);
                $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            if (empty($activities)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => [],
                    'count' => 0
                ]);
                return;
            }

            // Extract activity IDs
            $activityIds = array_column($activities, 'id');

            // Count graded entries (WHERE grade IS NOT NULL) for each activity in a single query
            $placeholders = implode(',', array_fill(0, count($activityIds), '?'));
            $countSql = "SELECT activity_id, COUNT(*) as graded_count 
                        FROM activity_grades 
                        WHERE activity_id IN ($placeholders) AND grade IS NOT NULL 
                        GROUP BY activity_id";
            $countStmt = $this->db->raw($countSql, $activityIds);
            $gradedCounts = $countStmt->fetchAll(PDO::FETCH_ASSOC);

            // Build a map of activity_id => graded_count
            $gradedMap = [];
            foreach ($gradedCounts as $row) {
                $gradedMap[$row['activity_id']] = (int)$row['graded_count'];
            }

            // Enrich activities with graded_count
            $result = [];
            foreach ($activities as $activity) {
                $activity['graded_count'] = $gradedMap[$activity['id']] ?? 0;
                $result[] = $activity;
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result,
                'count' => count($result)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * OPTIMIZED: Get activities for a specific course with grading stats (single request)
     * GET /api/activities/course/with-stats?course_id=6&section_id=1&academic_period_id=20&year_level=1
     * 
     * Returns activities for a specific course with graded_count and total student count
     * This eliminates N+1 query problem for CourseManagement page
     */
    public function api_get_course_activities_with_stats()
    {
        api_set_json_headers();

        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $courseId = $_GET['course_id'] ?? null;
            $sectionId = $_GET['section_id'] ?? null;
            $academicPeriodId = $_GET['academic_period_id'] ?? null;
            $yearLevel = $_GET['year_level'] ?? null;

            if (empty($courseId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'course_id is required'
                ]);
                return;
            }

            // Build activities query with filters
            $conditions = ['a.course_id = ?'];
            $params = [(int)$courseId];

            if (!empty($sectionId)) {
                $conditions[] = 'a.section_id = ?';
                $params[] = (int)$sectionId;
            }
            if (!empty($academicPeriodId)) {
                $conditions[] = 'a.academic_period_id = ?';
                $params[] = (int)$academicPeriodId;
            }

            $whereClause = implode(' AND ', $conditions);
            $sql = "SELECT a.* FROM activities a WHERE $whereClause ORDER BY a.due_at DESC";
            $stmt = $this->db->raw($sql, $params);
            $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($activities)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => [],
                    'count' => 0
                ]);
                return;
            }

            // Count total students for this section/year_level
            $studentParams = [];
            $studentConditions = [];
            
            if (!empty($sectionId)) {
                $studentConditions[] = 's.section_id = ?';
                $studentParams[] = (int)$sectionId;
            }
            if (!empty($yearLevel)) {
                $studentConditions[] = 's.year_level = ?';
                $studentParams[] = (int)$yearLevel;
            }

            $totalStudents = 0;
            if (!empty($studentConditions)) {
                $studentWhere = implode(' AND ', $studentConditions);
                $studentSql = "SELECT COUNT(*) as total FROM students s WHERE $studentWhere";
                $studentStmt = $this->db->raw($studentSql, $studentParams);
                $studentResult = $studentStmt->fetch(PDO::FETCH_ASSOC);
                $totalStudents = (int)($studentResult['total'] ?? 0);
            }

            // Extract activity IDs for batch grade count query
            $activityIds = array_column($activities, 'id');

            // Count graded entries (WHERE grade IS NOT NULL) for each activity in a single query
            $placeholders = implode(',', array_fill(0, count($activityIds), '?'));
            $countSql = "SELECT activity_id, COUNT(*) as graded_count 
                        FROM activity_grades 
                        WHERE activity_id IN ($placeholders) AND grade IS NOT NULL 
                        GROUP BY activity_id";
            $countStmt = $this->db->raw($countSql, $activityIds);
            $gradedCounts = $countStmt->fetchAll(PDO::FETCH_ASSOC);

            // Build a map of activity_id => graded_count
            $gradedMap = [];
            foreach ($gradedCounts as $row) {
                $gradedMap[$row['activity_id']] = (int)$row['graded_count'];
            }

            // Enrich activities with grading_stats
            $result = [];
            foreach ($activities as $activity) {
                $graded = $gradedMap[$activity['id']] ?? 0;
                $pending = max($totalStudents - $graded, 0);
                $percentage = $totalStudents > 0 ? round(($graded / $totalStudents) * 100) : 0;

                $activity['graded_count'] = $graded;
                $activity['grading_stats'] = [
                    'total' => $totalStudents,
                    'graded' => $graded,
                    'pending' => $pending,
                    'percentage_graded' => $percentage
                ];
                $result[] = $activity;
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result,
                'count' => count($result),
                'total_students' => $totalStudents
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * OPTIMIZED: Get all activities with grades for a student (across all enrolled courses)
     * GET /api/activities/student-all?student_id=93
     * 
     * Returns all activities for all courses the student is enrolled in, with grades embedded
     * This eliminates N+1 query problem for MyActivities page
     */
    public function api_get_all_student_activities_with_grades()
    {
        api_set_json_headers();

        // Check authorization
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Unauthorized'
            ]);
            return;
        }

        try {
            $studentId = $_GET['student_id'] ?? null;

            if (!$studentId) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Missing required parameter: student_id'
                ]);
                return;
            }

            $studentIdInt = (int)$studentId;

            // Get student to retrieve section_id. Accept either students.id or user_id (fallback).
            $studentSql = "SELECT * FROM students WHERE id = ?";
            $studentStmt = $this->db->raw($studentSql, [$studentIdInt]);
            $student = $studentStmt->fetch(PDO::FETCH_ASSOC);

            // If not found by students.id, try lookup by user_id (some callers pass user_id)
            if (!$student) {
                $studentSql2 = "SELECT * FROM students WHERE user_id = ?";
                $studentStmt2 = $this->db->raw($studentSql2, [$studentIdInt]);
                $student = $studentStmt2->fetch(PDO::FETCH_ASSOC);
            }

            if (!$student) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Student not found'
                ]);
                return;
            }

            $sectionId = $student['section_id'];

            // Determine the student's courses from teacher assignments for the student's section.
            // Use teacher_subject_sections -> teacher_subjects -> subjects to find subject_ids for the section.
            $taSql = "SELECT ts.subject_id, s.course_code, s.course_name 
                      FROM teacher_subject_sections tss 
                      INNER JOIN teacher_subjects ts ON tss.teacher_subject_id = ts.id 
                      INNER JOIN subjects s ON ts.subject_id = s.id 
                      WHERE tss.section_id = ?";
            $taStmt = $this->db->raw($taSql, [(int)$sectionId]);
            $teacherAssignments = $taStmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($teacherAssignments)) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => [],
                    'count' => 0
                ]);
                return;
            }

            // Build list of course IDs (subject IDs)
            $courseIds = array_map(function($ta) {
                return (int)$ta['subject_id'];
            }, $teacherAssignments);

            // Create a map of subject_id -> course_code for display
            $courseNameMap = [];
            foreach ($teacherAssignments as $ta) {
                $courseNameMap[$ta['subject_id']] = $ta['course_code'];
            }

            // Build SQL with IN clause to get all activities for enrolled courses
            $placeholders = implode(',', array_fill(0, count($courseIds), '?'));
            
                $sql = "SELECT a.*, ag.grade as student_grade, ag.status as grade_status, ag.id as grade_id, ag.created_at as grade_created_at 
                    FROM activities a 
                    LEFT JOIN activity_grades ag ON a.id = ag.activity_id AND ag.student_id = ? 
                    WHERE a.course_id IN ($placeholders) AND a.section_id = ?";
            
            $params = array_merge([$studentIdInt], $courseIds, [(int)$sectionId]);

            // Optional filters
            if (!empty($_GET['type'])) {
                $sql .= " AND a.type = ?";
                $params[] = $_GET['type'];
            }
            if (!empty($_GET['academic_period_id'])) {
                $sql .= " AND a.academic_period_id = ?";
                $params[] = (int)$_GET['academic_period_id'];
            }

            $sql .= " ORDER BY a.due_at DESC";

            // Execute raw query
            $stmt = $this->db->raw($sql, $params);
            $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Transform the result to match expected frontend format
            $result = [];
            if (is_array($activities)) {
                foreach ($activities as $activity) {
                    $result[] = [
                        'id' => $activity['id'],
                        'course_id' => $activity['course_id'],
                        'course_name' => $courseNameMap[$activity['course_id']] ?? 'N/A',
                        'academic_period_id' => $activity['academic_period_id'],
                        'title' => $activity['title'],
                        'type' => $activity['type'],
                        'max_score' => $activity['max_score'],
                        'due_at' => $activity['due_at'],
                        'section_id' => $activity['section_id'],
                        'created_at' => $activity['created_at'],
                        // Student's grade info (null if not graded yet)
                        'student_grade' => $activity['student_grade'],
                        'grade_status' => $activity['grade_status'] ?? 'Pending',
                        'grade_id' => $activity['grade_id'],
                        'grade_created_at' => $activity['grade_created_at'] ?? null
                    ];
                }
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result,
                'count' => count($result)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }
}
