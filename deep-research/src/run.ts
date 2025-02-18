import * as fs from 'fs/promises';
import { deepResearch, writeFinalReport } from './deep-research';
import { generateFeedback } from './feedback';
import { OutputManager } from './output-manager';

const output = new OutputManager();

// Helper function for logging
function log(...args: any[]) {
  output.log(...args);
}

async function run() {
  try {
    log("Starting research process...");

    // 1. Default values for testing
    const initialQuery = "Space based manufacturing?";
    const breadth = 2;
    const depth = 2;

    log("Generating follow-up questions...");

    // 2. Generate follow-up questions
    const followUpQuestions = await generateFeedback({
      query: initialQuery,
      numQuestions: 5,
      model: 'gemini-2.0-flash'
    }).catch(error => {
      log("Error generating feedback:", error);
      throw error;
    });

    // 3. Hardcoded answers for testing
    const questionAnswers = followUpQuestions.map(q => ({
      question: q,
      answer: "Sample answer for testing" // In production, get from user input
    }));

    // 4. Combine for context
    const fullResearchContext = `
Initial Query: ${initialQuery}

Follow-up Questions and Answers:
${questionAnswers.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}
`;

    // 5. Start research
    // Still use onProgress for logging purposes
    const result = await deepResearch({
      query_to_find_websites: fullResearchContext,
      breadth,
      depth,
      onProgress: (progress) => {
        output.updateProgress(progress);
      },
    });

    // 6. Generate final report
    const report = await writeFinalReport({
      prompt: fullResearchContext,
      learnings: result.learnings,
      visitedUrls: result.visitedUrls
    });

    // Save outputs
    await fs.writeFile('output.md', report);
    await fs.writeFile('sources.json', JSON.stringify(
      result.learnings.map(l => ({
        learning: l.content,
        source: l.sourceUrl,
        quote: l.sourceText
      })),
      null,
      2
    ));

    // Save debug logs
    await output.saveLogs();

    log('Complete! Check:');
    log('- output.md for the final report');
    log('- sources.json for source mappings');
    log('- research_debug.log for detailed logs');
  } catch (error) {
    log("Fatal error in research process:", error);
    // Write error to log file before exiting
    await output.saveLogs('error.log').catch(console.error);
    throw error;
  }
}

// Add more detailed error handling to the main execution
run().catch(error => {
  console.error("Application error:", error);
  output.log("Application failed:", error);
  output.saveLogs('error.log').finally(() => {
    process.exit(1);
  });
});

/* PRODUCTION VERSION (uncomment when ready for user input)
async function run() {
  // Get user input via API/frontend
  const initialQuery = await getUserQuery();
  const breadth = await getResearchBreadth();
  const depth = await getResearchDepth();

  // Generate and get answers to follow-up questions
  const followUpQuestions = await generateFeedback({...});
  const questionAnswers = await getQuestionAnswers(followUpQuestions);

  // Rest of the research process
  ...
}
*/