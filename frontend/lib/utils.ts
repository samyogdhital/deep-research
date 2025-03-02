import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SerpQuery } from '@deep-research/db/schema';

interface QueryNode {
  id: string;
  depth: number;
  timestamp: number;
  parentTimestamp: number;
  children: QueryNode[];
  queryNumber: number;
  data?: SerpQuery;
  isEnabled: boolean;
  x?: number; // For positioning
  y?: number;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateTotalQueries(depth: number, breadth: number): number {
  let totalQueries = breadth; // Initial depth queries
  let currentBreadth = breadth;

  // Calculate for each depth level
  for (let d = 2; d <= depth; d++) {
    currentBreadth = Math.ceil(currentBreadth / 2);
    totalQueries += (totalQueries * currentBreadth);
  }

  return totalQueries;
}

// Calculate breadth at each depth level
function calculateBreadthAtLevel(initialBreadth: number, currentDepth: number) {
  let breadth = initialBreadth;
  for (let i = 1; i < currentDepth; i++) {
    breadth = Math.ceil(breadth / 2);
  }
  return breadth;
}

export function generateQueryTree(depth: number, breadth: number) {
  const nodes: QueryNode[] = [];
  let currentTimestamp = Date.now();
  let queryCounter = 1;

  // Create first level
  const firstLevelNodes = Array.from({ length: breadth }, (_, i) => ({
    id: `1-${i + 1}`,
    depth: 1,
    timestamp: currentTimestamp + i,
    parentTimestamp: 0,
    children: [] as QueryNode[],
    queryNumber: queryCounter++,
    isEnabled: false
  }));

  nodes.push(...firstLevelNodes);
  currentTimestamp += breadth;

  // Generate subsequent levels
  let currentLevelNodes = firstLevelNodes;
  for (let d = 2; d <= depth; d++) {
    const nextLevelNodes: QueryNode[] = [];
    const breadthAtThisLevel = calculateBreadthAtLevel(breadth, d);

    currentLevelNodes.forEach(parentNode => {
      // Create children for this parent
      const children = Array.from({ length: breadthAtThisLevel }, (_, i) => {
        const node: QueryNode = {
          id: `${d}-${i + 1}`,
          depth: d,
          timestamp: currentTimestamp + i,
          parentTimestamp: parentNode.timestamp,
          children: [] as QueryNode[],
          queryNumber: queryCounter++,
          isEnabled: false
        };
        nextLevelNodes.push(node);
        return node;
      });

      parentNode.children = children;
      currentTimestamp += breadthAtThisLevel;
    });

    nodes.push(...nextLevelNodes);
    currentLevelNodes = nextLevelNodes;
  }

  return nodes;
}
