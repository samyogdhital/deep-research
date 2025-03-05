'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { generateQueryTree } from '@/lib/utils';
import { QueryTree } from '@/components/QueryTree';
import { QuerySheet } from '@/components/QuerySheet';
import type { ResearchData, SerpQuery } from '@deep-research/db/schema';

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
}

export function RealtimeView({ initialData }: RealtimeViewProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
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

  // Core state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.8);
  const [showResetButton, setShowResetButton] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

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
    socket.on('new_serp_query', handleData);
    socket.on('scraping_a_website', handleData);
    socket.on('analyzing_a_website', handleData);
    socket.on('analyzed_a_website', handleData);
    socket.on('report_writing_successfull', (data: ResearchData) => {
      window.location.href = `/report/${initialData.report_id}`;
    });

    setSocket(socket);
    return () => {
      socket.disconnect();
    };
  }, []);

  const updateNodesWithData = useCallback((queries: SerpQuery[]) => {
    setQueryNodes((prev) => {
      const updated = [...prev];
      queries.forEach((query, index) => {
        if (updated[index]) {
          updated[index] = { ...updated[index], data: query, isEnabled: true };
        }
      });
      return updated;
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className='min-h-screen bg-gray-50 dark:bg-gray-900 relative'
      onMouseDown={handleMouseDown}
      style={{
        cursor: isDragging ? 'grabbing' : selectedQuery ? 'auto' : 'grab',
        userSelect: selectedQuery ? 'text' : 'none',
        overflow: 'hidden',
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
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
          isInteractionDisabled={false}
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
        <QuerySheet query={selectedQuery} onOpenChange={handleSheetChange} />
      )}
    </div>
  );
}
