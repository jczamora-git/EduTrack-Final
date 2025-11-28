import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, GraduationCap, Settings, Plus, TrendingUp, Calendar, Edit, Bell, FileText, Grid3x3, ClipboardList, School } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { useEffect, useState } from "react";

const AdminDashboard = () => {
  const { user } = useAuth();
  
  // Fetch active academic period
  const { data: activePeriodData } = useQuery({
    queryKey: ['academic-period', 'active'],
    queryFn: () => apiGet(API_ENDPOINTS.ACADEMIC_PERIODS_ACTIVE),
  });
  
  const activePeriod = activePeriodData?.data;

  // State for dashboard stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalTeachers: 0,
    activeTeachers: 0,
    totalSubjects: 0,
    totalSections: 0,
    totalAnnouncements: 0,
  });
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [recentTeachers, setRecentTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch students stats
        const studentsRes = await apiGet(`${API_ENDPOINTS.STUDENTS}?limit=5`);
        const studentsList = studentsRes.data ?? studentsRes.students ?? [];
        const studentsStatsRes = await apiGet(`${API_ENDPOINTS.STUDENTS}/stats`).catch(() => ({ data: {} }));
        const studentStats = studentsStatsRes.data ?? studentsStatsRes ?? {};

        // Fetch teachers stats
        const teachersRes = await apiGet(`${API_ENDPOINTS.TEACHERS}?limit=5`);
        const teachersList = teachersRes.data ?? teachersRes.teachers ?? [];
        const teachersStatsRes = await apiGet(API_ENDPOINTS.TEACHER_STATS).catch(() => ({ stats: {} }));
        const teacherStats = teachersStatsRes.stats ?? teachersStatsRes.data ?? {};

        // Fetch subjects
        const subjectsRes = await apiGet(API_ENDPOINTS.SUBJECTS).catch(() => ({ data: [] }));
        const subjectsList = subjectsRes.data ?? subjectsRes.subjects ?? [];

        // Fetch sections
        const sectionsRes = await apiGet(API_ENDPOINTS.SECTIONS).catch(() => ({ data: [] }));
        const sectionsList = sectionsRes.data ?? sectionsRes.sections ?? [];

        // Fetch announcements
        const announcementsRes = await apiGet(API_ENDPOINTS.ANNOUNCEMENTS).catch(() => ({ data: [] }));
        const announcementsList = announcementsRes.data ?? announcementsRes.announcements ?? [];

        // Set stats
        setStats({
          totalStudents: studentStats.total ?? studentsList.length ?? 0,
          activeStudents: studentStats.active ?? studentsList.filter((s: any) => s.status === 'active').length ?? 0,
          totalTeachers: teacherStats.total ?? teachersList.length ?? 0,
          activeTeachers: teacherStats.active ?? teachersList.filter((t: any) => t.status === 'active').length ?? 0,
          totalSubjects: Array.isArray(subjectsList) ? subjectsList.length : 0,
          totalSections: Array.isArray(sectionsList) ? sectionsList.length : 0,
          totalAnnouncements: Array.isArray(announcementsList) ? announcementsList.length : 0,
        });

        // Set recent users
        setRecentStudents(Array.isArray(studentsList) ? studentsList.slice(0, 5) : []);
        setRecentTeachers(Array.isArray(teachersList) ? teachersList.slice(0, 5) : []);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Quick links for admin
  const quickLinks = [
    { name: "Students", href: "/admin/users/students", icon: Users, description: "Manage student accounts", count: stats.totalStudents },
    { name: "Teachers", href: "/admin/users/teachers", icon: GraduationCap, description: "Manage teacher accounts", count: stats.totalTeachers },
    { name: "Subjects", href: "/admin/users/subjects", icon: BookOpen, description: "Manage course subjects", count: stats.totalSubjects },
    { name: "Sections", href: "/admin/users/sections", icon: Grid3x3, description: "Manage class sections", count: stats.totalSections },
    { name: "Announcements", href: "/admin/announcements", icon: Bell, description: "System announcements", count: stats.totalAnnouncements },
    { name: "User Management", href: "/admin/users", icon: Settings, description: "All user accounts", count: null },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground">System overview and management</p>
        </div>

        {/* Current Academic Period Card */}
        <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Current Academic Period</CardTitle>
                  <CardDescription>Active grading period for the system</CardDescription>
                </div>
              </div>
              <Link to="/admin/academic-periods">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Manage Periods
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {activePeriod ? (
              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">School Year</p>
                  <p className="text-lg font-bold text-primary">{activePeriod.school_year}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Semester</p>
                  <p className="text-lg font-bold">{activePeriod.semester}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Grading Period</p>
                  <Badge className="text-sm px-3 py-1">
                    {activePeriod.period_type}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Period Duration</p>
                  <p className="text-sm font-medium">
                    {new Date(activePeriod.start_date).toLocaleDateString()} - {new Date(activePeriod.end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground mb-4">No active academic period set</p>
                <Link to="/admin/academic-periods">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Set Up Academic Period
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold">{loading ? '...' : stats.totalStudents}</p>
                  <p className="text-xs text-muted-foreground">{stats.activeStudents} active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Teachers</p>
                  <p className="text-2xl font-bold">{loading ? '...' : stats.totalTeachers}</p>
                  <p className="text-xs text-muted-foreground">{stats.activeTeachers} active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subjects</p>
                  <p className="text-2xl font-bold">{loading ? '...' : stats.totalSubjects}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Grid3x3 className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sections</p>
                  <p className="text-2xl font-bold">{loading ? '...' : stats.totalSections}</p>
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
                <CardDescription>Navigate to management pages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {quickLinks.map((link, index) => {
                    const Icon = link.icon;
                    return (
                      <Link key={index} to={link.href}>
                        <div className="p-4 border border-border rounded-lg hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold">{link.name}</p>
                                {link.count !== null && (
                                  <Badge variant="secondary">{link.count}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{link.description}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Students */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Students</CardTitle>
                    <CardDescription>Newly registered students</CardDescription>
                  </div>
                  <Link to="/admin/users/students">
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : recentStudents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No students found</div>
                  ) : (
                    recentStudents.map((student: any, index: number) => (
                      <div key={student.id ?? index} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="font-semibold text-primary text-sm">
                              {(student.first_name?.[0] ?? '')}{(student.last_name?.[0] ?? '')}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{student.first_name} {student.last_name}</p>
                            <p className="text-xs text-muted-foreground">{student.student_id ?? student.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {student.year_level ?? 'N/A'}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={student.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}
                          >
                            {student.status ?? 'active'}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Teachers */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Teachers</CardTitle>
                    <CardDescription>Newly registered teachers</CardDescription>
                  </div>
                  <Link to="/admin/users/teachers">
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : recentTeachers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No teachers found</div>
                  ) : (
                    recentTeachers.map((teacher: any, index: number) => (
                      <div key={teacher.id ?? index} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                            <span className="font-semibold text-accent text-sm">
                              {(teacher.first_name?.[0] ?? '')}{(teacher.last_name?.[0] ?? '')}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{teacher.first_name} {teacher.last_name}</p>
                            <p className="text-xs text-muted-foreground">{teacher.employee_id ?? teacher.email}</p>
                          </div>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={teacher.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}
                        >
                          {teacher.status ?? 'active'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* System Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  System Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Students</span>
                    <span className="font-semibold">{stats.totalStudents}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all" 
                      style={{ width: stats.totalStudents > 0 ? `${Math.min((stats.activeStudents / stats.totalStudents) * 100, 100)}%` : '0%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{stats.activeStudents} active students</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Teachers</span>
                    <span className="font-semibold">{stats.totalTeachers}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent rounded-full transition-all" 
                      style={{ width: stats.totalTeachers > 0 ? `${Math.min((stats.activeTeachers / stats.totalTeachers) * 100, 100)}%` : '0%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{stats.activeTeachers} active teachers</p>
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subjects</span>
                    <span className="font-semibold">{stats.totalSubjects}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Sections</span>
                    <span className="font-semibold">{stats.totalSections}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Announcements</span>
                    <span className="font-semibold">{stats.totalAnnouncements}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Admin Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Administration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/admin/academic-periods">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Academic Periods
                  </Button>
                </Link>
                <Link to="/admin/campuses">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <School className="h-4 w-4 mr-2" />
                    Campuses
                  </Button>
                </Link>
                <Link to="/admin/users/sections">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    Sections
                  </Button>
                </Link>
                <Link to="/admin/pdf-reports">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <FileText className="h-4 w-4 mr-2" />
                    PDF Reports
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

export default AdminDashboard;
