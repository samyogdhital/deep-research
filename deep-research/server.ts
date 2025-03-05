import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { deepResearch } from './src/deep-research';
import { ResearchDB } from './src/db';
import { generateFollowUps } from './src/agent/prompt-analyzer';
import { ReportWriter } from './src/agent/report-writer';
import { WebSocketManager, ResearchState } from './src/websocket';
import { config as envConfig } from 'dotenv';
import { ResearchProgress, DeepResearchOptions, WebsiteResult, CrunchedInfo, QueryData } from './src/types';
import { SerpQuery } from './src/db/schema';
import crypto from 'crypto';
import type { DBSchema } from './src/db';

envConfig();
const app = express();
const httpServer = createServer(app);

// Initialize managers
const wsManager = new WebSocketManager(httpServer, process.env.FRONTEND_BASE_URL!);

// Express middleware
app.use(cors({
    origin: "*",// process.env.FRONTEND_BASE_URL,
    credentials: true
}));
app.use(express.json({
    strict: true,
    limit: '10mb',
    type: 'application/json'
}));

// API Routes
app.post('/api/research/questions', async (req: Request, res: Response): Promise<void> => {
    const { prompt = '', followupQuestions = 5 } = req.body;
    try {
        if (!prompt.trim()) {
            res.status(400).json({ error: 'Prompt is required' });
            return;
        }

        // Initialize research in database first with a new report_id
        const db = await ResearchDB.getInstance();
        const report_id = await db.initializeResearch(prompt, 1, 1, followupQuestions);

        // Generate follow-up questions
        const questions = await generateFollowUps({
            query: prompt,
            numQuestions: followupQuestions
        });

        // Save the generated questions with empty answers
        for (let i = 0; i < questions.length; i++) {
            await db.addFollowUpQnA(report_id, {
                id: i + 1,
                question: questions[i] || '',
                answer: ''
            });
        }

        // Return both questions and report_id
        res.json({ questions, report_id });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            error: 'Failed to analyze prompt',
            details: errorMessage
        });
    }
});

app.post('/api/research/start', async (req: Request, res: Response): Promise<void> => {
    try {
        const { initial_query, depth, breadth, report_id: provided_report_id, followUpAnswers } = req.body;

        // Input validation
        if (!initial_query?.trim()) {
            res.status(400).json({ error: 'Initial query is required' });
            return;
        }

        if (depth < 1 || depth > 10 || breadth < 1 || breadth > 10) {
            res.status(400).json({ error: 'Invalid depth or breadth values. Must be between 1 and 10.' });
            return;
        }

        const db = await ResearchDB.getInstance();
        let report_id: string;

        if (provided_report_id) {
            // Check if research exists
            const existingResearch = await db.getResearchData(provided_report_id);
            if (!existingResearch) {
                res.status(404).json({ error: 'Research not found' });
                return;
            }
            report_id = provided_report_id;

            // Update research parameters
            await db.updateResearchParameters(report_id, {
                depth,
                breadth,
                followUps_num: Object.keys(followUpAnswers || {}).length
            });
        } else {
            // Initialize new research
            report_id = await db.initializeResearch(
                initial_query,
                depth,
                breadth,
                Object.keys(followUpAnswers || {}).length
            );
        }

        // Save follow-up QnA
        if (followUpAnswers) {
            for (const [question, answer] of Object.entries(followUpAnswers)) {
                await db.addFollowUpQnA(report_id, {
                    id: Date.now(),
                    question,
                    answer: answer as string
                });
            }
        }

        // Start research process
        const controller = new AbortController();
        const research: ResearchState = {
            id: report_id,
            prompt: initial_query,
            status: 'collecting',
            startTime: Date.now(),
            controller,
            cleanup: () => {
                controller.abort();
                research.status = 'failed';
            }
        };

        // Notify frontend that research has started
        await wsManager.handleResearchStart(research);

        try {
            // Start deep research process
            await deepResearch({
                query_to_find_websites: initial_query,
                depth,
                breadth,
                researchId: report_id,
                wsManager,
                signal: controller.signal
            });

            // Get fresh data before report generation
            const freshResearchData = await db.getResearchData(report_id);
            if (!freshResearchData) {
                throw new Error('Research data not found when trying to generate report');
            }

            // Start report generation
            research.status = 'generating';
            await wsManager.handleReportWritingStart(report_id);

            const reportWriter = new ReportWriter();
            const report = await reportWriter.generateReport({
                db_research_data: freshResearchData
            });

            // Save report
            await db.saveReport({
                report_id,
                title: report.title,
                sections: report.sections,
                citedUrls: report.citedUrls,
                isVisited: false,
                timestamp: Date.now()
            });

            // Update research status and notify frontend
            research.status = 'complete';
            await wsManager.handleReportWritingComplete(report_id);

            // Return final research data
            res.json(await db.getResearchData(report_id));

        } catch (error) {
            console.error('Error in research:', error);
            research.status = 'failed';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            wsManager.handleResearchError(new Error(errorMessage));
            res.status(500).json({
                error: 'Research failed',
                details: errorMessage
            });
        } finally {
            if (research.cleanup) {
                research.cleanup();
            }
        }

    } catch (error) {
        console.error('Error in research:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        wsManager.handleResearchError(new Error(errorMessage));
        res.status(500).json({
            error: 'Research failed',
            details: errorMessage
        });
    }
});

app.get('/api/reports', async (req: Request, res: Response) => {
    const db = await ResearchDB.getInstance();
    const researches = await db.getAllReports();
    res.json(researches);
});

// Get a single report by ID
app.get('/api/reports/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Report ID is required' });
        return;
    }

    const db = await ResearchDB.getInstance();
    const research = await db.getResearchData(id);

    if (!research) {
        res.status(404).json({ error: 'Research not found' });
        return;
    }

    res.json(research);
});

