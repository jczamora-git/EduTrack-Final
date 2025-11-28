import React, { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { API_ENDPOINTS, apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Search, Send, Users, Paperclip, BookOpen, MessageSquare, Info, FileText } from 'lucide-react';

const TeacherMessaging = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<any[]>([]);
  const [studentConversations, setStudentConversations] = useState<any[]>([]);
  const [messageRequests, setMessageRequests] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [studentsForSection, setStudentsForSection] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRequests, setShowRequests] = useState(true);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showInfo, setShowInfo] = useState(false);

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

  // Format year level like "1st Year" or "1" into "First Year"
  const formatYearLabel = (raw?: string | number | null) => {
    if (raw == null) return '';
    const s = String(raw).trim();
    // common forms: "1st Year", "1st", "1", "First Year"
    const map: Record<string, string> = { '1': 'First Year', '1st': 'First Year', '2': 'Second Year', '2nd': 'Second Year', '3': 'Third Year', '3rd': 'Third Year', '4': 'Fourth Year', '4th': 'Fourth Year' };
    // try direct map
    const lower = s.toLowerCase();
    for (const key of Object.keys(map)) {
      if (lower.startsWith(key)) return map[key];
    }
    // if contains a digit, replace digit with ordinal word
    const m = s.match(/(\d+)/);
    if (m) {
      const n = m[1];
      return map[n] || `${n}th Year`;
    }
    return s;
  };

  useEffect(() => {
    const load = async () => {
      try {
        // fetch teacher assignments for current authenticated teacher ("/api/teacher-assignments/my")
        const res = await apiGet(`${API_ENDPOINTS.TEACHER_ASSIGNMENTS}/my`);
        const assignedCourses = res.assigned_courses || res.assigned_courses || [];

        // Build channels from assigned courses so teacher can message per course
        const ch = (Array.isArray(assignedCourses) ? assignedCourses : []).map((c: any) => ({
          id: c.teacher_subject_id ?? c.id,
          title: `${c.course_name || c.title || 'Course'}`,
          subject: { id: c.subject_id ?? c.id, course_name: c.course_name },
          sections: c.sections || [],
          year_level: c.year_level ?? c.yearLevel ?? null,
          unread: 0,
          messages: [],
        }));

        setChannels(ch);

        // Load student message requests (unread direct messages from students)
        try {
          const reqRes = await apiGet(API_ENDPOINTS.MESSAGES);
          // Support multiple response shapes: { messages: [...] } or { data: [...] }
          const raw = reqRes.messages ?? reqRes.data ?? (reqRes.data && reqRes.data.messages) ?? [];
          // Filter for direct messages only (no broadcast_id). Show all direct messages (not only unread).
          const requests = Array.isArray(raw) ? raw.filter((m: any) => m.broadcast_id == null) : [];

          // Group direct messages by sender so the UI shows one card per student
          const groups: Record<string, any> = {};
          requests.forEach((m: any) => {
            const key = m.sender_id ?? m.email ?? `${m.first_name || ''}-${m.last_name || ''}`;
            if (!groups[key]) {
              groups[key] = {
                id: `dm-${key}`,
                sender_id: m.sender_id,
                first_name: m.first_name,
                last_name: m.last_name,
                email: m.email,
                messages: [m],
                count: 1,
                last_message: m.body,
                last_created_at: m.created_at || m.createdAt || null,
              };
            } else {
              groups[key].messages.push(m);
              groups[key].count = groups[key].messages.length;
              // keep last message based on created_at
              const existing = groups[key].last_created_at;
              const cur = m.created_at || m.createdAt || null;
              if (!existing || (cur && new Date(cur) > new Date(existing))) {
                groups[key].last_message = m.body;
                groups[key].last_created_at = cur;
              }
            }
          });

          const grouped = Object.values(groups).sort((a: any, b: any) => {
            const da = a.last_created_at ? new Date(a.last_created_at).getTime() : 0;
            const db = b.last_created_at ? new Date(b.last_created_at).getTime() : 0;
            return db - da;
          });

          console.log('Direct message groups loaded:', grouped);
          setMessageRequests(grouped);
        } catch (err) {
          console.warn('Failed to load direct messages:', err);
          setMessageRequests([]);
        }

        // Placeholder: load direct student conversations (replace with API when available)
        setStudentConversations([]);
      } catch (err) {
        console.error('Failed to load teacher assignments:', err);
        setChannels([{ id: 'none', title: 'No assigned courses', unread: 0, messages: [] }]);
      }
    };

    load();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages]);

  // Helper function to load messages (reused for polling)
  const loadMessages = async (selectedChannel: any, sectionId: number | null) => {
    if (!selectedChannel?.id) return;

    try {
      let mapped: any[] = [];

      // If this is a direct message from a student (via message request), load conversation with that student
      if (selectedChannel?.sender_id && !selectedChannel?.is_broadcast) {
        const res = await apiGet(API_ENDPOINTS.MESSAGES_CONVERSATION(selectedChannel.sender_id));
        const msgs = res.messages || res.data || res || [];
        mapped = (Array.isArray(msgs) ? msgs : []).map((m: any) => {
          const nameParts = [m.first_name, m.last_name].filter((x: any) => x);
          const fromName = nameParts.length > 0 ? nameParts.join(' ') : (m.from || (m.sender_id === Number(user?.id) ? 'You' : ''));
          return {
            id: m.id,
            from: fromName,
            body: m.body,
            created_at: m.created_at || m.createdAt || new Date().toISOString(),
            sender_id: m.sender_id,
          };
        });
      } else {
        // Load broadcasts for channel/section
        let broadcasts: any[] = [];
        if (sectionId) {
          const res = await apiGet(API_ENDPOINTS.BROADCASTS_BY_SECTION(sectionId));
          broadcasts = res.broadcasts || res.data || res || [];
        }

        // if no section broadcasts, try by subject (teacher_subject)
        if ((!broadcasts || broadcasts.length === 0) && selectedChannel?.id) {
          const res = await apiGet(API_ENDPOINTS.BROADCASTS_BY_SUBJECT(selectedChannel.id));
          broadcasts = res.broadcasts || res.data || res || [];
        }

        // Show one entry per broadcast (summary) instead of expanded per-recipient messages
        if (Array.isArray(broadcasts) && broadcasts.length > 0) {
          mapped = broadcasts.map((b: any) => ({
            id: `broadcast-${b.id}`,
            broadcast_id: b.id,
            from: user?.name || '',
            body: b.body,
            created_at: b.sent_at || b.created_at || new Date().toISOString(),
            recipients_count: b.recipients_count ?? 0,
            is_broadcast: true,
          }));
        } else {
          // No broadcasts found - clear messages for this channel
          mapped = [];
        }
      }

      // Only update messages (and channels) by id so effect doesn't loop on object identity
      setSelected((prev) => prev ? { ...prev, messages: mapped } : prev);
      setChannels((prev) => prev.map((c) => (c.id === selectedChannel.id ? { ...c, messages: mapped } : c)));
    } catch (err) {
      console.error('Failed to load broadcasts/messages for channel:', err);
    }
  };

  // Load messages when channel/section selected, and poll every 2.5 seconds while selected
  useEffect(() => {
    if (!selected?.id) return;

    // Load immediately
    loadMessages(selected, selectedSectionId);

    // Set up polling interval (every 2.5 seconds)
    const pollInterval = setInterval(() => {
      loadMessages(selected, selectedSectionId);
    }, 2500);

    // Clean up interval when channel deselected or component unmounts
    return () => clearInterval(pollInterval);
  }, [selected?.id, selectedSectionId, user?.id]);

  // Helper to reload direct message requests (called on interval)
  const reloadMessageRequests = async () => {
    try {
      const reqRes = await apiGet(API_ENDPOINTS.MESSAGES);
      const raw = reqRes.messages ?? reqRes.data ?? (reqRes.data && reqRes.data.messages) ?? [];
      const requests = Array.isArray(raw) ? raw.filter((m: any) => m.broadcast_id == null) : [];

      const groups: Record<string, any> = {};
      requests.forEach((m: any) => {
        const key = m.sender_id ?? m.email ?? `${m.first_name || ''}-${m.last_name || ''}`;
        if (!groups[key]) {
          groups[key] = {
            id: `dm-${key}`,
            sender_id: m.sender_id,
            first_name: m.first_name,
            last_name: m.last_name,
            email: m.email,
            messages: [m],
            count: 1,
            last_message: m.body,
            last_created_at: m.created_at || m.createdAt || null,
          };
        } else {
          groups[key].messages.push(m);
          groups[key].count = groups[key].messages.length;
          const existing = groups[key].last_created_at;
          const cur = m.created_at || m.createdAt || null;
          if (!existing || (cur && new Date(cur) > new Date(existing))) {
            groups[key].last_message = m.body;
            groups[key].last_created_at = cur;
          }
        }
      });

      const grouped = Object.values(groups).sort((a: any, b: any) => {
        const da = a.last_created_at ? new Date(a.last_created_at).getTime() : 0;
        const db = b.last_created_at ? new Date(b.last_created_at).getTime() : 0;
        return db - da;
      });

      setMessageRequests(grouped);
    } catch (err) {
      console.warn('Failed to reload direct message requests:', err);
    }
  };

  // Poll for new direct message requests every 3 seconds
  useEffect(() => {
    // Load immediately
    reloadMessageRequests();

    // Set up polling interval (every 3 seconds)
    const pollInterval = setInterval(() => {
      reloadMessageRequests();
    }, 3000);

    // Clean up interval when component unmounts
    return () => clearInterval(pollInterval);
  }, []);

  // when a section is selected, load students for that section so we can send user_ids
  useEffect(() => {
    const loadStudents = async () => {
      setStudentsForSection([]);
      if (!selected || !selectedSectionId) return;

      try {
        // use year_level from selected channel if available
        const year = selected.year_level ?? selected.yearLevel ?? '';
        const url = `${API_ENDPOINTS.STUDENTS}?section_id=${selectedSectionId}&year_level=${encodeURIComponent(year)}`;
        const res = await apiGet(url);
        const list = Array.isArray(res.data) ? res.data : [];
        setStudentsForSection(list);
      } catch (err) {
        console.error('Failed to load students for section:', err);
        setStudentsForSection([]);
      }
    };

    loadStudents();
  }, [selectedSectionId, selected]);

  const sendMessage = () => {
    if (!message.trim() || !selected) {
      toast({ title: 'Error', description: 'Please select a channel and type a message', variant: 'destructive' });
      return;
    }

    setSending(true);
    // If replying to a direct message (sender_id present), send as a direct message
    if (selected?.sender_id && !selected?.is_broadcast) {
      const payload = {
        body: message,
        receiver_id: selected.sender_id,
        teacher_subject_id: selected.subject?.id ?? null,
        section_id: selectedSectionId ?? null,
      };

      apiPost(API_ENDPOINTS.MESSAGES, payload)
        .then((res) => {
          // response may vary; assume success boolean or truthy
          if (res && (res.success === true || res.message_id || res.id)) {
            const newMsg: any = {
              id: res.message_id || res.id || Date.now(),
              from: user?.name || 'You',
              body: message,
              created_at: new Date().toISOString(),
              sender_id: user?.id ? Number(user.id) : null,
              receiver_id: selected.sender_id,
            };
            // append to selected conversation messages
            setSelected((prev) => prev ? { ...prev, messages: [...(prev.messages || []), newMsg] } : prev);
            setChannels((prev) => prev.map((c) => (c.id === selected.id ? { ...c, messages: [...(c.messages || []), newMsg] } : c)));
            // also update grouped direct message count/preview
            setMessageRequests((prev) => prev.map((g: any) => g.sender_id === selected.sender_id ? { ...g, messages: [...g.messages, newMsg], count: (g.count||0)+1, last_message: newMsg.body, last_created_at: newMsg.created_at } : g));
            setMessage('');
            toast({ title: 'Sent', description: 'Direct message sent' });
          } else {
            toast({ title: 'Error', description: res?.message || 'Failed to send message', variant: 'destructive' });
          }
        })
        .catch((err) => {
          console.error('Error sending direct message:', err);
          toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
        })
        .finally(() => setSending(false));

      return;
    }

    // build receiver_ids from loaded students (use their `user_id` field) for broadcast
    const receiver_ids = (studentsForSection && studentsForSection.length > 0)
      ? studentsForSection.map((s) => s.user_id).filter(Boolean)
      : [];

    const payload = {
      body: message,
      teacher_subject_id: selected.subject?.id ?? null,
      section_id: selectedSectionId ?? null,
      receiver_ids,
      // ensure sender_id is sent as a number (backend expects numeric id)
      sender_id: user?.id ? Number(user.id) : null,
    };

    apiPost(API_ENDPOINTS.BROADCASTS, payload)
      .then((res) => {
        if (res.success) {
          const newMsg: any = {
            id: res.broadcast_id || Date.now(),
            from: user?.name || 'You',
            body: message,
            created_at: new Date().toISOString(),
            sender_id: user?.id ? Number(user.id) : null,
            is_broadcast: true,
          };
          setSelected({ ...selected, messages: [...(selected.messages || []), newMsg] });
          setChannels((prev) =>
            prev.map((c) =>
              c.id === selected.id ? { ...c, messages: [...(c.messages || []), newMsg] } : c
            )
          );
          setMessage('');
          toast({ title: 'Success', description: `Broadcast sent to ${res.recipients_count || 0} recipient(s)` });
        } else {
          toast({ title: 'Error', description: res.message || 'Failed to send broadcast', variant: 'destructive' });
        }
      })
      .catch((err) => {
        console.error('Error sending broadcast:', err);
        toast({ title: 'Error', description: 'Failed to send broadcast', variant: 'destructive' });
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
                placeholder="Search channels or messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-secondary border-border text-sm"
              />
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto space-y-2 px-3 pb-4">
              {/* Direct Messages Section */}
              {messageRequests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase text-destructive">
                    <div className="h-2 w-2 bg-destructive rounded-full"></div>
                    <span>Direct Messages ({messageRequests.length})</span>
                    <button
                      onClick={() => setShowRequests(!showRequests)}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showRequests ? '−' : '+'}
                    </button>
                  </div>

                  {showRequests && (
                    <div className="space-y-1">
                      {messageRequests.slice(0, 8).map((req: any) => {
                        const senderName = req.first_name && req.last_name
                          ? `${req.first_name} ${req.last_name}`
                          : (req.from || req.sender_name || `Student #${req.sender_id}`);
                        return (
                          <button
                            key={req.id}
                            onClick={() => setSelected({
                              id: req.id,
                              sender_id: req.sender_id,
                              is_broadcast: false,
                              from: senderName,
                              messages: req.messages || []
                            })}
                            className={`w-full text-left p-2 rounded-lg transition-all text-sm ${
                              selected?.id === req.id
                                ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg'
                                : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 hover:bg-red-100/50 dark:hover:bg-red-950/40 text-foreground'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate text-xs">{senderName}</div>
                                <div className={`text-xs truncate mt-0.5 ${selected?.id === req.id ? 'opacity-80' : 'opacity-70'}`}>
                                  {(req.last_message || req.messages?.[req.messages.length - 1]?.body || '').substring(0, 40)}
                                </div>
                              </div>
                              {req.count > 1 && (
                                <div className="ml-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                                  {req.count}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {messageRequests.length > 8 && (
                        <div className="text-xs text-muted-foreground text-center py-1">
                          +{messageRequests.length - 8} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Channels List */}
              {channels.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase text-muted-foreground mt-2">
                    <BookOpen className="h-4 w-4" />
                    <span>Courses</span>
                  </div>
                  <div className="space-y-1">
                    {channels
                      .filter((c) =>
                        c.title.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelected({ ...c, messages: c.messages || [] });
                            setSelectedSectionId(c.sections?.[0]?.id ?? null);
                          }}
                          className={`w-full text-left p-3 rounded-lg transition-all text-sm ${
                            selected?.id === c.id
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                              : 'bg-secondary/50 border border-border/30 hover:bg-secondary hover:border-border text-foreground'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate text-xs">{c.title}</div>
                            {c.sections && c.sections.length > 0 && (
                              <div className={`text-xs truncate mt-0.5 ${selected?.id === c.id ? 'opacity-80' : 'opacity-60'}`}>
                                {c.sections.length} section{c.sections.length !== 1 ? 's' : ''}
                              </div>
                            )}
                            {c.messages && c.messages.length > 0 && (
                              <div className={`text-xs truncate mt-1 ${selected?.id === c.id ? 'opacity-70' : 'opacity-50'}`}>
                                {c.messages[c.messages.length - 1].body.substring(0, 35)}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {channels.length === 0 && messageRequests.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-12">
                  <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  No courses assigned yet
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Messages */}
          <div className="flex-1 flex gap-0 min-h-0 min-w-0">
            {selected ? (
              <>
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                  <Card className="flex-1 flex flex-col border-0 shadow-none rounded-none overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b border-border py-3 shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          {selected?.sender_id ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-5 w-5 text-red-500" />
                                <CardTitle className="text-lg">Direct Message</CardTitle>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {selected.from}
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="h-5 w-5 text-blue-500" />
                                <CardTitle className="text-lg">{selected.title}</CardTitle>
                              </div>
                              {selected.sections && selected.sections.length > 0 && (
                                <p className="text-sm text-muted-foreground">
                                  {selected.sections.length} section{selected.sections.length !== 1 ? 's' : ''}
                                </p>
                              )}
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
                        {selected?.sender_id ? 'No messages yet. Start the conversation!' : 'No messages yet. Send a broadcast!'}
                      </div>
                    </div>
                  ) : (
                    <>
                      {(selected.messages || []).map((m: any) => {
                        const isOwn = m.sender_id === Number(user?.id);
                        return (
                          <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-xs px-5 py-3 rounded-2xl shadow-sm ${
                                isOwn
                                  ? 'bg-blue-500 text-white rounded-br-none'
                                  : selected?.sender_id
                                    ? 'bg-red-50 dark:bg-red-950/20 text-foreground rounded-bl-none border border-red-200 dark:border-red-900/30'
                                    : 'bg-secondary text-foreground rounded-bl-none border border-border'
                              }`}
                            >
                              {!isOwn && (
                                <div className="text-xs font-semibold opacity-75 mb-2">
                                  {m.from}
                                </div>
                              )}
                              <div className="text-sm break-words">{m.body}</div>
                              {m.recipients_count && (
                                <div className="text-xs mt-2 opacity-70 flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {m.recipients_count} recipient{m.recipients_count !== 1 ? 's' : ''}
                                </div>
                              )}
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
                {selected && (
                  <div className="border-t border-border p-3 bg-secondary/30 space-y-2 shrink-0">
                    {selected?.sections && selected.sections.length > 0 && !selected?.sender_id && (
                      <div>
                        <label htmlFor={`section-select-${selected?.id ?? 'none'}`} className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">
                          Broadcast to section
                        </label>
                        <select
                          id={`section-select-${selected?.id ?? 'none'}`}
                          className="p-2.5 border border-border rounded-lg w-full text-sm bg-background text-foreground"
                          value={selectedSectionId ?? ''}
                          onChange={(e) => setSelectedSectionId(e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">-- Select section (all) --</option>
                          {selected.sections.map((s: any) => (
                            <option key={s.id} value={s.id}>{`${formatYearLabel(selected.year_level ?? selected.yearLevel ?? '')} - ${s.name}`}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selected?.sender_id && (
                      <div className="text-xs text-muted-foreground bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-2 rounded">
                        Replying to <span className="font-semibold">{selected.from}</span>
                      </div>
                    )}

                    {attachmentFile && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900/30">
                        <Paperclip className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-blue-600 dark:text-blue-400 flex-1">{attachmentFile.name}</span>
                        <button
                          onClick={() => setAttachmentFile(null)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
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
                        {/* info toggle in header only, removed from input area */}
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
                  </Card>
                </div>

                {/* Conversation Info Sidebar (collapsible) */}
                <aside className={`transition-all overflow-hidden flex flex-col min-h-0 ${showInfo ? 'w-80 shrink-0 p-4' : 'w-0 p-0'} bg-background border-l border-border/50`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted" />
                      <div>
                        <div className="font-semibold">{selected?.name ?? (selected?.from ?? selected?.title) ?? 'Conversation'}</div>
                        <div className="text-sm text-muted-foreground">Participants: {selected?.participants?.length ?? (selected?.sender_id ? 2 : 1)}</div>
                      </div>
                    </div>
                    <button onClick={() => setShowInfo(false)} className="text-muted-foreground">Close</button>
                  </div>

                  <div>
                    <div className="font-semibold mb-2">Files</div>
                    <div className="space-y-2 overflow-auto max-h-[60vh]">
                      {collectAttachments().length === 0 && <div className="text-sm text-muted-foreground">No files</div>}
                      {collectAttachments().map((f, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            {f.url ? (
                              <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-500 underline">
                                {f.name}
                              </a>
                            ) : (
                              <div className="text-sm">{f.name}</div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{f.created_at ? new Date(f.created_at).toLocaleString() : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </>
            ) : (
              <Card className="flex-1 flex items-center justify-center border-border shadow-md rounded-xl">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold text-foreground mb-2">Select a conversation</p>
                  <p className="text-sm text-muted-foreground">Choose a course or a student message to start messaging</p>
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

export default TeacherMessaging;
