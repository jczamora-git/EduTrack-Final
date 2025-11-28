import React, { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { API_ENDPOINTS, apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Search, Send, Paperclip, Megaphone, MessageSquare, Info, FileText } from 'lucide-react';

const StudentMessaging = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(true);
  const [showTeachers, setShowTeachers] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const collectAttachments = () => {
    const out: Array<{ name: string; url?: string | null; created_at?: string | null }> = [];
    const add = (name: string, url?: string | null, created_at?: string | null) => {
      if (!name) return;
      if (!out.find((o) => o.name === name && o.url === url)) out.push({ name, url, created_at });
    };

    (selected?.messages || []).forEach((m: any) => {
      const att = m.attachments ?? m.attachments_json ?? m.attachments_array ?? null;
      let arr: any[] = [];
      if (!att) return;
      if (typeof att === 'string') {
        try {
          const parsed = JSON.parse(att);
          if (Array.isArray(parsed)) arr = parsed;
        } catch (e) {
          // if it's a comma separated list
          arr = att.split(',').map((x: string) => x.trim()).filter(Boolean).map((s) => ({ name: s }));
        }
      } else if (Array.isArray(att)) arr = att;
      else if (typeof att === 'object') arr = [att];

      arr.forEach((a: any) => {
        if (!a) return;
        const name = a.name ?? a.filename ?? a.file_name ?? a.title ?? String(a);
        const url = a.url ?? a.path ?? null;
        add(name, url, m.created_at || null);
      });
    });

    return out;
  };

  useEffect(() => {
    // Load teacher assignments for the student's current subjects and build conversations
    const load = async () => {
      if (!user?.id) return;

      try {
        // fetch student record to get section_id and year_level
        const studentRes = await apiGet(API_ENDPOINTS.STUDENT_BY_USER(user.id));
        const student = studentRes.data || studentRes.student || studentRes || null;
        const sectionId = student?.section_id || student?.sectionId || null;

        // normalize year level to numeric if possible
        let studentYearLevelNum: number | null = null;
        const studentYearLevelRaw = student?.year_level ?? student?.yearLevel ?? null;
        if (typeof studentYearLevelRaw === 'number') studentYearLevelNum = studentYearLevelRaw;
        else if (typeof studentYearLevelRaw === 'string') {
          const m = String(studentYearLevelRaw).match(/(\d+)/);
          studentYearLevelNum = m ? Number(m[1]) : null;
        }

        // Get active academic period to infer semester
        let activePeriod: any = null;
        try {
          const activePeriodRes = await apiGet(`${API_ENDPOINTS.ACADEMIC_PERIODS_ACTIVE}-public`);
          activePeriod = activePeriodRes.data || activePeriodRes.period || activePeriodRes || null;
        } catch (err) {
          try {
            const activePeriodRes = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS_ACTIVE);
            activePeriod = activePeriodRes.data || activePeriodRes.period || activePeriodRes || null;
          } catch (err2) {
            console.warn('Failed to fetch active academic period', err2);
          }
        }

        const semesterMatch = (activePeriod?.semester || '').toString().match(/^(\d+)(st|nd|rd|th)/i);
        const currentSemesterShort = semesterMatch ? (String(semesterMatch[1]) === '1' ? '1st' : '2nd') : null;

        // Build semester candidates like MyCourses: try '1st' then '1'
        const semesterCandidates: (string | null)[] = [];
        if (currentSemesterShort) {
          semesterCandidates.push(currentSemesterShort);
          semesterCandidates.push(currentSemesterShort.startsWith('1') ? '1' : '2');
        } else {
          semesterCandidates.push(null);
        }

        // Fetch subjects for student (filtered by year_level and semester candidates)
        let subjects: any[] = [];
        let fetched = false;
        for (const sem of semesterCandidates) {
          try {
            const params = new URLSearchParams();
            if (studentYearLevelNum) params.set('year_level', String(studentYearLevelNum));
            if (sem) params.set('semester', sem);
            const subjRes = await apiGet(`${API_ENDPOINTS.SUBJECTS_FOR_STUDENT}?${params.toString()}`);
            const rows = subjRes.data || subjRes.subjects || subjRes || [];
            if (Array.isArray(rows) && rows.length > 0) {
              subjects = rows;
              fetched = true;
              break;
            }
          } catch (err) {
            // try next candidate
          }
        }

        // fallback without semester filter
        if (!fetched) {
          try {
            const params = new URLSearchParams();
            if (studentYearLevelNum) params.set('year_level', String(studentYearLevelNum));
            const subjRes = await apiGet(`${API_ENDPOINTS.SUBJECTS_FOR_STUDENT}?${params.toString()}`);
            const rows = subjRes.data || subjRes.subjects || subjRes || [];
            if (Array.isArray(rows)) subjects = rows;
          } catch (err) {
            console.warn('Failed to fetch subjects for student', err);
          }
        }

        const subjectIds = new Set((subjects || []).map((s: any) => s.id ?? s.subject_id ?? null));

        // fetch teacher assignments for this student's section and filter to subjectIds
        let assignments: any[] = [];
        if (sectionId) {
          try {
            const taRes = await apiGet(`${API_ENDPOINTS.TEACHER_ASSIGNMENTS_FOR_STUDENT}?section_id=${encodeURIComponent(sectionId)}`);
            const rows = taRes.data || taRes.assignments || taRes || [];
            if (Array.isArray(rows)) {
              assignments = rows.filter((r: any) => subjectIds.has(r?.subject?.id ?? r?.subject_id ?? null));
            }
          } catch (err) {
            console.warn('Failed to fetch teacher assignments for student:', err);
          }
        }

        // Map assignments to conversation entries. Include the teacher's user id
        // when available (`teacher.user_id` or `teacher.user.id`) so the UI uses
        // the correct users table id when opening a conversation or sending a
        // direct message. Fall back to `teacher_id` only if necessary.
        let convs = (Array.isArray(assignments) ? assignments : []).map((a: any) => {
          const teacher = a.teacher || {};
          const subject = a.subject || {};
          const teacherUserId = teacher.user_id ?? teacher.user?.id ?? a.teacher_user_id ?? null;
          return {
            id: a.teacher_subject_id ?? `${a.teacher_id}_${subject.id}`,
            title: `${subject.course_name || subject.title || 'Course'} — ${((teacher.first_name || '') + ' ' + (teacher.last_name || '')).trim()}`,
            teacherId: a.teacher_id || (teacher.id ?? null),
            teacherUserId,
            teacher,
            subject,
            unread: 0,
            messages: [],
          };
        });

        // If some assignments don't include the teacher's users.id, fetch teacher details
        // in batch to resolve `teacherUserId` so the UI can use the correct receiver id.
        const missingTeacherIds = Array.from(new Set(convs.filter((c) => !c.teacherUserId && c.teacherId).map((c) => c.teacherId)));
        if (missingTeacherIds.length > 0) {
          try {
            const fetches = await Promise.all(missingTeacherIds.map((tid: any) => apiGet(API_ENDPOINTS.TEACHER_BY_ID(tid)).catch(() => null)));
            const teacherMap: Record<string | number, any> = {};
            fetches.forEach((r: any, idx: number) => {
              const t = r?.data || r?.teacher || r || null;
              if (t) teacherMap[missingTeacherIds[idx]] = t;
            });

            convs = convs.map((c) => {
              if (!c.teacherUserId && c.teacherId && teacherMap[c.teacherId]) {
                const t = teacherMap[c.teacherId];
                const resolved = t.user_id ?? t.user?.id ?? t.user_id ?? null;
                return { ...c, teacherUserId: resolved, teacher: { ...(c.teacher || {}), ...t } };
              }
              return c;
            });
          } catch (err) {
            console.warn('Failed to fetch teacher details for user ids', err);
          }
        }

        // Also fetch section-level broadcasts and expose as a channel for students
        const broadcastChannels: any[] = [];
        if (sectionId) {
          try {
            const bRes = await apiGet(API_ENDPOINTS.BROADCASTS_BY_SECTION(sectionId));
            const bro = bRes.data || bRes.broadcasts || bRes || [];
            if (Array.isArray(bro) && bro.length > 0) {
              broadcastChannels.push({
                id: `broadcast_section_${sectionId}`,
                title: 'Section Announcements',
                unread: 0,
                // leave messages empty for now; they'll be loaded when selected
                messages: [],
                meta: { sectionId },
              });
            }
          } catch (err) {
            console.warn('Failed to fetch section broadcasts for student', err);
          }
        }

        const combined = [...broadcastChannels, ...convs];

        if (combined.length === 0) {
          setConversations([{ id: 'general', title: 'General', unread: 0, messages: [] }]);
        } else {
          setConversations(combined);
        }
      } catch (err) {
        console.error('Error loading messaging conversations:', err);
        setConversations([{ id: 'general', title: 'General', unread: 0, messages: [] }]);
      }
    };

    load();
  }, [user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages]);

  // Helper to resolve the teacher's users.id (the actual receiver_id expected by the API)
  const resolveTeacherUserId = async (teacherId: any, teacherObj: any) => {
    // If teacherObj already contains a user_id, prefer that
    const candidate = teacherObj?.user_id ?? teacherObj?.user?.id ?? teacherObj?.user_id;
    if (candidate) return candidate;

    // If teacherId already looks like a users.id (>=100 maybe) skip; otherwise fetch teacher record
    try {
      const res = await apiGet(API_ENDPOINTS.TEACHER_BY_ID(teacherId));
      const data = res.data || res.teacher || res || null;
      if (data) {
        // teacher table may include `user_id` or nested `user` object
        return data.user_id ?? data.user?.id ?? null;
      }
    } catch (err) {
      console.warn('Failed to resolve teacher user id for', teacherId, err);
    }

    return null;
  };

  const isBroadcastChannel = Boolean(selected && String(selected.id).startsWith('broadcast_'));

  // Organize conversations into sections
  const broadcastConversations = conversations.filter((c) => String(c.id).startsWith('broadcast_'));
  const teacherConversations = conversations.filter((c) => !String(c.id).startsWith('broadcast_'));

  const filteredBroadcasts = broadcastConversations.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTeachers = teacherConversations.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sendMessage = () => {
    if (!message.trim() || !selected) {
      toast({ title: 'Error', description: 'Please select a teacher and type a message', variant: 'destructive' });
      return;
    }

    if (isBroadcastChannel) {
      toast({ title: 'Info', description: 'This is an announcement channel. Students cannot send broadcasts.', variant: 'default' });
      return;
    }

    setSending(true);

    // resolve the actual user id for the teacher; some API shapes place it on
    // `teacher.user_id` or `teacher.user.id`. Fall back to `selected.teacherId`
    // if no user id is available so we don't break older shapes.
    const teacherObj = selected.teacher || {};
    const resolvedReceiverId = teacherObj.user_id ?? teacherObj.user?.id ?? selected.teacherId ?? null;

    const payload = {
      receiver_id: Number(resolvedReceiverId),
      body: message,
      teacher_subject_id: selected.subject?.id ?? null,
      section_id: null,
    };

    apiPost(API_ENDPOINTS.MESSAGES, payload)
      .then((res) => {
        if (res.success) {
          const newMsg: any = {
            id: res.message_id || Date.now(),
            from: user?.name ?? 'You',
            body: message,
            created_at: new Date().toISOString(),
            sender_id: user?.id,
          };
          setSelected((prev) => (prev ? { ...prev, messages: [...(prev.messages || []), newMsg] } : prev));
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selected.id ? { ...c, messages: [...(c.messages || []), newMsg] } : c
            )
          );
          setMessage('');
          toast({ title: 'Success', description: 'Message sent' });
        } else {
          toast({ title: 'Error', description: res.message || 'Failed to send message', variant: 'destructive' });
        }
      })
      .catch((err) => {
        console.error('Error sending message:', err);
        toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
      })
      .finally(() => setSending(false));
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentFile(file);
      toast({ title: 'File attached', description: `${file.name} ready to send` });
    }
  };

  // Helper function to load conversation messages (reused for polling)
  const loadConversation = async (selectedConv: any) => {
    if (!selectedConv) return;

    try {
      let msgs: any[] = [];

      // broadcast channels have ids like 'broadcast_section_{sectionId}' or 'broadcast_subject_{subjectId}'
      if (String(selectedConv.id).startsWith('broadcast_section_')) {
        const parts = String(selectedConv.id).split('_');
        const sectionId = parts.slice(2).join('_');
        const res = await apiGet(API_ENDPOINTS.BROADCASTS_BY_SECTION(sectionId));
        msgs = res.data || res.broadcasts || res || [];
      } else if (String(selectedConv.id).startsWith('broadcast_subject_')) {
        const parts = String(selectedConv.id).split('_');
        const subjectId = parts.slice(2).join('_');
        const res = await apiGet(API_ENDPOINTS.BROADCASTS_BY_SUBJECT(subjectId));
        msgs = res.data || res.broadcasts || res || [];
      } else if (selectedConv.teacherId || selectedConv.teacherUserId) {
        const t = selectedConv.teacher || {};
        const convUserId = selectedConv.teacherUserId ?? t.user_id ?? t.user?.id ?? selectedConv.teacherId;
        const res = await apiGet(API_ENDPOINTS.MESSAGES_CONVERSATION(convUserId));
        msgs = res.messages || res.data || res || [];
      }

      // normalize messages (ensure from/created_at) - determine sender from multiple possible shapes
      const mapped = (Array.isArray(msgs) ? msgs : []).map((m: any) => {
        // Try common shapes returned by broadcasts/messages endpoints
        let fromName = '';

        // teacher object (from teacher assignments or expanded joins)
        if (m.teacher) {
          const t = m.teacher;
          fromName = [t.first_name, t.last_name, t.name, t.full_name].filter(Boolean).join(' ');
        }

        // user object (sender information)
        if (!fromName && m.user) {
          const u = m.user;
          fromName = [u.first_name, u.last_name, u.name, u.full_name].filter(Boolean).join(' ');
        }

        // explicit first/last name fields
        if (!fromName && (m.first_name || m.last_name)) {
          fromName = [m.first_name, m.last_name].filter(Boolean).join(' ');
        }

        // other common fallback fields
        if (!fromName && m.sender_name) fromName = m.sender_name;
        if (!fromName && m.from) fromName = m.from;
        if (!fromName && m.created_by_name) fromName = m.created_by_name;

        // last resort: label as You (if sender_id is current user) or generic
        if (!fromName) fromName = m.sender_id === user?.id ? 'You' : (m.sender_id ? `User ${m.sender_id}` : 'System');

        return {
          id: m.id || m.broadcast_id || `${m.created_at || m.createdAt || Date.now()}_${Math.random()}`,
          from: fromName,
          body: m.body || m.message || m.content || '',
          created_at: m.created_at || m.createdAt || new Date().toISOString(),
          sender_id: m.sender_id || m.created_by || null,
        };
      });

      // If some messages have generic sender labels (e.g. "User {id}" or "System")
      // try to resolve sender names by fetching the user records for sender_id.
      const unresolvedSenderIds = Array.from(
        new Set(
          mapped
            .filter((m: any) => (typeof m.from === 'string' && (m.from.startsWith('User ') || m.from === 'System')) && m.sender_id)
            .map((m: any) => m.sender_id)
        )
      );

      if (unresolvedSenderIds.length > 0) {
        try {
          const userFetches = await Promise.all(
            unresolvedSenderIds.map((id: any) => apiGet(API_ENDPOINTS.USER_BY_ID(id)).catch(() => null))
          );

          const userMap: Record<string | number, string> = {};
          userFetches.forEach((u: any, idx: number) => {
            const data = u?.data || u?.user || u || null;
            if (data) {
              const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.name || data.email || `User ${unresolvedSenderIds[idx]}`;
              userMap[unresolvedSenderIds[idx]] = name;
            }
          });

          // replace from names where we have a mapping
          mapped.forEach((m: any) => {
            if (m.sender_id && userMap[m.sender_id]) {
              m.from = userMap[m.sender_id];
            }
          });
        } catch (err) {
          // if resolving fails, just continue with existing labels
          console.warn('Failed to resolve sender names for messages', err);
        }
      }

      // update selected and conversations, but effect depends only on selected.id so it won't loop
      setSelected((prev) => (prev ? { ...prev, messages: mapped } : prev));
      setConversations((prev) => prev.map((c) => (c.id === selectedConv.id ? { ...c, messages: mapped } : c)));
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    }
  };

  // Load messages when conversation selected, and poll every 2.5 seconds while selected
  useEffect(() => {
    if (!selected?.id) return;

    // Load immediately
    loadConversation(selected);

    // Set up polling interval (every 2.5 seconds)
    const pollInterval = setInterval(() => {
      loadConversation(selected);
    }, 2500);

    // Clean up interval when conversation deselected or component unmounts
    return () => clearInterval(pollInterval);
  }, [selected?.id]);

  return (
    <DashboardLayout>
      <div className="w-full max-h-[800px] h-screen flex flex-col">

        <div className="flex gap-0 flex-1 min-h-0">
          {/* Left Sidebar - Conversations */}
          <div className="w-80 flex flex-col bg-card/50 border-r border-border/50">
            {/* Search Bar */}
            <div className="relative p-4 shrink-0">
              <Search className="absolute left-7 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-secondary border-border text-sm"
              />
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto space-y-2 px-3 pb-4">
              {/* Section Announcements */}
              {filteredBroadcasts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase text-violet-600 dark:text-violet-400">
                    <Megaphone className="h-4 w-4" />
                    <span>Announcements ({filteredBroadcasts.length})</span>
                    <button
                      onClick={() => setShowAnnouncements(!showAnnouncements)}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showAnnouncements ? '−' : '+'}
                    </button>
                  </div>
                  {showAnnouncements && (
                    <div className="space-y-1">
                      {filteredBroadcasts.map((c) => (
                        <button
                          key={String(c.id)}
                          onClick={() => setSelected({ ...c, messages: c.messages || [] })}
                          className={`w-full text-left p-2 rounded-lg transition-all text-sm ${
                            selected?.id === c.id
                              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                              : 'bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/30 hover:bg-violet-100/50 dark:hover:bg-violet-950/40 text-foreground'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate text-xs">{c.title}</div>
                              {c.messages && c.messages.length > 0 && (
                                <div className={`text-xs truncate mt-0.5 ${selected?.id === c.id ? 'opacity-80' : 'opacity-60'}`}>
                                  {c.messages[c.messages.length - 1].body.substring(0, 40)}
                                </div>
                              )}
                            </div>
                            {c.unread > 0 && (
                              <div className="ml-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                                {c.unread}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Teachers & Courses */}
              {filteredTeachers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase text-blue-600 dark:text-blue-400 mt-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Teachers ({filteredTeachers.length})</span>
                    <button
                      onClick={() => setShowTeachers(!showTeachers)}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showTeachers ? '−' : '+'}
                    </button>
                  </div>
                  {showTeachers && (
                    <div className="space-y-1">
                      {filteredTeachers.map((c) => {
                        const subject = c.subject || {};
                        const teacher = c.teacher || {};
                        const courseCode = subject.course_code || subject.code || '';
                        const courseName = subject.course_name || subject.title || 'Course';
                        const teacherName = [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') || 'Teacher';

                        return (
                          <button
                            key={String(c.id)}
                            onClick={() => setSelected({ ...c, messages: c.messages || [] })}
                            className={`w-full text-left p-2 rounded-lg transition-all text-sm ${
                            selected?.id === c.id
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                              : 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 hover:bg-blue-100/50 dark:hover:bg-blue-950/40 text-foreground'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              {courseCode && (
                                <div className={`text-xs font-bold uppercase tracking-wide ${selected?.id === c.id ? 'opacity-75' : 'opacity-60'}`}>
                                  {courseCode}
                                </div>
                              )}
                              <div className="font-semibold truncate text-sm mt-1">{courseName}</div>
                              <div className={`text-xs truncate mt-2 ${selected?.id === c.id ? 'opacity-80' : 'opacity-70'}`}>
                                {teacherName}
                              </div>
                              {c.messages && c.messages.length > 0 && (
                                <div className={`text-xs truncate mt-2 ${selected?.id === c.id ? 'opacity-70' : 'opacity-50'}`}>
                                  {c.messages[c.messages.length - 1].body.substring(0, 40)}
                                </div>
                              )}
                            </div>
                            {c.unread > 0 && (
                              <div className="ml-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                                {c.unread}
                              </div>
                            )}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {conversations.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-12">
                  <Megaphone className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  No conversations yet
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Messages */}
          <div className="flex-1 flex gap-0 min-h-0 min-w-0">
            {selected ? (
              <>
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                  <Card className="flex-1 flex flex-col border-border shadow-md rounded-lg overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b border-border py-3 shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          {isBroadcastChannel ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <Megaphone className="h-5 w-5 text-violet-500" />
                                <CardTitle className="text-lg">Section Announcements</CardTitle>
                              </div>
                            </>
                          ) : (
                            <>
                              {selected.subject && (
                                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                                  {selected.subject.course_code || selected.subject.code || 'COURSE'}
                                </div>
                              )}
                              <CardTitle className="text-lg mb-1">{selected.subject?.course_name || selected.subject?.title || 'Course'}</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {[selected.teacher?.first_name, selected.teacher?.last_name].filter(Boolean).join(' ') || 'Teacher'}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="ml-4">
                          <button
                            onClick={() => setShowInfo((s) => !s)}
                            className="p-2 rounded-md hover:bg-secondary/60 transition-colors"
                            title="Conversation info"
                          >
                            <Info className="h-5 w-5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
                  {(selected?.messages || []).length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-sm text-muted-foreground text-center">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        {isBroadcastChannel ? 'No announcements yet' : 'No messages yet. Start a conversation!'}
                      </div>
                    </div>
                  ) : (
                    <>
                      {(selected.messages || []).map((m: any) => {
                        const isOwn = m.sender_id === Number(user?.id) || m.from === 'You';
                        return (
                          <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-xs px-5 py-3 rounded-2xl shadow-sm ${
                                isOwn
                                  ? 'bg-blue-500 text-white rounded-br-none'
                                  : 'bg-secondary text-foreground rounded-bl-none border border-border'
                              }`}
                            >
                              {!isOwn && (
                                <div className="text-xs font-semibold opacity-75 mb-2">
                                  {m.from}
                                </div>
                              )}
                              <div className="text-sm break-words">{m.body}</div>
                              <div
                                className={`text-xs mt-2 ${
                                  isOwn ? 'opacity-70' : 'opacity-60'
                                }`}
                              >
                                {new Date(m.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </CardContent>

                {/* Message Input */}
                {!isBroadcastChannel && (
                  <div className="border-t border-border p-3 bg-secondary/30 space-y-2 shrink-0">
                    {attachmentFile && (
                      <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/20">
                        <Paperclip className="h-4 w-4 text-primary" />
                        <span className="text-sm text-primary flex-1">{attachmentFile.name}</span>
                        <button
                          onClick={() => setAttachmentFile(null)}
                          className="text-xs text-primary hover:text-primary/70"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !sending && sendMessage()}
                        placeholder="Write a message..."
                        className="bg-background border-border"
                        disabled={sending}
                      />
                      <button
                        onClick={handleAttachmentClick}
                        className="p-2.5 rounded-lg bg-background border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title="Attach file"
                      >
                        <Paperclip className="h-5 w-5" />
                      </button>
                      <Button
                        onClick={sendMessage}
                        disabled={sending || !message.trim()}
                        size="icon"
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        <Send className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}

                {isBroadcastChannel && (
                  <div className="border-t border-border p-4 bg-secondary/50 text-center text-sm text-muted-foreground shrink-0">
                    This is an announcement channel. Students cannot send messages.
                  </div>
                )}
                  </Card>
                </div>

                {/* Conversation Info Sidebar (collapsible) */}
                <aside className={`transition-all overflow-hidden flex flex-col min-h-0 ${showInfo ? 'w-80 shrink-0 p-4' : 'w-0 p-0'} bg-card/40 border-l border-border/50`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-full bg-secondary/60 flex items-center justify-center text-xl font-bold">{(selected?.teacher?.first_name || selected?.from || 'U').charAt(0)}</div>
                    <div>
                      <div className="font-semibold">{selected?.from ?? (selected?.teacher && [selected.teacher.first_name, selected.teacher.last_name].filter(Boolean).join(' ')) ?? selected?.title}</div>
                      <div className="text-xs text-muted-foreground">{selected?.subject?.course_name ?? selected?.subject?.title ?? ''}</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Files</div>
                    <div className="space-y-2">
                      {collectAttachments().length === 0 ? (
                        <div className="text-xs text-muted-foreground">No files in this conversation</div>
                      ) : (
                        collectAttachments().map((f) => (
                          <div key={f.name} className="flex items-center justify-between p-2 bg-background rounded">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <a className="text-sm truncate" href={f.url || '#'} target="_blank" rel="noreferrer">{f.name}</a>
                            </div>
                            <div className="text-xs text-muted-foreground">{f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </aside>
              </>
            ) : (
              <Card className="flex-1 flex items-center justify-center border-border shadow-md rounded-xl">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold text-foreground mb-2">Select a conversation</p>
                  <p className="text-sm text-muted-foreground">Choose a teacher or announcement channel to start messaging</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileSelect}
      />

      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.5) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(148, 163, 184, 0.8);
        }
      `}</style>
    </DashboardLayout>
  );
};

export default StudentMessaging;
