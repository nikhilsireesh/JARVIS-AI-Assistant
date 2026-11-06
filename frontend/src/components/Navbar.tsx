'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, 
  Cpu, 
  Wifi, 
  CheckCircle2, 
  AlertCircle,
  Clock
} from 'lucide-react';

interface NavbarProps {
  apiStatus: 'healthy' | 'unhealthy' | 'loading';
  activeModel: string;
}

export default function Navbar({ apiStatus, activeModel }: NavbarProps) {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [greeting, setGreeting] = useState('Welcome');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      
      // Formatting Date
      const dateOpts: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      setCurrentDate(now.toLocaleDateString('en-US', dateOpts));
      
      // Formatting Time
      const timeOpts: Intl.DateTimeFormatOptions = { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      };
      setCurrentTime(now.toLocaleTimeString('en-US', timeOpts));
      
      // Greeting based on hours
      const hour = now.getHours();
      if (hour < 12) setGreeting('Good morning, Sir');
      else if (hour < 18) setGreeting('Good afternoon, Sir');
      else setGreeting('Good evening, Sir');
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-20 border-b border-jarvis-blue/10 bg-jarvis-bg/40 backdrop-blur-md px-8 flex items-center justify-between z-10 w-full relative">
      {/* Greeting and Date */}
      <div>
        <h2 className="text-xl font-hud font-bold text-white tracking-wide flex items-center gap-2">
          <span>{greeting}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-jarvis-blue animate-ping" />
        </h2>
        <p className="text-xs text-gray-400 font-hud tracking-widest mt-1 flex items-center gap-3">
          <span>{currentDate}</span>
          <span className="text-jarvis-blue/40 font-bold">|</span>
          <span className="flex items-center gap-1 text-jarvis-blue font-mono font-medium">
            <Clock className="w-3.5 h-3.5 text-jarvis-blue" />
            {currentTime}
          </span>
        </p>
      </div>

      {/* Stats and Indicators */}
      <div className="flex items-center gap-6">
        
        {/* Gemini Model Indicator */}
        <div className="glass-panel px-3 py-1.5 rounded-lg flex items-center gap-2 border border-jarvis-blue/10">
          <Cpu className="w-4 h-4 text-jarvis-blue" />
          <div className="text-[10px] font-hud uppercase tracking-widest text-gray-500 leading-none">
            Core AI
            <span className="block text-white text-xs font-semibold normal-case font-mono mt-0.5">{activeModel}</span>
          </div>
        </div>

        {/* Google Workspace Account Connection */}
        <div className="glass-panel px-3 py-1.5 rounded-lg flex items-center gap-2.5 border border-jarvis-blue/10">
          {user?.avatar ? (
            <img 
              src={user.avatar} 
              alt="Avatar" 
              className="w-7 h-7 rounded-full border border-jarvis-blue/30 shadow-[0_0_8px_rgba(0,240,255,0.2)]" 
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-jarvis-blue/20 flex items-center justify-center text-xs text-jarvis-blue border border-jarvis-blue/30 font-hud">
              ST
            </div>
          )}
          <div className="text-[10px] font-hud uppercase tracking-widest text-gray-500 leading-none">
            Workspace Account
            <span className="block text-white text-xs font-semibold normal-case mt-0.5 truncate max-w-[140px]">
              {user?.email || 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Api connection Status */}
        <div className="glass-panel px-3 py-1.5 rounded-lg flex items-center gap-2 border border-jarvis-blue/10">
          {apiStatus === 'healthy' ? (
            <Wifi className="w-4 h-4 text-green-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />
          )}
          <div className="text-[10px] font-hud uppercase tracking-widest text-gray-500 leading-none">
            Sync Status
            <span className="block text-white text-xs font-semibold normal-case mt-0.5">
              {apiStatus === 'healthy' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Notification bell */}
        <button className="w-10 h-10 rounded-lg glass-panel flex items-center justify-center border border-jarvis-blue/10 hover:border-jarvis-blue/30 transition-all duration-300 relative group">
          <Bell className="w-5 h-5 text-gray-300 group-hover:text-jarvis-blue transition-colors duration-300" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-jarvis-blue shadow-[0_0_6px_rgba(0,240,255,0.8)]" />
        </button>

      </div>
    </header>
  );
}
