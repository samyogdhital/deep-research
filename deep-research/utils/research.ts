/**
 * Calculates various query metrics for deep research at a specific depth level.
 * 
 * This function is crucial for determining:
 * 1. How many queries should be generated at the current depth
 * 2. How many child queries each parent query should generate
 * 3. Total number of queries across all depths up to the current depth
 * 
 * IMPORTANT CONCEPTS:
 * - At depth 1: Number of queries equals the initial breadth
 * - For deeper levels: Each parent generates Math.ceil(parent's queries_per_parent / 2) children
 * - queriesPerParent is NOT calculated using the total queries at previous depth
 *   but rather using the previous depth's queriesPerParent value
 * 
 * Example with depth=3, breadth=3:
 * Depth 1: 
 *   - totalQueriesAtDepth: 3 (initial breadth)
 *   - queriesPerParent: 3
 * 
 * Depth 2:
 *   - Each depth 1 query generates Math.ceil(3/2) = 2 children
 *   - totalQueriesAtDepth: 3 * 2 = 6
 *   - queriesPerParent: 2
 * 
 * Depth 3:
 *   - Each depth 2 query generates Math.ceil(2/2) = 1 child
 *   - totalQueriesAtDepth: 6 * 1 = 6
 *   - queriesPerParent: 1
 *   - Total queries across all depths: 3 + 6 + 6 = 15
 * 
 * @param totalDepth - Maximum depth of the research
 * @param initialBreadth - Number of queries at depth 1
 * @param currentDepth - The depth level we're calculating for
 * @returns Object containing:
 *   - totalQueriesAtDepth: Number of queries at current depth
 *   - queriesPerParent: Number of children each parent should generate
 *   - totalQueriesAcrossAllDepths: Sum of queries across all depths up to current
 */
// a function that gives you the number of queries to generate at a given depth given the resarch depth and breadth and current depth
export function calculateQueriesAtDepth(totalDepth: number, initialBreadth: number, currentDepth: number): {
    totalQueriesAtDepth: number;
    queriesPerParent: number;
    totalQueriesAcrossAllDepths: number;
} {
    if (currentDepth < 1 || currentDepth > totalDepth) {
        throw new Error('Current depth must be between 1 and total depth');
    }

    if (currentDepth === 1) {
        return {
            totalQueriesAtDepth: initialBreadth,
            queriesPerParent: initialBreadth,
            totalQueriesAcrossAllDepths: initialBreadth
        };
    }

    // First calculate queries at each depth level
    const queriesAtEachDepth: number[] = [initialBreadth]; // depth 1
    const queriesPerParentAtDepth: number[] = [initialBreadth]; // depth 1's queries per parent

    for (let depth = 2; depth <= currentDepth; depth++) {
        // Calculate queries per parent for this depth using previous depth's queries per parent
        const previousQueriesPerParent = queriesPerParentAtDepth[depth - 2];
        const currentQueriesPerParent = Math.ceil(previousQueriesPerParent / 2);
        queriesPerParentAtDepth.push(currentQueriesPerParent);

        // Calculate total queries at this depth
        // Each parent from previous depth generates currentQueriesPerParent children
        const totalQueriesAtThisDepth = queriesAtEachDepth[depth - 2] * currentQueriesPerParent;
        queriesAtEachDepth.push(totalQueriesAtThisDepth);
    }

    // Calculate total queries across all depths by summing up queriesAtEachDepth array
    const totalQueriesAcrossAllDepths = queriesAtEachDepth.reduce((sum, queries) => sum + queries, 0);

    return {
        totalQueriesAtDepth: queriesAtEachDepth[currentDepth - 1],
        queriesPerParent: queriesPerParentAtDepth[currentDepth - 1],
        totalQueriesAcrossAllDepths
    };
}

/**
 * COMMON MISCONCEPTIONS AND IMPORTANT NOTES:
 * 
 * 1. Parent Breadth Calculation:
 *    WRONG: Using total queries at previous depth to calculate children
 *    RIGHT: Use queriesPerParent from previous depth
 *    Example: At depth 3, we use depth 2's queriesPerParent (2), not its total queries (6)
 * 
 * 2. Total Queries Pattern:
 *    - For depth=3, breadth=3: Total 15 queries (3 + 6 + 6)
 *    - For depth=5, breadth=5: Total 110 queries (5 + 15 + 30 + 30 + 30)
 *    - Notice how queries at deeper levels may stabilize
 * 
 * 3. Arrays and Indexing:
 *    - queriesAtEachDepth[depth - 1] gives queries at current depth
 *    - queriesAtEachDepth[depth - 2] gives parent depth's queries
 *    - Arrays are 0-based, but depth is 1-based, hence the -1/-2 adjustments
 * 
 * 4. Use in Deep Research:
 *    - This function helps determine how many child queries to generate
 *    - Used when a parent query completes and needs to spawn children
 *    - Ensures consistent query distribution across the research tree
 */
