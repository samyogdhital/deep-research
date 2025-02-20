'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChevronDown, ChevronUp, Download, Check, Square, ArrowRight } from 'lucide-react';
import { FaRegStopCircle, FaPaperPlane } from "react-icons/fa";
import { Spinner } from './spinner';
import { TbSend2 } from "react-icons/tb";

type ResearchState = {
  step: 'input' | 'follow-up' | 'processing' | 'complete';
  initialPrompt: string;
  depth: number;
  breadth: number;
  followUpQuestions: string[];
  followUpAnswers: Record<string, string>;
  logs: string[];
  showLogs: boolean;
  report: string;
  sources: Array<{
    learning: string;
    source: string;
    quote: string;
  }>;
  showSources?: boolean;
};

export default function Home() {
  const [state, setState] = useState<ResearchState>({
    step: 'input',
    initialPrompt: '',
    depth: 1, // Default to 1
    breadth: 1, // Default to 1
    followUpQuestions: [],
    followUpAnswers: {},
    logs: [],
    showLogs: false,
    report: '',
    sources: []
  });

  const [status, setStatus] = useState<{
    loading: boolean;
    message: string;
    complete: boolean;
  }>({
    loading: false,
    message: '',
    complete: false
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [latestLog, setLatestLog] = useState<string>('');

  // Add state for input visibility
  const [showDepthInput, setShowDepthInput] = useState(false);
  const [showBreadthInput, setShowBreadthInput] = useState(false);

  const stopResearch = useCallback(() => {
    if (socket) {
      socket.emit('stop-research');
      setIsProcessing(false);
      setState(prev => ({ ...prev, step: 'input' }));
    }
  }, [socket]);

  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      withCredentials: true,
      transports: ['websocket']
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setState(prev => ({
        ...prev,
        logs: [...prev.logs,]
      }));
    });

    newSocket.on('log', (message: string) => {
      setState(prev => ({
        ...prev,
        logs: [...prev.logs, message]
      }));
      setLatestLog(message);

      if (message.includes('Generating follow-up questions')) {
        setStatus({ loading: true, message: 'Generating follow-up questions...', complete: false });
      } else if (message.includes('Questions generated')) {
        setStatus({ loading: false, message: 'Questions generated successfully', complete: true });
      } else if (message.includes('Starting research')) {
        setStatus({ loading: true, message: 'Processing research...', complete: false });
      } else if (message.includes('Generating final report')) {
        setStatus({ loading: true, message: 'Generating final report...', complete: false });
      } else if (message.includes('Research complete')) {
        setStatus({ loading: false, message: 'Research completed successfully', complete: true });
      } else if (message.includes('Research terminated by user')) {
        setStatus({ loading: false, message: 'Research stopped', complete: false });
        setIsProcessing(false);
        setState(prev => ({ ...prev, step: 'input' }));
      }
    });

    newSocket.on('progress', (data: any) => {
      console.log('Received progress:', data);
      setState(prev => ({
        ...prev,
        logs: [...prev.logs, `Progress update: ${JSON.stringify(data)}`]
      }));
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setState(prev => ({
        ...prev,
        logs: [...prev.logs, `Connection error: ${error.message}`]
      }));
    });

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.close();
    };
  }, []);

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.depth-input') && !target.closest('.depth-button')) {
        setShowDepthInput(false);
      }
      if (!target.closest('.breadth-input') && !target.closest('.breadth-button')) {
        setShowBreadthInput(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle parameter button clicks
  const handleDepthClick = () => {
    setShowDepthInput(true);
    setShowBreadthInput(false);
  };

  const handleBreadthClick = () => {
    setShowBreadthInput(true);
    setShowDepthInput(false);
  };

  const handleInitialSubmit = async () => {
    try {
      setState(prev => ({ 
        ...prev, 
        step: 'processing',
        depth: prev.depth || 1,
        breadth: prev.breadth || 1
      }));
      
      const response = await fetch('http://localhost:3001/api/research/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: state.initialPrompt
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to generate questions');
      }
      
      const data = await response.json();
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('Invalid response format');
      }

      setState(prev => ({
        ...prev,
        step: 'follow-up',
        followUpQuestions: data.questions
      }));
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate questions');
      setState(prev => ({ ...prev, step: 'input' }));
    } finally {
    }
  };

  const handleResearchStart = async () => {
    try {
      setState(prev => ({ ...prev, step: 'processing' }));
      setIsProcessing(true);
      
      const response = await fetch('http://localhost:3001/api/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: state.initialPrompt,
          depth: state.depth,
          breadth: state.breadth,
          followUpAnswers: state.followUpAnswers
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.report || !data.sources) {
        throw new Error('Invalid response format');
      }

      setState(prev => ({
        ...prev,
        step: 'complete',
        report: data.report,
        sources: data.sources
      }));
    } catch (error) {
      console.error('Error during research:', error);
      alert('Research failed. Please try again.');
      setState(prev => ({ ...prev, step: 'input' }));
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadReport = (format: 'pdf' | 'md') => {
    const reportContent = state.report;
    const fileName = `research-report.${format}`;
    const mimeType = 'text/markdown';

    const blob = new Blob([reportContent], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl min-h-screen flex flex-col font-inter">
      {state.step === 'input' && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-24 space-y-12">
          <h2 className="text-4xl font-bold text-gray-800 tracking-tight">
            What do you want to know?
          </h2>
          <div className="w-full max-w-2xl relative">
            <textarea
              className="w-full p-6 pb-20 border rounded-lg min-h-[200px] text-base font-medium focus:ring-2 focus:ring-gray-400 focus:border-transparent shadow-sm"
              placeholder="Enter your research query..."
              value={state.initialPrompt}
              onChange={e => setState(prev => ({ ...prev, initialPrompt: e.target.value }))}
            />
            
            {/* Bottom controls container */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
              <div className="flex gap-3">
                <div className="relative">
                  <button
                    onClick={handleDepthClick}
                    className="depth-button text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    <span className="font-semibold tracking-wide">Depth: {state.depth}</span>
                  </button>
                  {showDepthInput && (
                    <div className="depth-input absolute mt-2 bg-white p-3 rounded-lg shadow-lg border min-w-[180px]">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Select Depth (1-10)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        className="w-full p-2 border rounded-md text-sm"
                        value={state.depth}
                        onChange={e => {
                          const value = e.target.value === '' ? '' : parseInt(e.target.value);
                          setState(prev => ({
                            ...prev,
                            depth: value === '' ? value : Math.max(1, Math.min(10, value || 1))
                          }));
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={handleBreadthClick}
                    className="breadth-button text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    <span className="font-semibold tracking-wide">Breadth: {state.breadth}</span>
                  </button>
                  {showBreadthInput && (
                    <div className="breadth-input absolute mt-2 bg-white p-3 rounded-lg shadow-lg border min-w-[180px]">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Select Breadth (1-10)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        className="w-full p-2 border rounded-md text-sm"
                        value={state.breadth}
                        onChange={e => {
                          const value = e.target.value === '' ? '' : parseInt(e.target.value);
                          setState(prev => ({
                            ...prev,
                            breadth: value === '' ? value : Math.max(1, Math.min(10, value || 1))
                          }));
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Submit button with circle background */}
              <button
                className={`rounded-full p-3 transition-all ${
                  state.initialPrompt 
                    ? 'bg-gray-100 hover:bg-gray-200' 
                    : 'opacity-0'
                }`}
                onClick={handleInitialSubmit}
                disabled={!state.initialPrompt}
              >
                <TbSend2 
                  size={20} 
                  className={`transition-colors ${
                    state.initialPrompt 
                      ? 'text-gray-800' 
                      : 'text-gray-300'
                  }`} 
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Section */}
      {state.step !== 'input' && (
        <div className="mb-8">
          <div 
            className="mb-2 p-4 border rounded-lg bg-white cursor-pointer"
            onClick={(e) => {
              // Only toggle if clicking the header area
              const target = e.target as HTMLElement;
              if (!target.closest('.log-content')) {
                setState(prev => ({ ...prev, showLogs: !prev.showLogs }));
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {status.loading ? (
                  <Spinner className="w-5 h-5" />
                ) : status.complete ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : null}
                <span className="text-base font-bold text-gray-800 truncate">
                  {!state.showLogs && latestLog ? latestLog : status.message || 'Ready to begin research'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isProcessing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      stopResearch();
                    }}
                    className="p-2 hover:bg-red-50 rounded-full"
                    title="Stop Research"
                  >
                    <FaRegStopCircle className="w-6 h-6 text-red-500" />
                  </button>
                )}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform ${state.showLogs ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            {state.showLogs && (
              <div className="mt-4 pt-4 border-t log-content">
                <div className="bg-gray-50 p-4 rounded-md max-h-96 overflow-auto font-mono text-sm">
                  {state.logs.map((log, idx) => (
                    <div key={idx} className="py-1 text-gray-700">{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Follow-up Questions Section */}
      {state.step === 'follow-up' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Follow-up Questions</h2>
          {state.followUpQuestions.map((question, idx) => (
            <div key={idx} className="space-y-2">
              <p className="font-bold text-gray-700">{question}</p>
              <textarea
                className="w-full p-4 border rounded-lg text-base font-medium focus:ring-2 focus:ring-gray-400"
                rows={3}
                onChange={e => setState(prev => ({
                  ...prev,
                  followUpAnswers: { ...prev.followUpAnswers, [question]: e.target.value }
                }))}
              />
            </div>
          ))}
          <div className="flex justify-end mt-8">
            <button
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-bold"
              onClick={handleResearchStart}
            >
              Continue Research
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Complete Section */}
      {state.step === 'complete' && (
        <div className="space-y-6">
          <div className="flex justify-end gap-4">
            <button
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 font-bold"
              onClick={() => downloadReport('md')}
            >
              <Download size={18} />
              Download Markdown
            </button>
          </div>

          <div className="prose max-w-none font-medium">
            <div dangerouslySetInnerHTML={{ __html: state.report }} />
          </div>

          {/* Sources Accordion */}
          <div className="border rounded-lg overflow-hidden">
            <button
              className="w-full p-4 text-left font-bold flex items-center justify-between bg-gray-50 hover:bg-gray-100"
              onClick={() => setState(prev => ({ ...prev, showSources: !prev.showSources }))}
            >
              <span>Sources</span>
              {state.showSources ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {state.showSources && (
              <div className="p-4 space-y-4">
                {state.sources.map((source, idx) => (
                  <div key={idx} className="border p-4 rounded-lg">
                    <p className="font-bold">{source.learning}</p>
                    <p className="text-blue-600 mt-2 font-medium">
                      <a href={source.source} target="_blank" rel="noopener noreferrer">
                        {source.source}
                      </a>
                    </p>
                    <p className="text-gray-600 mt-2 italic">{source.quote}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
