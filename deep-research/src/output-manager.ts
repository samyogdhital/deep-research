import { ResearchProgress } from './deep-research';

export class OutputManager {
  private logs: string[] = [];

  log(...args: any[]) {
    const logMessage = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');

    this.logs.push(logMessage);
    // Add console output back for debugging
    console.log(logMessage);
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
