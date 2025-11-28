import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList, Search, List, LayoutGrid } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { API_ENDPOINTS, apiGet } from "@/lib/api";

const Activities = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "teacher") {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real activities data
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        
        // 1. Get teacher's assigned courses
        const coursesRes = await apiGet(`${API_ENDPOINTS.TEACHER_ASSIGNMENTS}/my`);
        const myCourses = coursesRes.assigned_courses || coursesRes.assignments || coursesRes.data || [];
        
        // Create lookup maps; keep the full assignment object for later (year_level, sections)
        const courseMap: Map<any, any> = new Map(
          myCourses.map((c: any) => [
            c.id || c.teacher_subject_id || c.subject_id,
            {
              raw: c,
              code: c.course_code || c.code || 'N/A',
              name: c.course_name || c.title || 'N/A',
              section: c.section_name || 'N/A'
            }
          ])
        );

        // Collect unique (section, year_level) pairs from assignments so we can fetch student counts per pair
        const sectionYearPairs = new Set<string>();
        myCourses.forEach((c: any) => {
          const yearLevel = c.year_level ?? c.yearLevel ?? c.year ?? c.subject?.year_level ?? null;
          if (Array.isArray(c.sections)) {
            for (const s of c.sections) {
              const sid = s.id ?? s.section_id ?? null;
              if (sid !== null && sid !== undefined) sectionYearPairs.add(`${sid}|${yearLevel ?? ''}`);
            }
          } else if (c.section_id) {
            sectionYearPairs.add(`${c.section_id}|${yearLevel ?? ''}`);
          }
        });

        // Fetch students count per (section, year_level). We'll also keep a fallback map keyed by section only.
        const sectionYearCounts: Record<string, number> = {};
        const sectionCountsFallback: Record<string, number> = {};
        await Promise.all(Array.from(sectionYearPairs).map(async (pair) => {
          try {
            const [sid, ylvl] = pair.split('|');
            const params = new URLSearchParams();
            params.set('section_id', String(sid));
            if (ylvl && ylvl.length > 0) params.set('year_level', String(ylvl));
            const res = await apiGet(`${API_ENDPOINTS.STUDENTS}?${params.toString()}`);
            const list = res.data ?? res.students ?? res ?? [];
            sectionYearCounts[pair] = Array.isArray(list) ? list.length : 0;
            // populate fallback for section-only (keep max found)
            const prev = sectionCountsFallback[String(sid)] ?? 0;
            sectionCountsFallback[String(sid)] = Math.max(prev, Array.isArray(list) ? list.length : 0);
          } catch (e) {
            sectionYearCounts[pair] = 0;
          }
        }));

        // 2. Fetch all activities WITH graded counts in a single request (OPTIMIZED)
        const activitiesRes = await apiGet(API_ENDPOINTS.ACTIVITIES_TEACHER_WITH_GRADES);
        const allActivities = activitiesRes.data || activitiesRes.activities || activitiesRes || [];

        // 3. Filter activities for teacher's courses and enrich with course info
        const myActivities = allActivities
          .filter((a: any) => {
            const courseId = a.course_id || a.teacher_subject_id || a.subject_id;
            return courseMap.has(courseId);
          })
          .map((a: any) => {
            const courseId = a.course_id || a.teacher_subject_id || a.subject_id;
            const courseInfo = courseMap.get(courseId) || { code: 'N/A', name: 'N/A', section: 'N/A' };
            
            // determine section id from activity if present
            const sectionId = a.section_id ?? a.section?.id ?? a.section_id ?? courseInfo.raw?.section_id ?? courseInfo.raw?.sections?.[0]?.id ?? null;
            const sectionLabel = sectionId ? String(sectionId) : (a.section_name ?? courseInfo.section ?? 'N/A');
            // Use graded_count from the new endpoint (already includes counts where grade IS NOT NULL)
            const graded = a.graded_count ?? a.graded ?? 0;
            const totalFromActivity = a.total_students ?? a.total_students_count ?? 0;
            // determine year level: prefer activity then assignment's year_level
            const yearLevel = a.year_level ?? a.yearLevel ?? courseInfo.raw?.year_level ?? courseInfo.raw?.yearLevel ?? courseInfo.raw?.year ?? null;
            const pairKey = sectionId ? `${sectionId}|${yearLevel ?? ''}` : null;
            const totalStudents = totalFromActivity || (pairKey ? (sectionYearCounts[pairKey] ?? sectionCountsFallback[String(sectionId)] ?? 0) : 0);

            return {
              id: a.id,
              title: a.title || a.name || 'Untitled',
              course: courseInfo.code,
              courseId: courseId,
              section: sectionLabel,
              section_id: sectionId,
              type: a.type || 'Assignment',
              dueDate: a.due_at ? new Date(a.due_at).toISOString().split('T')[0] : 'No due date',
              submissions: graded,
              totalStudents: totalStudents
            };
          });

        setActivities(myActivities);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user?.role === "teacher") {
      fetchActivities();
    }
  }, [isAuthenticated, user]);

  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("dueDate");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const subjects = useMemo(() => {
    return Array.from(new Set(activities.map((a) => a.course)));
  }, [activities]);

  const sections = useMemo(() => {
    return Array.from(new Set(activities.map((a) => a.section)));
  }, [activities]);

  const displayed = useMemo(() => {
    let out = activities.slice();
    if (subjectFilter !== "all") out = out.filter((a) => a.course === subjectFilter);
    if (sectionFilter !== "all") out = out.filter((a) => a.section === sectionFilter);
    if (searchQuery) out = out.filter((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()));

    if (sortBy === "dueDate") {
      out.sort((x, y) => (x.dueDate > y.dueDate ? 1 : -1));
    } else if (sortBy === "submissions") {
      out.sort((x, y) => y.submissions - x.submissions);
    } else if (sortBy === "title") {
      out.sort((x, y) => x.title.localeCompare(y.title));
    }

    return out;
  }, [activities, subjectFilter, sectionFilter, sortBy, searchQuery]);

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Activities</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading activities...' : `View and manage ${activities.length} activities across courses`}
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            {/* Sticky Navigation Controls */}
            <div className="sticky top-0 z-10 border-b border-border bg-card p-4 space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters and View Toggle */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Select value={subjectFilter} onValueChange={(v) => setSubjectFilter(v)}>
                    <SelectTrigger className="w-40 h-9">
                      <SelectValue>{subjectFilter === "all" ? "All subjects" : subjectFilter}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subjects</SelectItem>
                      {subjects.map((s) => (
                        <SelectItem value={s} key={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v)}>
                    <SelectTrigger className="w-40 h-9">
                      <SelectValue>{sectionFilter === "all" ? "All sections" : sectionFilter}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sections</SelectItem>
                      {sections.map((s) => (
                        <SelectItem value={s} key={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue>
                      {sortBy === "dueDate" ? "Due Date" : sortBy === "submissions" ? "Submissions" : "Title"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dueDate">Due Date</SelectItem>
                    <SelectItem value="submissions">Submissions</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>

                {/* View Mode Toggle */}
                <Button
                  aria-pressed={viewMode === "grid"}
                  title="Toggle list / grid"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode((v) => (v === "list" ? "grid" : "list"))}
                  className="ml-auto text-xs flex items-center gap-1"
                >
                  {viewMode === "list" ? (
                    <LayoutGrid className="h-4 w-4" />
                  ) : (
                    <List className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Results count */}
              {displayed.length > 0 && (
                <p className="text-xs text-muted-foreground">{displayed.length} activity/activities found</p>
              )}
            </div>

            {/* Activities Content */}
            <div className="p-4">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                  <p className="text-muted-foreground mt-4">Loading activities...</p>
                </div>
              ) : displayed.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No activities found</p>
                </div>
              ) : viewMode === "list" ? (
                <div className="space-y-3">
                  {displayed.map((activity, index) => (
                    <div
                      key={index}
                      className="p-4 border border-border rounded-lg hover:bg-muted/50 hover:shadow-sm transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-semibold text-base group-hover:text-primary transition-colors">{activity.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium">{activity.course}</span>
                            <span className="mx-2">•</span>
                            <span>{activity.section}</span>
                            <span className="mx-2">•</span>
                            <Badge variant="outline" className="text-xs">{activity.type}</Badge>
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">Due: {activity.dueDate}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Graded</p>
                              <p className="text-lg font-semibold">{activity.submissions}/{activity.totalStudents || 0}</p>
                          </div>
                          <Button variant="default" size="sm" onClick={() => navigate(`/teacher/courses/${activity.courseId}/activities/${activity.id}${activity.section_id ? `?section_id=${activity.section_id}` : ''}`)}>
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayed.map((activity, index) => (
                    <div key={index} className="p-5 border border-border rounded-lg hover:shadow-md transition-shadow duration-200 hover:border-primary/50 group cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-base group-hover:text-primary transition-colors">{activity.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{activity.course} • {activity.section}</p>
                        </div>
                        <Badge className="text-xs">{activity.type}</Badge>
                      </div>
                      <div className="space-y-2 mb-4">
                        <p className="text-sm text-muted-foreground">Due {activity.dueDate}</p>
                          <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-sm font-medium">Graded {activity.submissions}/{activity.totalStudents || 0}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/teacher/courses/${activity.courseId}/activities/${activity.id}${activity.section_id ? `?section_id=${activity.section_id}` : ''}`)} className="w-full">View</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Activities;
