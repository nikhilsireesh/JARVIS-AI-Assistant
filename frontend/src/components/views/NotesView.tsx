'use client';

import React, { useState, useEffect } from 'react';
import GlassCard from '../GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Notebook,
  PenTool
} from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

export default function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('jarvis_notes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotes(parsed);
        if (parsed.length > 0) {
          setActiveNote(parsed[0]);
        }
      } catch {}
    }
  }, []);

  const saveNotes = (newNotes: Note[]) => {
    setNotes(newNotes);
    localStorage.setItem('jarvis_notes', JSON.stringify(newNotes));
  };

  const handleCreateNote = () => {
    const newNote: Note = {
      id: Math.random().toString(),
      title: 'New Note Log',
      content: '',
      updated_at: new Date().toISOString()
    };

    const updated = [newNote, ...notes];
    saveNotes(updated);
    setActiveNote(newNote);
  };

  const handleUpdateActiveNote = (field: 'title' | 'content', value: string) => {
    if (!activeNote) return;

    const updatedNote = {
      ...activeNote,
      [field]: value,
      updated_at: new Date().toISOString()
    };

    setActiveNote(updatedNote);

    const updatedNotes = notes.map(n => n.id === activeNote.id ? updatedNote : n);
    saveNotes(updatedNotes);
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you wish to delete this note coordinate log, Sir?')) return;
    
    const filtered = notes.filter(n => n.id !== id);
    saveNotes(filtered);
    
    if (activeNote?.id === id) {
      setActiveNote(filtered.length > 0 ? filtered[0] : null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden relative z-10">
      
      {/* Sidebar List */}
      <div className="w-64 border-r border-jarvis-blue/10 bg-jarvis-bg/30 backdrop-blur-md flex flex-col p-4 space-y-4">
        <button
          onClick={handleCreateNote}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-jarvis-blue/15 border border-jarvis-blue/30 text-jarvis-blue hover:bg-jarvis-blue/25 hover:shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-all duration-300 font-hud text-xs tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>New Note Log</span>
        </button>

        <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-220px)] no-scrollbar">
          <p className="text-[9px] uppercase font-hud text-gray-500 tracking-wider mb-2 px-2">Saved Logs</p>
          {notes.map(note => {
            const isActive = activeNote?.id === note.id;
            return (
              <div
                key={note.id}
                onClick={() => setActiveNote(note)}
                className={`
                  flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all duration-200 group text-xs font-hud tracking-wide
                  ${isActive 
                    ? 'bg-jarvis-blue/10 text-jarvis-blue border border-jarvis-blue/15' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}
                `}
              >
                <span className="truncate max-w-[130px]">{note.title}</span>
                <button
                  onClick={(e) => handleDeleteNote(note.id, e)}
                  className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Panel */}
      <div className="flex-1 p-6 overflow-y-auto no-scrollbar bg-jarvis-bg/10">
        {activeNote ? (
          <GlassCard className="max-w-4xl mx-auto min-h-[480px] flex flex-col justify-between" hoverEffect={false}>
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="border-b border-jarvis-blue/10 pb-4">
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => handleUpdateActiveNote('title', e.target.value)}
                  className="bg-transparent border-none text-white text-base outline-none font-hud font-bold w-full focus:glow-text-blue"
                  placeholder="Note Title Log"
                />
                <span className="text-[9px] text-gray-500 font-mono block mt-1">
                  Last sync: {new Date(activeNote.updated_at).toLocaleString()}
                </span>
              </div>

              <textarea
                value={activeNote.content}
                onChange={(e) => handleUpdateActiveNote('content', e.target.value)}
                className="w-full flex-1 min-h-[320px] bg-transparent border-none text-xs text-gray-300 outline-none placeholder-gray-600 font-mono leading-relaxed resize-none mt-2"
                placeholder="Log your thoughts, data coordinates, or meeting coordinates, Sir..."
              />
            </div>
            
            <div className="border-t border-jarvis-blue/10 pt-4 flex justify-between items-center text-[10px] text-gray-500 font-hud">
              <span className="flex items-center gap-1">
                <PenTool className="w-3.5 h-3.5 text-jarvis-blue" />
                Log active
              </span>
              <span>Characters: {activeNote.content.length}</span>
            </div>
          </GlassCard>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-sm mx-auto">
            <Notebook className="w-12 h-12 text-gray-600 animate-pulse" />
            <p className="font-hud text-xs text-gray-500 tracking-wider">
              No notes loaded, Sir. Select or initialize a new log entry.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
