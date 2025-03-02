import { useState } from 'react';
import type { SerpQuery } from '@deep-research/db/schema';
import { cn } from '@/lib/utils';

interface QueryNode {
  id: string;
  depth: number;
  rank: number;
  parentRank: number;
  data?: SerpQuery;
  isEnabled: boolean;
}

interface QueryTreeProps {
  nodes: QueryNode[];
  onQueryClick: (query: SerpQuery) => void;
}

export function QueryTree({ nodes, onQueryClick }: QueryTreeProps) {
  // Group nodes by depth level
  const nodesByDepth = nodes.reduce((acc, node) => {
    acc[node.depth] = acc[node.depth] || [];
    acc[node.depth].push(node);
    return acc;
  }, {} as Record<number, QueryNode[]>);

  const maxDepth = Math.max(...Object.keys(nodesByDepth).map(Number));

  return (
    <div className='relative'>
      {Object.entries(nodesByDepth).map(([depth, depthNodes]) => (
        <div
          key={depth}
          className={cn(
            'flex items-center justify-center gap-4 mb-12',
            'relative'
          )}
        >
          {depthNodes.map((node) => (
            <div key={node.id} className='relative'>
              {/* Draw connection line to parent */}
              {node.parentRank > 0 && (
                <div
                  className='absolute w-px bg-gray-300 dark:bg-gray-700 transform origin-top'
                  style={{
                    top: '-48px', // Adjust based on your layout
                    left: '50%',
                    height: '48px',
                  }}
                />
              )}

              {/* Query Node */}
              <button
                onClick={() => node.data && onQueryClick(node.data)}
                disabled={!node.isEnabled}
                className={cn(
                  'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  'border-2',
                  node.isEnabled
                    ? 'border-[#007e81] bg-white dark:bg-[#202121] text-gray-900 dark:text-white hover:bg-[#007e81] hover:text-white cursor-pointer'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed',
                  'min-w-[200px] text-center'
                )}
              >
                <span className='block truncate'>
                  {node.data?.query || `Query ${node.rank}`}
                </span>
                {node.data && (
                  <span className='text-xs text-gray-500 dark:text-gray-400 block truncate mt-1'>
                    {node.data.objective}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
