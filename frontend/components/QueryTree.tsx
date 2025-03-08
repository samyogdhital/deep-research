import { useState } from 'react';
import type { SerpQuery } from '@deep-research/db/schema';
import { cn } from '@/lib/utils';
import { Sheet } from '@/components/ui/sheet';
import { QuerySheet } from '@/components/QuerySheet';
import { BsCircle, BsCheckCircleFill } from 'react-icons/bs';
import { CgSpinner } from 'react-icons/cg';
import { DBSchema } from '@deep-research/db';

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

interface QueryTreeProps {
  nodes: QueryNode[];
  onQueryClick: (query: SerpQuery, e: React.MouseEvent) => void;
  onQueryClickEnd: (query: SerpQuery, e: React.MouseEvent) => void;
  isInteractionDisabled?: boolean;
  reportStatus?: 'no-start' | 'in-progress' | 'completed' | 'failed';
}

export function QueryTree({
  nodes,
  onQueryClick,
  onQueryClickEnd,
  isInteractionDisabled = false,
  reportStatus = 'no-start',
}: QueryTreeProps) {
  // Constants for layout
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 50;
  const LEVEL_HEIGHT = 170;
  const SVG_PADDING = 50;
  const REPORT_NODE_MARGIN = 100; // Added margin for report node
  const MIN_NODE_SPACING = 70;

  // Helper function to truncate query text
  const truncateQuery = (query: string) => {
    const words = query.trim().split(/\s+/);
    return words.length > 3 ? words.slice(0, 4).join(' ') + '...' : query;
  };

  // Create a map of parent to children relationships
  const childrenMap = nodes.reduce((acc, node) => {
    if (node.parentTimestamp !== 0) {
      const parentNode = nodes.find(
        (n) => n.timestamp === node.parentTimestamp
      );
      if (parentNode) {
        acc[parentNode.timestamp] = acc[parentNode.timestamp] || [];
        acc[parentNode.timestamp].push(node);
      }
    }
    return acc;
  }, {} as Record<number, QueryNode[]>);

  // Group nodes by depth level
  const nodesByDepth = nodes.reduce((acc, node) => {
    acc[node.depth] = acc[node.depth] || [];
    acc[node.depth].push(node);
    return acc;
  }, {} as Record<number, QueryNode[]>);

  // Calculate dimensions
  const maxDepth = Math.max(...Object.keys(nodesByDepth).map(Number));
  const maxNodesInLevel = Math.max(
    ...Object.values(nodesByDepth).map((level) => level.length)
  );
  const levelWidth = maxNodesInLevel * (NODE_WIDTH + MIN_NODE_SPACING);
  const svgWidth = Math.max(1200, levelWidth + 2 * SVG_PADDING);
  const svgHeight = (maxDepth + 1) * LEVEL_HEIGHT + 2 * SVG_PADDING;

  // Calculate node positions with centered children
  const getNodePosition = (node: QueryNode) => {
    const nodesInLevel = nodesByDepth[node.depth];
    const nodeIndex = nodesInLevel.findIndex(
      (n) => n.timestamp === node.timestamp
    );

    // For root nodes or nodes without siblings, center in their section
    const sectionWidth = svgWidth / nodesInLevel.length;
    const baseX = nodeIndex * sectionWidth + sectionWidth / 2;

    // If this node has children, adjust position to center over them
    const children = childrenMap[node.timestamp] || [];
    if (children.length > 0) {
      const childrenPositions = children.map((child) => {
        const childLevel = nodesByDepth[child.depth];
        const childIndex = childLevel.findIndex(
          (n) => n.timestamp === child.timestamp
        );
        const childSectionWidth = svgWidth / childLevel.length;
        return childIndex * childSectionWidth + childSectionWidth / 2;
      });

      // Center parent over the middle of its children's span
      const minChildX = Math.min(...childrenPositions);
      const maxChildX = Math.max(...childrenPositions);
      return {
        x: minChildX + (maxChildX - minChildX) / 2,
        y: node.depth * LEVEL_HEIGHT + SVG_PADDING,
      };
    }

    return {
      x: baseX,
      y: node.depth * LEVEL_HEIGHT + SVG_PADDING,
    };
  };

  // Curved path between nodes with precise edge connections
  const drawPath = (
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) => {
    const startPoint = {
      x: startX,
      y: startY + NODE_HEIGHT, // Bottom edge of parent
    };
    const endPoint = {
      x: endX,
      y: endY, // Top edge of child
    };

    // Calculate control points for a smooth curve
    const distance = endPoint.y - startPoint.y;
    const controlPoint1 = {
      x: startPoint.x,
      y: startPoint.y + distance * 0.4, // Increased from 0.2 to 0.4 for smoother curve
    };
    const controlPoint2 = {
      x: endPoint.x,
      y: endPoint.y - distance * 0.4, // Increased from 0.2 to 0.4 for smoother curve
    };

    return `M ${startPoint.x} ${startPoint.y}
            C ${controlPoint1.x} ${controlPoint1.y},
              ${controlPoint2.x} ${controlPoint2.y},
              ${endPoint.x} ${endPoint.y}`;
  };

  // Get max depth to position report node
  const reportNodeY =
    (maxDepth + 1) * LEVEL_HEIGHT + SVG_PADDING + REPORT_NODE_MARGIN;

  // Get report node status info
  const getReportNodeInfo = () => {
    switch (reportStatus) {
      case 'in-progress':
        return {
          title: 'Writing Report...',
          icon: <CgSpinner className='w-6 h-6 animate-spin' />,
          className:
            'bg-orange-500 text-white cursor-wait transition-all duration-300',
        };
      case 'completed':
        return {
          title: 'Report Generated',
          icon: <BsCheckCircleFill className='w-5 h-5' />,
          className:
            'bg-green-500 text-white cursor-pointer hover:bg-green-600 transition-all duration-300',
        };
      case 'failed':
        return {
          title: 'Report Failed',
          icon: <BsCircle className='w-5 h-5' />,
          className:
            'bg-red-500 text-white cursor-not-allowed transition-all duration-300',
        };
      default:
        return {
          title: 'Report',
          icon: null,
          className:
            'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed transition-all duration-300',
        };
    }
  };

  const reportInfo = getReportNodeInfo();

  // Get leaf nodes (nodes without children)
  const leafNodes = nodes.filter(
    (node) => !nodes.some((n) => n.parentTimestamp === node.timestamp)
  );

  return (
    <div className='w-full h-full flex items-center justify-center'>
      <svg
        width={svgWidth}
        height={svgHeight + NODE_HEIGHT + REPORT_NODE_MARGIN * 2}
        className='overflow-visible'
        style={{ pointerEvents: isInteractionDisabled ? 'none' : 'auto' }}
      >
        {/* Draw connections */}
        {nodes.map((node) => {
          if (node.parentTimestamp === 0) return null;

          const parent = nodes.find(
            (n) => n.timestamp === node.parentTimestamp
          );
          if (!parent) return null;

          const parentPos = getNodePosition(parent);
          const childPos = getNodePosition(node);

          return (
            <g key={`connection-${node.timestamp}`}>
              <path
                d={drawPath(parentPos.x, parentPos.y, childPos.x, childPos.y)}
                stroke='rgb(249 115 22 / 0.3)'
                strokeWidth={5}
                fill='none'
              />
              <circle
                cx={parentPos.x}
                cy={parentPos.y + NODE_HEIGHT}
                r={8}
                fill='rgb(249 115 22 / 0.3)'
              />
              <circle
                cx={childPos.x}
                cy={childPos.y}
                r={8}
                fill='rgb(249 115 22 / 0.3)'
              />
            </g>
          );
        })}

        {/* Draw nodes */}
        {nodes.map((node) => {
          const { x, y } = getNodePosition(node);
          const hasData = !!node.data;

          return (
            <g
              key={`node-${node.timestamp}`}
              transform={`translate(${x - NODE_WIDTH / 2}, ${y})`}
            >
              <foreignObject width={NODE_WIDTH} height={NODE_HEIGHT}>
                <button
                  onMouseDown={(e) => hasData && onQueryClick(node.data!, e)}
                  onMouseUp={(e) => hasData && onQueryClickEnd(node.data!, e)}
                  disabled={!hasData || isInteractionDisabled}
                  className={cn(
                    'w-full h-full rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center px-3',
                    hasData
                      ? isInteractionDisabled
                        ? 'bg-orange-400 text-white cursor-default'
                        : 'bg-orange-500 text-white hover:bg-orange-600 cursor-pointer'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {node.data
                    ? truncateQuery(node.data.query)
                    : `Query ${node.queryNumber}`}
                </button>
              </foreignObject>
            </g>
          );
        })}

        {/* Report Node */}
        <g
          transform={`translate(${
            svgWidth / 2 - NODE_WIDTH / 2
          }, ${reportNodeY})`}
        >
          <foreignObject width={NODE_WIDTH} height={NODE_HEIGHT}>
            <div
              className={cn(
                'w-full h-full rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 px-3',
                reportInfo.className,
                reportStatus === 'completed' &&
                  'cursor-pointer hover:opacity-90'
              )}
              onClick={() => {
                if (reportStatus === 'completed') {
                  const reportId = window.location.pathname.split('/').pop();
                  window.location.href = `/report/${reportId}`;
                }
              }}
            >
              {reportInfo.icon}
              <span>{reportInfo.title}</span>
            </div>
          </foreignObject>
        </g>

        {/* Connections to Report Node */}
        {leafNodes.map((leafNode) => {
          const leafPos = getNodePosition(leafNode);
          const reportX = svgWidth / 2;

          // Calculate midpoint Y for smoother curve
          const midY = leafPos.y + (reportNodeY - leafPos.y) * 0.5;

          return (
            <path
              key={`report-connection-${leafNode.timestamp}`}
              d={`M ${leafPos.x} ${leafPos.y + NODE_HEIGHT} 
                  C ${leafPos.x} ${midY},
                    ${reportX} ${midY},
                    ${reportX} ${reportNodeY}`}
              stroke='rgb(249 115 22 / 0.2)'
              strokeWidth={4}
              fill='none'
            />
          );
        })}
      </svg>
    </div>
  );
}
