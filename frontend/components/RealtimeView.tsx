'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Sheet } from '@/components/ui/sheet';
import { generateQueryTree } from '@/lib/utils';
import { QueryTree } from '@/components/QueryTree';
import { QuerySheet } from '@/components/QuerySheet';
import type { ResearchData, SerpQuery } from '@deep-research/db/schema';

interface QueryNode {
  id: string;
  depth: number;
  rank: number;
  parentRank: number;
  data?: SerpQuery;
  isEnabled: boolean;
}

interface RealtimeViewProps {
  initialData: ResearchData;
}

export function RealtimeView({ initialData }: RealtimeViewProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [queryNodes, setQueryNodes] = useState<QueryNode[]>(() => {
    // Generate tree and populate with initial data
    const nodes = generateQueryTree(initialData.depth, initialData.breadth);

    // Update nodes with existing data
    initialData.serpQueries.forEach((query) => {
      const nodeIndex = nodes.findIndex((n) => n.rank === query.query_rank);
      if (nodeIndex !== -1) {
        nodes[nodeIndex] = {
          ...nodes[nodeIndex],
          data: query,
          isEnabled: true,
        };
      }
    });

    return nodes;
  });
  const [selectedQuery, setSelectedQuery] = useState<SerpQuery | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [researchData, setResearchData] = useState<ResearchData | null>(
    initialData
  );

  // Add state for drag and zoom functionality
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });

  // Handle zoom with Ctrl + wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      setScale((prev) => Math.min(Math.max(0.5, prev + delta * 0.001), 2));
    } else if (e.shiftKey) {
      // Horizontal scroll with Shift + wheel
      e.preventDefault();
      const newX = positionRef.current.x - e.deltaY;
      positionRef.current.x = newX;
      setPosition((prev) => ({ ...prev, x: newX }));
    } else {
      // Vertical scroll without modifier keys
      e.preventDefault();
      const newY = positionRef.current.y - e.deltaY;
      positionRef.current.y = newY;
      setPosition((prev) => ({ ...prev, y: newY }));
    }
  }, []);

  // Add wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  // Check if content is out of view
  const checkVisibility = useCallback(() => {
    if (!treeRef.current) return;
    const rect = treeRef.current.getBoundingClientRect();
    const isOutOfView =
      rect.top > window.innerHeight ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.right < 0;
    setShowScrollButton(isOutOfView);
  }, []);

  useEffect(() => {
    checkVisibility();
    window.addEventListener('scroll', checkVisibility);
    window.addEventListener('resize', checkVisibility);
    return () => {
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [checkVisibility]);

  // Handle mouse events for dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;

      positionRef.current = { x: newX, y: newY };
      setPosition({ x: newX, y: newY });

      e.preventDefault();
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left click
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
    e.preventDefault();
  }, []);

  // Add event listeners for mouse move and up
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove, { capture: true });
      window.addEventListener('mouseup', handleMouseUp, { capture: true });
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove, {
        capture: true,
      });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Initialize socket connection and handle events
  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to websocket');
    });

    // Handle website status updates
    socket.on('new_serp_query', (data: ResearchData) => {
      console.log('New SERP query received:', data.serpQueries);
      // Find the query in the current data that matches the new data
      const updatedQuery = data.serpQueries.find((q) =>
        researchData?.serpQueries.some(
          (existing) => existing.query_rank === q.query_rank
        )
      );

      if (
        updatedQuery &&
        selectedQuery?.query_rank === updatedQuery.query_rank
      ) {
        // If we're currently viewing this query, update it
        setSelectedQuery(updatedQuery);
      }

      updateNodesWithData(data.serpQueries);
      setResearchData(data);
    });

    socket.on('scraping_a_website', (data: ResearchData) => {
      console.log('Website scraping update:', data.serpQueries);
      const updatedQuery = data.serpQueries.find(
        (q) => selectedQuery?.query_rank === q.query_rank
      );
      if (updatedQuery) setSelectedQuery(updatedQuery);

      updateNodesWithData(data.serpQueries);
      setResearchData(data);
    });

    socket.on('analyzing_a_website', (data: ResearchData) => {
      console.log('Website analyzing update:', data.serpQueries);
      const updatedQuery = data.serpQueries.find(
        (q) => selectedQuery?.query_rank === q.query_rank
      );
      if (updatedQuery) setSelectedQuery(updatedQuery);

      updateNodesWithData(data.serpQueries);
      setResearchData(data);
    });

    socket.on('analyzed_a_website', (data: ResearchData) => {
      console.log('Website analyzed update:', data.serpQueries);
      const updatedQuery = data.serpQueries.find(
        (q) => selectedQuery?.query_rank === q.query_rank
      );
      if (updatedQuery) setSelectedQuery(updatedQuery);

      updateNodesWithData(data.serpQueries);
      setResearchData(data);
    });

    socket.on('report_writing_successfull', (data: ResearchData) => {
      window.location.href = `/report/${initialData.report_id}`;
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, []);

  // Update nodes with incoming data
  const updateNodesWithData = useCallback((queries: SerpQuery[]) => {
    setQueryNodes((prev) => {
      const updated = [...prev];

      queries.forEach((query) => {
        const nodeIndex = updated.findIndex((n) => n.rank === query.query_rank);
        if (nodeIndex !== -1) {
          const existingNode = updated[nodeIndex];

          // If node already has data and is enabled, merge the data
          if (existingNode.data && existingNode.isEnabled) {
            updated[nodeIndex] = {
              ...existingNode,
              data: {
                ...existingNode.data,
                successful_scraped_websites: [
                  ...existingNode.data.successful_scraped_websites,
                  ...query.successful_scraped_websites.filter(
                    (newSite) =>
                      !existingNode.data?.successful_scraped_websites.some(
                        (existingSite) => existingSite.url === newSite.url
                      )
                  ),
                ],
                failedWebsites: [
                  ...(existingNode.data.failedWebsites || []),
                  ...(query.failedWebsites?.filter(
                    (newSite) =>
                      !existingNode.data?.failedWebsites?.some(
                        (existingSite) =>
                          existingSite.website === newSite.website
                      )
                  ) || []),
                ],
              },
            };
          } else {
            // If node doesn't have data yet, just set the new data
            updated[nodeIndex] = {
              ...existingNode,
              data: query,
              isEnabled: true,
            };
          }
        }
      });

      return updated;
    });

    // Update research data while preserving existing data
    setResearchData((prev) => {
      if (!prev) return prev;

      const updatedQueries = [...prev.serpQueries];

      queries.forEach((query) => {
        const existingIndex = updatedQueries.findIndex(
          (q) => q.query_rank === query.query_rank
        );

        if (existingIndex !== -1) {
          // Update existing query while preserving its data
          updatedQueries[existingIndex] = {
            ...updatedQueries[existingIndex],
            successful_scraped_websites: [
              ...updatedQueries[existingIndex].successful_scraped_websites,
              ...query.successful_scraped_websites.filter(
                (newSite) =>
                  !updatedQueries[
                    existingIndex
                  ].successful_scraped_websites.some(
                    (existingSite) => existingSite.url === newSite.url
                  )
              ),
            ],
            failedWebsites: [
              ...(updatedQueries[existingIndex].failedWebsites || []),
              ...(query.failedWebsites?.filter(
                (newSite) =>
                  !updatedQueries[existingIndex].failedWebsites?.some(
                    (existingSite) => existingSite.website === newSite.website
                  )
              ) || []),
            ],
          };
        } else {
          // Add new query
          updatedQueries.push(query);
        }
      });

      return {
        ...prev,
        serpQueries: updatedQueries,
      };
    });
  }, []);

  const handleQueryClick = useCallback(
    (query: SerpQuery) => {
      // Find the most up-to-date data for this query_rank
      const currentQueryData = researchData?.serpQueries.find(
        (q) => q.query_rank === query.query_rank
      );

      // Use the most up-to-date data if available, otherwise use the clicked query data
      setSelectedQuery(currentQueryData || query);
      setIsSheetOpen(true);
    },
    [researchData]
  );

  const scrollToView = useCallback(() => {
    if (!treeRef.current) return;

    // Reset both refs and state atomically
    const resetPosition = { x: 0, y: 0 };
    positionRef.current = resetPosition;
    setPosition(resetPosition);
    setScale(1);

    // Force visibility check after reset
    setTimeout(checkVisibility, 100);
  }, [checkVisibility]);

  return (
    <div
      ref={containerRef}
      className='min-h-screen bg-gray-50 dark:bg-gray-900 p-8 overflow-hidden relative'
      onMouseDown={handleMouseDown}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      <div className='max-w-none'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-8 pointer-events-none'>
          Research Progress
        </h1>

        {/* Query Tree */}
        <div
          ref={treeRef}
          className='query-tree-container'
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'all 0.1s ease-out',
            willChange: 'transform',
            transformOrigin: '0 0',
          }}
        >
          <QueryTree nodes={queryNodes} onQueryClick={handleQueryClick} />
        </div>

        {/* Scroll to View Button */}
        {showScrollButton && (
          <button
            onClick={scrollToView}
            className='fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg transition-all'
            style={{ zIndex: 50 }}
          >
            Reset View
          </button>
        )}

        {/* Query Details Sheet */}
        {selectedQuery && (
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <QuerySheet
              query={selectedQuery}
              isOpen={isSheetOpen}
              onOpenChange={setIsSheetOpen}
            />
          </Sheet>
        )}
      </div>
    </div>
  );
}
