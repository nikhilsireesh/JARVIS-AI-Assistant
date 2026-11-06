'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import GlassCard from '../GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Paperclip,
  Trash2,
  Plus,
  Terminal,
  Play,
  Cpu,
  Bot,
  User,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  model: string;
  created_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  metadata: any;
  created_at: string;
}

// Custom simple markdown + code block renderer
function renderMarkdown(content: string) {
  if (!content) return null;

  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const lang = match ? match[1] : '';
      const code = match ? match[2] : part.slice(3, -3);

      return (
        <pre key={i} className="bg-black/50 border border-jarvis-blue/20 rounded-lg p-4 my-3 overflow-x-auto font-mono text-[11px] text-gray-300 relative group">
          {lang && (
            <span className="absolute top-2 right-2 text-[9px] uppercase tracking-widest text-gray-500 font-hud font-bold">
              {lang}
            </span>
          )}
          <code>{code}</code>
        </pre>
      );
    }

    const lines = part.split('\n');
    return lines.map((line, j) => {
      if (line.startsWith('### ')) {
        return <h4 key={`${i}-${j}`} className="text-sm font-hud font-bold text-jarvis-blue mt-4 mb-2">{line.slice(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={`${i}-${j}`} className="text-base font-hud font-bold text-white mt-5 mb-2">{line.slice(3)}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={`${i}-${j}`} className="text-lg font-hud font-black text-white mt-6 mb-3 border-b border-jarvis-blue/10 pb-1">{line.slice(2)}</h2>;
      }
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const text = line.trim().slice(2);
        return (
          <li key={`${i}-${j}`} className="list-disc ml-6 my-1 text-xs text-gray-300">
            {renderInlineMarkdown(text)}
          </li>
        );
      }
      
      if (line.trim() === '') return <div key={`${i}-${j}`} className="h-2" />;
      return (
        <p key={`${i}-${j}`} className="text-xs text-gray-300 leading-relaxed my-1.5">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  });
}

function renderInlineMarkdown(text: string) {
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((part, k) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={k} className="text-white font-semibold glow-text-blue">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function ChatView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // States for operations
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activeTool, setActiveTool] = useState<{ name: string; args: any; status: 'running' | 'done' | 'failed' } | null>(null);
  
  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load conversations on mount
  const fetchConversations = async (selectLatest = true) => {
    try {
      const list = await api.get<Conversation[]>('/chat/conversations');
      setConversations(list);
      
      if (selectLatest && list.length > 0 && !activeConvo) {
        handleSelectConversation(list[0]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, activeTool]);

  // Configure Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        };
        rec.onerror = (event: any) => {
          setIsListening(false);
          // 'no-speech' (silence timeout) and 'aborted' (user stopped) are normal outcomes, not failures
          if (event.error === 'no-speech' || event.error === 'aborted') return;
          console.warn('Speech recognition error:', event.error);
          setVoiceError(
            event.error === 'not-allowed' || event.error === 'service-not-allowed'
              ? 'Microphone access is blocked. Allow it in your browser\'s site settings and try again.'
              : event.error === 'audio-capture'
                ? 'No microphone was found.'
                : event.error === 'network'
                  ? 'Speech recognition needs an internet connection.'
                  : `Voice input failed (${event.error}).`
          );
        };
        
        recognitionRef.current = rec;
      }
    }
  }, []);

  const handleSelectConversation = async (convo: Conversation) => {
    setActiveConvo(convo);
    setLoadingHistory(true);
    setStreamingText('');
    setActiveTool(null);
    try {
      const list = await api.get<Message[]>(`/chat/conversations/${convo.id}/messages`);
      setMessages(list);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateConversation = async () => {
    try {
      const convo = await api.post<Conversation>('/chat/conversations', {
        title: 'New Conversation',
        model: 'gemini-3.5-flash'
      });
      setConversations((prev) => [convo, ...prev]);
      setActiveConvo(convo);
      setMessages([]);
      setStreamingText('');
      setActiveTool(null);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/conversations/${id}`);
      setConversations((prev) => prev.filter(c => c.id !== id));
      if (activeConvo?.id === id) {
        setActiveConvo(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const toggleSpeechInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser, Sir.');
      return;
    }
    setVoiceError('');
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        // start() throws InvalidStateError if a session is already running
        console.warn('Speech recognition could not start:', err);
      }
    }
  };

  // Speaks out response text
  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Cancel active voice
      window.speechSynthesis.cancel();
      
      const cleanText = text.replace(/[*#`\-]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Look for a premium male English voice
      const voices = window.speechSynthesis.getVoices();
      const defaultVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices[0];
      if (defaultVoice) utterance.voice = defaultVoice;
      
      utterance.rate = 1.0;
      utterance.pitch = 0.95; // Slightly lower pitch for JARVIS
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    const textToSend = inputText;
    setInputText('');
    setSending(true);
    setStreamingText('');
    setActiveTool(null);

    // Optimistically insert user message in UI
    const tempUserMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: textToSend,
      metadata: {},
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const targetConvoId = activeConvo?.id || '';

    try {
      // Fetch using credentials and stream parsing
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const token = localStorage.getItem('jarvis_token');
      
      const response = await fetch(`${API_URL}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          message: textToSend,
          conversationId: targetConvoId,
          model: activeConvo?.model || 'gemini-3.5-flash'
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Streaming request failed.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep partial line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                
                if (event.type === 'tool_start') {
                  setActiveTool({
                    name: event.tool,
                    args: event.args,
                    status: 'running'
                  });
                } else if (event.type === 'tool_end') {
                  setActiveTool((prev) => prev ? { ...prev, status: event.error ? 'failed' : 'done' } : null);
                  // Keep showing tool action for a bit
                  setTimeout(() => setActiveTool(null), 2500);
                } else if (event.type === 'chunk') {
                  setStreamingText((prev) => prev + event.text);
                } else if (event.type === 'done') {
                  // Message completed. Refresh threads to capture auto-titling if new convo
                  if (!activeConvo) {
                    await fetchConversations(false);
                  }
                  
                  // Re-fetch conversation messages to get actual server-synced values
                  if (activeConvo) {
                    const list = await api.get<Message[]>(`/chat/conversations/${activeConvo.id}/messages`);
                    setMessages(list);
                  } else {
                    await fetchConversations(true);
                  }
                  
                  // Run voice if enabled
                  if (voiceOutputEnabled) {
                    speakText(streamingText);
                  }
                  
                  setStreamingText('');
                  setActiveTool(null);
                } else if (event.type === 'error') {
                  console.error('AI Stream Error event:', event.message);
                }
              } catch (e) {
                // Parsing error
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Append fail message
      setMessages((prev) => [...prev, {
        id: Math.random().toString(),
        role: 'system',
        content: 'System error: Unable to transmit coordinates to JARVIS mainframe. Please check sync.',
        metadata: {},
        created_at: new Date().toISOString()
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden relative z-10">
      
      {/* Threads Sidebar */}
      <div className="w-64 border-r border-jarvis-blue/10 bg-jarvis-bg/30 backdrop-blur-md flex flex-col p-4 justify-between">
        <div className="space-y-4">
          <button
            onClick={handleCreateConversation}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-jarvis-blue/15 border border-jarvis-blue/30 text-jarvis-blue hover:bg-jarvis-blue/25 hover:shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-all duration-300 font-hud text-xs tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>Initialize Deck</span>
          </button>

          <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] no-scrollbar">
            <p className="text-[9px] uppercase font-hud text-gray-500 tracking-wider mb-2 px-2">
              System Conversations
            </p>
            {conversations.map((convo) => {
              const isActive = activeConvo?.id === convo.id;
              return (
                <div
                  key={convo.id}
                  onClick={() => handleSelectConversation(convo)}
                  className={`
                    flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all duration-200 group text-xs font-hud tracking-wide
                    ${isActive 
                      ? 'bg-jarvis-blue/10 text-jarvis-blue border border-jarvis-blue/15' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}
                  `}
                >
                  <span className="truncate max-w-[130px]">{convo.title}</span>
                  <button 
                    onClick={(e) => handleDeleteConversation(convo.id, e)}
                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Voice Toggles */}
        <div className="border-t border-jarvis-blue/10 pt-4 flex justify-around">
          <button
            onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
            className={`
              p-2.5 rounded-lg border transition-all duration-300
              ${voiceOutputEnabled 
                ? 'border-jarvis-blue bg-jarvis-blue/10 text-jarvis-blue shadow-[0_0_8px_rgba(0,240,255,0.15)]' 
                : 'border-jarvis-blue/10 text-gray-400 hover:text-white'}
            `}
          >
            {voiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Conversation Window */}
      <div className="flex-1 flex flex-col justify-between bg-jarvis-bg/10 relative">
        
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {loadingHistory ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-jarvis-blue animate-spin" />
            </div>
          ) : messages.length > 0 || streamingText || activeTool ? (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((msg) => {
                const isModel = msg.role === 'model';
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id}
                    className={`flex gap-4 ${isModel ? 'justify-start' : 'justify-end'}`}
                  >
                    {isModel && (
                      <div className="w-8 h-8 rounded-full border border-jarvis-blue/30 bg-jarvis-blue/10 flex items-center justify-center text-jarvis-blue shadow-[0_0_8px_rgba(0,240,255,0.15)] shrink-0">
                        <Bot className="w-4.5 h-4.5" />
                      </div>
                    )}
                    <div 
                      className={`
                        p-4 rounded-xl max-w-2xl text-xs leading-relaxed
                        ${isModel 
                          ? 'glass-panel border border-jarvis-blue/15 text-gray-300' 
                          : 'bg-jarvis-blue/15 border border-jarvis-blue/25 text-white shadow-[0_0_10px_rgba(0,240,255,0.05)]'}
                      `}
                    >
                      {renderMarkdown(msg.content)}
                    </div>
                    {!isModel && (
                      <div className="w-8 h-8 rounded-full border border-gray-600 bg-white/5 flex items-center justify-center text-gray-300 shrink-0">
                        <User className="w-4.5 h-4.5" />
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Tool Running indicators */}
              {activeTool && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 justify-start"
                >
                  <div className="w-8 h-8 rounded-full border border-jarvis-blue/30 bg-jarvis-blue/10 flex items-center justify-center text-jarvis-blue shadow-[0_0_8px_rgba(0,240,255,0.15)] shrink-0">
                    <Cpu className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="glass-panel border border-jarvis-blue/15 p-4 rounded-xl max-w-xl flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-jarvis-blue animate-ping" />
                    <p className="font-hud text-xs tracking-wider text-jarvis-blue">
                      JARVIS: Executing operation <span className="font-mono text-white">[{activeTool.name}]</span>...
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Active streaming chunks */}
              {streamingText && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 justify-start"
                >
                  <div className="w-8 h-8 rounded-full border border-jarvis-blue/30 bg-jarvis-blue/10 flex items-center justify-center text-jarvis-blue shadow-[0_0_8px_rgba(0,240,255,0.15)] shrink-0">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                  <div className="glass-panel border border-jarvis-blue/15 p-4 rounded-xl max-w-2xl text-xs text-gray-300 leading-relaxed">
                    {renderMarkdown(streamingText)}
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-6">
              <div className="w-20 h-20 rounded-full border-2 border-jarvis-blue flex items-center justify-center text-jarvis-blue shadow-[0_0_20px_rgba(0,240,255,0.3)] animate-pulse">
                <Bot className="w-10 h-10" />
              </div>
              <div>
                <h3 className="font-hud text-lg font-bold text-white tracking-wide glow-text-blue">
                  JARVIS COGNITIVE INTERFACE
                </h3>
                <p className="text-xs text-gray-400 mt-2 font-hud leading-relaxed">
                  System active. How may I assist you with your Workspace today, Sir?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button 
                  onClick={() => setInputText('Summarize my unread emails.')}
                  className="glass-panel p-2.5 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-[10px] text-gray-400 hover:text-white font-hud tracking-wider uppercase text-left transition-colors duration-200"
                >
                  Summarize unread emails
                </button>
                <button 
                  onClick={() => setInputText('What meetings do I have today?')}
                  className="glass-panel p-2.5 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-[10px] text-gray-400 hover:text-white font-hud tracking-wider uppercase text-left transition-colors duration-200"
                >
                  Today's schedule
                </button>
                <button 
                  onClick={() => setInputText('Create a spreadsheet for monthly expenses.')}
                  className="glass-panel p-2.5 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-[10px] text-gray-400 hover:text-white font-hud tracking-wider uppercase text-left transition-colors duration-200"
                >
                  Create expense sheet
                </button>
                <button 
                  onClick={() => setInputText('Schedule a meeting tomorrow at 4 PM.')}
                  className="glass-panel p-2.5 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-[10px] text-gray-400 hover:text-white font-hud tracking-wider uppercase text-left transition-colors duration-200"
                >
                  Schedule meeting
                </button>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-6 border-t border-jarvis-blue/10 bg-jarvis-bg/35 backdrop-blur-md">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-center gap-3">
            
            <button
              type="button"
              className="glass-panel p-3 rounded-xl border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-gray-400 hover:text-jarvis-blue transition-colors duration-300"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Instruct JARVIS (e.g. Draft an email, summarize my calendar)..."
                disabled={sending}
                className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/40 rounded-xl py-3.5 pl-4 pr-12 text-xs text-white outline-none placeholder-gray-500 font-hud tracking-wide shadow-[inset_0_0_12px_rgba(0,240,255,0.03)]"
              />
              <button
                type="button"
                onClick={toggleSpeechInput}
                className={`
                  absolute right-3.5 top-3 p-1 rounded-lg transition-colors duration-300
                  ${isListening ? 'text-red-400 animate-ping' : 'text-gray-400 hover:text-jarvis-blue'}
                `}
              >
                {isListening ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              className="py-3.5 px-5 rounded-xl bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider flex items-center gap-2 hover:bg-jarvis-cyan hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all duration-300 disabled:opacity-50 disabled:hover:shadow-none"
            >
              <span>SEND</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
          {voiceError && (
            <p className="mt-2 text-[10px] font-hud text-red-400 tracking-wide">{voiceError}</p>
          )}
        </div>

      </div>

    </div>
  );
}
