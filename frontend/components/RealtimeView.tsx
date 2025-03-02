'use client';

import { useEffect, useState } from 'react';
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
  reportId: string;
}

export function RealtimeView({ reportId }: RealtimeViewProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [queryNodes, setQueryNodes] = useState<QueryNode[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<SerpQuery | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);

  // Initialize socket connection and handle events
  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to websocket');
    });

    // Handle initial data and tree setup
    socket.on('new_serp_query', (data: ResearchData) => {
      if (queryNodes.length === 0 && data.depth && data.breadth) {
        const initialNodes = generateQueryTree(data.depth, data.breadth);
        setQueryNodes(initialNodes);
      }
      updateNodesWithData(data.serpQueries);
      setResearchData(data);
    });

    // Handle website status updates
    socket.on('scraping_a_website', (data: ResearchData) => {
      updateNodesWithData(data.serpQueries);
      setResearchData(data);
    });

    socket.on('analyzing_a_website', (data: ResearchData) => {
      updateNodesWithData(data.serpQueries);
      setResearchData(data);
    });

    socket.on('analyzed_a_website', (data: ResearchData) => {
      updateNodesWithData(data.serpQueries);
      setResearchData(data);
    });

    // Handle research completion
    socket.on('report_writing_successfull', (data: ResearchData) => {
      window.location.href = `/report/${reportId}`;
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [reportId]);

  // Update nodes with incoming data
  const updateNodesWithData = (queries: SerpQuery[]) => {
    setQueryNodes((prev) => {
      const updated = [...prev];
      queries.forEach((query) => {
        const nodeIndex = updated.findIndex((n) => n.rank === query.query_rank);
        if (nodeIndex !== -1) {
          updated[nodeIndex] = {
            ...updated[nodeIndex],
            data: query,
            isEnabled: true,
          };
        }
      });
      return updated;
    });
  };

  const handleQueryClick = (query: SerpQuery) => {
    setSelectedQuery(query);
    setIsSheetOpen(true);
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 p-8'>
      <div className='max-w-7xl mx-auto'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-8'>
          Research Progress
        </h1>

        {/* Query Tree */}
        <div className='query-tree-container overflow-x-auto pb-8'>
          <QueryTree nodes={queryNodes} onQueryClick={handleQueryClick} />
        </div>

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
