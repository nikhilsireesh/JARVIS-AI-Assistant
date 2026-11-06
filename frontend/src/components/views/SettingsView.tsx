'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import GlassCard from '../GlassCard';
import { 
  Settings, 
  Cpu, 
  User, 
  ShieldCheck, 
  Bell, 
  Check, 
  LogOut, 
  Link2Off,
  CloudLightning,
  Sparkles
} from 'lucide-react';

export default function SettingsView() {
  const { user, loginWithGoogle, refreshProfile } = useAuth();
  
  // Local preference states
  const [model, setModel] = useState(user?.preferences?.model || 'gemini-3.5-flash');
  const [theme, setTheme] = useState(user?.preferences?.theme || 'dark');
  const [notifications, setNotifications] = useState(user?.preferences?.notifications ?? true);
  const [saving, setSaving] = useState(false);

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      await api.put('/settings/preferences', {
        model,
        theme,
        notifications
      });
      await refreshProfile();
      alert('System configurations updated successfully, Sir.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you absolutely certain you wish to sever connection links with Stark mainframe coordinates (Google APIs)?')) return;
    try {
      await api.post('/settings/disconnect-google');
      await refreshProfile();
      alert('Google Workspace connection severed.');
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-[calc(100vh-80px)] no-scrollbar relative z-10 hud-grid">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-hud font-bold text-white tracking-wide glow-text-blue">
          MAINFRAME PREFERENCES
        </h1>
        <p className="text-sm text-gray-400 mt-1 font-hud uppercase tracking-widest">
          Configure active Gemini models, system overlays, and account links
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <GlassCard className="flex flex-col items-center text-center space-y-4">
            <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2 border-b border-jarvis-blue/10 pb-3 w-full justify-center">
              <User className="w-4 h-4 text-jarvis-blue" />
              <span>User Profile</span>
            </h3>

            <div className="relative">
              {user?.avatar ? (
                <img 
                  src={user.avatar} 
                  alt="Avatar" 
                  className="w-20 h-20 rounded-full border-2 border-jarvis-blue/40 shadow-[0_0_15px_rgba(0,240,255,0.3)]" 
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-jarvis-blue/10 flex items-center justify-center border-2 border-jarvis-blue/30 text-xl font-bold font-hud text-jarvis-blue shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                  ST
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-jarvis-bg animate-pulse" />
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white font-hud tracking-wide">{user?.name || 'Sir'}</h4>
              <p className="text-xs text-gray-500 font-mono mt-1">{user?.email}</p>
            </div>
            
            <div className="w-full border-t border-jarvis-blue/10 pt-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-center text-[10px] font-hud uppercase tracking-wider text-gray-500">
                <span>System Security</span>
                <span className="text-green-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  JWT ACTIVE
                </span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Configurations Card */}
        <div className="md:col-span-2 space-y-6">
          <GlassCard className="space-y-6">
            <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2 border-b border-jarvis-blue/10 pb-3">
              <Settings className="w-4.5 h-4.5 text-jarvis-blue" />
              <span>System Settings</span>
            </h3>

            <div className="space-y-5">
              
              {/* Active Gemini Model */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-white font-hud tracking-wide flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-jarvis-blue" />
                    <span>Gemini Model Selector</span>
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Toggle default cognitive modeling mainframe</p>
                </div>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-xs text-white outline-none font-hud max-w-xs w-full"
                >
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Default)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Analytical, paid tier)</option>
                </select>
              </div>

              {/* Notification Center Alerts Toggle */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-jarvis-blue/5 pt-4">
                <div>
                  <h4 className="text-xs font-semibold text-white font-hud tracking-wide flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-jarvis-blue" />
                    <span>HUD Telemetry Alerts</span>
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Receive audio and HUD notifications when active</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifications(!notifications)}
                  className={`
                    w-12 h-6 rounded-full p-1 transition-all duration-300 relative border
                    ${notifications 
                      ? 'bg-jarvis-blue/15 border-jarvis-blue' 
                      : 'bg-black/40 border-jarvis-blue/10'}
                  `}
                >
                  <div className={`w-4 h-4 rounded-full bg-jarvis-blue transition-all duration-300 ${notifications ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Google Connection Management */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-jarvis-blue/5 pt-4">
                <div>
                  <h4 className="text-xs font-semibold text-white font-hud tracking-wide flex items-center gap-1.5">
                    <CloudLightning className="w-4 h-4 text-jarvis-blue" />
                    <span>Google Workspace Mainframe Link</span>
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Manage OAuth 2.0 link status for Gmail, Calendar, Sheets</p>
                </div>
                {user?.isGoogleConnected ? (
                  <button
                    onClick={handleDisconnectGoogle}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-400/40 bg-red-500/5 hover:bg-red-500/15 text-red-400 transition-all font-hud text-xs"
                  >
                    <Link2Off className="w-4 h-4" />
                    <span>Sever connection</span>
                  </button>
                ) : (
                  <button
                    onClick={loginWithGoogle}
                    className="px-4 py-1.5 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider uppercase hover:bg-jarvis-cyan hover:shadow-[0_0_10px_rgba(0,240,255,0.3)] transition-all"
                  >
                    Connect with Google
                  </button>
                )}
              </div>

            </div>

            {/* Save Button */}
            <div className="border-t border-jarvis-blue/10 pt-4 flex justify-end">
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider uppercase hover:bg-jarvis-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.4)] transition-all flex items-center gap-1.5"
              >
                {saving ? 'Saving...' : 'Commit Preferences'}
                <Check className="w-4 h-4" />
              </button>
            </div>
          </GlassCard>
        </div>

      </div>

    </div>
  );
}
