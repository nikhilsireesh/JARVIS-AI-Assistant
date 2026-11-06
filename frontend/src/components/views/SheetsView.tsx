'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import GlassCard from '../GlassCard';
import { 
  FileSpreadsheet, 
  Search, 
  Plus, 
  TrendingUp, 
  Sparkles,
  Loader2,
  TableProperties,
  Database,
  ArrowRight
} from 'lucide-react';

interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  sheets: string[];
}

const LAST_SHEET_KEY = 'jarvis_last_sheet_id';

// Accepts a bare spreadsheet ID or a full https://docs.google.com/spreadsheets/d/<id>/... URL
const extractSheetId = (input: string): string => {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return (match ? match[1] : input).trim();
};

export default function SheetsView() {
  const [sheetId, setSheetId] = useState('');
  const [loadError, setLoadError] = useState('');
  const [spreadsheetInfo, setSpreadsheetInfo] = useState<SpreadsheetInfo | null>(null);
  const [activeSheetTab, setActiveSheetTab] = useState<string>('');
  const [gridData, setGridData] = useState<any[][]>([]);
  
  // Loading states
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [analyzingSheet, setAnalyzingSheet] = useState(false);
  
  // Append form states
  const [appendRange, setAppendRange] = useState('');
  const [appendValues, setAppendValues] = useState('');
  const [appending, setAppending] = useState(false);

  // Analysis result
  const [analysisResult, setAnalysisResult] = useState('');

  const loadSpreadsheetInfo = async (idOverride?: string) => {
    const id = extractSheetId(idOverride ?? sheetId);
    if (!id) return;
    setSheetId(id);
    setLoadingInfo(true);
    setLoadError('');
    setSpreadsheetInfo(null);
    setGridData([]);
    setAnalysisResult('');

    try {
      const info = await api.get<SpreadsheetInfo>(`/workspace/sheets/${encodeURIComponent(id)}`);
      setSpreadsheetInfo(info);
      if (info.sheets.length > 0) {
        setActiveSheetTab(info.sheets[0]);
      }
      try { localStorage.setItem(LAST_SHEET_KEY, id); } catch {}
    } catch (err) {
      console.warn('Failed to load spreadsheet details:', err);
      setLoadError('Could not open that spreadsheet. Check the ID and that your Google account has access to it.');
      try { localStorage.removeItem(LAST_SHEET_KEY); } catch {}
    } finally {
      setLoadingInfo(false);
    }
  };

  const loadSheetGrid = async () => {
    if (!spreadsheetInfo || !activeSheetTab) return;
    setLoadingGrid(true);
    try {
      // Read a safe large initial range A1:K50
      const range = `${activeSheetTab}!A1:K40`;
      const res = await api.post<{ values: any[][] }>(`/workspace/sheets/${spreadsheetInfo.spreadsheetId}/read-range`, {
        range
      });
      setGridData(res.values || []);
      // Set default range for append input to match the active tab
      setAppendRange(activeSheetTab);
    } catch (err) {
      console.error('Failed to load grid range data:', err);
    } finally {
      setLoadingGrid(false);
    }
  };

  // Reopen the last spreadsheet that loaded successfully, if any
  useEffect(() => {
    let lastId: string | null = null;
    try { lastId = localStorage.getItem(LAST_SHEET_KEY); } catch {}
    if (lastId) loadSpreadsheetInfo(lastId);
  }, []);

  useEffect(() => {
    loadSheetGrid();
  }, [activeSheetTab, spreadsheetInfo]);

  const handleAppendRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spreadsheetInfo || !appendValues.trim()) return;

    setAppending(true);
    try {
      // Input format: comma-separated values for a single row, e.g. "Value1, Value2, Value3"
      const rowValues = appendValues.split(',').map(v => v.trim());
      
      await api.post(`/workspace/sheets/${spreadsheetInfo.spreadsheetId}/append`, {
        range: appendRange || activeSheetTab,
        values: [rowValues] // 2D array
      });

      setAppendValues('');
      loadSheetGrid(); // Refresh grid data!
      alert('Row values appended successfully to Google Sheet, Sir!');
    } catch (err) {
      console.error('Failed to append row:', err);
      alert('Failed to append row values.');
    } finally {
      setAppending(false);
    }
  };

  const handleAnalyzeSheet = async () => {
    if (gridData.length === 0 || !spreadsheetInfo) return;
    
    setAnalyzingSheet(true);
    setAnalysisResult('');
    try {
      const dataString = gridData.map(row => row.join(' | ')).join('\n');
      const userMessage = `Analyze this sheet grid data and output a brief analysis summary with key insights. Grid values:\n${dataString}`;
      
      // Call Gemini chat to stream the analysis
      const convo = await api.post<{ id: string }>('/chat/conversations', {
        title: `Sheets Analysis: ${spreadsheetInfo.title}`,
        model: 'gemini-3.5-flash'
      });

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
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
                  setAnalysisResult(prev => prev + event.text);
                }
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to analyze sheet:', err);
      setAnalysisResult('Analysis execution failed. Please verify API configuration.');
    } finally {
      setAnalyzingSheet(false);
    }
  };

  // Helper to generate spreadsheet header columns A, B, C...
  const getColHeader = (index: number): string => {
    let temp = index;
    let col = '';
    while (temp >= 0) {
      col = String.fromCharCode((temp % 26) + 65) + col;
      temp = Math.floor(temp / 26) - 1;
    }
    return col;
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-[calc(100vh-80px)] no-scrollbar relative z-10 hud-grid">
      
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-hud font-bold text-white tracking-wide glow-text-blue">
            TABULAR DECKS
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-hud uppercase tracking-widest">
            Inspect, read, append, and analyze spreadsheets databases
          </p>
        </div>

        {/* Load spreadsheet by ID */}
        <div className="flex items-center gap-2 bg-jarvis-bg/40 glass-panel p-1 rounded-lg border border-jarvis-blue/10 max-w-sm">
          <input
            type="text"
            placeholder="Spreadsheet ID or URL..."
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadSpreadsheetInfo(); }}
            className="bg-transparent border-none outline-none text-xs text-white px-2 py-1 font-mono tracking-wide w-48 truncate"
          />
          <button
            onClick={() => loadSpreadsheetInfo()}
            disabled={loadingInfo}
            className="bg-jarvis-blue text-jarvis-bg font-hud font-bold text-[10px] tracking-wider uppercase px-3 py-1.5 rounded hover:bg-jarvis-cyan transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {loadingInfo ? 'Accessing...' : 'LOAD'}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {loadingInfo ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-jarvis-blue animate-spin" />
        </div>
      ) : spreadsheetInfo ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main Grid View */}
          <div className="xl:col-span-2 space-y-4">
            <GlassCard className="flex flex-col min-h-[450px]">
              
              {/* Sheet title and tabs */}
              <div className="border-b border-jarvis-blue/10 pb-4 mb-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-white font-hud font-bold text-sm tracking-wide">
                  <FileSpreadsheet className="w-5 h-5 text-jarvis-blue" />
                  <span>{spreadsheetInfo.title}</span>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                  {spreadsheetInfo.sheets.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveSheetTab(tab)}
                      className={`
                        px-3 py-1 rounded text-[10px] font-hud tracking-wider uppercase transition-all duration-200 shrink-0
                        ${activeSheetTab === tab
                          ? 'bg-jarvis-blue/15 text-jarvis-blue font-bold border border-jarvis-blue/20'
                          : 'bg-white/5 text-gray-400 hover:text-white'}
                      `}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid content */}
              <div className="flex-1 overflow-auto max-h-[380px] border border-jarvis-blue/10 rounded-lg bg-black/30">
                {loadingGrid ? (
                  <div className="h-full flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 text-jarvis-blue animate-spin" />
                  </div>
                ) : gridData.length > 0 ? (
                  <table className="w-full text-left font-mono text-[10px] text-gray-300 border-collapse">
                    <thead>
                      <tr className="bg-jarvis-blue/10 border-b border-jarvis-blue/20 font-hud uppercase tracking-wider text-[9px] text-jarvis-blue">
                        <th className="p-2 border-r border-jarvis-blue/15 text-center w-8 bg-black/40">#</th>
                        {Array.from({ length: Math.max(...gridData.map(r => r.length), 1) }).map((_, colIdx) => (
                          <th key={colIdx} className="p-2 border-r border-jarvis-blue/15 text-center bg-black/40">
                            {getColHeader(colIdx)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-jarvis-blue/5">
                      {gridData.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-jarvis-blue/5">
                          <td className="p-2 border-r border-jarvis-blue/15 text-center font-hud bg-black/20 text-gray-500 font-bold">
                            {rowIdx + 1}
                          </td>
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="p-2 border-r border-jarvis-blue/10 truncate max-w-[150px]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-12 text-center text-gray-500 font-hud">
                    No records found inside tab range, Sir.
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Controls Sidebar */}
          <div className="space-y-8">
            
            {/* Append row form */}
            <GlassCard className="space-y-4">
              <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2 border-b border-jarvis-blue/10 pb-3">
                <Plus className="w-4 h-4 text-jarvis-blue" />
                <span className="uppercase tracking-widest text-xs">Append Row Data</span>
              </h3>

              <form onSubmit={handleAppendRow} className="space-y-3">
                <div>
                  <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Sheet Tab / Range</label>
                  <input
                    type="text"
                    required
                    value={appendRange}
                    onChange={(e) => setAppendRange(e.target.value)}
                    placeholder="e.g. Sheet1"
                    className="w-full bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2 text-xs text-white outline-none placeholder-gray-600 font-hud"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-hud uppercase tracking-widest text-gray-500 block mb-1">Row Values (Comma-separated)</label>
                  <textarea
                    required
                    value={appendValues}
                    onChange={(e) => setAppendValues(e.target.value)}
                    placeholder="e.g. 2026-06-29, Server Maintenance, 150.00, Complete"
                    className="w-full min-h-[70px] bg-black/45 border border-jarvis-blue/15 focus:border-jarvis-blue/35 rounded-lg p-2.5 text-xs text-white outline-none placeholder-gray-600 font-mono leading-relaxed"
                  />
                </div>
                <button
                  type="submit"
                  disabled={appending || !appendValues.trim()}
                  className="w-full py-2.5 rounded-lg bg-jarvis-blue text-jarvis-bg font-hud font-bold text-xs tracking-wider uppercase hover:bg-jarvis-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all"
                >
                  {appending ? 'Appending coordinates...' : 'Append Row'}
                </button>
              </form>
            </GlassCard>

            {/* AI Analysis Widget */}
            <GlassCard className="space-y-4">
              <div className="flex items-center justify-between border-b border-jarvis-blue/10 pb-3">
                <h3 className="font-hud font-semibold text-white tracking-wide flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-jarvis-blue" />
                  <span className="uppercase tracking-widest text-xs">AI Data Analyzer</span>
                </h3>
                <button
                  onClick={handleAnalyzeSheet}
                  disabled={analyzingSheet || gridData.length === 0}
                  className="text-[9px] text-jarvis-blue border border-jarvis-blue/20 hover:border-jarvis-blue/40 px-2 py-1 rounded hover:bg-jarvis-blue/5 transition-all font-hud font-bold uppercase"
                >
                  {analyzingSheet ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>

              {analyzingSheet && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-jarvis-blue animate-spin" />
                  <span className="text-xs text-gray-500 font-hud ml-2">Computing variables...</span>
                </div>
              )}

              {analysisResult && (
                <div className="bg-black/30 border border-jarvis-blue/10 rounded-lg p-4 max-h-[220px] overflow-y-auto no-scrollbar font-mono text-[10px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {analysisResult}
                </div>
              )}
            </GlassCard>
          </div>

        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 text-center max-w-sm mx-auto">
          <Database className="w-12 h-12 text-gray-600 animate-pulse" />
          <p className="font-hud text-xs text-gray-500 tracking-wider">
            Load a spreadsheet database using the input above, Sir.
          </p>
          {loadError && (
            <p className="font-hud text-xs text-red-400 tracking-wide">{loadError}</p>
          )}
        </div>
      )}

    </div>
  );
}
