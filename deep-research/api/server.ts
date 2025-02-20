import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import { generateFeedback } from '../src/feedback';
import { deepResearch, writeFinalReport } from '../src/deep-research';
import { OutputManager } from '../src/output-manager';
import * as fs from 'fs/promises';
import path from 'path';
import { setBroadcastFn } from '../src/deep-research';

const app = express();
const httpServer = createServer(app);

// Update OutputManager to use socket.io
let globalSocket: Server;

const io = new Server(httpServer, {
    cors: {
        origin: "http://host.docker.internal:3000",  // Frontend URL
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type"]
    }
});

// Add AbortController for managing research termination
let currentResearch: {
    controller: AbortController;
    cleanup: () => void;
} | null = null;

// Update broadcast function to handle all logging
function broadcast(message: string) {
    // console.log(message);  // Server-side log
    io.emit('log', message);  // Send to all clients
}

setBroadcastFn(broadcast);  // Pass broadcast function to deep-research

// Create output manager with broadcast
const output = new OutputManager((message: string) => {
    broadcast(message);  // Pass broadcast function to OutputManager
});

// Attach socket handlers
let isResearchStopped = false;

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    broadcast('Connected to research server');

    socket.on('stop-research', () => {
        if (currentResearch) {
            broadcast('Research terminated by user');
            currentResearch.controller.abort();
            currentResearch.cleanup();
            currentResearch = null;
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));
app.use(express.json());

app.post('/api/research/questions', async (req, res) => {
    try {
        broadcast('Generating follow-up questions...');
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const questions = await generateFeedback({
            query: prompt,
            numQuestions: 5
        });

        if (!questions || !Array.isArray(questions)) {
            throw new Error('Invalid response format');
        }

        broadcast('Questions generated successfully');
        res.json({ questions });
    } catch (error) {
        broadcast(`Error: ${error.message}`);
        console.error('Error generating questions:', error);
        res.status(500).json({
            error: 'Failed to generate questions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.post('/api/research/start', async (req, res) => {
    try {
        if (currentResearch) {
            currentResearch.controller.abort();
            currentResearch.cleanup();
        }

        const controller = new AbortController();
        const { signal } = controller;

        currentResearch = {
            controller,
            cleanup: () => {
                // Cleanup logic here
            }
        };

        isResearchStopped = false;
        broadcast('Starting research process...');
        const { prompt, depth, breadth, followUpAnswers } = req.body;

        // Validate input
        if (!prompt) {
            throw new Error('Prompt is required');
        }

        // Combine prompt with follow-up answers
        const fullContext = `
Initial Query: ${prompt}

Follow-up Answers:
${Object.entries(followUpAnswers)
                .map(([q, a]) => `Q: ${q}\nA: ${a}`)
                .join('\n\n')}
`;

        broadcast('Starting research process...');

        // Start research process with output manager
        const result = await deepResearch({
            query_to_find_websites: fullContext,
            depth,
            breadth,
            signal,
            onProgress: (progress) => {
                output.updateProgress(progress);  // This will now broadcast progress
            }
        });

        currentResearch = null;
        broadcast('Generating final report...');

        // Generate final report
        const report = await writeFinalReport({
            prompt: fullContext,
            learnings: result.learnings,
            visitedUrls: result.visitedUrls
        });

        // Save report to file before sending response
        await fs.writeFile(
            path.join(process.cwd(), 'research.md'),
            report
        );

        // Add this broadcast before sending response
        broadcast('Deep Research complete.');

        // Send raw markdown without JSON stringifying
        res.json({
            report: report.replace(/\\n/g, '\n'), // Fix escaped newlines
            sources: result.learnings.map(l => ({
                learning: l.content,
                source: l.sourceUrl,
                quote: l.sourceText
            }))
        });

    } catch (error) {
        if (error.name === 'AbortError') {
            broadcast('Research process stopped');
            res.status(200).json({ status: 'stopped' });
        } else {
            broadcast(`Error: ${error.message}`);
            console.error('Research error:', error);
            res.status(500).json({
                error: 'Research failed',
                details: error.message
            });
        }
    }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
