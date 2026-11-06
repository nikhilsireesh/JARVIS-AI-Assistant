'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import GlassCard from '../GlassCard';
import { 
  Activity, 
  Terminal, 
  Loader2, 
  RefreshCw,
  Clock
} from 'lucide-react';

interface ActivityLog {
  action_type: string;
  details: string;
  created_at: string;
}

export default function ActivityView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const list = await api.get<ActivityLog[]>('/workspace/activity');
      setLogs(list);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-[calc(100vh-80px)] no-scrollbar relative z-10 hud-grid">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-hud font-bold text-white tracking-wide glow-text-blue">
            SYSTEM TELEMETRY
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-hud uppercase tracking-widest">
            Audit logs tracking all workspace and AI actions
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="glass-panel p-2.5 rounded-lg border border-jarvis-blue/15 hover:border-jarvis-blue/30 text-gray-300 hover:text-jarvis-blue transition-all duration-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Terminal logs container */}
      <GlassCard className="min-h-[500px] flex flex-col">
        <div className="flex items-center gap-2 border-b border-jarvis-blue/10 pb-3 mb-4">
          <Terminal className="w-5 h-5 text-jarvis-blue animate-pulse" />
          <span className="font-hud text-xs font-bold uppercase tracking-wider text-white">
            Telemetry Console readout
          </span>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar font-mono text-xs space-y-3.5 pr-2">
          {loading ? (
            <div className="h-full flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-jarvis-blue animate-spin" />
            </div>
          ) : logs.length > 0 ? (
            logs.map((log, idx) => {
              const date = new Date(log.created_at);
              const timestamp = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
              return (
                <div 
                  key={idx} 
                  className="flex items-start gap-4 p-2 rounded hover:bg-white/2 transition-colors border border-transparent hover:border-jarvis-blue/5 leading-relaxed"
                >
                  <span className="text-jarvis-blue font-semibold shrink-0">[{timestamp}]</span>
                  <span className="text-[10px] uppercase font-hud tracking-widest text-jarvis-blue bg-jarvis-blue/10 px-1.5 py-0.5 rounded border border-jarvis-blue/20 shrink-0">
                    {log.action_type}
                  </span>
                  <span className="text-gray-300">{log.details}</span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20 text-gray-500 font-hud">
              Console feed is currently empty. Execute commands to populate, Sir.
            </div>
          )}
        </div>
      </GlassCard>

    </div>
  );
}
