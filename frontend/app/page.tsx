'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Download,
  Check,
  ArrowRight,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { Spinner } from '../components/spinner';
import { TbSend2 } from 'react-icons/tb';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useRouter } from 'next/navigation';
import { saveReport, getAllReports } from '@/lib/db'; // Add import
import { useResearchStore } from '@/lib/research-store';
import type { SerpQueryResult, ResearchSourcesLog } from '@/types/research';
import { cn } from '@/lib/utils';
import { ArrowBigRight } from 'lucide-react';

interface Report {
  title: string;
  report_id: string;
  sections: Array<{
    rank: number;
    sectionHeading: string;
    content: string;
  }>;
  citedUrls: Array<{
    rank: number;
    url: string;
    title: string;
    oneValueablePoint: string;
  }>;
  isVisited?: boolean;
}

type ResearchState = {
  step: 'input' | 'follow-up' | 'processing' | 'complete';
  initialPrompt: string;
  depth: number;
  breadth: number;
  followUps_num: number;
  generatedFollowUpQuestions: string[];
  followUps_QnA: Array<{
    id: number;
    question: string;
    answer: string;
  }>;
  logs: string[];
  showLogs: boolean;
  report: Report | null;
  sourcesLog?: ResearchSourcesLog;
};

type ResearchPhase = 'input' | 'follow-up' | 'processing' | 'complete';

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<ResearchState>({
    step: 'input',
    initialPrompt: '',
    depth: 1,
    breadth: 1,
    followUps_num: 5,
    generatedFollowUpQuestions: [],
    followUps_QnA: [],
    logs: [],
    showLogs: false,
    report: null,
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentResearchId, setCurrentResearchId] = useState<string | null>(
    null
  );

  // Remove unused state
  const [showDepthInput, setShowDepthInput] = useState(false);
  const [showBreadthInput, setShowBreadthInput] = useState(false);
  const [showFollowUpsInput, setShowFollowUpsInput] = useState(false);

  // Add ref for textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [accordionValue, setAccordionValue] = useState<string | undefined>(
    undefined
  );

  // Handle accordion auto-expand/collapse sequence
  useEffect(() => {
    if (state.step === 'processing') {
      // Initially collapsed
      setAccordionValue(undefined);

      // Expand after 200ms
      const expandTimeout = setTimeout(() => {
        setAccordionValue('logs');
      }, 200);

      // Collapse when follow-up questions are ready
      if (state.generatedFollowUpQuestions.length > 0) {
        setAccordionValue(undefined);
      }

      return () => clearTimeout(expandTimeout);
    }
  }, [state.step, state.generatedFollowUpQuestions.length]);

  useEffect(() => {
    const newSocket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    newSocket.on('log', (message: string) => {
      setState((prev) => ({
        ...prev,
        logs: [...prev.logs, message],
      }));

      if (message.includes('Research terminated by user')) {
        setState((prev) => ({ ...prev, step: 'input' }));
      }
    });

    newSocket.on('sources-update', (sourcesLog: ResearchSourcesLog) => {
      setState((prev) => ({
        ...prev,
        sourcesLog,
      }));
    });

    setSocket(newSocket);

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.off('research-completed');
      newSocket.close();
    };
  }, [router, currentResearchId]);

  // Modified auto-resize handler
  const handleTextareaResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (state.initialPrompt) {
      textarea.style.height = 'auto';
      const newHeight = Math.max(
        150,
        Math.min(textarea.scrollHeight + 16, window.innerHeight * 0.5)
      );
      textarea.style.height = `${newHeight}px`;
    } else {
      textarea.style.height = '150px';
    }
  }, [state.initialPrompt]);

  // Update input handlers
  const handleDepthChange = (value: string) => {
    const depth = parseInt(value);
    if (!isNaN(depth) && depth >= 1 && depth <= 10) {
      setState((prev) => ({ ...prev, depth }));
    }
  };

  const handleBreadthChange = (value: string) => {
    const breadth = parseInt(value);
    if (!isNaN(breadth) && breadth >= 1 && breadth <= 10) {
      setState((prev) => ({ ...prev, breadth }));
    }
  };

  const handleFollowUpsChange = (value: string) => {
    const followUps = parseInt(value);
    if (!isNaN(followUps) && followUps >= 1 && followUps <= 10) {
      setState((prev) => ({ ...prev, followUps_num: followUps }));
    }
  };

  const stopResearch = useCallback(() => {
    if (socket) {
      socket.emit('stop-research');
      setState((prev) => ({ ...prev, step: 'input' }));
    }
  }, [socket]);

  useEffect(() => {
    const newSocket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    setSocket(newSocket);

    // Add all socket event listeners here
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setState((prev) => ({
        ...prev,
        logs: [...prev.logs],
      }));
    });

    // Modified research-completed handler to be simpler
    newSocket.on('research-completed', async ({ id, researchId }) => {
      useResearchStore.getState().removeResearch(researchId);

      if (researchId === currentResearchId) {
        setCurrentResearchId(null);
        router.push(`/report/${id}`);
      }
    });

    newSocket.on('progress', (data: any) => {
      console.log('Received progress:', data);
      setState((prev) => ({
        ...prev,
        logs: [...prev.logs, `Progress update: ${JSON.stringify(data)}`],
      }));
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setState((prev) => ({
        ...prev,
        logs: [...prev.logs, `Connection error: ${error.message}`],
      }));
    });

    // Update the research phase handler
    newSocket.on('research-phase', (phase: ResearchPhase) => {
      setState((prev) => ({
        ...prev,
        step: phase,
      }));
    });

    // Request initial sources data
    newSocket.emit('request-sources');

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.off('research-completed');
      newSocket.close();
    };
  }, [router, currentResearchId]); // Add router and currentResearchId to dependencies

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.depth-input') && !target.closest('.depth-button')) {
        setShowDepthInput(false);
      }
      if (
        !target.closest('.breadth-input') &&
        !target.closest('.breadth-button')
      ) {
        setShowBreadthInput(false);
      }

      if (
        !target.closest('.followups-input') &&
        !target.closest('.followups-button')
      ) {
        setShowFollowUpsInput(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle parameter button clicks
  const handleDepthClick = () => {
    setShowDepthInput(!showDepthInput);
    setShowBreadthInput(false);
    setShowFollowUpsInput(false);
  };

  const handleBreadthClick = () => {
    setShowBreadthInput(!showBreadthInput);
    setShowDepthInput(false);
    setShowFollowUpsInput(false);
  };

  const handleFollowUpsClick = () => {
    setShowFollowUpsInput(!showFollowUpsInput);
    setShowDepthInput(false);
    setShowBreadthInput(false);
  };

  const handleInitialSubmit = async () => {
    if (!state.initialPrompt.trim()) {
      alert('Please enter a research query');
      return;
    }

    try {
      // Reset state before starting
      setState((prev) => ({
        ...prev,
        step: 'processing',
        generatedFollowUpQuestions: [],
        followUps_QnA: [], // Ensure this is always an array
        logs: [...prev.logs, 'Generating follow-up questions...'],
      }));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/research/questions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: state.initialPrompt,
            followupQuestions: state.followUps_num,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to generate questions');
      }

      const data = await response.json();

      // Validate data structure
      if (!data || !data.questions || !Array.isArray(data.questions)) {
        throw new Error('Invalid response format from server');
      }

      // Ensure questions is an array and map it safely
      const questions = Array.isArray(data.questions) ? data.questions : [];
      const followUps = questions.map((q: string, idx: number) => ({
        id: idx + 1,
        question: q,
        answer: '',
      }));

      // Update state with generated questions and move to follow-up step
      setState((prev) => ({
        ...prev,
        step: 'follow-up',
        generatedFollowUpQuestions: questions,
        followUps_QnA: followUps,
        logs: [...prev.logs, 'Follow-up questions generated successfully'],
      }));

      // Collapse accordion when questions appear
      setAccordionValue(undefined);
    } catch (error) {
      console.error('Error:', error);

      // Reset to initial state on error, ensuring arrays are empty but defined
      setState((prev) => ({
        ...prev,
        step: 'input',
        generatedFollowUpQuestions: [],
        followUps_QnA: [], // Always reset to empty array, never undefined
        logs: [
          ...prev.logs,
          `Error: ${
            error instanceof Error
              ? error.message
              : 'Failed to generate questions'
          }`,
        ],
      }));
    }
  };

  const handleResearchStart = async () => {
    // Validate all questions are answered
    if (state.followUps_QnA.some((qa) => !qa.answer.trim())) {
      alert('Please answer all follow-up questions');
      return;
    }

    try {
      const researchId = crypto.randomUUID();
      setCurrentResearchId(researchId);

      setState((prev) => ({
        ...prev,
        step: 'processing',
        logs: [...prev.logs, 'Starting deep research...'],
      }));

      // Add to ongoing research with proper type
      useResearchStore.getState().addResearch({
        id: researchId,
        prompt: state.initialPrompt,
        startTime: Date.now(),
        status: 'collecting',
      });

      // Format follow-up answers to match backend schema
      const followUpAnswers = state.followUps_QnA.reduce(
        (acc: Record<string, string>, curr) => {
          acc[curr.id.toString()] = curr.answer;
          return acc;
        },
        {}
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/research/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            report_id: researchId,
            initial_query: state.initialPrompt,
            depth: state.depth,
            breadth: state.breadth,
            followUps_num: state.followUps_num,
            followUpAnswers,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Research failed to start');
      }

      const data = await response.json();

      // Update research store with report title
      if (data.report?.title) {
        useResearchStore.getState().updateResearch(researchId, {
          status: 'analyzing',
        });
      }

      // Add success log
      setState((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          'Research started successfully. Redirecting to report page...',
        ],
      }));

      // Redirect to report page using report_id
      router.push(`/report/${researchId}`);
    } catch (error) {
      console.error('Research error:', error);

      // Update research store to remove failed research
      if (currentResearchId) {
        useResearchStore.getState().removeResearch(currentResearchId);
      }

      setState((prev) => ({
        ...prev,
        step: 'input',
        logs: [
          ...prev.logs,
          `Error: ${
            error instanceof Error ? error.message : 'Research failed'
          }`,
        ],
      }));
    }
  };

  // Update answer handling
  const handleAnswerChange = (questionId: number, answer: string) => {
    setState((prev) => ({
      ...prev,
      followUps_QnA: prev.followUps_QnA.map(
        (qa: { id: number; question: string; answer: string }) =>
          qa.id === questionId ? { ...qa, answer } : qa
      ),
    }));
  };

  const handleDownload = () => {
    if (!state.report) return;

    // Convert report to string format for download
    const reportContent = state.report.sections
      .map((section) => `# ${section.sectionHeading}\n\n${section.content}`)
      .join('\n\n');

    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.report.title || 'research-report'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper function to determine if sources should be shown
  const shouldShowSources = useMemo(() => {
    return (
      (state.step === 'processing' || state.step === 'complete') &&
      state.generatedFollowUpQuestions.length > 0
    );
  }, [state.step, state.generatedFollowUpQuestions.length]);

  return (
    <main className='container mx-auto px-4 py-8 max-w-4xl min-h-screen flex flex-col'>
      {state.step === 'input' && (
        <div className='flex-1 flex flex-col items-center justify-center -mt-24 space-y-12'>
          <h2 className='text-4xl font-bold font-inter text-gray-800 dark:text-white tracking-tight'>
            What do you want to know?
          </h2>

          {/* Combined container with seamless connection */}
          <div className='w-full max-w-2xl'>
            <div className='border-2 dark:border-gray-700 rounded-t-lg overflow-auto bg-white dark:bg-[#202121] border-b-0'>
              <textarea
                ref={textareaRef}
                className='w-full text-base font-medium resize-none border-none focus:outline-none focus:ring-0
                  text-gray-900 dark:text-white 
                  placeholder:text-gray-400 dark:placeholder:text-gray-500 p-[24px] pt-[10px] pb-0 mt-4 h-[150px] dark:bg-[#202121]'
                placeholder='Enter your research query...'
                value={state.initialPrompt}
                onChange={(e) => {
                  setState((prev) => ({
                    ...prev,
                    initialPrompt: e.target.value,
                  }));
                  handleTextareaResize();
                }}
              />
            </div>

            {/* Controls section with top border removed */}
            <div className='border-2 dark:border-gray-700 border-t-0 rounded-b-lg bg-white dark:bg-[#202121] px-6 py-3'>
              <div className='flex justify-between items-center'>
                <div className='flex gap-3'>
                  <div className='relative'>
                    <Button
                      title='Research Depth'
                      variant='outline'
                      onClick={handleDepthClick}
                      className='depth-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600'
                    >
                      Depth: {state.depth || 1}
                    </Button>
                    {showDepthInput && (
                      <div className='depth-input absolute top-full mt-2 left-0 bg-white dark:bg-[#161818] p-3 rounded-lg shadow-lg border dark:border-gray-700 min-w-[180px] z-10'>
                        <label className='block text-sm font-semibold mb-2 dark:text-white'>
                          Select Depth (1-10)
                        </label>
                        <input
                          type='number'
                          min={1}
                          max={10}
                          className='w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                          value={state.depth}
                          onChange={(e) => handleDepthChange(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className='relative'>
                    <Button
                      title='Research Breadth'
                      variant='outline'
                      onClick={handleBreadthClick}
                      className='breadth-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600'
                    >
                      Breadth: {state.breadth || 1}
                    </Button>
                    {showBreadthInput && (
                      <div className='breadth-input absolute top-full mt-2 left-0 bg-white dark:bg-[#161818] p-3 rounded-lg shadow-lg border dark:border-gray-700 min-w-[180px] z-10'>
                        <label className='block text-sm font-semibold mb-2 dark:text-white'>
                          Select Breadth (1-10)
                        </label>
                        <input
                          type='number'
                          min={1}
                          max={10}
                          className='w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                          value={state.breadth}
                          onChange={(e) => handleBreadthChange(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className='relative'>
                    <Button
                      title='Follow Up Questions'
                      variant='outline'
                      onClick={handleFollowUpsClick}
                      className='followups-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600'
                    >
                      Follow Ups: {state.followUps_num || 5}
                    </Button>
                    {showFollowUpsInput && (
                      <div className='followups-input absolute top-full mt-2 left-0 bg-white dark:bg-[#161818] p-3 rounded-lg shadow-lg border dark:border-gray-700 min-w-[180px] z-10'>
                        <label className='block text-sm font-semibold mb-2 dark:text-white'>
                          Select Follow Ups (1-10)
                        </label>
                        <input
                          type='number'
                          min={1}
                          max={10}
                          className='w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                          value={state.followUps_num}
                          onChange={(e) =>
                            handleFollowUpsChange(e.target.value)
                          }
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
                    ${
                      state.initialPrompt
                        ? 'bg-gray-900 hover:bg-black text-white dark:bg-[#007e81] dark:hover:bg-[#00676a] dark:text-white'
                        : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-400'
                    }`}
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
        <div className='space-y-4 mx-auto mb-6 w-full max-w-3xl'>
          <Accordion
            type='single'
            collapsible
            value={accordionValue}
            onValueChange={setAccordionValue}
            className='w-full'
          >
            <AccordionItem value='logs' className='border-none'>
              <AccordionTrigger
                className={cn(
                  'flex w-full items-center justify-between px-6 py-3',
                  'text-left text-xs transition-all',
                  'bg-white dark:bg-gray-800',
                  '[&[data-state=open]>div>svg]:rotate-180',
                  'border border-gray-100 dark:border-gray-700 rounded-lg',
                  '[&[data-state=open]]:rounded-b-none',
                  'hover:no-underline'
                )}
              >
                <div className='flex w-full items-center justify-between pr-6'>
                  <span className='text-base font-bold text-gray-800 dark:text-gray-200'>
                    Deep Research
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    12 sources
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className='pt-6 w-full bg-gray-50 dark:bg-gray-800/50 border border-t-0 border-gray-100 dark:border-gray-700 rounded-b-lg'>
                {/* Roadmap with Checkpoints */}
                <div className='relative pl-8'>
                  {/* Vertical Timeline - Only between icons */}
                  <div className='absolute left-[1.1875rem] top-[1.25rem] bottom-[1.25rem] w-[1px] bg-gray-200 dark:bg-gray-700 -translate-x-1/2' />

                  {/* Follow-up Questions Checkpoint */}
                  <div className='space-y-4'>
                    <Accordion type='single' collapsible className='w-full'>
                      <AccordionItem value='followup' className='border-none'>
                        <AccordionTrigger
                          className={cn(
                            'flex w-full items-center py-2 pr-6',
                            'text-left text-xs transition-all',
                            '[&[data-state=open]>div>svg]:rotate-180',
                            'hover:no-underline group'
                          )}
                        >
                          <div className='flex items-center gap-3 w-full'>
                            <div
                              className={cn(
                                'w-5 h-5 rounded-full flex items-center justify-center relative z-10',
                                state.generatedFollowUpQuestions.length > 0
                                  ? 'bg-green-100 dark:bg-green-900/20'
                                  : 'bg-blue-100 dark:bg-blue-900/20'
                              )}
                            >
                              <div
                                className={cn(
                                  'w-2.5 h-2.5 rounded-full',
                                  state.generatedFollowUpQuestions.length > 0
                                    ? 'bg-green-500 dark:bg-green-400'
                                    : 'bg-blue-400 dark:bg-blue-500 animate-pulse'
                                )}
                              />
                            </div>
                            <span className='text-xs text-gray-700 dark:text-gray-200 flex-grow'>
                              {state.generatedFollowUpQuestions.length > 0
                                ? 'Generated Follow-up Questions'
                                : 'Generating Follow-up Questions'}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {/* Follow-up Question Logs - No icons, just text */}
                          <div className='pl-9 space-y-2 mt-2'>
                            <div className='text-[0.75rem] text-gray-600 dark:text-gray-300 pl-4 border-l-2 border-gray-200 dark:border-gray-700'>
                              <div className='py-1.5'>
                                Generating follow-up questions
                              </div>
                              {state.generatedFollowUpQuestions.length > 0 && (
                                <div className='py-1.5'>
                                  Generated{' '}
                                  {state.generatedFollowUpQuestions.length}{' '}
                                  follow-up questions
                                </div>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {/* Search Phase - Disabled until previous step completes */}
                    <div
                      className={`w-full ${
                        state.generatedFollowUpQuestions.length === 0
                          ? 'opacity-50'
                          : ''
                      }`}
                    >
                      <div className='flex items-center gap-3 py-2 pr-6'>
                        <div className='w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative z-10'>
                          <div className='w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500' />
                        </div>
                        <span className='text-xs text-gray-700 dark:text-gray-200'>
                          Searching for information
                        </span>
                      </div>
                    </div>

                    {/* Analysis Phase - Disabled until previous step completes */}
                    <div
                      className={`w-full ${
                        state.generatedFollowUpQuestions.length === 0
                          ? 'opacity-50'
                          : ''
                      }`}
                    >
                      <div className='flex items-center gap-3 py-2 pr-6'>
                        <div className='w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative z-10'>
                          <div className='w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500' />
                        </div>
                        <span className='text-xs text-gray-700 dark:text-gray-200'>
                          Analyzing findings
                        </span>
                      </div>
                    </div>

                    {/* Report Generation - Disabled until previous step completes */}
                    <div
                      className={`w-full ${
                        state.generatedFollowUpQuestions.length === 0
                          ? 'opacity-50'
                          : ''
                      }`}
                    >
                      <div className='flex items-center gap-3 py-2 pr-6'>
                        <div className='w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative z-10'>
                          <div className='w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500' />
                        </div>
                        <span className='text-xs text-gray-700 dark:text-gray-200'>
                          Generating final report
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Updated Follow-up section with more margin and smaller text */}
      {state.step === 'follow-up' && (
        <div className='space-y-8 mx-auto w-full max-w-3xl mt-12'>
          <div className='text-center space-y-2'>
            <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-100'>
              Follow-up Questions
            </h2>
            <p className='text-sm text-gray-600 dark:text-gray-400'>
              Help us understand your research needs better by answering these
              questions
            </p>
          </div>
          {Array.isArray(state.followUps_QnA) &&
          state.followUps_QnA.length > 0 ? (
            state.followUps_QnA.map((qa, idx) => (
              <div
                key={qa.id}
                className='bg-white dark:bg-[#202121] rounded-xl p-6 shadow-sm border-2 border-gray-100 dark:border-gray-800 space-y-4 transition-all duration-200 hover:shadow-md w-full'
              >
                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-8 h-8 sticky top-0'>
                    <span className='flex items-center justify-center w-7 h-7 rounded-full bg-[#007e81] dark:bg-[#00676a] text-white font-medium text-xs'>
                      {idx + 1}
                    </span>
                  </div>
                  <div className='flex-1 space-y-3'>
                    <p className='font-medium text-gray-800 dark:text-gray-200'>
                      {qa.question}
                    </p>
                    <div className='relative'>
                      <textarea
                        className='w-full p-4 border-2 rounded-lg text-base
                          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400
                          dark:bg-[#161717] dark:text-white dark:border-gray-700
                          dark:focus:ring-[#007e81] dark:focus:ring-offset-[#202121]
                          transition-all duration-200
                          resize-none overflow-y-auto min-h-[120px] max-h-[400px]'
                        value={qa.answer}
                        onChange={(e) => {
                          handleAnswerChange(qa.id, e.target.value);
                          // Auto-expand logic
                          e.target.style.height = 'auto';
                          e.target.style.height =
                            Math.min(e.target.scrollHeight, 400) + 'px';
                        }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height =
                            Math.min(target.scrollHeight, 400) + 'px';
                        }}
                        placeholder='Type your answer here...'
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className='text-center text-gray-500 dark:text-gray-400 py-8'>
              Loading questions...
            </div>
          )}
          <div className='flex justify-end mt-8 mb-12'>
            <Button
              onClick={handleResearchStart}
              disabled={
                !Array.isArray(state.followUps_QnA) ||
                state.followUps_QnA.length === 0 ||
                state.followUps_QnA.some((qa) => !qa.answer?.trim())
              }
              className='text-white bg-[#007e81] hover:bg-[#00676a]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors shadow-md hover:shadow-lg
                py-2 px-3 text-base font-medium rounded-lg
                flex items-center gap-0 pr-2'
            >
              Research
              <ArrowBigRight size={20} />
            </Button>
          </div>
        </div>
      )}
      {/* dark:bg-[#007e81] dark:hover:bg-[#00676a] */}
      {/* Complete section */}
      {state.step === 'complete' && state.report && (
        <div className='space-y-6'>
          {/* Download button */}
          <div className='flex justify-end'>
            <Button
              variant='outline'
              onClick={handleDownload}
              className='flex items-center gap-2 px-3 py-2 border border-black transition-colors hover:text-white hover:bg-black dark:bg-transparent dark:text-[#007e81] dark:border-[#007e81] dark:hover:hover:bg-[#00676a] dark:hover:text-white'
            >
              <Download size={16} />
              Download Markdown
            </Button>
          </div>

          {/* Report content with proper dark mode */}
          <div className='prose dark:prose-invert max-w-none'>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ node, ...props }) => (
                  <h1 className='text-4xl font-bold mb-6' {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className='text-3xl font-bold mt-8 mb-4' {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className='text-2xl font-bold mt-6 mb-3' {...props} />
                ),
                a: ({ node, ...props }) => (
                  <a
                    className='text-blue-600 hover:text-blue-800 underline'
                    target='_blank'
                    rel='noopener noreferrer'
                    {...props}
                  />
                ),
                p: ({ node, ...props }) => <p className='my-4' {...props} />,
              }}
            >
              {state.report.sections
                .map(
                  (section) =>
                    `# ${section.sectionHeading}\n\n${section.content}`
                )
                .join('\n\n')}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {state.step === 'processing' && (
        <div className='space-y-6'>
          {/* Sources accordion (expanded by default) */}
          {shouldShowSources && (
            <Accordion type='single' collapsible defaultValue='sources'>
              <AccordionItem value='sources'>
                <AccordionTrigger className='text-xl font-bold'>
                  All Sources{' '}
                  {state.sourcesLog?.queries?.length
                    ? `(${state.sourcesLog.queries.length})`
                    : ''}
                </AccordionTrigger>
                <AccordionContent>
                  {state.sourcesLog?.queries?.length ? (
                    state.sourcesLog.queries.map(
                      (query: SerpQueryResult, idx: number) => (
                        <Accordion
                          key={idx}
                          type='single'
                          collapsible
                          className='ml-4 mb-4'
                        >
                          <AccordionItem value={`query-${idx}`}>
                            <AccordionTrigger className='text-lg font-semibold'>
                              {query.query} - {query.objective}
                            </AccordionTrigger>
                            <AccordionContent>
                              {/* Successfully scraped section */}
                              {query.successfulScrapes.length > 0 && (
                                <div className='mb-4'>
                                  <h4 className='font-medium mb-2 text-green-600 dark:text-green-400'>
                                    Successfully Scraped (
                                    {query.successfulScrapes.length})
                                  </h4>
                                  <ol className='list-decimal ml-4 space-y-4'>
                                    {query.successfulScrapes.map(
                                      (
                                        scrape: {
                                          url: string;
                                          extractedContent: string;
                                        },
                                        sIdx: number
                                      ) => (
                                        <li
                                          key={sIdx}
                                          className='text-gray-800 dark:text-gray-200'
                                        >
                                          <a
                                            href={scrape.url}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-blue-600 dark:text-blue-400 hover:underline'
                                          >
                                            {scrape.url}
                                          </a>
                                          <p className='mt-2 text-sm text-gray-600 dark:text-gray-300'>
                                            {scrape.extractedContent}
                                          </p>
                                        </li>
                                      )
                                    )}
                                  </ol>
                                </div>
                              )}

                              {/* Failed scrapes section */}
                              {query.failedScrapes.length > 0 && (
                                <div>
                                  <h4 className='font-medium mb-2 text-red-500'>
                                    Failed to Scrape (
                                    {query.failedScrapes.length})
                                  </h4>
                                  <ul className='list-disc ml-4 space-y-2'>
                                    {query.failedScrapes.map(
                                      (
                                        fail: { url: string; error: string },
                                        fIdx: number
                                      ) => (
                                        <li
                                          key={fIdx}
                                          className='text-sm text-gray-500'
                                        >
                                          {fail.url} - {fail.error}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )
                    )
                  ) : (
                    <p className='text-gray-500 dark:text-gray-400'>
                      No sources found.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}
    </main>
  );
}