// Mark a report as visited
app.patch('/api/reports/:id/visit', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Report ID is required' });
        return;
    }

    const db = await ResearchDB.getInstance();
    const success = await db.markReportAsVisited(id);

    if (!success) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }

    res.json({ success: true });
});

// Update report title
app.patch('/api/reports/:id/title', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title } = req.body;

    if (!id || !title?.trim()) {
        res.status(400).json({ error: 'Report ID and title are required' });
        return;
    }

    const db = await ResearchDB.getInstance();
    const success = await db.updateReportTitle(id, title);

    if (!success) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }

    res.json({ success: true });
});

// Delete a single report
app.delete('/api/reports/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Report ID is required' });
        return;
    }

    const db = await ResearchDB.getInstance();
    const success = await db.deleteReport(id);

    if (!success) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }

    res.json({ success: true });
});

// Clear all reports
app.delete('/api/reports', async (req: Request, res: Response) => {
    const db = await ResearchDB.getInstance();
    const success = await db.clearAllReports();
    res.json({ success });
});

// Resume research check endpoint
app.post('/api/resume', async (req: Request, res: Response): Promise<void> => {
    try {
        const { report_id } = req.body;
        if (!report_id) {
            res.status(400).json({ error: 'Report ID is required' });
            return;
        }

        const db = await ResearchDB.getInstance();
        const research = await db.getResearchData(report_id);

        if (!research) {
            res.status(404).json({ error: 'Research not found' });
            return;
        }

        // Find last successful state
        const lastSuccessfulState = {
            depth: 0,
            queryTimestamp: 0,
            context: ''
        };

        // Sort queries by depth and rank to find the latest successful one
        const sortedQueries = research.serpQueries.sort((a, b) =>
            (b.depth_level - a.depth_level) || (b.query_timestamp - a.query_timestamp)
        );

        // Find last successful query and build context
        const successfulQueries = sortedQueries.filter(q =>
            q.successful_scraped_websites.some(w => w.status === 'analyzed')
        );

        if (successfulQueries.length > 0) {
            const lastQuery = successfulQueries[0];
            if (lastQuery) {  // Extra safety check
                lastSuccessfulState.depth = lastQuery.depth_level;
                lastSuccessfulState.queryTimestamp = lastQuery.query_timestamp;

                // Build context from all successful queries up to this depth
                lastSuccessfulState.context = research.serpQueries
                    .filter(q => q.depth_level <= lastQuery.depth_level)
                    .flatMap(q => q.successful_scraped_websites
                        .filter(w => w.status === 'analyzed')
                        .flatMap(w => w.core_content)
                    ).join('\n');
            }
        }

        // Calculate expected total queries based on depth and breadth
        let totalExpectedQueries = research.breadth; // Initial depth queries
        let currentBreadth = research.breadth;

        // Calculate for each depth level
        for (let depth = 2; depth <= research.depth; depth++) {
            currentBreadth = Math.ceil(currentBreadth / 2);
            const queriesAtThisDepth = (totalExpectedQueries * currentBreadth);
            totalExpectedQueries += queriesAtThisDepth;
        }

        // Check if research is complete
        const currentQueries = research.serpQueries.length;
        const canResume = currentQueries < totalExpectedQueries;

        res.json({
            can_resume: canResume,
            current_queries: currentQueries,
            expected_queries: totalExpectedQueries,
            last_successful_state: lastSuccessfulState,
            depth: research.depth,
            breadth: research.breadth
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            error: 'Failed to check resume status',
            details: errorMessage
        });
    }
});

// `npm run debug -- 1001` to debug
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// `