import express, { Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { deepResearch } from './src/deep-research';
import { ResearchDB } from './src/db/db';
import { generateFollowUps } from './src/agent/prompt-analyzer';
import { ReportWriter } from './src/agent/report-writer';
import { WebSocketManager } from './src/websocket';
import { config as envConfig } from 'dotenv';
import { DBSchema } from './src/db/db';
import { SerpQuery } from './src/db/schema';

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
        const { questions, title: reportTitle } = await generateFollowUps({
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

        // Save the report title
        console.log("🔃🔃", `Report Title: ${reportTitle}`);
        await db.addReportTitle(report_id, reportTitle);

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
        const { initial_query, depth, breadth, report_id: provided_report_id, followUpAnswers, is_deep_research } = req.body;

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

            // Update followup answers
            if (followUpAnswers && existingResearch.followUps_QnA) {
                for (const qa of existingResearch.followUps_QnA) {
                    if (followUpAnswers[qa.question]) {
                        await db.updateFollowUpAnswer(report_id, {
                            ...qa,
                            answer: followUpAnswers[qa.question]
                        });
                    }
                }
            }
        } else {
            // Initialize new research
            report_id = await db.initializeResearch(
                initial_query,
                depth,
                breadth,
                Object.keys(followUpAnswers || {}).length
            );

            // Update followup answers for the newly created research
            if (followUpAnswers) {
                const existingQnA = (await db.getResearchData(report_id))?.followUps_QnA || [];
                for (const qa of existingQnA) {
                    if (followUpAnswers[qa.question]) {
                        await db.updateFollowUpAnswer(report_id, {
                            ...qa,
                            answer: followUpAnswers[qa.question]
                        });
                    }
                }
            }
        }

        // const research = await db.getResearchData(report_id);
        // if (!research) {
        //     throw new Error('Research not found');
        // }

        // Calculate if all SERP queries are complete
        // let totalExpectedQueries = breadth;
        // let currentBreadth = breadth;
        // for (let depth = 2; depth <= this.depth; depth++) {
        //     currentBreadth = Math.ceil(currentBreadth / 2);
        //     totalExpectedQueries += (totalExpectedQueries * currentBreadth);
        // }

        // const completedQueries = research.serpQueries.filter(q =>
        //     q.successful_scraped_websites.some(w => w.status === 'analyzed')
        // ).length;


        try {
            // Get fresh data and verify ALL queries at ALL depths are complete
            let freshResearchData = await db.getResearchData(report_id);
            if (!freshResearchData) {
                throw new Error('Research data not found when trying to generate report');
            }

            // Notify frontend that research is starting
            await wsManager.handleResearchStart(report_id);

            // Start the deep research process - this will now wait for ALL queries at ALL depths to complete
            await deepResearch(report_id, Boolean(is_deep_research), wsManager);

            // Get the updated research data after all queries have completed
            freshResearchData = await db.getResearchData(report_id);
            if (!freshResearchData) {
                throw new Error('Research data not found after deep research');
            }

            // Start report generation only when ALL queries at ALL depths are complete
            await wsManager.handleReportWritingStart(report_id);

            // Set initial report status to in-progress
            await db.saveReport(report_id, {
                title: freshResearchData.report?.title || '',
                // sections: [],
                // citedUrls: [],
                content: '',
                isVisited: false,
                timestamp: Date.now(),
                status: 'in-progress'
            });

            const reportWriter = new ReportWriter();
            const reportContent = await reportWriter.generateReport({
                db_research_data: freshResearchData,
                wsManager: wsManager
            });

            // Save completed report
            await db.saveReport(report_id, {
                title: freshResearchData.report?.title || '',
                // sections: report.sections,
                // citedUrls: report.citedUrls,
                content: reportContent,
                isVisited: false,
                timestamp: Date.now(),
                status: 'completed'
            });

            // Update research status and notify frontend
            await wsManager.handleReportWritingComplete(report_id);

            // Return final research data
            res.json(await db.getResearchData(report_id));

        } catch (error) {
            console.error('Error in research:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Set report status to failed in database
            const db = await ResearchDB.getInstance();
            await db.saveReport(report_id, {
                title: (await db.getResearchData(report_id))?.report.title || 'Failed Report',
                // sections: [],
                // citedUrls: [],
                content: '',
                isVisited: false,
                timestamp: Date.now(),
                status: 'failed'
            });

            // Notify clients about the failure
            wsManager.handleResearchError(new Error(errorMessage), report_id);

            res.status(500).json({
                error: 'Research failed',
                details: errorMessage
            });
        }
    } catch (error) {
        console.error('Error in research:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // For initialization errors, we don't have a report_id yet
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
    const research = await db.getResearchData(id) as DBSchema['researches'][number];

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
    // Notify all the clients with empty array of active researches.
    wsManager.clearAllActiveResearches();

    // Clear all reports from the db
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

        // Calculate total expected queries based on depth and breadth
        let totalExpectedQueries = research.breadth;
        let currentBreadth = research.breadth;
        for (let depth = 2; depth <= research.depth; depth++) {
            currentBreadth = Math.ceil(currentBreadth / 2);
            totalExpectedQueries += (research.breadth * currentBreadth);
        }

        // Find the last depth level that has any failed or in-progress queries
        let lastIncompleteDepth = 1;
        const incompleteQueries = research.serpQueries.filter(q =>
            q.stage === 'failed' ||
            q.stage === 'in-progress' ||
            q.successful_scraped_websites.some(w => w.status !== 'analyzed')
        );

        if (incompleteQueries.length > 0) {
            lastIncompleteDepth = Math.max(...incompleteQueries.map(q => q.depth_level));
        }

        // For each depth level up to lastIncompleteDepth
        for (let depth = 1; depth <= lastIncompleteDepth; depth++) {
            const queriesAtDepth = research.serpQueries.filter(q => q.depth_level === depth);
            const expectedQueriesAtDepth = depth === 1 ? research.breadth :
                Math.ceil(research.breadth / Math.pow(2, depth - 1));

            // If we don't have enough queries at this depth, generate more
            if (queriesAtDepth.length < expectedQueriesAtDepth) {
                await wsManager.handleResearchStart(report_id);
                await deepResearch(report_id, true, wsManager);
                res.json({ status: 'resumed', message: 'Research resumed successfully' });
                return;
            }

            // Check each query at this depth
            for (const query of queriesAtDepth) {
                // If query is failed or has failed/in-progress websites
                if (query.stage === 'failed' ||
                    query.stage === 'in-progress' ||
                    query.successful_scraped_websites.some(w => w.status !== 'analyzed')) {
                    await wsManager.handleResearchStart(report_id);
                    await deepResearch(report_id, true, wsManager);
                    res.json({ status: 'resumed', message: 'Research resumed successfully' });
                    return;
                }
            }
        }

        // If we get here, all queries are complete and successful
        res.json({ status: 'complete', message: 'All queries are complete' });

    } catch (error) {
        console.error('Error in resume endpoint:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        wsManager.handleResearchError(new Error(errorMessage), req.body.report_id);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get running researches
app.get('/api/running_researches', async (req: Request, res: Response) => {
    res.json(Array.from(wsManager.getActiveResearchIds()));
});

// `npm run debug -- 1001` to debug
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// `