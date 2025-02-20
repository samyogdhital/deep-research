'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChevronDown,  Download, Check,  ArrowRight } from 'lucide-react';
import { FaRegStopCircle} from "react-icons/fa";
import { Spinner } from './spinner';
import { TbSend2 } from "react-icons/tb";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

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
      } else if (message.includes('Deep Research complete.')) { // Add this condition
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
      
      const response = await fetch('http://host.docker.internal:3001/api/research/questions', {
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
      
      // Add validation and logging
      console.log('Received report data:', data);
      
      if (!data.report) {
        console.error('Missing report in response:', data);
        throw new Error('Report data is missing from response');
      }

      setState(prev => ({
        ...prev,
        step: 'complete',
        report: data.report,
        sources: data.sources || []
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

  // Add ref for textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Modified auto-resize handler
  const handleTextareaResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Set initial height to scrollHeight only if there's content
    if (state.initialPrompt) {
      textarea.style.height = 'auto';
      const newHeight = Math.max(
        200, // smaller min-height
        Math.min(
          textarea.scrollHeight + 16,
          window.innerHeight * 0.6 // max 60% of viewport height
        )
      );
      textarea.style.height = `${newHeight}px`;
    } else {
      // Reset to min-height when empty
      textarea.style.height = '200px';
    }
  }, [state.initialPrompt]);

  // Add resize listener
  useEffect(() => {
    const handleResize = () => {
      handleTextareaResize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleTextareaResize]);

  // Auto-resize on content change
  useEffect(() => {
    handleTextareaResize();
  }, [state.initialPrompt, handleTextareaResize]);

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl min-h-screen flex flex-col font-inter">
      {state.step === 'input' && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-24 space-y-12">
          <h2 className="text-4xl font-bold text-gray-800 tracking-tight">
            What do you want to know?
          </h2>
          
          {/* Combined input container with seamless border */}
          <div className="w-full max-w-2xl relative border rounded-lg overflow-hidden">
            {/* Input area - removed border-bottom */}
            <textarea
              ref={textareaRef}
              className="w-full p-6 pb-16 text-base font-medium focus:outline-none resize-none overflow-hidden border-none transition-all duration-200"
              style={{ 
                height: '200px', // Fixed initial height
                maxHeight: 'calc(60vh)' // Max height as 60% of viewport
              }}
              placeholder="Enter your research query..."
              value={state.initialPrompt}
              onChange={e => {
                setState(prev => ({ ...prev, initialPrompt: e.target.value }));
                handleTextareaResize();
              }}
            />
            
            {/* Controls section - removed border-top */}
            <div className="absolute bottom-0 left-0 right-0 px-6 py-3 bg-white">
              <div className="flex justify-between items-center">
                <div className="flex gap-3">
                  <div className="relative">
                    <button
                      onClick={handleDepthClick}
                      className="depth-button text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 bg-white"
                    >
                      <span className="font-semibold tracking-wide">Depth: {state.depth}</span>
                    </button>
                    {showDepthInput && (
                      <div className="depth-input absolute bottom-full mb-2 left-0 bg-white p-3 rounded-lg shadow-lg border min-w-[180px] z-10">
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
                            const value = e.target.value === '' ? 1 : parseInt(e.target.value);
                            setState(prev => ({
                              ...prev,
                              depth: Math.max(1, Math.min(10, value))
                            }));
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={handleBreadthClick}
                      className="breadth-button text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 bg-white"
                    >
                      <span className="font-semibold tracking-wide">Breadth: {state.breadth}</span>
                    </button>
                    {showBreadthInput && (
                      <div className="breadth-input absolute bottom-full mb-2 left-0 bg-white p-3 rounded-lg shadow-lg border min-w-[180px] z-10">
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
                            const value = e.target.value === '' ? 1 : parseInt(e.target.value);
                            setState(prev => ({
                              ...prev,
                              breadth: Math.max(1, Math.min(10, value))
                            }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button with new styling */}
                <button
                  className={`rounded-full p-3 transition-all ${
                    state.initialPrompt 
                      ? 'bg-gray-900 text-white' 
                      : 'text-gray-300'
                  } hover:bg-gray-100`}
                  onClick={handleInitialSubmit}
                  disabled={!state.initialPrompt}
                >
                  <TbSend2 size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Updated Log Section */}
      {state.step !== 'input' && (
        <div className="mb-8">
          <div 
            className="mb-2 p-4 border rounded-lg bg-white cursor-pointer"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (!target.closest('.log-content')) {
                setState(prev => ({ ...prev, showLogs: !prev.showLogs }));
              }
            }}
          >
            <div className="flex items-center justify-between">
              {/* Log text container with fade effect */}
              <div className="flex items-center gap-3 flex-1 min-w-0"> {/* add min-w-0 to allow truncation */}
                {status.loading ? (
                  <Spinner className="w-5 h-5 flex-shrink-0" />
                ) : status.complete ? (
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : null}
                <div 
                  className="relative flex-1 min-w-0" // Container for fade effect
                >
                  <div 
                    className="text-base font-bold text-gray-800 truncate pr-16 before:content-[''] before:absolute before:right-0 before:top-0 before:bottom-0 before:w-16 before:bg-gradient-to-r before:from-transparent before:to-white"
                  >
                    {!state.showLogs && latestLog ? latestLog : status.message || 'Ready to begin research'}
                  </div>
                </div>
              </div>

              {/* Controls with proper spacing */}
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
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

            {/* Expanded logs section */}
            {state.showLogs && (
              <div className="mt-4 pt-4 border-t log-content">
                <div className="bg-gray-50 p-4 rounded-md max-h-96 overflow-y-auto overflow-x-hidden font-mono text-sm">
                  {state.logs.map((log, idx) => (
                    <div 
                      key={idx} 
                      className="py-1 text-gray-700 truncate pr-4 hover:whitespace-normal hover:truncate-none"
                    >
                      {log}
                    </div>
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

      {/* Complete Section with enhanced markdown rendering */}
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

          <div className="prose prose-lg max-w-none font-medium">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({node, ...props}) => <h1 className="text-4xl font-bold mb-6" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-2xl font-bold mt-6 mb-3" {...props} />,
                a: ({node, ...props}) => (
                  <a 
                    className="text-blue-600 hover:text-blue-800 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  />
                ),
                p: ({node, ...props}) => <p className="my-4" {...props} />,
              }}
            >
              {state.report}
            </ReactMarkdown>
          </div>
          
          {/* ...existing sources accordion... */}
        </div>
      )}
    </main>
  );
}
