'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { generateQueryTree } from '@/lib/utils';
import { QueryTree } from '@/components/QueryTree';
import { QuerySheet } from '@/components/QuerySheet';
import type { ResearchData, SerpQuery } from '@deep-research/db/schema';
import { Button } from '@/components/ui/button';
import { TbPlayerPlayFilled } from 'react-icons/tb';
import { useParams, useRouter } from 'next/navigation';

interface QueryNode {
  id: number;
  depth: number;
  timestamp: number;
  parentTimestamp: number;
  children: QueryNode[];
  queryNumber: number;
  data?: SerpQuery;
  isEnabled: boolean;
}

interface RealtimeViewProps {
  initialData: ResearchData;
  browser_report_id: string;
}

export function RealtimeView({
  initialData,
  browser_report_id,
}: RealtimeViewProps) {
  const router = useRouter();

  const [queryNodes, setQueryNodes] = useState<QueryNode[]>(() => {
    const nodes = generateQueryTree(initialData.depth, initialData.breadth);
    initialData.serpQueries.forEach((query, index) => {
      const nodeToUpdate = nodes[index];
      if (nodeToUpdate) {
        nodes[index] = { ...nodeToUpdate, data: query, isEnabled: true };
      }
    });
    return nodes;
  });
  const [selectedQuery, setSelectedQuery] = useState<SerpQuery | null>(null);
  const [researchData, setResearchData] = useState<ResearchData>(initialData);
  const [reportStatus, setReportStatus] = useState<
    'no-start' | 'in-progress' | 'completed' | 'failed'
  >(
    initialData.report?.status === 'not-started'
      ? 'no-start'
      : initialData.report?.status || 'no-start'
  );

  // Core state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.8);
  const [showResetButton, setShowResetButton] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [activeResearches, setActiveResearches] = useState<string[]>([]);

  // Check tree visibility
  const checkTreeVisibility = useCallback(() => {
    if (!containerRef.current || !treeRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const treeRect = treeRef.current.getBoundingClientRect();

    const padding = 100; // Visibility threshold
    const isOutOfView =
      treeRect.left > containerRect.right - padding ||
      treeRect.right < containerRect.left + padding ||
      treeRect.top > containerRect.bottom - padding ||
      treeRect.bottom < containerRect.top + padding;

    setShowResetButton(isOutOfView);
  }, []);

  // Reset to center
  const resetToCenter = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    setScale(0.8);
  }, []);

  // Monitor tree visibility
  useEffect(() => {
    const interval = setInterval(checkTreeVisibility, 100);
    return () => clearInterval(interval);
  }, [checkTreeVisibility]);

  // Handle node click
  const handleQueryClick = useCallback(
    (query: SerpQuery, e: React.MouseEvent) => {
      setDragStartPos({ x: e.clientX, y: e.clientY });
    },
    []
  );

  // Handle node click end (mouseup)
  const handleQueryClickEnd = useCallback(
    (query: SerpQuery, e: React.MouseEvent) => {
      const deltaX = Math.abs(e.clientX - dragStartPos.x);
      const deltaY = Math.abs(e.clientY - dragStartPos.y);

      // If it's a small movement (click rather than drag)
      if (deltaX < 5 && deltaY < 5) {
        setSelectedQuery(query);
      }
    },
    [dragStartPos]
  );

  // Handle sheet state change
  const handleSheetChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedQuery(null);
    }
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Don't zoom if interacting with sheet content
      if (
        e.target instanceof Element &&
        (e.target.closest('[role="dialog"]') || selectedQuery)
      ) {
        return;
      }

      e.preventDefault();
      const delta = -e.deltaY;
      const scaleFactor = 0.05;
      const newScale =
        delta > 0 ? scale * (1 + scaleFactor) : scale / (1 + scaleFactor);

      // Limit scale between 0.1 and 2
      setScale(Math.min(Math.max(newScale, 0.1), 2));
      checkTreeVisibility();
    },
    [scale, selectedQuery, checkTreeVisibility]
  );

  // Add wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Handle dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      if (selectedQuery) return; // Prevent dragging when sheet is open

      e.preventDefault();
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      setPosition({ x: newX, y: newY });
      checkTreeVisibility();
    },
    [isDragging, checkTreeVisibility, selectedQuery]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't initiate drag if clicking inside the sheet
      if (
        e.target instanceof Element &&
        (e.target.closest('[role="dialog"]') || selectedQuery)
      ) {
        return;
      }

      if (e.button !== 0) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position, selectedQuery]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add drag event listeners
  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Socket connection and handlers
  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    const handleData = (data: ResearchData) => {
      setResearchData(data);
      updateNodesWithData(data.serpQueries);
    };

    socket.on('connect', () => console.log('Connected to websocket'));

    // Group data update events
    [
      'new_serp_query',
      'got_websites_from_serp_query',
      'scraping_a_website',
      'scraped_a_website',
      'scraping_a_website_failed',
      'analyzing_a_website',
      'analyzed_a_website',
      'analyzing_serp_query',
      'analyzed_serp_query',
    ].forEach((event) =>
      socket.on(event, (data: ResearchData, report_id: string) => {
        // Only update state if the event is for the current research
        if (report_id === browser_report_id) {
          handleData(data);

          // Log the event for debugging
          console.log(`Received websocket event: ${event}`, {
            report_id,
            timestamp: new Date().toISOString(),
          });
        }
      })
    );

    // Report status handlers
    socket.on(
      'report_writing_start',
      (data: ResearchData, report_id: string) => {
        if (report_id === browser_report_id) {
          setReportStatus('in-progress');
        }
      }
    );

    socket.on(
      'report_writing_successfull',
      (data: ResearchData, report_id: string) => {
        if (report_id === browser_report_id) {
          setReportStatus('completed');
          window.location.href = `/report/${data.report_id}`;
        }
      }
    );

    socket.on(
      'research_error',
      (error: { error: string; report_id?: string }) => {
        if (!error.report_id || error.report_id === browser_report_id) {
          setReportStatus('failed');
        }
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [browser_report_id]);

  const updateNodesWithData = useCallback((queries: SerpQuery[]) => {
    setQueryNodes((prev) =>
      prev.map((node, index) =>
        queries[index]
          ? { ...node, data: queries[index], isEnabled: true }
          : node
      )
    );
  }, []);

  // Fetch active researches
  useEffect(() => {
    const fetchActiveResearches = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/running_researches`
        );
        if (response.ok) {
          const data = await response.json();
          setActiveResearches(data);
        }
      } catch (error) {
        console.error('Error fetching active researches:', error);
      }
    };
    fetchActiveResearches();
  }, []);

  const handleResume = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/resume`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ report_id: initialData.report_id }),
        }
      );

      if (response.ok) {
        // Reload the page after successful resume
        router.refresh();
      } else {
        console.error('Failed to resume research');
      }
    } catch (error) {
      console.error('Error resuming research:', error);
    }
  };

  return (
    <div
      ref={containerRef}
      className='w-full h-full bg-gray-50 dark:bg-gray-900 relative overflow-hidden flex items-center justify-center'
      onMouseDown={handleMouseDown}
      style={{
        cursor: isDragging ? 'grabbing' : selectedQuery ? 'auto' : 'grab',
        userSelect: selectedQuery ? 'text' : 'none',
      }}
    >
      {initialData && (
        <div className='fixed top-4 right-4 z-50'>
          {initialData.report?.status === 'completed' ? (
            <Button
              variant='outline'
              onClick={() =>
                (window.location.href = `/report/${initialData.report_id}`)
              }
              className='text-[#007e81] hover:text-[#006669] dark:text-[#00a3a8] dark:hover:text-[#008589] border-[#007e81] dark:border-[#00a3a8]'
            >
              View Report
            </Button>
          ) : (
            !activeResearches.includes(initialData.report_id) &&
            initialData.serpQueries.length > 0 &&
            (!initialData.report || initialData.report.status === 'failed') && (
              <Button
                variant='outline'
                onClick={handleResume}
                className='text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400 border-orange-600 dark:border-orange-500 flex items-center gap-2'
              >
                <TbPlayerPlayFilled className='w-4 h-4' />
                Resume
              </Button>
            )
          )}
        </div>
      )}
      <div
        ref={treeRef}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          transformOrigin: 'center center',
        }}
      >
        <QueryTree
          nodes={queryNodes}
          onQueryClick={handleQueryClick}
          onQueryClickEnd={handleQueryClickEnd}
          isInteractionDisabled={!!selectedQuery}
          reportStatus={reportStatus}
        />
      </div>

      {showResetButton && (
        <button
          onClick={resetToCenter}
          className='fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg transition-all'
          style={{
            zIndex: 9999,
            pointerEvents: 'auto',
          }}
        >
          Reset View
        </button>
      )}

      {selectedQuery && (
        <QuerySheet
          query={
            researchData.serpQueries.find(
              (q) => q.query_timestamp === selectedQuery.query_timestamp
            ) || selectedQuery
          }
          onOpenChange={handleSheetChange}
        />
      )}
    </div>
  );
}
