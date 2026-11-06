'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquareCode,
  Mail,
  Calendar,
  FileSpreadsheet,
  CheckSquare,
  FileText,
  Workflow,
  Activity,
  Settings,
  Terminal,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type TabName =
  | 'dashboard'
  | 'chat'
  | 'gmail'
  | 'calendar'
  | 'sheets'
  | 'tasks'
  | 'notes'
  | 'automation'
  | 'activity'
  | 'settings';

interface SidebarProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'AI Chat', icon: MessageSquareCode },
    { id: 'gmail', label: 'Gmail', icon: Mail },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'sheets', label: 'Sheets', icon: FileSpreadsheet },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'automation', label: 'Automation', icon: Workflow },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <aside className="w-64 glass-panel border-r border-jarvis-blue/15 h-screen flex flex-col justify-between p-4 z-20">
      <div>
        {/* Title / Logo */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-jarvis-blue/10">
          <div className="relative">
            <img 
              src="/logo.jpg" 
              alt="JARVIS Logo" 
              className="w-9 h-9 rounded-lg border border-jarvis-blue/20 shadow-[0_0_8px_rgba(0,240,255,0.2)] object-cover"
            />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-jarvis-bg animate-pulse" />
          </div>
          <div>
            <h1 className="font-hud text-lg font-bold tracking-wider text-jarvis-blue glow-text-blue">
              JARVIS AI
            </h1>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-hud">
              SYSTEM ACTIVE
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 relative group
                  ${isActive 
                    ? 'text-jarvis-blue bg-jarvis-blue/10 border-l-2 border-jarvis-blue' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'}
                `}
              >
                <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-jarvis-blue' : 'text-gray-400'}`} />
                <span className="font-hud tracking-wide">{item.label}</span>

                {/* Hover indicator glow */}
                {!isActive && (
                  <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-jarvis-blue/0 group-hover:bg-jarvis-blue/40 group-hover:shadow-[0_0_6px_rgba(0,240,255,0.8)] transition-all duration-300" />
                )}

                {/* Active Indicator Glow Background */}
                {isActive && (
                  <motion.div
                    layoutId="activeGlow"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-jarvis-blue/5 to-transparent pointer-events-none"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout / User Info */}
      <div className="border-t border-jarvis-blue/10 pt-4">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border-l-2 border-transparent transition-all duration-300 font-hud tracking-wide"
        >
          <LogOut className="w-5 h-5" />
          <span>System Logout</span>
        </button>
      </div>
    </aside>
  );
}
