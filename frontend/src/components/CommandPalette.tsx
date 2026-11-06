'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Command, 
  Mail, 
  Calendar, 
  FileSpreadsheet, 
  MessageSquare,
  Sparkles,
  Settings,
  X
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: any) => void;
  onQuickAction: (action: string) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onQuickAction
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const shortcuts = [
    { category: 'Navigation', name: 'Open AI Chat', action: () => onNavigate('chat'), icon: MessageSquare },
    { category: 'Navigation', name: 'Read Inbox', action: () => onNavigate('gmail'), icon: Mail },
    { category: 'Navigation', name: 'View Calendar', icon: Calendar, action: () => onNavigate('calendar') },
    { category: 'Navigation', name: 'Inspect Spreadsheets', icon: FileSpreadsheet, action: () => onNavigate('sheets') },
    { category: 'Quick Action', name: 'Draft a new Email', icon: Sparkles, action: () => onQuickAction('draft_email') },
    { category: 'Quick Action', name: 'Schedule a Meeting', icon: Sparkles, action: () => onQuickAction('create_meeting') },
    { category: 'Navigation', name: 'Configure Settings', icon: Settings, action: () => onNavigate('settings') },
  ];

  const filteredShortcuts = shortcuts.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        {/* Backdrop blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Palette Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-2xl rounded-xl border border-jarvis-blue/20 bg-jarvis-bg/90 p-4 shadow-[0_0_50px_rgba(0,240,255,0.15)] backdrop-blur-xl z-10 flex flex-col max-h-[500px]"
        >
          {/* Input Header */}
          <div className="flex items-center gap-3 px-3 py-2 border-b border-jarvis-blue/10">
            <Search className="w-5 h-5 text-jarvis-blue" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search shortcuts and commands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none text-white text-base outline-none placeholder-gray-500 font-hud tracking-wide"
            />
            <div className="flex items-center gap-1.5 bg-jarvis-blue/10 px-2 py-0.5 rounded border border-jarvis-blue/20 text-[10px] text-jarvis-blue font-hud">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors duration-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4 no-scrollbar">
            {filteredShortcuts.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-hud tracking-wider text-gray-500 px-3 mb-2">
                  Commands & Actions
                </p>
                {filteredShortcuts.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-jarvis-blue/10 border border-transparent hover:border-jarvis-blue/15 transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4.5 h-4.5 text-gray-400 group-hover:text-jarvis-blue transition-colors duration-200" />
                        <span className="text-sm font-hud tracking-wide">{item.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-hud tracking-widest bg-white/5 px-2 py-1 rounded">
                        {item.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 font-hud">
                No matching commands found.
              </div>
            )}
          </div>
          
          <div className="border-t border-jarvis-blue/10 pt-3 mt-3 flex items-center justify-between text-[10px] text-gray-500 font-hud">
            <span>Use ↑↓ to navigate, Enter to select</span>
            <span>Esc to close</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
