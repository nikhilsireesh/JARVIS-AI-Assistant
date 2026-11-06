'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import GlassCard from '../GlassCard';
import { 
  Workflow, 
  Plus, 
  Activity, 
  Trash2, 
  Power, 
  Clock, 
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  cron_expression: string;
  action_type: string;
  action_config: any;
  is_active: boolean;
  last_run_at: string | null;
}

interface RunLog {
  id: string;
  automation_name: string;
  status: 'success' | 'failed';
  output: string;
  run_duration_ms: number;
  created_at: string;
}

export default function AutomationView() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // New automation states
  const [name, setName] = useState('');
  const [actionType, setActionType] = useState('email_summary');
  const [cronExpression, setCronExpression] = useState('0 9 * * *'); // Default 9 AM daily
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const list = await api.get<Automation[]>('/automations');
      setAutomations(list);
      
      setLoadingLogs(true);
      const logList = await api.get<RunLog[]>('/automations/logs');
      setLogs(logList);
    } catch (err) {
      console.error('Failed to load automation data:', err);
    } finally {
      setLoading(false);
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.put(`/automations/${id}`, {
        isActive: !currentStatus
      });
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
    } catch (err) {
      console.error('Failed to toggle automation status:', err);
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation script, Sir?')) return;
    try {
      await api.delete(`/automations/${id}`);
      setAutomations(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Failed to delete automation:', err);
    }
  };

  const handleCreateAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cronExpression) return;

    setCreating(true);
    try {
      await api.post('/automations', {
        name,
        triggerType: 'schedule',
        cronExpression,
        actionType,
        actionConfig: {}
      });
      
      setName('');
      fetchData();
    } catch (err) {
      console.error('Failed to create automation:', err);
      alert('Unable to schedule automation. Verify cron syntax.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-[calc(100vh-80px)] no-scrollbar relative z-10 hud-grid">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-hud font-bold text-white tracking-wide glow-text-blue">
          AUTOMATION ARCS
        </h1>
        <p className="text-sm text-gray-400 mt-1 font-hud uppercase tracking-widest">
          Schedule background cron automations and generate workspace briefings
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Active Automations List */}
        <div className="xl:col-span-2 space-y-6">
          <GlassCard className="min-h-[400px]">
            <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-3 mb-6">
              <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
                <Workflow className="w-4 h-4 text-jarvis-blue" />
                <span className="uppercase tracking-widest text-xs">Active Automated Arcs</span>
              </h3>
            </div>

            {loading ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="w-6 h-6 text-jarvis-blue animate-spin" />
              </div>
            ) : automations.length > 0 ? (
              <div className="space-y-4">
                {automations.map((auto) => (
                  <div
                    key={auto.id}
                    className="p-4 rounded-xl border border-jarvis-blue/10 bg-white/2 hover:bg-jarvis-blue/5 transition-all duration-200 flex items-center justify-between gap-6"
                  >
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => handleToggleActive(auto.id, auto.is_active)}
                        className={`
                          p-2.5 rounded-lg border transition-all duration-300
                          ${auto.is_active 
                            ? 'border-green-500/20 bg-green-500/10 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.15)]' 
                            : 'border-jarvis-blue/10 text-gray-500'}
                        `}
                      >
                        <Power className="w-4.5 h-4.5" />
                      </button>
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-white">{auto.name}</h4>
                        <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-jarvis-blue" />
                            {auto.cron_expression}
                          </span>
                          <span className="uppercase tracking-wider">
                            Type: {auto.action_type}
                          </span>
                        </div>
                        {auto.last_run_at && (
                          <p className="text-[9px] text-gray-500 font-mono">
                            Last run: {new Date(auto.last_run_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteAutomation(auto.id)}
                      className="p-2 rounded border border-transparent hover:border-red-400/20 text-gray-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-sm text-gray-500 font-hud">
                No active automation tasks deployed.
              </div>
            )}
          </GlassCard>
        </div>

        {/* Create Automation Sidebar */}
        <div className="space-y-8">
          <GlassCard className="space-y-4">
            <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2 border-b border-jarvis-blue/10 pb-3">
              <Plus className="w-4 h-4 text-jarvis-blue" />
              <span className="uppercase tracking-widest text-xs">Deploy New Arc</span>
            </h3>

            <form onSubmit={handleCreateAutomation} className="space-y-4">
              <div>
                <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Arc Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Morning Briefing Report"
                  className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-xs text-white outline-none placeholder-gray-600 font-hud"
                />
              </div>

              <div>
                <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Action Payload</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-xs text-white outline-none font-hud"
                >
                  <option value="email_summary">Summarize Inbox & Email Report</option>
                  <option value="meeting_notification">Compile Meeting Timeline Alert</option>
                  <option value="end_of_day_report">Compile End of Day Action Logs</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Cron Expression Coordinates</label>
                <input
                  type="text"
                  required
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 9 * * * (e.g. 9:00 AM daily)"
                  className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-xs text-white outline-none placeholder-gray-600 font-mono"
                />
                <a 
                  href="https://crontab.guru" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[9px] text-jarvis-blue font-hud uppercase tracking-wider block mt-1 hover:underline text-right"
                >
                  Cron Guide Helper
                </a>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider uppercase hover:bg-jarvis-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all"
              >
                {creating ? 'Deploying Arc...' : 'Deploy Schedule'}
              </button>
            </form>
          </GlassCard>
        </div>

      </div>

      {/* Execution Logs */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-3">
          <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
            <Activity className="w-4 h-4 text-jarvis-blue" />
            <span className="uppercase tracking-widest text-xs">Automation Run Logs</span>
          </h3>
        </div>

        <div className="max-h-[300px] overflow-y-auto no-scrollbar font-mono text-[10px] space-y-2">
          {loadingLogs ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-4 h-4 text-jarvis-blue animate-spin" />
            </div>
          ) : logs.length > 0 ? (
            logs.map((log) => (
              <div 
                key={log.id} 
                className="flex items-start gap-4 p-2.5 rounded hover:bg-white/2 transition-colors border border-transparent hover:border-jarvis-blue/5"
              >
                {log.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex justify-between flex-wrap gap-2 text-gray-500">
                    <span className="text-white font-hud font-semibold">{log.automation_name}</span>
                    <span>Duration: {log.run_duration_ms}ms | {new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-400 mt-1 whitespace-pre-wrap">{log.output}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-gray-500 font-hud">
              No automation logs compiled.
            </div>
          )}
        </div>
      </GlassCard>

    </div>
  );
}
