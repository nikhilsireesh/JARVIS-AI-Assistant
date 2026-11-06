'use client';

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import Sidebar, { TabName } from '../components/Sidebar';
import Navbar from '../components/Navbar';
import ParticlesBackground from '../components/ParticlesBackground';
import CommandPalette from '../components/CommandPalette';
import GlassCard from '../components/GlassCard';

// View Imports
import DashboardView from '../components/views/DashboardView';
import ChatView from '../components/views/ChatView';
import GmailView from '../components/views/GmailView';
import CalendarView from '../components/views/CalendarView';
import SheetsView from '../components/views/SheetsView';
import AutomationView from '../components/views/AutomationView';
import ActivityView from '../components/views/ActivityView';
import SettingsView from '../components/views/SettingsView';
import TasksView from '../components/views/TasksView';
import NotesView from '../components/views/NotesView';

import { Terminal, Shield, LogIn } from 'lucide-react';

function DashboardShell() {
  const { isLoggedIn, loginWithGoogle, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const [apiStatus, setApiStatus] = useState<'healthy' | 'unhealthy'>('healthy');
  
  // Command Palette & Quick Action triggers
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [composeTrigger, setComposeTrigger] = useState(0);
  const [meetingTrigger, setMeetingTrigger] = useState(0);

  // LTM Buzzer Alert states
  const [ltmToast, setLtmToast] = useState<{ id: string; message: string } | null>(null);

  // Read token from query parameters (cross-origin callback support)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        localStorage.setItem('jarvis_token', urlToken);
        // Clean the token from the browser address bar
        const newUrl = window.location.pathname;
        window.history.replaceState(null, '', newUrl);
        // Refresh page to trigger profile load
        window.location.reload();
      }
    }
  }, []);

  // Monitor LTM alerts in activity logs
  useEffect(() => {
    if (!isLoggedIn) return;

    // Track when this session loaded so we only alert on new items
    let lastAlertTime = Date.now();

    const playBuzzer = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        
        const playBeep = (time: number, freq: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, time);
          
          gain.gain.setValueAtTime(0.15, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + duration - 0.02);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(time);
          osc.stop(time + duration);
        };
        
        const now = ctx.currentTime;
        playBeep(now, 880, 0.15); // A5 note
        playBeep(now + 0.2, 880, 0.15); // Double beep
      } catch (err) {
        console.error('Failed to play HUD buzzer:', err);
      }
    };

    const checkLtmAlerts = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
        const res = await fetch(`${API_URL}/workspace/activity`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('jarvis_token')}`
          }
        });
        if (!res.ok) return;
        
        const logs = await res.json();
        const ltmAlerts = logs.filter((l: any) => l.action_type === 'ltm_alert');
        if (ltmAlerts.length > 0) {
          ltmAlerts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          const newestAlert = ltmAlerts[0];
          const alertTime = new Date(newestAlert.created_at).getTime();
          
          if (alertTime > lastAlertTime) {
            lastAlertTime = alertTime;
            setLtmToast({ id: newestAlert.id || Math.random().toString(), message: newestAlert.details });
            playBuzzer();
          }
        }
      } catch (err) {
        console.error('Failed to poll LTM alerts:', err);
      }
    };

    const interval = setInterval(checkLtmAlerts, 10000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Monitor backend connection health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
        const res = await fetch(`${API_URL}/auth/google`);
        if (res.ok) setApiStatus('healthy');
        else setApiStatus('unhealthy');
      } catch {
        setApiStatus('unhealthy');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Listen for Ctrl+K global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleQuickAction = (action: string) => {
    if (action === 'draft_email') {
      setActiveTab('gmail');
      // Increment trigger timestamp to fire view reaction
      setComposeTrigger(Date.now());
    } else if (action === 'create_meeting') {
      setActiveTab('calendar');
      setMeetingTrigger(Date.now());
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-jarvis-bg flex items-center justify-center relative">
        <ParticlesBackground />
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border-4 border-jarvis-blue/10 border-t-jarvis-blue animate-spin" />
          <p className="mt-6 font-hud text-xs text-jarvis-blue tracking-widest animate-pulse">
            JARVIS MAIN DEPLOYMENT INITIALIZING...
          </p>
        </div>
      </div>
    );
  }

  // --- UNAUTHENTICATED: Render futuristic login desk ---
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-jarvis-bg flex flex-col items-center justify-center p-6 relative select-none">
        <ParticlesBackground />
        
        <GlassCard className="w-full max-w-md p-8 text-center space-y-6 border border-jarvis-blue/20 bg-jarvis-bg/85 shadow-[0_0_40px_rgba(0,240,255,0.1)]" hoverEffect={false}>
          {/* Logo center */}
          <div className="flex flex-col items-center">
            <img 
              src="/logo.jpg" 
              alt="JARVIS Logo" 
              className="w-16 h-16 rounded-2xl border border-jarvis-blue/30 shadow-[0_0_15px_rgba(0,240,255,0.25)] object-cover mb-2"
            />
            <h1 className="mt-4 font-hud text-2xl font-black tracking-wider text-white glow-text-blue">
              JARVIS AI
            </h1>
            <p className="text-[10px] text-gray-500 font-hud tracking-widest uppercase mt-0.5">
              Personal Workspace mainframe
            </p>
          </div>

          <p className="text-xs text-gray-400 font-hud leading-relaxed">
            Sir, please authenticate using Google OAuth coordinates to establish connection hooks with your Gmail, Calendar, and Sheets.
          </p>

          <button
            onClick={loginWithGoogle}
            className="w-full py-3 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 hover:bg-jarvis-cyan hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all duration-300"
          >
            <LogIn className="w-4 h-4" />
            <span>Connect Workspace</span>
          </button>

          <div className="border-t border-jarvis-blue/10 pt-4 flex items-center justify-center gap-1.5 text-[9px] text-gray-500 font-hud uppercase tracking-widest">
            <Shield className="w-3.5 h-3.5 text-jarvis-blue" />
            <span>AES-256 ENCRYPTED CREDENTIALS</span>
          </div>
        </GlassCard>
      </main>
    );
  }

  // --- AUTHENTICATED: Render main dashboard interface ---
  const activeModel = user?.preferences?.model || 'gemini-3.5-flash';

  return (
    <div className="flex min-h-screen bg-jarvis-bg text-gray-100 overflow-hidden relative">
      <ParticlesBackground />
      
      {/* Left Navigation Menu */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Right Content Panel */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Navbar apiStatus={apiStatus} activeModel={activeModel} />
        
        {/* Render active tabs */}
        <div className="flex-1 min-h-0 relative">
          {activeTab === 'dashboard' && (
            <DashboardView 
              onNavigate={setActiveTab} 
              onQuickAction={handleQuickAction} 
            />
          )}
          {activeTab === 'chat' && <ChatView />}
          {activeTab === 'gmail' && <GmailView />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'sheets' && <SheetsView />}
          {activeTab === 'automation' && <AutomationView />}
          {activeTab === 'activity' && <ActivityView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'tasks' && <TasksView />}
          {activeTab === 'notes' && <NotesView />}
        </div>
      </div>

      {/* Global Command palette */}
      <CommandPalette 
        isOpen={isCommandOpen} 
        onClose={() => setIsCommandOpen(false)} 
        onNavigate={setActiveTab}
        onQuickAction={handleQuickAction}
      />

      {/* LTM Alert Toast */}
      {ltmToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm glass-panel p-4 rounded-xl border border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.25)] animate-pulse flex items-start gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex justify-between items-center text-[10px] font-hud uppercase tracking-widest text-red-400">
              <span>Stark Mainframe Telemetry Alert</span>
              <button onClick={() => setLtmToast(null)} className="hover:text-white font-bold text-xs">✕</button>
            </div>
            <p className="text-xs text-white font-hud leading-relaxed">
              {ltmToast.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <DashboardShell />
    </AuthProvider>
  );
}
