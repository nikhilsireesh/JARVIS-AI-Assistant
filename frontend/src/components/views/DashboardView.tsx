'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import GlassCard from '../GlassCard';
import { 
  Sparkles, 
  Mail, 
  Calendar as CalendarIcon, 
  Activity, 
  ArrowUpRight, 
  TrendingUp, 
  RefreshCw,
  Plus
} from 'lucide-react';

interface DashboardData {
  unreadCount: number;
  recentEmails: any[];
  upcomingMeetings: any[];
  activityLogs: any[];
  productivityScore: number;
}

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
  onQuickAction: (action: string) => void;
}

export default function DashboardView({ onNavigate, onQuickAction }: DashboardViewProps) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const res = await api.get<DashboardData>('/workspace/dashboard');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border-4 border-jarvis-blue/10 border-t-jarvis-blue animate-spin" />
          <p className="mt-4 font-hud text-xs text-jarvis-blue tracking-widest animate-pulse">
            LOADING JARVIS DASHBOARD METRICS...
          </p>
        </div>
      </div>
    );
  }

  const score = data?.productivityScore || 75;
  const circumference = 2 * Math.PI * 45; // radius is 45
  const strokeOffset = circumference - (score / 100) * circumference;

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-[calc(100vh-80px)] no-scrollbar relative z-10 hud-grid">
      {/* Welcome Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-hud font-bold text-white tracking-wide glow-text-blue">
            COMMAND DECKS
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-hud uppercase tracking-widest">
            Holographic Overview of your Google Workspace
          </p>
        </div>
        <button
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="glass-panel p-2.5 rounded-lg border border-jarvis-blue/15 hover:border-jarvis-blue/30 text-gray-300 hover:text-jarvis-blue transition-all duration-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Core Stats Overview */}
        <GlassCard className="col-span-2 space-y-6" delay={0.1}>
          <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-4">
            <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-jarvis-blue" />
              <span>Today's Summary</span>
            </h3>
            <span className="text-[10px] bg-jarvis-blue/10 text-jarvis-blue border border-jarvis-blue/20 px-2 py-0.5 rounded font-hud tracking-widest uppercase">
              Live Feed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Unread emails widget */}
            <div className="glass-panel p-4 rounded-xl border border-jarvis-blue/10 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-hud tracking-widest uppercase">Unread Messages</span>
                <h4 className="text-3xl font-hud font-bold text-white mt-1">{data?.unreadCount || 0}</h4>
                <button 
                  onClick={() => onNavigate('gmail')}
                  className="text-xs text-jarvis-blue hover:text-jarvis-cyan mt-3 flex items-center gap-1 font-hud tracking-wide group transition-colors duration-200"
                >
                  <span>Open Inbox</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                </button>
              </div>
              <div className="w-12 h-12 rounded-lg bg-jarvis-blue/10 flex items-center justify-center border border-jarvis-blue/25 shadow-[0_0_10px_rgba(0,240,255,0.15)]">
                <Mail className="w-6 h-6 text-jarvis-blue" />
              </div>
            </div>

            {/* Upcoming meetings widget */}
            <div className="glass-panel p-4 rounded-xl border border-jarvis-blue/10 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-hud tracking-widest uppercase">Upcoming Meetings</span>
                <h4 className="text-3xl font-hud font-bold text-white mt-1">{data?.upcomingMeetings.length || 0}</h4>
                <button 
                  onClick={() => onNavigate('calendar')}
                  className="text-xs text-jarvis-blue hover:text-jarvis-cyan mt-3 flex items-center gap-1 font-hud tracking-wide group transition-colors duration-200"
                >
                  <span>View Schedule</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                </button>
              </div>
              <div className="w-12 h-12 rounded-lg bg-jarvis-blue/10 flex items-center justify-center border border-jarvis-blue/25 shadow-[0_0_10px_rgba(0,240,255,0.15)]">
                <CalendarIcon className="w-6 h-6 text-jarvis-blue" />
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="border-t border-jarvis-blue/10 pt-6">
            <p className="text-xs text-gray-400 font-hud tracking-widest uppercase mb-4">Quick Command Actions</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => onNavigate('chat')}
                className="glass-panel py-3 px-4 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-gray-300 hover:text-jarvis-blue hover:bg-jarvis-blue/5 text-center font-hud text-xs tracking-wider transition-all duration-300"
              >
                Launch Chat
              </button>
              <button
                onClick={() => onQuickAction('draft_email')}
                className="glass-panel py-3 px-4 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-gray-300 hover:text-jarvis-blue hover:bg-jarvis-blue/5 text-center font-hud text-xs tracking-wider transition-all duration-300"
              >
                Compose Email
              </button>
              <button
                onClick={() => onQuickAction('create_meeting')}
                className="glass-panel py-3 px-4 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-gray-300 hover:text-jarvis-blue hover:bg-jarvis-blue/5 text-center font-hud text-xs tracking-wider transition-all duration-300"
              >
                Book Meeting
              </button>
              <button
                onClick={() => onNavigate('sheets')}
                className="glass-panel py-3 px-4 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-gray-300 hover:text-jarvis-blue hover:bg-jarvis-blue/5 text-center font-hud text-xs tracking-wider transition-all duration-300"
              >
                Open Sheets
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Productivity Circle Widget */}
        <GlassCard className="flex flex-col items-center justify-center space-y-6" delay={0.2}>
          <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2 border-b border-jarvis-blue/10 pb-4 w-full justify-center">
            <TrendingUp className="w-4 h-4 text-jarvis-blue" />
            <span>Productivity Index</span>
          </h3>

          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Glowing Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="45"
                className="stroke-jarvis-dark-blue fill-none"
                strokeWidth="10"
              />
              <circle
                cx="80"
                cy="80"
                r="45"
                className="stroke-jarvis-blue fill-none"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                style={{
                  filter: 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.6))',
                  transition: 'stroke-dashoffset 1s ease-out'
                }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-hud font-bold text-white glow-text-blue">{score}%</span>
              <span className="text-[10px] text-gray-500 font-hud tracking-widest uppercase mt-0.5">Rating</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-400 font-hud tracking-wide">
              Holographic automation index is operating at optimal velocity. System health: 100%.
            </p>
          </div>
        </GlassCard>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Unread Emails List */}
        <GlassCard className="space-y-4" delay={0.3}>
          <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-3">
            <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
              <Mail className="w-4 h-4 text-jarvis-blue" />
              <span>Pending Inbox</span>
            </h3>
            <button 
              onClick={() => onNavigate('gmail')}
              className="text-[10px] text-jarvis-blue hover:text-jarvis-cyan font-hud tracking-wider uppercase"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-jarvis-blue/5 space-y-1">
            {data?.recentEmails && data.recentEmails.length > 0 ? (
              data.recentEmails.map((email) => (
                <div 
                  key={email.id} 
                  onClick={() => onNavigate('gmail')}
                  className="py-3 px-2 flex flex-col gap-1 hover:bg-jarvis-blue/5 rounded-lg cursor-pointer transition-colors duration-200"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-jarvis-blue truncate max-w-[150px]">
                      {email.from.split('<')[0].trim()}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="text-xs text-white font-medium truncate">{email.subject}</h4>
                  <p className="text-[11px] text-gray-400 truncate">{email.snippet}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-sm text-gray-500 font-hud">
                No unread messages found, Sir.
              </div>
            )}
          </div>
        </GlassCard>

        {/* Upcoming Meetings List */}
        <GlassCard className="space-y-4" delay={0.4}>
          <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-3">
            <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-jarvis-blue" />
              <span>Timeline Schedule</span>
            </h3>
            <button 
              onClick={() => onNavigate('calendar')}
              className="text-[10px] text-jarvis-blue hover:text-jarvis-cyan font-hud tracking-wider uppercase"
            >
              Calendar Full
            </button>
          </div>

          <div className="space-y-3">
            {data?.upcomingMeetings && data.upcomingMeetings.length > 0 ? (
              data.upcomingMeetings.map((meeting) => {
                const startTime = new Date(meeting.startTime);
                const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isOngoing = new Date() >= startTime && new Date() <= new Date(meeting.endTime);
                
                return (
                  <div 
                    key={meeting.id}
                    className={`
                      p-3 rounded-lg border flex items-center justify-between gap-4
                      ${isOngoing 
                        ? 'border-jarvis-blue bg-jarvis-blue/10 shadow-[0_0_10px_rgba(0,240,255,0.1)]' 
                        : 'border-jarvis-blue/10 bg-white/2'}
                    `}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="flex flex-col items-center bg-jarvis-blue/10 text-jarvis-blue border border-jarvis-blue/20 rounded px-2.5 py-1 min-w-[52px]">
                        <span className="text-[10px] font-mono leading-none">{startTime.toLocaleDateString([], { month: 'short' })}</span>
                        <span className="text-sm font-bold font-hud leading-none mt-1">{startTime.getDate()}</span>
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs font-semibold text-white truncate">{meeting.summary}</h4>
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 font-hud uppercase tracking-wider">
                          <span>{timeStr}</span>
                          {meeting.location && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[120px]">{meeting.location}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    {meeting.htmlLink && (
                      <a 
                        href={meeting.htmlLink}
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-jarvis-blue border border-jarvis-blue/20 hover:border-jarvis-blue/40 px-2 py-1 rounded hover:bg-jarvis-blue/5 transition-all font-hud"
                      >
                        Join
                      </a>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-sm text-gray-500 font-hud">
                No meetings scheduled for today, Sir.
              </div>
            )}
          </div>
        </GlassCard>

      </div>

      {/* Recent Activity Log Logs */}
      <GlassCard className="space-y-4" delay={0.5}>
        <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-3">
          <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
            <Activity className="w-4 h-4 text-jarvis-blue" />
            <span>AI Operations Audit Log</span>
          </h3>
          <button 
            onClick={() => onNavigate('activity')}
            className="text-[10px] text-jarvis-blue hover:text-jarvis-cyan font-hud tracking-wider uppercase"
          >
            Open Logs
          </button>
        </div>

        <div className="space-y-3 font-mono text-[11px]">
          {data?.activityLogs && data.activityLogs.length > 0 ? (
            data.activityLogs.map((log, idx) => {
              const time = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              return (
                <div key={idx} className="flex gap-4 text-gray-400 hover:text-white transition-colors duration-200">
                  <span className="text-jarvis-blue font-semibold">[{time}]</span>
                  <span className="text-gray-500 uppercase tracking-widest text-[9px] px-1.5 py-0.2 bg-white/5 rounded border border-white/10 flex items-center">
                    {log.action_type}
                  </span>
                  <span className="truncate">{log.details}</span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-gray-500 font-hud">
              No recent assistant activities logged.
            </div>
          )}
        </div>
      </GlassCard>

    </div>
  );
}
