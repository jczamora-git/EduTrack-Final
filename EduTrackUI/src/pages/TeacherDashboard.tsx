import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, FileText, TrendingUp, Plus, Award, QrCode } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { NotificationBell } from "@/components/NotificationBell";
import { useEffect, useState } from "react";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { useNotificationContext } from "@/context/NotificationContext";

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { notifications, addNotification } = useNotificationContext();
  
  // State for real data
  const [courses, setCourses] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [recentGrades, setRecentGrades] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    totalActivities: 0,
    avgGrade: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch announcements and seed global notifications
  useEffect(() => {
    let mounted = true;
    const loadAnnouncements = async () => {
      try {
        const res = await apiGet(API_ENDPOINTS.ANNOUNCEMENTS);
        const list = res.data ?? res.announcements ?? res ?? [];

        const matchesAudience = (aud: string | null | undefined) => {
          const role = user?.role ?? '';
          if (!aud) return true;
          const a = String(aud).toLowerCase();
          if (a === 'all') return true;
          if (role === 'student' && (a === 'students' || a === 'student')) return true;
          if (role === 'teacher' && (a === 'teachers' || a === 'teacher')) return true;
          if (role === 'admin') return true;
          return false;
        };

        const existingMsg = new Set<string>();
        const existingIds = new Set<string | number>();
        notifications.forEach((n: any) => {
          if (n.sourceId) existingIds.add(String(n.sourceId));
          if (n.message) existingMsg.add(n.message);
        });

        (Array.isArray(list) ? list : []).forEach((a: any) => {
          if (!mounted) return;
          if (!matchesAudience(a.audience)) return;
          const msg = a.title ? `${a.title}: ${a.message ?? ''}` : (a.message ?? '');
          const sid = a.id ?? a._id ?? null;
          if (sid && existingIds.has(String(sid))) return;
          if (!sid && existingMsg.has(msg)) return;

          addNotification({ type: 'info', message: msg, duration: 0, meta: a, sourceId: sid, displayToast: false });
          if (sid) existingIds.add(String(sid));
          existingMsg.add(msg);
        });
      } catch (e) {
        // ignore
      }
    };
    loadAnnouncements();
    return () => { mounted = false; };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch teacher's courses using assigned_courses which has students_count
      const coursesRes = await apiGet(`${API_ENDPOINTS.TEACHER_ASSIGNMENTS}/my`);
      const assignedCourses = coursesRes.assigned_courses ?? [];

      if (!Array.isArray(assignedCourses) || assignedCourses.length === 0) {
        setCourses([]);
        setRecentActivities([]);
        setRecentGrades([]);
        setStats({ totalCourses: 0, totalStudents: 0, totalActivities: 0, avgGrade: 0 });
        setLoading(false);
        return;
      }

      // Get all course IDs (teacher_subject_id) for fetching activities
      const courseIds = assignedCourses.map((c: any) => c.teacher_subject_id ?? c.id);
      
      // Calculate total students from sections' students_count
      let totalStudents = 0;
      assignedCourses.forEach((course: any) => {
        if (Array.isArray(course.sections)) {
          course.sections.forEach((sec: any) => {
            totalStudents += sec.students_count ?? 0;
          });
        }
      });

      // Fetch activities for teacher's courses using the optimized endpoint
      let allActivities: any[] = [];
      try {
        const activitiesRes = await apiGet(API_ENDPOINTS.ACTIVITIES_TEACHER_WITH_GRADES);
        allActivities = activitiesRes.data ?? activitiesRes.activities ?? [];
      } catch (e) {
        // Fallback to regular activities endpoint
        const activitiesRes = await apiGet(API_ENDPOINTS.ACTIVITIES);
        allActivities = activitiesRes.data ?? activitiesRes.activities ?? [];
      }

      // Filter activities to only those belonging to teacher's courses
      const teacherActivities = allActivities.filter((a: any) => {
        const actCourseId = a.course_id ?? a.teacher_subject_id;
        return courseIds.includes(Number(actCourseId)) || courseIds.includes(String(actCourseId));
      });

      // Process courses with stats
      const coursesWithStats = assignedCourses.map((course: any) => {
        const courseId = course.teacher_subject_id ?? course.id;
        
        // Count students across all sections
        let studentCount = 0;
        if (Array.isArray(course.sections)) {
          course.sections.forEach((sec: any) => {
            studentCount += sec.students_count ?? 0;
          });
        }

        // Count activities for this course
        const courseActivities = teacherActivities.filter((a: any) => {
          const actCourseId = a.course_id ?? a.teacher_subject_id;
          return String(actCourseId) === String(courseId);
        });

        return {
          id: courseId,
          subject_id: course.subject_id ?? course.id,
          name: course.course_name ?? 'N/A',
          code: course.course_code ?? '',
          students: studentCount,
          activities: courseActivities.length,
          avgGrade: 0, // Will calculate if needed
          sections: course.sections ?? [],
          year_level: course.year_level
        };
      });

      // Get recent activities (sorted by creation date)
      const sortedActivities = [...teacherActivities]
        .sort((a, b) => new Date(b.created_at || b.due_at || '').getTime() - 
                        new Date(a.created_at || a.due_at || '').getTime())
        .slice(0, 5);

      // Build recent activities with graded counts
      const recentWithStats = sortedActivities.map((activity: any) => {
        // Find the course for this activity
        const course = assignedCourses.find((c: any) => {
          const courseId = c.teacher_subject_id ?? c.id;
          const actCourseId = activity.course_id ?? activity.teacher_subject_id;
          return String(courseId) === String(actCourseId);
        });

        // Get total students for the activity's section
        let totalForActivity = 0;
        if (course && Array.isArray(course.sections)) {
          const actSection = course.sections.find((s: any) => String(s.id) === String(activity.section_id));
          totalForActivity = actSection?.students_count ?? 0;
        }

        // Use graded_count from the optimized endpoint
        const gradedCount = activity.graded_count ?? 0;

        return {
          id: activity.id,
          course: course?.course_name ?? 'N/A',
          courseId: course?.teacher_subject_id ?? course?.id,
          activity: activity.title ?? activity.name ?? 'Untitled',
          submitted: gradedCount,
          total: totalForActivity,
          sectionId: activity.section_id,
          date: activity.created_at ?? activity.due_at ?? new Date().toISOString().split('T')[0]
        };
      });

      // Fetch recent grades from activities
      const recentGradesList: any[] = [];
      for (const activity of sortedActivities.slice(0, 5)) {
        if (recentGradesList.length >= 5) break;
        try {
          const gradesRes = await apiGet(API_ENDPOINTS.ACTIVITY_GRADES(activity.id));
          const grades = gradesRes.data ?? gradesRes.grades ?? [];
          
          if (Array.isArray(grades)) {
            // Get grades that have been graded (grade is not null)
            const gradedSubmissions = grades
              .filter((g: any) => g.grade !== null && g.grade !== undefined && g.grade !== '')
              .slice(0, 3);

            for (const g of gradedSubmissions) {
              if (recentGradesList.length >= 5) break;
              
              // Try to get student name from the grade response or fetch from students API
              let studentName = g.student_name ?? 
                (g.first_name && g.last_name ? `${g.first_name} ${g.last_name}` : null);
              
              // If no name in grade response, try to fetch student info
              if (!studentName && g.student_id) {
                try {
                  const studentRes = await apiGet(API_ENDPOINTS.STUDENT_BY_ID(g.student_id));
                  const student = studentRes.data ?? studentRes;
                  studentName = student.first_name && student.last_name 
                    ? `${student.first_name} ${student.last_name}` 
                    : (student.name ?? 'Student');
                } catch (e) {
                  studentName = 'Student';
                }
              }
              
              recentGradesList.push({
                studentName: studentName ?? 'Student',
                activity: activity.title ?? activity.name ?? 'Untitled',
                grade: g.grade,
                maxScore: activity.max_score ?? 100,
                date: g.updated_at ?? g.created_at ?? null
              });
            }
          }
        } catch (e) {
          // Ignore grade fetch errors
        }
      }

      // Calculate overall stats
      const totalActivities = teacherActivities.length;

      // Update state
      setCourses(coursesWithStats);
      setRecentActivities(recentWithStats);
      setRecentGrades(recentGradesList);
      setStats({
        totalCourses: coursesWithStats.length,
        totalStudents,
        totalActivities,
        avgGrade: 0 // Can be calculated if needed
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              EduTrack
            </Link>
            <Badge className="bg-accent text-accent-foreground">Teacher</Badge>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome, {user?.name}</h1>
            <p className="text-muted-foreground">Manage your courses and track student progress</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Courses</p>
                  <p className="text-2xl font-bold">{loading ? '...' : stats.totalCourses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold">{loading ? '...' : stats.totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Activities</p>
                  <p className="text-2xl font-bold">{loading ? '...' : stats.totalActivities}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Courses */}
            <Card>
              <CardHeader>
                <CardTitle>My Courses</CardTitle>
                <CardDescription>Manage your active courses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading courses...</div>
                ) : courses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No courses assigned yet</div>
                ) : (
                  courses.map((course) => (
                    <div key={course.id} className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{course.name}</h3>
                          {course.section && (
                            <p className="text-xs text-muted-foreground mt-1">Section: {course.section}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {course.students} students
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              {course.activities} activities
                            </span>
                          </div>
                        </div>
                        {course.avgGrade > 0 && (
                          <Badge variant="secondary" className="bg-success/10 text-success">
                            Avg: {course.avgGrade}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/teacher/courses/${course.id}`}>View Details</Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
                <CardDescription>Latest submissions and assessments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading activities...</div>
                ) : recentActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No recent activities</div>
                ) : (
                  recentActivities.map((activity) => (
                    <div key={activity.id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{activity.activity}</p>
                          <p className="text-sm text-muted-foreground">{activity.course}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{activity.date}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Graded: {activity.submitted}/{activity.total}
                        </p>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/teacher/courses/${activity.courseId}/activities/${activity.id}${activity.sectionId ? `?section_id=${activity.sectionId}` : ''}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/teacher/grades">
                    <FileText className="h-4 w-4 mr-2" />
                    Grade Input
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/teacher/courses">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Manage Courses
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/teacher/attendance-qr">
                    <QrCode className="h-4 w-4 mr-2" />
                    Attendance
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Recent Grades */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Recent Grades
                </CardTitle>
                <CardDescription>Latest graded submissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
                ) : recentGrades.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">No recent grades</div>
                ) : (
                  recentGrades.map((grade, idx) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-sm truncate flex-1">{grade.studentName}</p>
                        <Badge className="text-xs bg-success/10 text-success">
                          {grade.grade}/{grade.maxScore}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{grade.activity}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
