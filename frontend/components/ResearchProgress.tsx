import { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface WebsiteResult {
  url: string;
  extractedContent: string;
}

interface QueryResult {
  query: string;
  objective: string;
  query_rank: number;
  successfulScrapes: WebsiteResult[];
  failedScrapes: string[];
}

interface CrunchedInfo {
  query_rank: number;
  crunched_information: Array<{
    url: string;
    content: string[];
  }>;
}

interface ResearchProgressProps {
  isVisible: boolean;
  currentQuery?: string;
  queries: QueryResult[];
  step: 'input' | 'follow-up' | 'processing' | 'complete';
  generatedFollowUpQuestions: string[];
  crunchedInfo?: CrunchedInfo[];
  socket: any;
}

export function ResearchProgress({
  isVisible,
  currentQuery: initialQuery,
  queries: initialQueries,
  step,
  generatedFollowUpQuestions,
  crunchedInfo: initialCrunchedInfo,
  socket,
}: ResearchProgressProps) {
  const [queries, setQueries] = useState<QueryResult[]>(initialQueries);
  const [currentQuery, setCurrentQuery] = useState<string | undefined>(
    initialQuery
  );
  const [crunchedInfo, setCrunchedInfo] = useState<CrunchedInfo[]>(
    initialCrunchedInfo || []
  );
  const [isInformationCrunching, setIsInformationCrunching] = useState(false);
  const [hasStartedCrunching, setHasStartedCrunching] = useState(false);
  const [isLoadingQueries, setIsLoadingQueries] = useState(false);
  const [latestQueryRank, setLatestQueryRank] = useState<number | null>(null);
  const [activeAccordion, setActiveAccordion] =
    useState<string>('understanding');

  // Initialize research phase based on the step prop
  const [researchPhase, setResearchPhase] = useState<
    'understanding' | 'gathering' | 'crunching' | 'writing' | 'complete'
  >(
    step === 'follow-up'
      ? 'understanding'
      : step === 'processing'
      ? 'gathering'
      : step === 'complete'
      ? 'complete'
      : 'understanding'
  );

  // Update active accordion when phase changes
  useEffect(() => {
    setActiveAccordion(researchPhase);
  }, [researchPhase]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('get-research-state');

    socket.on('research-phase', (phase: string) => {
      console.log('Research phase update:', phase);
      const validPhases = [
        'understanding',
        'gathering',
        'crunching',
        'writing',
        'complete',
      ];
      if (validPhases.includes(phase)) {
        setResearchPhase(phase as any);
        setActiveAccordion(phase); // Auto-expand the current phase

        // Update UI state based on phase
        switch (phase) {
          case 'gathering':
            setIsInformationCrunching(false);
            setIsLoadingQueries(true);
            break;
          case 'crunching':
            setIsInformationCrunching(true);
            setHasStartedCrunching(true);
            setIsLoadingQueries(false);
            break;
          case 'writing':
          case 'complete':
            setIsInformationCrunching(false);
            setIsLoadingQueries(false);
            break;
        }
      }
    });

    // Handle source updates
    socket.on('sources-update', (data: { queries: QueryResult[] }) => {
      if (data.queries?.length > 0) {
        const sortedQueries = data.queries.sort(
          (a, b) => a.query_rank - b.query_rank
        );
        setQueries(sortedQueries);

        // Track latest query for animation
        const newLatestRank =
          sortedQueries[sortedQueries.length - 1].query_rank;
        if (newLatestRank !== latestQueryRank) {
          setLatestQueryRank(newLatestRank);
        }

        setCurrentQuery(sortedQueries[sortedQueries.length - 1].query);
        setIsLoadingQueries(false);
      }
    });

    // Handle information crunching updates
    socket.on(
      'information-crunching-update',
      (data: { crunchedInfo: CrunchedInfo[] }) => {
        if (data.crunchedInfo) {
          setCrunchedInfo(data.crunchedInfo);
        }
      }
    );

    return () => {
      socket.off('research-phase');
      socket.off('sources-update');
      socket.off('information-crunching-update');
    };
  }, [socket, latestQueryRank]);

  // Determine if each phase should be enabled
  const isUnderstandingEnabled = true;
  const isGatheringEnabled = [
    'gathering',
    'crunching',
    'writing',
    'complete',
  ].includes(researchPhase);
  const isCrunchingEnabled =
    hasStartedCrunching &&
    ['crunching', 'writing', 'complete'].includes(researchPhase);
  const isWritingEnabled = ['writing', 'complete'].includes(researchPhase);

  return (
    <div
      className={cn(
        'transition-all duration-500 ease-in-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      )}
    >
      <Accordion
        type='single'
        value={activeAccordion}
        onValueChange={setActiveAccordion}
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
                Deep Research Progress
              </span>
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                {queries.length} sources
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className='pt-6 w-full bg-gray-50 dark:bg-gray-800/50 border border-t-0 border-gray-100 dark:border-gray-700 rounded-b-lg'>
            <div className='space-y-6 px-6'>
              {/* Generated Follow-up Questions */}
              <AccordionItem value='understanding' className='border-none'>
                <AccordionTrigger
                  className='text-sm'
                  disabled={!isUnderstandingEnabled}
                >
                  <div className='flex items-center gap-3 w-full'>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center relative z-10',
                        researchPhase !== 'understanding'
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : 'bg-blue-100 dark:bg-blue-900/20'
                      )}
                    >
                      <div
                        className={cn(
                          'w-2.5 h-2.5 rounded-full',
                          researchPhase !== 'understanding'
                            ? 'bg-green-500 dark:bg-green-400'
                            : 'bg-blue-400 dark:bg-blue-500 animate-pulse'
                        )}
                      />
                    </div>
                    <span className='text-xs text-gray-700 dark:text-gray-200 flex-grow'>
                      {researchPhase !== 'understanding'
                        ? 'Generated Follow-up Questions'
                        : 'Generating Follow-up Questions'}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className='pl-9 space-y-2 mt-2'>
                    {generatedFollowUpQuestions.map((question, index) => (
                      <div key={index} className='py-1.5'>
                        {question}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Gathering Research Information */}
              <AccordionItem value='gathering' className='border-none'>
                <AccordionTrigger
                  className='text-sm'
                  disabled={!isGatheringEnabled}
                >
                  <div className='flex items-center gap-3 w-full'>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center relative z-10',
                        researchPhase === 'gathering'
                          ? 'bg-blue-100 dark:bg-blue-900/20'
                          : researchPhase === 'understanding'
                          ? 'bg-gray-100 dark:bg-gray-700'
                          : 'bg-green-100 dark:bg-green-900/20'
                      )}
                    >
                      <div
                        className={cn(
                          'w-2.5 h-2.5 rounded-full',
                          researchPhase === 'gathering'
                            ? 'bg-blue-400 dark:bg-blue-500 animate-pulse'
                            : researchPhase === 'understanding'
                            ? 'bg-gray-400 dark:bg-gray-500'
                            : 'bg-green-500 dark:bg-green-400'
                        )}
                      />
                    </div>
                    <span className='text-xs text-gray-700 dark:text-gray-200 flex-grow'>
                      {isLoadingQueries
                        ? 'Searching for Information...'
                        : queries.length > 0
                        ? `Found ${queries.length} Sources`
                        : 'Searching for Information'}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className='ml-8 space-y-4'>
                    {isLoadingQueries && queries.length === 0 ? (
                      <div className='flex items-center justify-center py-4'>
                        <div className='animate-pulse text-sm text-gray-600 dark:text-gray-300'>
                          Searching websites...
                        </div>
                      </div>
                    ) : queries.length > 0 ? (
                      <>
                        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                          Research Progress
                        </h4>
                        {queries.map((query, idx) => (
                          <Accordion
                            type='single'
                            collapsible
                            className={cn(
                              'w-full transition-all duration-300',
                              query.query_rank === latestQueryRank &&
                                'animate-fadeIn'
                            )}
                            key={idx}
                          >
                            <AccordionItem value={`query-${idx}`}>
                              <AccordionTrigger className='text-sm'>
                                <div className='flex items-center gap-2'>
                                  <span>{query.query}</span>
                                  {query.query_rank === latestQueryRank &&
                                    isLoadingQueries && (
                                      <span className='text-xs text-blue-500 animate-pulse'>
                                        (Searching...)
                                      </span>
                                    )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className='text-xs text-gray-600 dark:text-gray-300 mb-2'>
                                  Objective: {query.objective}
                                </div>
                                {query.successfulScrapes.length > 0 ? (
                                  <ol className='list-decimal ml-4 space-y-3'>
                                    {query.successfulScrapes.map(
                                      (scrape, sIdx) => (
                                        <li
                                          key={sIdx}
                                          className={cn(
                                            'text-sm transition-all duration-300',
                                            query.query_rank ===
                                              latestQueryRank &&
                                              'animate-fadeIn'
                                          )}
                                        >
                                          <a
                                            href={scrape.url}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-blue-600 dark:text-blue-400 hover:underline'
                                          >
                                            {scrape.url}
                                          </a>
                                          <p className='mt-1 text-gray-600 dark:text-gray-300'>
                                            {scrape.extractedContent}
                                          </p>
                                        </li>
                                      )
                                    )}
                                  </ol>
                                ) : (
                                  <div className='text-sm text-gray-500 italic'>
                                    Analyzing websites...
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        ))}
                      </>
                    ) : null}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Information Crunching */}
              {hasStartedCrunching && (
                <AccordionItem value='crunching' className='border-none'>
                  <AccordionTrigger
                    className='text-sm'
                    disabled={!isCrunchingEnabled}
                  >
                    <div className='flex items-center gap-3 w-full'>
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center relative z-10',
                          researchPhase === 'crunching'
                            ? 'bg-blue-100 dark:bg-blue-900/20'
                            : researchPhase === 'understanding' ||
                              researchPhase === 'gathering'
                            ? 'bg-gray-100 dark:bg-gray-700'
                            : 'bg-green-100 dark:bg-green-900/20'
                        )}
                      >
                        <div
                          className={cn(
                            'w-2.5 h-2.5 rounded-full',
                            researchPhase === 'crunching'
                              ? 'bg-blue-400 dark:bg-blue-500 animate-pulse'
                              : researchPhase === 'understanding' ||
                                researchPhase === 'gathering'
                              ? 'bg-gray-400 dark:bg-gray-500'
                              : 'bg-green-500 dark:bg-green-400'
                          )}
                        />
                      </div>
                      <span className='text-xs text-gray-700 dark:text-gray-200 flex-grow'>
                        Information Crunching
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {crunchedInfo && crunchedInfo.length > 0 && (
                      <div className='ml-8 space-y-4'>
                        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                          Crunched Information
                        </h4>
                        {crunchedInfo.map((info, idx) => (
                          <Accordion
                            type='single'
                            collapsible
                            className='w-full'
                            key={idx}
                          >
                            <AccordionItem value={`crunch-${idx}`}>
                              <AccordionTrigger className='text-sm'>
                                Query {info.query_rank}
                              </AccordionTrigger>
                              <AccordionContent>
                                {info.crunched_information.map(
                                  (crunch, cIdx) => (
                                    <div key={cIdx} className='mb-3'>
                                      <a
                                        href={crunch.url}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-blue-600 dark:text-blue-400 hover:underline text-sm'
                                      >
                                        {crunch.url}
                                      </a>
                                      <ul className='mt-1 space-y-1'>
                                        {crunch.content.map(
                                          (content, contentIdx) => (
                                            <li
                                              key={contentIdx}
                                              className='text-sm text-gray-600 dark:text-gray-300'
                                            >
                                              {content}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Writing Final Report */}
              <AccordionItem value='writing' className='border-none'>
                <AccordionTrigger
                  className='text-sm'
                  disabled={!isWritingEnabled}
                >
                  <div className='flex items-center gap-3 w-full'>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center relative z-10',
                        researchPhase === 'writing'
                          ? 'bg-blue-100 dark:bg-blue-900/20'
                          : researchPhase === 'complete'
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : 'bg-gray-100 dark:bg-gray-700'
                      )}
                    >
                      <div
                        className={cn(
                          'w-2.5 h-2.5 rounded-full',
                          researchPhase === 'writing'
                            ? 'bg-blue-400 dark:bg-blue-500 animate-pulse'
                            : researchPhase === 'complete'
                            ? 'bg-green-500 dark:bg-green-400'
                            : 'bg-gray-400 dark:bg-gray-500'
                        )}
                      />
                    </div>
                    <span className='text-xs text-gray-700 dark:text-gray-200 flex-grow'>
                      Writing Final Report
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {/* ... existing content ... */}
                </AccordionContent>
              </AccordionItem>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
