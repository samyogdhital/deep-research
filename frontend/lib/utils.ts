import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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

export function generateQueryTree(depth: number, breadth: number) {
  const nodes: {
    id: string;
    depth: number;
    rank: number;
    parentRank: number;
    isEnabled: boolean;
  }[] = [];

  let currentRank = 1;
  let currentBreadth = breadth;
  let previousLevelStart = 0;
  let previousLevelEnd = 0;

  // Generate nodes for each depth level
  for (let d = 1; d <= depth; d++) {
    const levelStart = nodes.length;

    // Generate nodes for current breadth
    for (let b = 1; b <= currentBreadth; b++) {
      // For depth > 1, calculate parent rank
      let parentRank = 0;
      if (d > 1) {
        // Calculate parent index based on current position
        const parentIndex = Math.floor((currentRank - levelStart - 1) / 2) + previousLevelStart;
        parentRank = nodes[parentIndex]?.rank || 0;
      }

      nodes.push({
        id: `query-${d}-${currentRank}`,
        depth: d,
        rank: currentRank,
        parentRank,
        isEnabled: false
      });

      currentRank++;
    }

    // Update level tracking
    previousLevelStart = levelStart;
    previousLevelEnd = nodes.length - 1;

    // Update breadth for next level
    currentBreadth = Math.ceil(currentBreadth / 2);
  }

  return nodes;
}
