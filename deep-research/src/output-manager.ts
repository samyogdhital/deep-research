import { ResearchProgress } from './deep-research';

export class OutputManager {
  private logs: string[] = [];
  private broadcastFn?: (message: string) => void;

  constructor(broadcastFn?: (message: string) => void) {
    this.broadcastFn = broadcastFn;
  }

  log(...args: any[]) {
    const logMessage = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');

    this.logs.push(logMessage);
    console.log(logMessage);

    if (this.broadcastFn) {
      this.broadcastFn(logMessage); // This will emit to frontend
    }
  }

  updateProgress(progress: ResearchProgress) {
    // Just log the progress instead of showing in terminal
    this.log('Research Progress:', {
      depth: `${progress.currentDepth}/${progress.totalDepth}`,
      queries: `${progress.completedQueries}/${progress.totalQueries}`,
      websitesAnalyzed: progress.analyzedWebsites || 0,
      currentQuery: progress.currentQuery
    });
  }

  async saveLogs(filename: string = 'research_debug.log') {
    const fs = require('fs');
    await fs.promises.writeFile(filename, this.logs.join('\n'));
  }
}
