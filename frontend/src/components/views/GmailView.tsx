'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import GlassCard from '../GlassCard';
import { 
  Search, 
  Mail, 
  Star, 
  Archive, 
  Trash2, 
  CornerUpLeft, 
  ChevronRight,
  Send,
  Loader2,
  Inbox,
  PenTool,
  ArrowLeft,
  Paperclip
} from 'lucide-react';

interface Email {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
}

export default function GmailView() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [activeEmail, setActiveEmail] = useState<Email | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<string>('label:INBOX');

  // Manual Compose form state
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Reply Draft generation state
  const [aiDraftContent, setAiDraftContent] = useState('');
  const [generatingDraft, setGeneratingDraft] = useState(false);

  const fetchEmails = async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const q = searchQuery ? `${activeFolder} ${searchQuery}` : activeFolder;
      const res = await api.get<{ emails: Email[] }>(`/workspace/emails?q=${encodeURIComponent(q)}&maxResults=30`);
      setEmails(res.emails);
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [activeFolder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmails();
  };

  const handleOpenEmail = async (emailId: string) => {
    setLoadingDetail(true);
    setAiDraftContent('');
    try {
      const emailDetail = await api.get<Email>(`/workspace/emails/${emailId}`);
      setActiveEmail(emailDetail);
      
      // Update reading status in local list
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isRead: true } : e));
    } catch (err) {
      console.error('Failed to open email:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleArchiveEmail = async (emailId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.post(`/workspace/emails/${emailId}/archive`);
      setEmails(prev => prev.filter(e => e.id !== emailId));
      if (activeEmail?.id === emailId) {
        setActiveEmail(null);
      }
    } catch (err) {
      console.error('Failed to archive email:', err);
    }
  };

  const handleDeleteEmail = async (emailId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.delete(`/workspace/emails/${emailId}`);
      setEmails(prev => prev.filter(e => e.id !== emailId));
      if (activeEmail?.id === emailId) {
        setActiveEmail(null);
      }
    } catch (err) {
      console.error('Failed to delete email:', err);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) return;

    setSendingEmail(true);
    try {
      await api.post('/workspace/emails/send', {
        to: composeTo,
        subject: composeSubject,
        body: composeBody
      });
      setIsComposing(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      fetchEmails(true);
    } catch (err) {
      console.error('Failed to send email:', err);
      alert('Email failed to transmit, Sir.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleGenerateAiReply = async () => {
    if (!activeEmail) return;
    setGeneratingDraft(true);
    setAiDraftContent('');
    try {
      // In production, we send request to backend AI endpoint, or chat endpoint.
      // We will call a fast endpoint to generate a draft using our Gemini service.
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      // We can query Gemini directly by sending a chat message requesting a reply draft, or a custom route.
      // Since we want this to be extremely functional and integrated, we will create a system chat thread for this email,
      // or send a quick prompt.
      // We'll write to a direct AI utility or make a chat call.
      const userMessage = `Reply politely to this email. Body of the email: "${activeEmail.body || activeEmail.snippet}"`;
      
      const convo = await api.post<{ id: string }>('/chat/conversations', {
        title: `Reply Draft: ${activeEmail.subject}`,
        model: 'gemini-3.5-flash'
      });
      
      const response = await fetch(`${API_URL}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jarvis_token')}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: convo.id,
          model: 'gemini-3.5-flash'
        }),
        credentials: 'include'
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let text = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'chunk') {
                  text += event.text;
                  setAiDraftContent((prev) => prev + event.text);
                }
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate AI reply draft:', err);
      setAiDraftContent('Failed to generate reply draft, Sir. Please check your connection.');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleSendAiReply = async () => {
    if (!activeEmail || !aiDraftContent) return;
    setSendingEmail(true);
    try {
      await api.post('/workspace/emails/send', {
        to: activeEmail.from,
        subject: `Re: ${activeEmail.subject}`,
        body: aiDraftContent.replace(/\n/g, '<br/>'),
        threadId: activeEmail.id
      });
      setAiDraftContent('');
      handleArchiveEmail(activeEmail.id);
    } catch (err) {
      console.error('Failed to send AI reply:', err);
      alert('Failed to transmit AI reply.');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden relative z-10">
      
      {/* Folder Sidebar */}
      <div className="w-56 border-r border-jarvis-blue/10 bg-jarvis-bg/30 backdrop-blur-md flex flex-col p-4 space-y-4">
        <button
          onClick={() => {
            setIsComposing(true);
            setActiveEmail(null);
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-jarvis-blue/15 border border-jarvis-blue/30 text-jarvis-blue hover:bg-jarvis-blue/25 hover:shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-all duration-300 font-hud text-xs tracking-wider"
        >
          <PenTool className="w-4 h-4" />
          <span>New Dispatch</span>
        </button>

        <div className="space-y-1">
          <p className="text-[9px] uppercase font-hud text-gray-500 tracking-wider mb-2 px-2">Folders</p>
          {[
            { id: 'label:INBOX', label: 'Inbox', icon: Inbox },
            { id: 'label:UNREAD', label: 'Unread', icon: Mail },
            { id: 'label:STARRED', label: 'Starred', icon: Star },
            { id: 'label:SENT', label: 'Sent Dispatches', icon: Send },
            { id: 'label:TRASH', label: 'Trash Bin', icon: Trash2 },
          ].map(folder => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.id;
            return (
              <button
                key={folder.id}
                onClick={() => {
                  setActiveFolder(folder.id);
                  setActiveEmail(null);
                  setIsComposing(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-hud tracking-wide transition-all duration-200
                  ${isActive 
                    ? 'bg-jarvis-blue/10 text-jarvis-blue border border-jarvis-blue/15' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'}
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{folder.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel splitting List & Details */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Email list */}
        {(!activeEmail && !isComposing) || activeEmail === null ? (
          <div className="flex-1 flex flex-col justify-between bg-jarvis-bg/10">
            {/* Search header */}
            <div className="p-4 border-b border-jarvis-blue/10 flex items-center gap-4">
              <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
                <Search className="w-4.5 h-4.5 text-gray-500 absolute left-3" />
                <input
                  type="text"
                  placeholder="Filter inbox dispatches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg py-2 pl-10 pr-4 text-xs text-white outline-none placeholder-gray-500 font-hud tracking-wide"
                />
              </form>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-jarvis-blue/5 p-4 no-scrollbar space-y-1">
              {loadingList ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-jarvis-blue animate-spin" />
                </div>
              ) : emails.length > 0 ? (
                emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => handleOpenEmail(email.id)}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all duration-200 flex items-start gap-4 border border-transparent hover:border-jarvis-blue/10 hover:bg-jarvis-blue/5
                      ${!email.isRead ? 'bg-jarvis-blue/5 border-l-2 border-l-jarvis-blue' : ''}
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs ${!email.isRead ? 'text-jarvis-blue font-bold' : 'text-gray-300'}`}>
                          {email.from.split('<')[0].trim()}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className={`text-xs ${!email.isRead ? 'text-white font-semibold' : 'text-gray-400'} truncate`}>
                        {email.subject}
                      </h4>
                      <p className="text-[11px] text-gray-500 truncate mt-1">{email.snippet}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20 max-w-sm mx-auto">
                  <Inbox className="w-12 h-12 text-gray-600 animate-pulse" />
                  <p className="font-hud text-xs text-gray-500 tracking-wider">
                    Inbox is currently empty of dispatches, Sir.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Email Detail Panel */}
        {activeEmail && (
          <div className="flex-1 flex flex-col bg-jarvis-bg/20 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-jarvis-blue/10 flex items-center justify-between">
              <button
                onClick={() => setActiveEmail(null)}
                className="flex items-center gap-1.5 text-xs text-jarvis-blue hover:text-jarvis-cyan font-hud tracking-wide transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return</span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleArchiveEmail(activeEmail.id)}
                  className="p-2 rounded-lg glass-panel border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-gray-400 hover:text-jarvis-blue transition-colors"
                  title="Archive Dispatch"
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteEmail(activeEmail.id)}
                  className="p-2 rounded-lg glass-panel border border-jarvis-blue/10 hover:border-red-400/30 text-gray-400 hover:text-red-400 transition-colors"
                  title="Delete Dispatch"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Email Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              <GlassCard className="space-y-4">
                <div className="border-b border-jarvis-blue/10 pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <h2 className="text-sm font-hud font-bold text-white tracking-wide">{activeEmail.subject}</h2>
                    <span className="text-[10px] text-gray-500 font-mono shrink-0">
                      {new Date(activeEmail.date).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-3 text-[11px] font-hud tracking-wide">
                    <div>
                      <span className="text-gray-500 uppercase">From:</span>{' '}
                      <span className="text-jarvis-blue font-mono">{activeEmail.from}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 uppercase">To:</span>{' '}
                      <span className="text-gray-400 font-mono">{activeEmail.to}</span>
                    </div>
                  </div>
                </div>

                {/* HTML rendering via iframe */}
                <div className="bg-black/20 border border-jarvis-blue/10 rounded-lg p-4 min-h-[300px]">
                  {activeEmail.body ? (
                    <iframe
                      srcDoc={`
                        <html>
                          <head>
                            <style>
                              body {
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                font-size: 14px;
                                line-height: 1.6;
                                color: #d1d5db;
                                background-color: transparent;
                              }
                              a { color: #00f0ff; text-decoration: none; }
                              a:hover { text-decoration: underline; }
                            </style>
                          </head>
                          <body>${activeEmail.body}</body>
                        </html>
                      `}
                      title="email-body"
                      className="w-full h-full min-h-[300px] border-none bg-transparent"
                    />
                  ) : (
                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {activeEmail.snippet}
                    </p>
                  )}
                </div>
              </GlassCard>

              {/* Generative AI Assistant Drafting Reply Section */}
              <GlassCard className="space-y-4" delay={0.1}>
                <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-3">
                  <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-jarvis-blue animate-pulse" />
                    <span>JARVIS Generative Autoreply</span>
                  </h3>
                  <button
                    onClick={handleGenerateAiReply}
                    disabled={generatingDraft}
                    className="text-[10px] text-jarvis-blue border border-jarvis-blue/20 hover:border-jarvis-blue/40 px-2.5 py-1 rounded hover:bg-jarvis-blue/5 transition-all font-hud font-bold"
                  >
                    {generatingDraft ? 'Analyzing...' : 'Generate Draft'}
                  </button>
                </div>

                {generatingDraft && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 text-jarvis-blue animate-spin" />
                    <span className="text-xs text-gray-500 font-hud ml-2">Assembling reply context...</span>
                  </div>
                )}

                {aiDraftContent && (
                  <div className="space-y-4">
                    <textarea
                      value={aiDraftContent}
                      onChange={(e) => setAiDraftContent(e.target.value)}
                      className="w-full min-h-[140px] bg-black/40 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-3 text-xs text-white outline-none placeholder-gray-600 font-mono leading-relaxed"
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setAiDraftContent('')}
                        className="px-3.5 py-1.5 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/25 text-gray-400 hover:text-white font-hud text-xs tracking-wider transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendAiReply}
                        disabled={sendingEmail}
                        className="px-4 py-1.5 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider flex items-center gap-1.5 hover:bg-jarvis-cyan hover:shadow-[0_0_10px_rgba(0,240,255,0.3)] transition-all"
                      >
                        {sendingEmail ? 'Transmitting...' : 'Send AI Reply'}
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        )}

        {/* Compose Dispatch Panel */}
        {isComposing && (
          <div className="flex-1 flex flex-col bg-jarvis-bg/20 overflow-hidden">
            <div className="p-4 border-b border-jarvis-blue/10">
              <button
                onClick={() => setIsComposing(false)}
                className="flex items-center gap-1.5 text-xs text-jarvis-blue hover:text-jarvis-cyan font-hud tracking-wide transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
              <GlassCard className="max-w-3xl mx-auto space-y-6">
                <div className="border-b border-jarvis-blue/10 pb-4">
                  <h2 className="text-sm font-hud font-bold text-white tracking-wide">COMPOSE NEW DISPATCH</h2>
                </div>

                <form onSubmit={handleSendEmail} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-[10px] font-hud uppercase tracking-widest text-gray-500 block mb-1.5">
                        Recipient Coordinates (To)
                      </label>
                      <input
                        type="email"
                        required
                        value={composeTo}
                        onChange={(e) => setComposeTo(e.target.value)}
                        placeholder="recipient@domain.com"
                        className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2.5 text-xs text-white outline-none placeholder-gray-600 font-hud tracking-wide"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-hud uppercase tracking-widest text-gray-500 block mb-1.5">
                        Subject Line
                      </label>
                      <input
                        type="text"
                        required
                        value={composeSubject}
                        onChange={(e) => setComposeSubject(e.target.value)}
                        placeholder="Workspace Update Summary"
                        className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2.5 text-xs text-white outline-none placeholder-gray-600 font-hud tracking-wide"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-hud uppercase tracking-widest text-gray-500 block mb-1.5">
                        Transmission Message
                      </label>
                      <textarea
                        required
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        placeholder="Sir, I have assembled the requested documents..."
                        className="w-full min-h-[220px] bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-3.5 text-xs text-white outline-none placeholder-gray-600 font-mono leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-jarvis-blue/10 pt-4 mt-6">
                    <button
                      type="button"
                      className="glass-panel p-2.5 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/30 text-gray-400 hover:text-jarvis-blue transition-colors"
                      title="Add Attachment"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsComposing(false)}
                        className="px-4 py-2 rounded-lg border border-jarvis-blue/10 hover:border-jarvis-blue/25 text-gray-400 hover:text-white font-hud text-xs tracking-wider transition-all"
                      >
                        Dismiss
                      </button>
                      <button
                        type="submit"
                        disabled={sendingEmail}
                        className="px-5 py-2 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider flex items-center gap-2 hover:bg-jarvis-cyan hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all"
                      >
                        {sendingEmail ? 'Transmitting...' : 'Send Dispatch'}
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </form>
              </GlassCard>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
