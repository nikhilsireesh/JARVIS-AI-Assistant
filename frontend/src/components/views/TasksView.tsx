'use client';

import React, { useState, useEffect } from 'react';
import GlassCard from '../GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Plus, 
  ListTodo,
  CheckCircle2
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('jarvis_tasks');
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Save to localStorage when tasks change
  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem('jarvis_tasks', JSON.stringify(newTasks));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const newTask: Task = {
      id: Math.random().toString(),
      title: text.trim(),
      completed: false,
      created_at: new Date().toISOString()
    };

    saveTasks([newTask, ...tasks]);
    setText('');
  };

  const handleToggleComplete = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTasks(updated);
  };

  const handleDeleteTask = (id: string) => {
    const filtered = tasks.filter(t => t.id !== id);
    saveTasks(filtered);
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-[calc(100vh-80px)] no-scrollbar relative z-10 hud-grid">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-hud font-bold text-white tracking-wide glow-text-blue">
          OPERATIONAL CHECKLIST
        </h1>
        <p className="text-sm text-gray-400 mt-1 font-hud uppercase tracking-widest">
          Manage system coordinates and action items
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Task lists */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard className="min-h-[400px]">
            <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-3 mb-6">
              <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
                <ListTodo className="w-4.5 h-4.5 text-jarvis-blue" />
                <span className="uppercase tracking-widest text-xs">Task coordinates</span>
              </h3>
              <span className="text-[10px] text-gray-500 font-hud tracking-wider">
                Total: {tasks.length} | Completed: {tasks.filter(t => t.completed).length}
              </span>
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {tasks.length > 0 ? (
                  tasks.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 rounded-lg border border-jarvis-blue/10 bg-white/2 hover:bg-jarvis-blue/5 transition-all flex items-center justify-between gap-4 group"
                    >
                      <div 
                        onClick={() => handleToggleComplete(task.id)}
                        className="flex items-center gap-3 cursor-pointer select-none flex-1 truncate"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-jarvis-blue shrink-0 animate-pulse" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-500 hover:text-jarvis-blue transition-colors shrink-0" />
                        )}
                        <span className={`text-xs truncate ${task.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                          {task.title}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Purge Task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-20 text-gray-500 font-hud">
                    All operations clear, Sir. No pending checklist items.
                  </div>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        </div>

        {/* Input Sidebar */}
        <div className="space-y-8">
          <GlassCard className="space-y-4">
            <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2 border-b border-jarvis-blue/10 pb-3">
              <Plus className="w-4 h-4 text-jarvis-blue" />
              <span className="uppercase tracking-widest text-xs">Append Task</span>
            </h3>

            <form onSubmit={handleAddTask} className="space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Append task coordinate summary..."
                className="w-full min-h-[90px] bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-3 text-xs text-white outline-none placeholder-gray-600 font-hud tracking-wide"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="w-full py-2.5 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider uppercase hover:bg-jarvis-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all"
              >
                Save Coordinate
              </button>
            </form>
          </GlassCard>
        </div>

      </div>

    </div>
  );
}
