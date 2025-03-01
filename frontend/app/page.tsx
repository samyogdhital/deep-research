'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { TbSend2 } from 'react-icons/tb';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useResearchStore, OngoingResearch } from '@/lib/research-store';
import type { ResearchData } from '@deep-research/db/schema';
import { cn } from '@/lib/utils';
import { ArrowBigRight } from 'lucide-react';

// Define interfaces using backend types
interface FollowUpQA {
  id: number;
  question: string;
  answer: string;
}

type ResearchPhase =
  | 'input'
  | 'follow-up'
  | 'searching'
  | 'analyzing'
  | 'reporting'
  | 'processing'
  | 'complete';

interface ResearchState {
  step: ResearchPhase;
  initialPrompt: string;
  depth: number;
  breadth: number;
  followUps_num: number;
  generatedFollowUpQuestions: string[];
  followUps_QnA: FollowUpQA[];
  logs: string[];
  showLogs: boolean;
  report: ResearchData['report'];
  sourcesLog?: ResearchData['serpQueries'];
  currentResearchId?: string;
  error?: string;
  isResearchInProgress: boolean;
  serpQueries: Array<{
    query: string;
    objective: string;
    query_rank: number;
    successful_scraped_websites: Array<{
      url: string;
      title: string;
      description: string;
      isRelevant: number;
      extracted_from_website_analyzer_agent: string[];
    }>;
    failedWebsites: string[];
  }>;
  crunchedInformation: Array<{
    query_rank: number;
    crunched_information: Array<{
      url: string;
      content: string[];
    }>;
  }>;
}

