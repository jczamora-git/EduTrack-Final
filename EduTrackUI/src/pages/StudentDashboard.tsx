import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Bell, Award, TrendingUp, ClipboardList, Calendar, QrCode, Settings, MessageSquare, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { useNotificationContext } from "@/context/NotificationContext";
import { NotificationBell } from "@/components/NotificationBell";
import { useEffect, useState } from "react";

const StudentDashboard = () => {
  const { user } = useAuth();
  const { notifications, addNotification } = useNotificationContext();
  const [courses, setCourses] = useState<any[]>([]);
  const [recentGrades, setRecentGrades] = useState<any[]>([]);
  const [courseStats, setCourseStats] = useState<{ averageGrade: number; overallProgress: number }>({ averageGrade: 0, overallProgress: 0 });

  const sidebarNotifications = [
    { id: 1, message: "New assignment posted in Mathematics 101", time: "2 hours ago" },
    { id: 2, message: "Grade updated for Physics Lab Report", time: "1 day ago" },
  ];

  // Fetch announcements and add to global notifications (once)
  useEffect(() => {
    let mounted = true;
    const loadAnnouncements = async () => {
      try {
        const res = await apiGet(API_ENDPOINTS.ANNOUNCEMENTS);
        const list = res.data ?? res.announcements ?? res ?? [];

        const existingMsg = new Set(sidebarNotifications.map((n: any) => n.message));
        const existingIds = new Set<string | number>();
        // Include already-added global notification sourceIds and messages
        notifications.forEach((n: any) => {
          if (n.sourceId) existingIds.add(String(n.sourceId));
          if (n.message) existingMsg.add(n.message);
        });

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

        (Array.isArray(list) ? list : []).forEach((a: any) => {
          if (!mounted) return;
          if (!matchesAudience(a.audience)) return;
          const msg = a.title ? `${a.title}: ${a.message ?? ''}` : (a.message ?? '');
          const sid = a.id ?? a._id ?? null;
          if (sid && existingIds.has(String(sid))) return; // already added
          if (!sid && existingMsg.has(msg)) return; // dedupe by message if no id

          // attach full announcement as meta and keep it persistent
          addNotification({ type: 'info', message: msg, duration: 0, meta: a, sourceId: sid, displayToast: false });
          if (sid) existingIds.add(String(sid));
          existingMsg.add(msg);
        });
      } catch (e) {
        // ignore fetch errors on dashboard
      }
    };

    loadAnnouncements();
    return () => { mounted = false; };
  }, []);

  // Load dashboard data: student -> subjects -> activities/grades
  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        const userId = (user as any)?.id ?? (user as any)?.user_id ?? (user as any)?.userId;
        if (!userId) return;

        // Get student record for this user
        const studentRes = await apiGet(API_ENDPOINTS.STUDENT_BY_USER(userId));
        const student = (studentRes && (studentRes.data ?? studentRes.student)) || studentRes || null;
        const studentId = student?.id ?? student?.student_id ?? student?.studentId;

        // Fetch active academic period to get current semester (reuse logic from MyCourses)
        let activePeriod = null;
        try {
          const ap = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS_ACTIVE);
          activePeriod = ap.data || ap.period || ap || null;
        } catch (err) {
          // ignore
        }

        const studentYearLevelRaw = student.year_level ?? student.yearLevel ?? null;
        let studentYearLevelNum: number | null = null;
        if (typeof studentYearLevelRaw === 'number') studentYearLevelNum = studentYearLevelRaw;
        else if (typeof studentYearLevelRaw === 'string') {
          const m = String(studentYearLevelRaw).match(/(\d+)/);
          studentYearLevelNum = m ? Number(m[1]) : null;
        }

        const semesterMatch = (activePeriod?.semester || '').match(/^(\d+)(st|nd|rd|th)/i);
        const currentSemesterShort = semesterMatch ? (String(semesterMatch[1]) === '1' ? '1st' : '2nd') : null;

        // Try filtered subject fetches similar to MyCourses
        const subjectsQueryBase = new URLSearchParams();
        if (studentYearLevelNum) subjectsQueryBase.set('year_level', String(studentYearLevelNum));
        let subjects: any[] = [];

        const semesterCandidates: (string | null)[] = [];
        if (currentSemesterShort) {
          semesterCandidates.push(currentSemesterShort);
          semesterCandidates.push(currentSemesterShort.startsWith('1') ? '1' : '2');
        } else {
          semesterCandidates.push(null);
        }

        let fetchedSubjects = false;
        for (const sem of semesterCandidates) {
          try {
            const params = new URLSearchParams(subjectsQueryBase.toString());
            if (sem) params.set('semester', sem);
            const subjectsRes = await apiGet(`${API_ENDPOINTS.SUBJECTS_FOR_STUDENT}?${params.toString()}`);
            const rows = subjectsRes.data || subjectsRes.subjects || subjectsRes || [];
            console.debug('StudentDashboard: subjects fetch', params.toString(), rows?.length ?? 0);
            if (Array.isArray(rows) && rows.length > 0) {
              subjects = rows;
              fetchedSubjects = true;
              break;
            }
          } catch (err) {
            // try next candidate
          }
        }

        if (!fetchedSubjects) {
          try {
            const params = new URLSearchParams();
            if (studentYearLevelNum) params.set('year_level', String(studentYearLevelNum));
            const subjectsRes = await apiGet(`${API_ENDPOINTS.SUBJECTS_FOR_STUDENT}?${params.toString()}`);
            const rows = subjectsRes.data || subjectsRes.subjects || subjectsRes || [];
            subjects = Array.isArray(rows) ? rows : [];
            console.debug('StudentDashboard: fallback subjects fetch', rows?.length ?? 0);
          } catch (err) {
            subjects = [];
          }
        }

        // Map subjects into the UI shape (prefer course_name)
        const mappedCourses = (Array.isArray(subjects) ? subjects : []).map((s: any) => ({
          id: s.id ?? s.subject_id,
          name: s.course_name ?? s.title ?? s.name ?? '',
          code: s.course_code ?? s.code ?? '',
          teacher: s.teacher_name ?? (s.teacher && s.teacher.name) ?? '',
          grade: s.average_grade ?? s.avg_grade ?? null,
          progress: s.progress ?? 0,
          status: 'active',
        }));

        if (mounted) setCourses(mappedCourses);

        // Fetch activities + grades for student (recent)
        const activitiesRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES_STUDENT_ALL}?student_id=${studentId}`);
        const activities = (activitiesRes && (activitiesRes.data ?? activitiesRes.activities)) || activitiesRes || [];

        const recent = (Array.isArray(activities) ? activities : [])
          .slice(0, 10)
          .map((a: any) => ({
            activity: a.title ?? a.name ?? a.activity ?? a.activity_title,
            course: a.subject_name ?? (a.subject && a.subject.name) ?? a.course_name ?? '',
            grade: a.grade ?? a.student_grade ?? a.score ?? 0,
            date: a.date ?? a.created_at ?? a.submitted_at ?? a.timestamp,
          }));

        if (mounted) setRecentGrades(recent);

        // Aggregate activities per course to compute per-course grade and progress
        const courseAgg: Record<string, {
          course_id?: number;
          course_name?: string;
          totalActivities: number;
          completedCount: number;
          totalScoreObtained: number;
          totalMaxScore: number;
        }> = {};

        (Array.isArray(activities) ? activities : []).forEach((a: any) => {
          const cid = a.course_id ?? a.subject_id ?? a.courseId ?? a.id ?? null;
          const cname = a.course_name ?? a.subject_name ?? a.course ?? '';
          const key = String(cid || cname || 'unknown');
          if (!courseAgg[key]) courseAgg[key] = { course_id: cid, course_name: cname, totalActivities: 0, completedCount: 0, totalScoreObtained: 0, totalMaxScore: 0 };
          courseAgg[key].totalActivities += 1;
          const hasGrade = a.student_grade !== null && a.student_grade !== undefined;
          if (hasGrade) {
            courseAgg[key].completedCount += 1;
            // If activity provides max_score and student_grade, accumulate percent-equivalent
            const got = Number(a.student_grade) || 0;
            const max = Number(a.max_score) || 0;
            if (max > 0) {
              courseAgg[key].totalScoreObtained += got;
              courseAgg[key].totalMaxScore += max;
            } else {
              // fallback: treat grade as percent already
              courseAgg[key].totalScoreObtained += got;
              courseAgg[key].totalMaxScore += 100;
            }
          }
        });

        // Enrich mappedCourses with computed grade and progress from activities
        const mappedWithStats = mappedCourses.map((mc: any) => {
          const keyById = String(mc.id ?? mc.code ?? mc.name);
          const agg = courseAgg[keyById] || courseAgg[String(mc.name)] || null;
          let gradeVal: number | null = null;
          let progressVal = 0;
          if (agg) {
            if (agg.totalMaxScore > 0) {
              gradeVal = Math.round((agg.totalScoreObtained / agg.totalMaxScore) * 100 * 10) / 10;
            }
            progressVal = agg.totalActivities > 0 ? Math.round((agg.completedCount / agg.totalActivities) * 100) : 0;
          }
          return { ...mc, grade: gradeVal, progress: progressVal };
        });

        if (mounted) setCourses(mappedWithStats);

        // Compute simple overall stats using enriched courses (ignore null grades)
        if (mounted) {
          const graded = mappedWithStats.filter((c: any) => c.grade !== null && c.grade !== undefined);
          const avg = (graded.length > 0) ? graded.reduce((s: number, c: any) => s + Number(c.grade || 0), 0) / graded.length : 0;
          const prog = (mappedWithStats.length > 0) ? Math.round(mappedWithStats.reduce((s: number, c: any) => s + (Number(c.progress) || 0), 0) / mappedWithStats.length) : 0;
          setCourseStats({ averageGrade: Math.round((avg + Number.EPSILON) * 10) / 10, overallProgress: prog });
        }
      } catch (e) {
        // ignore errors silently for now
      }
    };

    loadDashboard();
    return () => { mounted = false; };
  }, [user]);

  // Quick access links for student
  const quickLinks = [
    { name: "My Courses", href: "/student/courses", icon: BookOpen, description: "View enrolled courses", color: "bg-primary/10 text-primary" },
    { name: "My Activities", href: "/student/activities", icon: ClipboardList, description: "Track assignments & exams", color: "bg-accent/10 text-accent" },
    { name: "My Grades", href: "/student/grades", icon: Award, description: "View your grades", color: "bg-success/10 text-success" },
    { name: "My Progress", href: "/student/progress", icon: TrendingUp, description: "Track your journey", color: "bg-warning/10 text-warning" },
    { name: "Attendance QR", href: "/student/attendance-qr", icon: QrCode, description: "Show attendance code", color: "bg-blue-100 text-blue-600" },
    { name: "Notifications", href: "/student/notifications", icon: Bell, description: "View announcements", color: "bg-purple-100 text-purple-600" },
  ];

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">EduTrack</Link>
            <Badge variant="secondary">Student</Badge>4
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name}!</h1>
          <p className="text-muted-foreground">Track your courses and academic progress</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Courses</p>
                  <p className="text-2xl font-bold">{courses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <Award className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average Grade</p>
                  <p className="text-2xl font-bold">{courseStats.averageGrade}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overall Progress</p>
                  <p className="text-2xl font-bold">{courseStats.overallProgress}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Activities</p>
                  <p className="text-2xl font-bold">{recentGrades.length}</p>
                  <p className="text-xs text-muted-foreground">recent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Access Cards */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Access</CardTitle>
                <CardDescription>Navigate to your pages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {quickLinks.map((link, index) => {
                    const Icon = link.icon;
                    return (
                      <Link key={index} to={link.href}>
                        <div className="p-4 border border-border rounded-lg hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer group">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg ${link.color} flex items-center justify-center`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold group-hover:text-primary transition-colors">{link.name}</p>
                              <p className="text-sm text-muted-foreground">{link.description}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* My Courses */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Courses</CardTitle>
                    <CardDescription>Your enrolled courses and progress</CardDescription>
                  </div>
                  <Link to="/student/courses">
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {courses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No courses found</p>
                  </div>
                ) : (
                  courses.slice(0, 4).map((course) => (
                    <Link key={course.id} to={`/student/courses/${course.id}`}>
                      <div className="p-4 border border-border rounded-lg hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{course.name}</h3>
                            <p className="text-sm text-muted-foreground">{course.teacher || 'TBA'}</p>
                          </div>
                          <Badge variant="secondary" className="bg-success/10 text-success">
                            {course.grade !== null ? `${course.grade}%` : 'N/A'}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{course.progress}%</span>
                          </div>
                          <Progress value={course.progress} className="h-2" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent Grades */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Grades</CardTitle>
                    <CardDescription>Your latest assessment results</CardDescription>
                  </div>
                  <Link to="/student/grades">
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentGrades.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No grades yet</p>
                    </div>
                  ) : (
                    recentGrades.slice(0, 5).map((grade, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="font-medium">{grade.activity}</p>
                          <p className="text-sm text-muted-foreground">{grade.course}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-success">{grade.grade}%</p>
                          <p className="text-xs text-muted-foreground">{grade.date}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/student/courses">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <BookOpen className="h-4 w-4 mr-2" />
                    My Courses
                  </Button>
                </Link>
                <Link to="/student/grades">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <Award className="h-4 w-4 mr-2" />
                    My Grades
                  </Button>
                </Link>
                <Link to="/student/activities">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    My Activities
                  </Button>
                </Link>
                <Link to="/student/attendance-qr">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <QrCode className="h-4 w-4 mr-2" />
                    Attendance QR
                  </Button>
                </Link>
                <Link to="/student/settings">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Academic Progress Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Progress Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Course Completion</span>
                    <span className="font-semibold">{courseStats.overallProgress}%</span>
                  </div>
                  <Progress value={courseStats.overallProgress} className="h-2" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Average Grade</span>
                    <span className="font-semibold">{courseStats.averageGrade}%</span>
                  </div>
                  <Progress value={courseStats.averageGrade} className="h-2" />
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Enrolled Courses</span>
                    <span className="font-semibold">{courses.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Recent Activities</span>
                    <span className="font-semibold">{recentGrades.length}</span>
                  </div>
                </div>

                <Link to="/student/progress" className="block">
                  <Button variant="outline" size="sm" className="w-full">
                    View Full Progress
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
