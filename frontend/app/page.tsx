'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChevronDown,  Download, Check,  ArrowRight } from 'lucide-react';
import { FaRegStopCircle} from "react-icons/fa";
import { Spinner } from '../components/spinner';
import { TbSend2 } from "react-icons/tb";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useRouter } from 'next/navigation';
import { saveReport, getAllReports } from '@/lib/db';  // Add import

type ResearchState = {
  step: 'input' | 'follow-up' | 'processing' | 'complete';
  initialPrompt: string;
  depth: number;
  breadth: number;
  followupQuestions: number;
  generatedFollowUpQuestions: string[];
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
  sourcesLog: ResearchSourcesLog;
};

type SerpQueryResult = {
  query: string;
  objective: string;
  successfulScrapes: Array<{
    url: string;
    extractedContent: string;
  }>;
  failedScrapes: Array<{
    url: string;
    error: string;
  }>;
};

type ResearchSourcesLog = {
  queries: SerpQueryResult[];
  lastUpdated: string;
};

// Add new types
type ResearchPhase = 'idle' | 'collecting-sources' | 'analyzing' | 'generating-report';

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<ResearchState>({
    step: 'input',
    initialPrompt: '',
    depth: 1, // Default to 1
    breadth: 1, // Default to 1
    followupQuestions: 5, // Default to 5
    generatedFollowUpQuestions: [],
    followUpAnswers: {},
    logs: [],
    showLogs: false,
    report: '',
    sources: [],
    sourcesLog: { // Add default value for sourcesLog
      queries: [],
      lastUpdated: new Date().toISOString()
    }
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
  const [showFollowUpsInput, setShowFollowUpsInput] = useState(false);

  // Add new state for research phase
  const [researchPhase, setResearchPhase] = useState<ResearchPhase>('idle');

  const stopResearch = useCallback(() => {
    if (socket) {
      socket.emit('stop-research');
      setIsProcessing(false);
      setState(prev => ({ ...prev, step: 'input' }));
    }
  }, [socket]);

  useEffect(() => {
    const newSocket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
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

    newSocket.on('sources-update', (sourcesLog: ResearchSourcesLog) => {
      setState(prev => ({
        ...prev,
        sourcesLog
      }));
    });

    // Add new event listener for research phase updates
    newSocket.on('research-phase', (phase: ResearchPhase) => {
      setResearchPhase(phase);
    });

    // Request initial sources data
    newSocket.emit('request-sources');

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

      if (!target.closest('.followups-input') && !target.closest('.followups-button')) {
        setShowFollowUpsInput(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle parameter button clicks
  const handleDepthClick = () => {
    setShowBreadthInput(false);
    setShowDepthInput(true);
    setShowFollowUpsInput(false)
  };

  const handleBreadthClick = () => {
    setShowBreadthInput(true);
    setShowDepthInput(false);
    setShowFollowUpsInput(false)
  };

  const handleFollowUpsClick = () => {
    setShowBreadthInput(false);
    setShowDepthInput(false);
    setShowFollowUpsInput(true)
  };

  const handleInitialSubmit = async () => {
    try {
      
      setState(prev => ({ 
        ...prev, 
        step: 'processing',
      }));

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/research/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: state.initialPrompt,
          followupQuestions: state.followupQuestions
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
        generatedFollowUpQuestions: data.questions
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
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/research/start`, {
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

      if (!data.report_title) {
        throw new Error('Report title is missing from response');
      }

      // Save report with validated title
      const reportId = await saveReport({
        report_title: data.report_title, // Use title from API response
        report: data.report,
        sourcesLog: data.sourcesLog
      });

      // Force a refresh of the sidebar data before navigation
      await getAllReports();

      // Navigate to report page
      router.push(`/report/${reportId}`);

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
        150, // smaller min-height
        Math.min(
          textarea.scrollHeight + 16,
          window.innerHeight * 0.5 // max 50% of viewport height
        )
      );
      textarea.style.height = `${newHeight}px`;
    } else {
      // Reset to min-height when empty
      textarea.style.height = '150px';
    }
  }, [state.initialPrompt]);

  // Helper function to determine if sources should be shown
  const shouldShowSources = useMemo(() => {
    return state.step === 'processing' || state.step === 'complete';
  }, [state.step]);

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl min-h-screen flex flex-col">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {state.step === 'input' && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-24 space-y-12">
          <h2 className="text-4xl font-bold font-inter text-gray-800 dark:text-white tracking-tight">
            What do you want to know?
          </h2>
          
          {/* Combined container with seamless connection */}
          <div className="w-full max-w-2xl">
            <div className="border-2 dark:border-gray-700 rounded-t-lg overflow-auto bg-white dark:bg-[#202121] border-b-0">
              <textarea
                ref={textareaRef}
                className="w-full text-base font-medium resize-none border-none focus:outline-none focus:ring-0
                  text-gray-900 dark:text-white 
                  placeholder:text-gray-400 dark:placeholder:text-gray-500 p-[24px] pt-[10px] pb-0 mt-4 h-[150px] dark:bg-[#202121]"
                placeholder="Enter your research query..."
                value={state.initialPrompt}
                onChange={e => {
                  setState(prev => ({ ...prev, initialPrompt: e.target.value }));
                  handleTextareaResize();
                }}
              />
            </div>

            {/* Controls section with top border removed */}
            <div className="border-2 dark:border-gray-700 border-t-0 rounded-b-lg bg-white dark:bg-[#202121] px-6 py-3">
              <div className="flex justify-between items-center">
                <div className="flex gap-3">
                  <div className="relative">
                    <Button
                      title='Research Depth'
                      variant="outline"
                      onClick={handleDepthClick}
                      className="depth-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600"
                    >
                      Depth: {state.depth || 1}
                    </Button>
                    {showDepthInput && (
                      <div className="depth-input absolute top-full mt-2 left-0 bg-white dark:bg-[#161818] p-3 rounded-lg shadow-lg border dark:border-gray-700 min-w-[180px] z-10">
                        <label className="block text-sm font-semibold mb-2 dark:text-white">
                          Select Depth (1-10)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={state.depth === null ? '' : state.depth}
                          onChange={e => {
                            const inputValue = e.target.value;
                            if (inputValue === '') {
                              setState(prev => ({ ...prev, depth: null }));
                            } else {
                              const value = parseInt(inputValue);
                              setState(prev => ({
                                ...prev,
                                depth: Math.max(1, Math.min(10, value))
                              }));
                            }
                          }}
                          onBlur={() => {
                            if (state.depth === null) {
                              setState(prev => ({ ...prev, depth: 1 }));
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <Button
                      title='Research Breadth'
                      variant="outline"
                      onClick={handleBreadthClick}
                      className="breadth-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600"
                    >
                      Breadth: {state.breadth || 1}
                    </Button>
                    {showBreadthInput && (
                      <div className="breadth-input absolute top-full mt-2 left-0 bg-white dark:bg-[#161818] p-3 rounded-lg shadow-lg border dark:border-gray-700 min-w-[180px] z-10">
                        <label className="block text-sm font-semibold mb-2 dark:text-white">
                          Select Breadth (1-10)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={state.breadth === null ? '' : state.breadth}
                          onChange={e => {
                            const inputValue = e.target.value;
                            if (inputValue === '') {
                              setState(prev => ({ ...prev, breadth: null }));
                            } else {
                              const value = parseInt(inputValue);
                              setState(prev => ({
                                ...prev,
                                breadth: Math.max(1, Math.min(10, value))
                              }));
                            }
                          }}
                          onBlur={() => {
                            if (state.breadth === null) {
                              setState(prev => ({ ...prev, breadth: 1 }));
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <Button
                      title='Follow Up Questions'
                      variant="outline"
                      onClick={handleFollowUpsClick}
                      className="followups-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600"
                    >
                      Follow Ups: {state.followupQuestions || 5}
                    </Button>
                    {showFollowUpsInput && (
                      <div className="followups-input absolute top-full mt-2 left-0 bg-white dark:bg-[#161818] p-3 rounded-lg shadow-lg border dark:border-gray-700 min-w-[180px] z-10">
                        <label className="block text-sm font-semibold mb-2 dark:text-white">
                          Select Breadth (1-10)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          className="w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={state.followupQuestions === null ? '' : state.followupQuestions}
                          onChange={e => {
                            const inputValue = e.target.value;
                            if (inputValue === '') {
                              setState(prev => ({ ...prev, followupQuestions: null }));
                            } else {
                              const value = parseInt(inputValue);
                              setState(prev => ({
                                ...prev,
                                followupQuestions: Math.max(1, Math.min(10, value))
                              }));
                            }
                          }}
                          onBlur={() => {
                            if (state.followupQuestions === null) {
                              setState(prev => ({ ...prev, followupQuestions: 1 }));
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Circular submit button */}
                <Button
                  title='Submit Prompt'
                  disabled={!state.initialPrompt}
                  onClick={handleInitialSubmit}
                  className={`rounded-full w-12 h-12 p-0 flex items-center justify-center transition-colors
                    ${state.initialPrompt 
                      ? 'bg-gray-900 hover:bg-black text-white dark:bg-[#007e81] dark:hover:bg-[#00676a] dark:text-white' 
                      : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-400'}`}
                >
                  <TbSend2 size={20} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Updated Log Section */}
      {state.step !== 'input' && (
        <div className="mb-8">
          <Accordion type="single" className='w-full' collapsible>
            <AccordionItem value="item-1" className="border-2 dark:border-gray-700 rounded-lg">
              <AccordionTrigger 
                className="px-4 py-5 bg-white dark:bg-[#202121] rounded-t-lg data-[state=open]:rounded-b-none hover:no-underline"
              >
                <div className="flex items-center gap-3 w-full overflow-hidden"> {/* Added overflow-hidden to the container */}
                  {status.loading ? (
                    <Spinner className="w-5 h-5 flex-shrink-0 text-gray-700 dark:text-white" />
                  ) : status.complete ? (
                    <Check className="w-5 h-5 flex-shrink-0 text-green-500" />
                  ) : null}
                  <span className="truncate text-gray-900 dark:text-gray-100 font-medium">
                    {latestLog || status.message || 'Ready to begin research'}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="border-t bg-gray-100 dark:bg-[#313131]">
                <div className="bg-gray-100 dark:bg-[#313131] p-4 rounded-b-lg">
                  {state.logs.map((log, idx) => (
                    <div key={idx} className="py-1.5 text-gray-700 dark:text-white">
                      {log}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Updated Follow-up section */}
      {state.step === 'follow-up' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
            Follow-up Questions
          </h2>
          {state.generatedFollowUpQuestions.map((question, idx) => (
            <div key={idx} className="space-y-2">
              <p className="font-bold text-gray-700 dark:text-gray-300">{question}</p>
              <textarea
                className="w-full p-4 border-2 rounded-lg text-base font-medium 
                  focus:outline-none focus:ring-0 focus:border-gray-400
                  dark:bg-[#202121] dark:text-white dark:border-gray-700
                  dark:focus:border-[#007e81] transition-colors
                  resize-none min-h-[120px]"
                onChange={e => setState(prev => ({
                  ...prev,
                  followUpAnswers: { ...prev.followUpAnswers, [question]: e.target.value }
                }))}
              />
            </div>
          ))}
          <div className="flex justify-end mt-8">
            <Button
              onClick={handleResearchStart}
              className="text-black bg-white hover:text-white hover:bg-black
                dark:bg-[#007e81] dark:hover:bg-[#00676a] dark:text-white border border-black
                transition-colors"
            >
              Deep Research
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </div>
        </div>
      )}
{/* dark:bg-[#007e81] dark:hover:bg-[#00676a] */}
      {/* Complete section */}
      {state.step === 'complete' && (
        <div className="space-y-6">
          {/* Download button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => downloadReport('md')}
              className="flex items-center gap-2 px-3 py-2 border border-black transition-colors hover:text-white hover:bg-black dark:bg-transparent dark:text-[#007e81] dark:border-[#007e81] dark:hover:hover:bg-[#00676a] dark:hover:text-white"
            >
              <Download size={16} />
              Download Markdown
            </Button>
          </div>

          {/* Report content with proper dark mode */}
          <div className="prose dark:prose-invert max-w-none">
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
        </div>
      )}

      {state.step === 'processing' && (
        <div className="space-y-6">
          {/* Logs accordion (collapsed by default) */}
          <Accordion type="single" collapsible>
            {/* ...existing logs accordion... */}
          </Accordion>

          {/* Sources accordion (expanded by default) */}
          {shouldShowSources && (
            <Accordion type="single" collapsible defaultValue="sources">
              <AccordionItem value="sources">
                <AccordionTrigger className="text-xl font-bold">
                  All Sources
                </AccordionTrigger>
                <AccordionContent>
                  {state.sourcesLog.queries.map((query, idx) => (
                    <Accordion key={idx} type="single" collapsible className="ml-4 mb-4">
                      <AccordionItem value={`query-${idx}`}>
                        <AccordionTrigger className="text-lg font-semibold">
                          {query.query} - {query.objective}
                        </AccordionTrigger>
                        <AccordionContent>
                          {/* Successfully scraped section */}
                          {query.successfulScrapes.length > 0 && (
                            <div className="mb-4">
                              <h4 className="font-medium mb-2 text-green-600 dark:text-green-400">
                                Successfully Scraped ({query.successfulScrapes.length})
                              </h4>
                              <ol className="list-decimal ml-4 space-y-4">
                                {query.successfulScrapes.map((scrape, sIdx) => (
                                  <li key={sIdx} className="text-gray-800 dark:text-gray-200">
                                    <a href={scrape.url} 
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       className="text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      {scrape.url}
                                    </a>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                      {scrape.extractedContent}
                                    </p>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                          
                          {/* Failed scrapes section */}
                          {query.failedScrapes.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2 text-red-500">
                                Failed to Scrape ({query.failedScrapes.length})
                              </h4>
                              <ul className="list-disc ml-4 space-y-2">
                                {query.failedScrapes.map((fail, fIdx) => (
                                  <li key={fIdx} className="text-sm text-gray-500">
                                    {fail.url} - {fail.error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}
    </main>
  );
}
