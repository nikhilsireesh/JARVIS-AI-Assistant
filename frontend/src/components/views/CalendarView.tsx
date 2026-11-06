'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import GlassCard from '../GlassCard';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  Trash2, 
  Plus, 
  Sparkles,
  Loader2,
  CalendarCheck,
  Send
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  status: string;
  htmlLink: string;
  attendees: { email: string; responseStatus: string }[];
  organizer: string;
}

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');

  // Manual Event Create State
  const [isCreating, setIsCreating] = useState(false);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [attendeesInput, setAttendeesInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Natural Language Scheduler State
  const [nlText, setNlText] = useState('');
  const [schedulingNl, setSchedulingNl] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let timeMin = now.toISOString();
      let timeMax = '';

      const start = new Date();
      if (activeTab === 'today') {
        start.setHours(0, 0, 0, 0);
        timeMin = start.toISOString();
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        timeMax = end.toISOString();
      } else if (activeTab === 'week') {
        start.setDate(start.getDate() - start.getDay()); // Start of week
        start.setHours(0, 0, 0, 0);
        timeMin = start.toISOString();
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        timeMax = end.toISOString();
      } else if (activeTab === 'month') {
        start.setDate(1); // Start of month
        start.setHours(0, 0, 0, 0);
        timeMin = start.toISOString();
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        timeMax = end.toISOString();
      }

      const res = await api.get<CalendarEvent[]>(
        `/workspace/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=50`
      );
      setEvents(res);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [activeTab]);

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to cancel this meeting coordinates, Sir?')) return;
    
    try {
      await api.delete(`/workspace/calendar/events/${id}`);
      setEvents(prev => prev.filter(ev => ev.id !== id));
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary || !startTime || !endTime) return;

    setSaving(true);
    try {
      const attendees = attendeesInput
        ? attendeesInput.split(',').map(email => email.trim()).filter(email => email !== '')
        : [];

      await api.post('/workspace/calendar/events', {
        summary,
        description,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        location,
        attendees
      });

      setIsCreating(false);
      setSummary('');
      setDescription('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setAttendeesInput('');
      fetchEvents();
    } catch (err) {
      console.error('Failed to create calendar event:', err);
      alert('Failed to transmit calendar schedule, Sir.');
    } finally {
      setSaving(false);
    }
  };

  // Natural Language Scheduler triggers Gemini Chat in backend
  const handleNlSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlText.trim()) return;

    setSchedulingNl(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      
      // Create system conversation to run the calendar scheduler tool in background
      const convo = await api.post<{ id: string }>('/chat/conversations', {
        title: `NLP Event: ${nlText.substring(0, 20)}`,
        model: 'gemini-3.5-flash'
      });

      // Send instruction. Gemini will resolve coordinates and execute the create_calendar_event tool!
      const response = await fetch(`${API_URL}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jarvis_token')}`
        },
        body: JSON.stringify({
          message: `Schedule this meeting: ${nlText}`,
          conversationId: convo.id,
          model: 'gemini-3.5-flash'
        }),
        credentials: 'include'
      });

      // Consume the reader to wait until done
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
        }
      }

      setNlText('');
      fetchEvents(); // Reload calendar grid to show new event!
      alert('Calendar scheduled successfully via natural language command, Sir!');
    } catch (err) {
      console.error('Failed to schedule via NLP:', err);
      alert('Unable to schedule meeting via NLP. Please verify syntax.');
    } finally {
      setSchedulingNl(false);
    }
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-[calc(100vh-80px)] no-scrollbar relative z-10 hud-grid">
      
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-hud font-bold text-white tracking-wide glow-text-blue">
            CHRONOMETRIC TIMELINES
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-hud uppercase tracking-widest">
            Schedules and coordinate timelines on primary calendar
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 bg-jarvis-bg/40 glass-panel p-1 rounded-lg border border-jarvis-blue/10">
          {(['today', 'week', 'month'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-4 py-1.5 rounded text-xs font-hud tracking-wider uppercase transition-all duration-200
                ${activeTab === tab 
                  ? 'bg-jarvis-blue/15 text-jarvis-blue font-bold border border-jarvis-blue/20' 
                  : 'text-gray-400 hover:text-white'}
              `}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Events Timeline feed */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard className="min-h-[400px] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-3">
                <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-jarvis-blue" />
                  <span className="uppercase tracking-widest text-xs">Calendar Feed ({activeTab})</span>
                </h3>
              </div>

              <div className="space-y-3 mt-4">
                {loading ? (
                  <div className="py-20 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-jarvis-blue animate-spin" />
                  </div>
                ) : events.length > 0 ? (
                  events.map((event) => {
                    const start = new Date(event.startTime);
                    const end = new Date(event.endTime);
                    const timeRange = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                    
                    return (
                      <div
                        key={event.id}
                        className="p-4 rounded-xl border border-jarvis-blue/10 bg-white/2 hover:bg-jarvis-blue/5 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-start gap-4">
                          {/* Left Date indicator */}
                          <div className="flex flex-col items-center bg-jarvis-blue/10 text-jarvis-blue border border-jarvis-blue/25 rounded-lg px-3 py-1.5 min-w-[56px] text-center shadow-[inset_0_0_8px_rgba(0,240,255,0.05)]">
                            <span className="text-[10px] font-mono leading-none uppercase">{start.toLocaleDateString([], { month: 'short' })}</span>
                            <span className="text-lg font-bold font-hud leading-none mt-1">{start.getDate()}</span>
                          </div>
                          
                          {/* Info */}
                          <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-white">{event.summary}</h4>
                            <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-jarvis-blue shrink-0" />
                              <span>{timeRange}</span>
                            </p>
                            {event.location && (
                              <p className="text-[10px] text-gray-400 font-hud tracking-wide flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-jarvis-blue shrink-0" />
                                <span className="truncate max-w-[200px]">{event.location}</span>
                              </p>
                            )}
                            {event.attendees.length > 0 && (
                              <div className="flex items-center gap-1 text-[9px] text-jarvis-blue font-hud uppercase tracking-wider pt-1">
                                <Users className="w-3 h-3 text-jarvis-blue shrink-0" />
                                <span>{event.attendees.length} Attendees</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-center">
                          {event.htmlLink && (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-hud border border-jarvis-blue/20 hover:border-jarvis-blue/45 px-3 py-1.5 rounded hover:bg-jarvis-blue/10 transition-all"
                            >
                              Open in GCal
                            </a>
                          )}
                          <button
                            onClick={(e) => handleDeleteEvent(event.id, e)}
                            className="p-1.5 rounded border border-transparent hover:border-red-400/20 text-gray-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                            title="Cancel Event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-20 text-sm text-gray-500 font-hud flex flex-col items-center justify-center space-y-4">
                    <CalendarCheck className="w-12 h-12 text-gray-600 animate-pulse" />
                    <span>No calendar schedules compiled for this timeframe, Sir.</span>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Action Widgets Sidebar */}
        <div className="space-y-8">
          
          {/* Natural Language Scheduling */}
          <GlassCard className="space-y-4">
            <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2 border-b border-jarvis-blue/10 pb-3">
              <Sparkles className="w-4 h-4 text-jarvis-blue" />
              <span className="uppercase tracking-widest text-xs">AI Natural Scheduler</span>
            </h3>
            
            <form onSubmit={handleNlSchedule} className="space-y-3">
              <textarea
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                placeholder="Instruct in normal terms, Sir (e.g. Schedule a meeting tomorrow with John at 2:00 PM about Q3 metrics)."
                className="w-full min-h-[90px] bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-3 text-xs text-white outline-none placeholder-gray-600 font-hud tracking-wide"
              />
              <button
                type="submit"
                disabled={schedulingNl || !nlText.trim()}
                className="w-full py-2.5 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider flex items-center justify-center gap-2 hover:bg-jarvis-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all duration-300 disabled:opacity-50"
              >
                {schedulingNl ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resolving Coordinates...</span>
                  </>
                ) : (
                  <>
                    <span>Schedule Event</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </GlassCard>

          {/* Manual Scheduler Form Toggle */}
          <GlassCard className="space-y-4">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-jarvis-blue/10 border border-jarvis-blue/20 text-jarvis-blue hover:bg-jarvis-blue/20 transition-all font-hud text-xs tracking-wide uppercase"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreating ? 'Close Scheduler' : 'Manual Scheduler'}</span>
            </button>

            {isCreating && (
              <form onSubmit={handleCreateEvent} className="space-y-4 pt-2">
                <div>
                  <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Event Title</label>
                  <input
                    type="text"
                    required
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Briefing with Stark Team"
                    className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-xs text-white outline-none placeholder-gray-600 font-hud"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Details/Agenda</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Q3 operational schedules overview"
                    className="w-full min-h-[60px] bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-xs text-white outline-none placeholder-gray-600 font-hud"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Start Coordinates</label>
                    <input
                      type="datetime-local"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-[10px] text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">End Coordinates</label>
                    <input
                      type="datetime-local"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-[10px] text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Location / Video Link</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Stark Labs, NY / Meet link"
                    className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-xs text-white outline-none placeholder-gray-600 font-hud"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Attendees (Comma-separated Emails)</label>
                  <input
                    type="text"
                    value={attendeesInput}
                    onChange={(e) => setAttendeesInput(e.target.value)}
                    placeholder="rahul@domain.com, john@domain.com"
                    className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-xs text-white outline-none placeholder-gray-600 font-hud"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider uppercase hover:bg-jarvis-cyan hover:shadow-[0_0_10px_rgba(0,240,255,0.3)] transition-all"
                >
                  {saving ? 'Transmitting Schedule...' : 'Save Timeline'}
                </button>
              </form>
            )}
          </GlassCard>

        </div>

      </div>

    </div>
  );
}
