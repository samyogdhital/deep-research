'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TbSend2 } from 'react-icons/tb';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowBigRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Define interfaces using backend types
interface FollowUpQA {
  id: number;
  question: string;
  answer: string;
}

type ResearchPhase = 'input' | 'follow-up';

interface ResearchState {
  step: ResearchPhase;
  initialPrompt: string;
  depth: number;
  breadth: number;
  followUps_num: number;
  followUps_QnA: FollowUpQA[];
  currentResearchId?: string;
  error?: string;
  isResearchInProgress: boolean;
  deepResearch: boolean;
}

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<ResearchState>({
    step: 'input',
    initialPrompt: '',
    depth: 2,
    breadth: 2,
    followUps_num: 1,
    followUps_QnA: [],
    isResearchInProgress: false,
    deepResearch: false,
  });

  const [activeInput, setActiveInput] = useState<
    'depth' | 'breadth' | 'followUps' | null
  >(null);
  const [inputValue, setInputValue] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const firstFollowUpRef = useRef<HTMLTextAreaElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add auto-focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []); // Empty dependency array means this runs once on mount

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

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest('.input-popup') &&
        !target.closest('.trigger-button')
      ) {
        if (activeInput) {
          // Ensure we have a valid number, defaulting to current value if invalid
          const currentValue =
            activeInput === 'followUps'
              ? state.followUps_num
              : state[activeInput as 'depth' | 'breadth'];

          const newValue = inputValue.trim()
            ? Math.max(
                1,
                Math.min(
                  Number(inputValue),
                  activeInput === 'followUps' ? 30 : 10
                )
              )
            : currentValue;

          // Update state atomically
          setState((prev) => ({
            ...prev,
            [activeInput === 'followUps' ? 'followUps_num' : activeInput]:
              newValue,
          }));

          // Reset input state
          setInputValue(newValue.toString());
          setActiveInput(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [
    activeInput,
    inputValue,
    state.depth,
    state.breadth,
    state.followUps_num,
  ]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && activeInput) {
      // Ensure we have a valid number, defaulting to current value if invalid
      const currentValue =
        activeInput === 'followUps'
          ? state.followUps_num
          : state[activeInput as 'depth' | 'breadth'];

      const newValue = inputValue.trim()
        ? Math.max(
            1,
            Math.min(Number(inputValue), activeInput === 'followUps' ? 30 : 10)
          )
        : currentValue;

      // Update state atomically
      setState((prev) => ({
        ...prev,
        [activeInput === 'followUps' ? 'followUps_num' : activeInput]: newValue,
      }));

      // Reset input state
      setInputValue(newValue.toString());
      setActiveInput(null);
    }
  };

  const handleInputChange = (value: string) => {
    // Only allow numbers and empty string
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = value === '' ? -1 : Number(value);
      const max = activeInput === 'followUps' ? 30 : 10;

      // Allow empty string for typing, but enforce range for numbers
      if (value === '' || (numValue >= 1 && numValue <= max)) {
        setInputValue(value);
      }
    }
  };

  const handleInputClick = (type: 'depth' | 'breadth' | 'followUps') => {
    const currentValue =
      type === 'followUps' ? state.followUps_num : state[type];
    setInputValue(currentValue.toString());
    setActiveInput(type);
  };

  const handleInitialSubmit = async () => {
    if (!state.initialPrompt.trim()) return;

    setIsSubmitting(true);

    try {
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

      if (!response.ok) throw new Error('Failed to generate questions');

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        step: 'follow-up',
        followUps_QnA: data.questions.map((q: string, i: number) => ({
          id: i + 1,
          question: q,
          answer: '',
        })),
        currentResearchId: data.report_id,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'An error occurred',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResearchStart = async () => {
    // Validate all questions are answered
    if (state.followUps_QnA.some((qa) => !qa.answer.trim())) {
      setState((prev) => ({
        ...prev,
        error: 'Please answer all questions before proceeding',
      }));
      return;
    }

    if (!state.currentResearchId) {
      setState((prev) => ({
        ...prev,
        error: 'No research ID found',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isResearchInProgress: true }));

    try {
      // Convert follow-up answers to the expected format
      const followUpAnswers = Object.fromEntries(
        state.followUps_QnA.map((qa) => [qa.question, qa.answer])
      );

      // Start research process without waiting for response
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/research/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_query: state.initialPrompt,
          depth: state.depth,
          breadth: state.breadth,
          followUps_num: state.followUps_num,
          followUpAnswers,
          report_id: state.currentResearchId,
          is_deep_research: state.deepResearch,
        }),
      }).catch((error) => {
        console.error('Error starting research:', error);
      });

      // Immediately redirect to realtime page
      router.push(`/realtime/${state.currentResearchId}`);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isResearchInProgress: false,
        error: error instanceof Error ? error.message : 'An error occurred',
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

  // Focus on first follow-up textarea when questions load
  useEffect(() => {
    if (state.step === 'follow-up' && firstFollowUpRef.current) {
      firstFollowUpRef.current.focus();
    }
  }, [state.step]);

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
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    (e.ctrlKey || e.metaKey) &&
                    state.initialPrompt &&
                    !isSubmitting
                  ) {
                    e.preventDefault();
                    handleInitialSubmit();
                  }
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
                      onClick={() => handleInputClick('depth')}
                      className='trigger-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600'
                    >
                      Depth: {state.depth}
                    </Button>
                    {activeInput === 'depth' && (
                      <div className='input-popup absolute top-full mt-2 left-0 bg-white dark:bg-[#161818] p-3 rounded-lg shadow-lg border dark:border-gray-700 min-w-[180px] z-10'>
                        <label className='block text-sm font-semibold mb-2 dark:text-white'>
                          Select Depth (1-10)
                        </label>
                        <input
                          type='number'
                          min={1}
                          max={10}
                          className='w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                          value={inputValue}
                          onChange={(e) => handleInputChange(e.target.value)}
                          onKeyDown={handleInputKeyDown}
                        />
                      </div>
                    )}
                  </div>

                  <div className='relative'>
                    <Button
                      title='Research Breadth'
                      variant='outline'
                      onClick={() => handleInputClick('breadth')}
                      className='trigger-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600'
                    >
                      Breadth: {state.breadth}
                    </Button>
                    {activeInput === 'breadth' && (
                      <div className='input-popup absolute top-full mt-2 left-0 bg-white dark:bg-[#161818] p-3 rounded-lg shadow-lg border dark:border-gray-700 min-w-[180px] z-10'>
                        <label className='block text-sm font-semibold mb-2 dark:text-white'>
                          Select Breadth (1-10)
                        </label>
                        <input
                          type='number'
                          min={1}
                          max={10}
                          className='w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                          value={inputValue}
                          onChange={(e) => handleInputChange(e.target.value)}
                          onKeyDown={handleInputKeyDown}
                        />
                      </div>
                    )}
                  </div>

                  <div className='relative'>
                    <Button
                      title='Follow Up Questions'
                      variant='outline'
                      onClick={() => handleInputClick('followUps')}
                      className='trigger-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600'
                    >
                      Follow Ups: {state.followUps_num}
                    </Button>
                    {activeInput === 'followUps' && (
                      <div className='input-popup absolute top-full mt-2 left-0 bg-white dark:bg-[#161818] p-3 rounded-lg shadow-lg border dark:border-gray-700 min-w-[180px] z-10'>
                        <label className='block text-sm font-semibold mb-2 dark:text-white'>
                          Select Follow Ups
                          <br />
                          (1-30)
                        </label>
                        <input
                          type='number'
                          min={1}
                          max={30}
                          className='w-full p-2 border rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                          value={inputValue}
                          onChange={(e) => handleInputChange(e.target.value)}
                          onKeyDown={handleInputKeyDown}
                        />
                      </div>
                    )}
                  </div>

                  <div className='relative'>
                    <Button
                      title='Deep Research'
                      variant='outline'
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          deepResearch: !prev.deepResearch,
                        }))
                      }
                      className={cn(
                        'trigger-button dark:bg-[#272828] dark:text-gray-300 dark:hover:bg-[#161818] dark:border-gray-600',
                        state.deepResearch &&
                          'bg-[#3b82f6] text-white hover:bg-[#2563eb] dark:bg-[#3b82f6] dark:text-white dark:hover:bg-[#2563eb] dark:border-[#3b82f6]'
                      )}
                    >
                      Deep
                    </Button>
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
                        ref={qa.id === 1 ? firstFollowUpRef : undefined}
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
    </main>
  );
}
