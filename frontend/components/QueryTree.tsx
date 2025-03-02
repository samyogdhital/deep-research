import { useState } from 'react';
import type { SerpQuery } from '@deep-research/db/schema';
import { cn } from '@/lib/utils';

interface QueryNode {
  id: string;
  depth: number;
  rank: number;
  parentRank: number;
  children: QueryNode[];
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

  // Get max depth
  const maxDepth = Math.max(...Object.keys(nodesByDepth).map(Number));

  // Constants for layout
  const NODE_WIDTH = 120;
  const NODE_HEIGHT = 40;
  const LEVEL_HEIGHT = 100;
  const SVG_PADDING = 40;

  // Calculate total width needed
  const maxNodesInAnyLevel = Math.max(
    ...Object.values(nodesByDepth).map((level) => level.length)
  );
  const svgWidth = Math.max(1000, maxNodesInAnyLevel * (NODE_WIDTH + 40));
  const svgHeight = maxDepth * LEVEL_HEIGHT + 2 * SVG_PADDING;

  // Function to draw curved path between parent and child
  const drawPath = (
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) => {
    const midY = (startY + endY) / 2;
    return `M ${startX} ${startY} 
            C ${startX} ${midY},
              ${endX} ${midY},
              ${endX} ${endY}`;
  };

  return (
    <svg width={svgWidth} height={svgHeight} className='overflow-visible'>
      {/* Draw connections first so they appear behind nodes */}
      {Object.entries(nodesByDepth).map(([depth, depthNodes]) => {
        const currentDepth = parseInt(depth);
        if (currentDepth === maxDepth) return null;

        const y1 = (currentDepth - 1) * LEVEL_HEIGHT + SVG_PADDING;
        const y2 = currentDepth * LEVEL_HEIGHT + SVG_PADDING;
        const levelWidth = svgWidth / depthNodes.length;

        return depthNodes.map((node, i) => {
          const startX = (i + 0.5) * levelWidth;
          const nextLevelWidth =
            svgWidth / (nodesByDepth[currentDepth + 1]?.length || 1);

          return node.children.map((child, childIndex) => {
            const childNodeIndex = nodesByDepth[currentDepth + 1].findIndex(
              (n) => n.id === child.id
            );
            const endX = (childNodeIndex + 0.5) * nextLevelWidth;

            return (
              <path
                key={`${node.id}-${child.id}`}
                d={drawPath(
                  startX,
                  y1 + NODE_HEIGHT / 2,
                  endX,
                  y2 - NODE_HEIGHT / 2
                )}
                stroke='rgb(249 115 22 / 0.3)'
                strokeWidth={2}
                fill='none'
              />
            );
          });
        });
      })}

      {/* Draw nodes */}
      {Object.entries(nodesByDepth).map(([depth, depthNodes]) => {
        const y = (parseInt(depth) - 1) * LEVEL_HEIGHT + SVG_PADDING;
        const levelWidth = svgWidth / depthNodes.length;

        return depthNodes.map((node, i) => {
          const x = (i + 0.5) * levelWidth;

          return (
            <g
              key={node.id}
              transform={`translate(${x - NODE_WIDTH / 2}, ${y})`}
            >
              <foreignObject width={NODE_WIDTH} height={NODE_HEIGHT}>
                <button
                  onClick={() => node.data && onQueryClick(node.data)}
                  disabled={!node.isEnabled}
                  className={cn(
                    'w-full h-full rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center',
                    node.isEnabled
                      ? 'bg-orange-500 text-white hover:bg-orange-600 cursor-pointer'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {node.data?.query || `Query ${node.rank}`}
                </button>
              </foreignObject>
            </g>
          );
        });
      })}
    </svg>
  );
}
