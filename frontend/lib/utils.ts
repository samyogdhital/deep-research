import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SerpQuery } from '@deep-research/db/schema';

interface QueryNode {
  id: string;
  depth: number;
  rank: number;
  parentRank: number;
  children: QueryNode[];
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
  let currentRank = 1;

  // Create first level
  const firstLevelNodes = Array.from({ length: breadth }, (_, i) => ({
    id: `1-${currentRank + i}`,
    depth: 1,
    rank: currentRank + i,
    parentRank: 0,
    children: [],
    isEnabled: false
  }));

  nodes.push(...firstLevelNodes);
  currentRank += breadth;

  // Generate subsequent levels
  let currentLevelNodes = firstLevelNodes;
  for (let d = 2; d <= depth; d++) {
    const nextLevelNodes: QueryNode[] = [];
    const breadthAtThisLevel = calculateBreadthAtLevel(breadth, d);

    currentLevelNodes.forEach(parentNode => {
      // Create children for this parent
      const children = Array.from({ length: breadthAtThisLevel }, (_, i) => {
        const node: QueryNode = {
          id: `${d}-${currentRank + i}`,
          depth: d,
          rank: currentRank + i,
          parentRank: parentNode.rank,
          children: [],
          isEnabled: false
        };
        nextLevelNodes.push(node);
        return node;
      });

      parentNode.children = children;
      currentRank += breadthAtThisLevel;
    });

    nodes.push(...nextLevelNodes);
    currentLevelNodes = nextLevelNodes;
  }

  return nodes;
}