// Add interface for website data
interface Website {
  url: string;
  title: string;
  description: string;
  isRelevant: number;
  extracted_from_website_analyzer_agent: string[];
}

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<ResearchState>({
    step: 'input',
    initialPrompt: '',
    depth: 1,
    breadth: 2,
    followUps_num: 1,
    generatedFollowUpQuestions: [],
    followUps_QnA: [],
    logs: [],
    showLogs: false,
    report: undefined,
    isResearchInProgress: false,
    serpQueries: [],
    crunchedInformation: [],
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentResearchId, setCurrentResearchId] = useState<string | null>(
    null
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Remove unused state
  const [showDepthInput, setShowDepthInput] = useState(false);
  const [showBreadthInput, setShowBreadthInput] = useState(false);
  const [showFollowUpsInput, setShowFollowUpsInput] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single WebSocket setup effect
  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('request-ongoing-research');
    });

    socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
      setState((prev) => ({
        ...prev,
        logs: [...prev.logs, `Connection error: ${error.message}`],
      }));
    });

    // Handle research events
    socket.on('new_serp_query', (data: any) => {
      console.log('New SERP query:', data); // Debug log
      setState((prev) => {
        // Get all queries from the incoming data
        const incomingQueries = data.serpQueries || [];
        const updatedQueries = [...prev.serpQueries];

        incomingQueries.forEach((incomingQuery: any) => {
          const newQuery = {
            query: incomingQuery.query || '',
            objective: incomingQuery.objective || '',
            query_rank: incomingQuery.query_rank || updatedQueries.length + 1,
            successful_scraped_websites:
              incomingQuery.successful_scraped_websites || [],
            failedWebsites: incomingQuery.failedWebsites || [],
          };

          // Check if this query already exists
          const existingQueryIndex = updatedQueries.findIndex(
            (q) => q.query_rank === newQuery.query_rank
          );

          if (existingQueryIndex !== -1) {
            // Update existing query
            updatedQueries[existingQueryIndex] = {
              ...updatedQueries[existingQueryIndex],
              ...newQuery,
            };
          } else {
            // Add new query
            updatedQueries.push(newQuery);
          }
        });

        // Sort queries by rank
        updatedQueries.sort((a, b) => a.query_rank - b.query_rank);

        return {
          ...prev,
          step: 'searching',
          serpQueries: updatedQueries,
        };
      });
    });

    socket.on('new_website_successfully_scrape', (data: any) => {
      console.log('New website data:', data); // Debug log
      setState((prev) => {
        const updatedQueries = [...prev.serpQueries];

        // Handle all queries in the incoming data
        (data.serpQueries || []).forEach((incomingQuery: any) => {
          const queryIndex = updatedQueries.findIndex(
            (q) => q.query_rank === incomingQuery.query_rank
          );

          if (queryIndex !== -1) {
            const existingWebsites =
              updatedQueries[queryIndex].successful_scraped_websites;
            const newWebsites = incomingQuery.successful_scraped_websites || [];

            // Update or add each new website
            newWebsites.forEach((newSite: any) => {
              const existingIndex = existingWebsites.findIndex(
                (site) => site.url === newSite.url
              );

              const websiteObj = {
                url: newSite.url || '',
                title: newSite.title || newSite.url || 'Unknown Website',
                description: newSite.description || '',
                isRelevant:
                  typeof newSite.isRelevant === 'number'
                    ? newSite.isRelevant
                    : 0,
                extracted_from_website_analyzer_agent:
                  newSite.extracted_from_website_analyzer_agent || [],
              };

              if (existingIndex !== -1) {
                existingWebsites[existingIndex] = {
                  ...existingWebsites[existingIndex],
                  ...websiteObj,
                };
              } else {
                existingWebsites.push(websiteObj);
              }
            });

            updatedQueries[queryIndex] = {
              ...updatedQueries[queryIndex],
              successful_scraped_websites: existingWebsites,
            };
          }
        });

        return {
          ...prev,
          serpQueries: updatedQueries,
        };
      });
    });

    socket.on('website_analyzer_agent', (data: any) => {
      console.log('Website analyzer data:', data); // Debug log
      setState((prev) => {
        const updatedQueries = [...prev.serpQueries];

        // Handle all queries in the incoming data
        (data.serpQueries || []).forEach((incomingQuery: any) => {
          const queryIndex = updatedQueries.findIndex(
            (q) => q.query_rank === incomingQuery.query_rank
          );

          if (queryIndex !== -1) {
            const currentWebsites = [
              ...updatedQueries[queryIndex].successful_scraped_websites,
            ];
            const analyzedWebsites =
              incomingQuery.successful_scraped_websites || [];

            // Update analyzed websites
            analyzedWebsites.forEach((analyzedSite: any) => {
              const websiteIndex = currentWebsites.findIndex(
                (site) => site.url === analyzedSite.url
              );

              if (websiteIndex !== -1) {
                currentWebsites[websiteIndex] = {
                  ...currentWebsites[websiteIndex],
                  isRelevant:
                    typeof analyzedSite.isRelevant === 'number'
                      ? analyzedSite.isRelevant
                      : currentWebsites[websiteIndex].isRelevant,
                  extracted_from_website_analyzer_agent:
                    analyzedSite.extracted_from_website_analyzer_agent ||
                    currentWebsites[websiteIndex]
                      .extracted_from_website_analyzer_agent,
                };
              }
            });

            updatedQueries[queryIndex] = {
              ...updatedQueries[queryIndex],
              successful_scraped_websites: currentWebsites,
            };
          }
        });

        return {
          ...prev,
          serpQueries: updatedQueries,
        };
      });
    });

    socket.on('crunching_serp_query', () => {
      setState((prev) => ({
        ...prev,
        step: 'analyzing',
      }));
    });

    socket.on('crunched_information', (data: any) => {
      setState((prev) => ({
        ...prev,
        crunchedInformation: [
          ...(prev.crunchedInformation || []),
          {
            ...data,
            crunched_information: data.crunched_information || [],
          },
        ],
      }));
    });

    socket.on('report_writing_start', (data: any) => {
      console.log('Report writing start:', data); // Debug log
      setState((prev) => {
        // Get all queries from the incoming data
        const incomingQueries = data.serpQueries || [];
        const updatedQueries = [...incomingQueries].sort(
          (a, b) => a.query_rank - b.query_rank
        );

        return {
          ...prev,
          step: 'reporting',
          serpQueries: updatedQueries,
        };
      });
    });

    socket.on('report_writing_successfull', (data: any) => {
      setState((prev) => ({
        ...prev,
        report: data,
        step: 'complete',
        isResearchInProgress: false,
      }));
    });

    // Handle research completion
    socket.on(
      'research-completed',
      async ({ id, researchId }: { id: string; researchId: string }) => {
        console.log('Research completed:', { id, researchId }); // Debug log
        useResearchStore.getState().removeResearch(researchId);
        if (researchId === currentResearchId) {
          setCurrentResearchId(null);
          setState((prev) => ({
            ...prev,
            isResearchInProgress: false,
            step: 'complete',
          }));
          router.push(`/report/${id}`);
        }
      }
    );

    setSocket(socket);

    return () => {
      console.log('Cleaning up socket connection');
      socket.disconnect();
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
      setState((prev) => ({ ...prev, error: 'Please enter a research query' }));
      return;
    }

    try {
      setIsSubmitting(true);
      setState((prev) => ({
        ...prev,
        error: undefined,
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

      const data: { questions: string[]; report_id: string } =
        await response.json();

      if (!data.questions?.length) {
        throw new Error('No questions were generated');
      }

      const followUps: FollowUpQA[] = data.questions.map((q, idx) => ({
        id: idx + 1,
        question: q,
        answer: '',
      }));

      setState((prev) => ({
        ...prev,
        step: 'follow-up',
        currentResearchId: data.report_id,
        generatedFollowUpQuestions: data.questions,
        followUps_QnA: followUps,
      }));
    } catch (error) {
      console.error('Error:', error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate questions',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResearchStart = async () => {
    if (!state.currentResearchId) {
      setState((prev) => ({ ...prev, error: 'No research ID found' }));
      return;
    }

    if (state.followUps_QnA.some((qa) => !qa.answer.trim())) {
      setState((prev) => ({
        ...prev,
        error: 'Please answer all follow-up questions',
      }));
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        error: undefined,
        isResearchInProgress: true,
        step: 'processing',
      }));

      // Convert follow-up answers to the expected format
      const followUpAnswers = state.followUps_QnA.reduce<
        Record<string, string>
      >((acc, curr) => {
        acc[curr.id.toString()] = curr.answer;
        return acc;
      }, {});

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/research/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report_id: state.currentResearchId,
            initial_query: state.initialPrompt,
            depth: state.depth,
            breadth: state.breadth,
            followUps_num: state.followUps_num,
            followUpAnswers,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Research failed to start');
      }
    } catch (error) {
      console.error('Research error:', error);
      setState((prev) => ({
        ...prev,
        step: 'input',
        isResearchInProgress: false,
        error: error instanceof Error ? error.message : 'Research failed',
      }));
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setState((prev) => ({
      ...prev,
      followUps_QnA: prev.followUps_QnA.map((qa) =>
        qa.id === questionId ? { ...qa, answer } : qa
      ),
    }));
  };

  const handleDownload = () => {
    if (!state.report?.sections) return;

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

  return (
    <main className='container mx-auto px-4 py-8 max-w-4xl min-h-screen flex flex-col'>
      {/* Show error message if exists */}
      {state.error && (
        <div className='mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400'>
          {state.error}
        </div>
      )}

      {state.step === 'input' && (
        <div className='flex-1 flex flex-col items-center justify-center -mt-24 space-y-12 animate-in fade-in duration-300'>
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

            {/* Depth Breadth and Follow Ups Controls section with top border removed */}
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
                  disabled={!state.initialPrompt || isSubmitting}
                  onClick={handleInitialSubmit}
                  className={cn(
                    'rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-300',
                    state.initialPrompt && !isSubmitting
                      ? 'bg-gray-900 hover:bg-black text-white dark:bg-[#007e81] dark:hover:bg-[#00676a] dark:text-white'
                      : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-400'
                  )}
                >
                  {isSubmitting ? (
                    <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                  ) : (
                    <TbSend2 size={20} />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List of follow up questions that user will answer and start the deep research process by clicking on research button. */}
      {state.step === 'follow-up' && !state.isResearchInProgress && (
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
          <>
            {state.followUps_QnA.map((qa, idx) => (
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
            ))}
            <div className='flex justify-end mt-8 mb-12'>
              <Button
                onClick={handleResearchStart}
                disabled={
                  !Array.isArray(state.followUps_QnA) ||
                  state.followUps_QnA.length === 0 ||
                  state.followUps_QnA.some((qa) => !qa.answer?.trim()) ||
                  state.isResearchInProgress
                }
                className={cn(
                  'text-white bg-[#007e81] hover:bg-[#00676a]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors shadow-md hover:shadow-lg',
                  'py-2 px-3 text-base font-medium rounded-lg',
                  'flex items-center gap-2'
                )}
              >
                {state.isResearchInProgress ? (
                  <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                ) : (
                  <>
                    Research
                    <ArrowBigRight size={20} />
                  </>
                )}
              </Button>
            </div>
          </>
        </div>
      )}

      {/* Research Progress UI */}
      {state.isResearchInProgress && (
        <div className='space-y-8 mx-auto w-full max-w-3xl mt-12'>
          <div className='text-center space-y-2'>
            <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-100'>
              Research in Progress
            </h2>
            <p className='text-sm text-gray-600 dark:text-gray-400'>
              {state.step === 'searching' &&
                'Searching and analyzing websites...'}
              {state.step === 'analyzing' &&
                'Analyzing gathered information...'}
              {state.step === 'reporting' &&
                'Generating your research report...'}
              {state.step === 'processing' && 'Processing your request...'}
            </p>
          </div>

          {/* SERP Queries Progress */}
          {(state.serpQueries || []).length > 0 && (
            <div className='space-y-6 max-h-[70vh] overflow-y-auto pr-2'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-gray-200 sticky top-0 bg-white dark:bg-[#161717] py-2 z-10'>
                Search Queries Progress
              </h3>
              <div className='space-y-4'>
                {state.serpQueries.map((query, idx) => (
                  <div
                    key={idx}
                    className='bg-white dark:bg-[#202121] rounded-xl p-6 shadow-sm border-2 border-gray-100 dark:border-gray-800'
                  >
                    <div className='space-y-4'>
                      <div className='flex justify-between items-start'>
                        <div className='space-y-2'>
                          <h4 className='font-medium text-gray-900 dark:text-gray-100'>
                            Query {query.query_rank}: {query.query}
                          </h4>
                          <p className='text-sm text-gray-600 dark:text-gray-400'>
                            Objective: {query.objective}
                          </p>
                        </div>
                      </div>

                      {/* Websites Progress */}
                      <div className='mt-4 space-y-3'>
                        <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                          Analyzed Websites (
                          {query.successful_scraped_websites?.length || 0})
                        </h5>
                        <div className='space-y-2'>
                          {(query.successful_scraped_websites || []).map(
                            (website, widx) => (
                              <div
                                key={`${website.url}-${widx}`}
                                className='flex items-start justify-between text-sm bg-gray-50 dark:bg-[#161717] p-3 rounded-lg gap-4'
                              >
                                <div className='flex-1 min-w-0 space-y-1'>
                                  <div className='text-gray-900 dark:text-gray-100 font-medium truncate'>
                                    {website.title || website.url}
                                  </div>
                                  {website.description && (
                                    <div className='text-gray-500 dark:text-gray-400 text-xs truncate'>
                                      {website.description}
                                    </div>
                                  )}
                                  <div className='text-gray-400 dark:text-gray-500 text-xs truncate'>
                                    {website.url}
                                  </div>
                                </div>
                                <div className='flex-shrink-0 self-center'>
                                  {Array.isArray(
                                    website.extracted_from_website_analyzer_agent
                                  ) &&
                                  website.extracted_from_website_analyzer_agent
                                    .length > 0 ? (
                                    <span className='text-green-600 dark:text-green-400 flex items-center gap-1 whitespace-nowrap'>
                                      <span className='w-2 h-2 rounded-full bg-green-500'></span>
                                      Analyzed
                                    </span>
                                  ) : (
                                    <span className='text-yellow-600 dark:text-yellow-400 flex items-center gap-1 whitespace-nowrap'>
                                      <span className='w-2 h-2 rounded-full bg-yellow-500 animate-pulse'></span>
                                      Processing
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Information Crunching Progress */}
          {(state.crunchedInformation || []).length > 0 && (
            <div className='space-y-6'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-gray-200'>
                Information Processing
              </h3>
              <div className='space-y-4'>
                {(state.crunchedInformation || []).map(
                  (info, idx) =>
                    info && (
                      <div
                        key={idx}
                        className='bg-white dark:bg-[#202121] rounded-xl p-6 shadow-sm border-2 border-gray-100 dark:border-gray-800'
                      >
                        <h4 className='font-medium text-gray-900 dark:text-gray-100'>
                          Query {info.query_rank || 'Unknown'} Results
                        </h4>
                        <div className='mt-4 space-y-3'>
                          {(info.crunched_information || []).map(
                            (crunch, cidx) =>
                              crunch && (
                                <div
                                  key={cidx}
                                  className='text-sm bg-gray-50 dark:bg-[#161717] p-3 rounded-lg'
                                >
                                  <p className='text-gray-600 dark:text-gray-400'>
                                    Processed information from{' '}
                                    {(
                                      crunch.url || 'Unknown Source'
                                    ).toString()}
                                  </p>
                                </div>
                              )
                          )}
                        </div>
                      </div>
                    )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
