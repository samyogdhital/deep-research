# Architecture Documentation

This document provides a comprehensive, technically detailed overview of our Deep Research Agent project. It covers both frontend and backend architectures, outlines the deep research workflow, and integrates the new UI/UX requirements for source tracking and real-time updates. The goal is to ensure that every component—from the initial user query to the final report generation and real-time source logging—is well-documented and seamlessly integrated.

---

## Detailed Technical Analysis and Rationale

### Frontend Flow (Based on page.tsx)

- **Component & State Management:**  
  The main UI is implemented as a React client component in Next.js. It uses a state machine with stages:  
  - **Input stage:** Users enter a research prompt using an auto-resizing textarea.  
  - **Follow-up:** The UI displays AI-generated questions allowing users to refine the query.  
  - **Processing:** Real-time logs are displayed, and the component responds to Socket.io events (e.g., progress updates and source data).  
  - **Complete:** The final report and dynamic “All Sources” accordion (populated by real-time data) are rendered.
  
- **Real-Time Communication:**  
  Socket.io is used to asynchronously update the UI with log messages and source data. This approach minimizes API calls (e.g., no redundant LLM calls) and ensures fast feedback.
  
- **UI Controls & Rationale:**  
  Dynamic input fields for depth, breadth, and follow-up questions provide granular control over the research. Although there is no explicit sorting function in the provided code, the ordered display of source data is essential for maintaining clarity and coherence in the UI.

### Backend Flow (Based on server.ts and deep-research.ts)

- **Server & Socket.io Setup (server.ts):**  
  An Express server paired with Socket.io handles incoming requests. It listens for connections and research-related events (such as starting research or stopping it) and emits real-time updates.
  
- **Agent Orchestration (deep-research.ts):**  
  The deep research process is partitioned among several specialized agents:
  - **Master Agent:** Orchestrates the overall research, creating SERP queries.
  - **Website Analysis Agent:** Scrapes websites and extracts key data, ensuring that each source is logged.
  - **Information Crunching Agent:** Activates at set token thresholds to optimize and condense the scraped data.
  - **Report Generation Agent:** Compiles data into a final, citation-rich report.
  
- **Real-Time Source Logging:**  
  Real-time updates for source data (both successful and failed scrapes) are continuously pushed to the frontend. A dedicated log file ensures complete audit trails.
  
- **Design Rationale:**  
  The modular backend design divides the research process into discrete steps that improve error resilience and scalability. By focusing on real-time feedback and minimizing redundant API calls (e.g., using pre-collected data for source display), the system is optimized for performance and cost efficiency.

---

## Frontend Architecture (Next.js)

### Main Component Structure

The core frontend is implemented in the `page.tsx` file as a React client component using Next.js 14. The user journey through the application is divided into distinct stages, each managing specific tasks.

#### State Management

```js
interface ResearchState {
  step: 'input' | 'follow-up' | 'processing' | 'complete';
  initialPrompt: string;
  depth: number | null;
  breadth: number | null;
  followupQuestions: number | null;
  generatedFollowUpQuestions: string[];
  followUpAnswers: Record<string, string>;
  logs: string[];
  showLogs: boolean;
  report: string;
  sources: Array<{ id: number, url: string, title: string }>;
}
```

- **Hooks Used:**
  - `useState` for managing primary research state and UI controls (e.g., depth/breadth inputs).
  - `useRef` for textarea management.
  - `useSocket` for real-time communication with the backend.

#### Research Flow Stages

1. **Initial Input Stage (step: 'input')**
    - The user enters the research query.
    - Provides controls for research depth, breadth, and follow-up questions.
    - Utilizes a dynamic, auto-resizing textarea with input validation (numeric inputs between 1-10).

2. **Follow-up Questions Stage (step: 'follow-up')**
    - Displays AI-generated follow-up questions.
    - Provides text areas for the user to enter answers.
    - Tracks progress and validates input.

3. **Processing Stage (step: 'processing')**
    - Displays real-time logs and research progress indicators.
    - Implements source tracking using Accordion components.
    - Includes an option to stop the research process.

4. **Complete Stage (step: 'complete')**
    - Renders a markdown report with citations.
    - Offers download options (PDF/MD).
    - Displays source references with links and success/failure indicators for scraped sources.
    - **Note:** The "All Sources" accordion is displayed **only** on the report generating page. It is not visible during the initial input, follow-up, or processing stages.

#### WebSocket Integration

Real-time communication with the backend is achieved via Socket.io:

```js
useEffect(() => {
  const newSocket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
    withCredentials: true,
    transports: ['websocket']
  });
  
  // Socket event handlers for:
  // - log messages
  // - progress updates  
  // - source updates
  // - research completion
  
  return () => newSocket.close();
}, []);
```

### New UI/UX Requirements & Real-Time Sources Integration

- **Display Timing:**  
  The sources accordion should only be shown on the final report generating page. It should not be visible during the initial research stages (input, follow-up, or processing).

- **Sources Accordion Details:**
  - **Structure:**  
    - The main accordion ("All Sources") is expanded by default on the report page.
    - It contains nested accordions for each SERP query executed during the research process.
  - **Content Organization:**  
    - **For Each SERP Query Accordion:**
      - **Successful Scrapes:** Lists all websites successfully scraped. Each entry includes:
        - The website URL.
        - A key extracted snippet (e.g., an important quote or value) that was retrieved from the website.
      - **Failed Scrapes:** Lists websites that failed to be scraped under that specific SERP query.
  - **Real-Time Updates:**
    - The sources data (both successful and failed scrapes) must be updated in real time via Socket.io.
    - This data is populated in the UI dynamically and also stored in a dedicated log file for auditing and error recovery purposes.
  - **LLM Call Optimization:**  
    - No additional LLM calls should be made for this feature. The extraction of source information should rely solely on data already collected by the website analysis agents.

---

## Backend Architecture (Node.js)

### Server Setup (server.ts)

The backend is built with Node.js using Express and Socket.io. It handles the orchestration of multiple AI agents and ensures real-time communication with the frontend.

#### Core Server Components

```js
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_BASE_URL,
    credentials: true
  }
});
```

### Main API Routes

1. **/api/research/questions**
    - Generates follow-up questions based on the initial prompt.
    - Utilizes AI for question generation.
    - Returns an array of targeted questions.

2. **/api/research/start**
    - Initiates the deep research process.
    - Manages the research abort controller.
    - Handles source logging.
    - Coordinates multiple AI agents.

### Deep Research Implementation (deep-research.ts)

The core function that controls the deep research flow is implemented as follows:

```js
export async function deepResearch({
  query_to_find_websites,
  breadth,
  depth,
  onProgress,
  signal,
  parentTokenCount = 0
}): Promise<ResearchResult> {
  // Implementation details:
  // 1. Master Agent generates SERP queries with specific objectives.
  // 2. Website Analysis Agent scrapes and analyzes websites.
  // 3. Information Crunching Agent activates at 50k token thresholds.
  // 4. Report Generation Agent compiles the final technical report.
}
```

#### Key Components & Their Responsibilities

1. **Master Agent**
    - Generates SERP queries with specific objectives.
    - Controls the research breadth and depth.
    - Tracks token usage.

2. **Website Analysis Agent**
    - Scrapes and analyzes web content.
    - Extracts relevant information based on the objective.
    - Maintains citation tracking for all extracted data.

3. **Information Crunching Agent**
    - Activates when token thresholds (around 50k tokens) are reached.
    - Compresses and synthesizes the scraped data while preserving source attribution.
    - Ensures efficient token usage by condensing data into high-value insights.

4. **Report Generation Agent**
    - Compiles the final technical report.
    - Manages citations and references with precise formatting.
    - Handles markdown report generation.

### Error Handling

Robust error handling is implemented to capture any critical issues during the research process. In case of errors (e.g., a website fails to scrape), the system logs detailed information.

```js
async function writeErrorOutput(error: Error, data: {
  learnings: TrackedLearning[],
  visitedUrls: string[],
  failedUrls: string[],
  crunchedInfo: any,
  agentResults: AgentResult[],
  researchContext?: {
    prompt: string,
    totalSources: number,
    timeStamp: string
  }
}): Promise<string> {
  // Write error details and logs to error-output.md
}
```

### Real-Time Updates and Logging

#### Socket.io Integration for Real-Time Data

The backend uses Socket.io to send real-time updates (including source data) to the frontend:

```js
io.on('connection', (socket) => {
  // Listen for research initiation
  socket.on('startResearch', async (data) => {
    try {
      const researchData = await deepResearch({ ...data });
      // Emit source updates (SERP queries, successful and failed scrapes) in real time
      socket.emit('sourcesUpdate', researchData.sources);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });
});
```

#### Continuous Source Logging

A dedicated log file (e.g., `source_logs.txt`) is maintained to capture all source data in real time. This ensures that, in the event of errors, an audit trail is available.

```js
const fs = require('fs');

function logSourceData(data) {
  fs.appendFile('source_logs.txt', JSON.stringify(data, null, 2) + '\n', (err) => {
    if (err) console.error("Error writing source log", err);
  });
}
```

---

## Integration of New Requirements

### UI/UX Adjustments for the Sources Accordion

- **Visibility Control:**  
  - The sources accordion will **only** be displayed on the final report generating page.
  - It will be hidden during the initial input, follow-up, and processing stages.
  
- **Real-Time Data Population:**  
  - The accordion will display data for each SERP query as nested accordions.
  - Each SERP query accordion will include:
    - **Successful Scrapes:**  
      A list of successfully scraped websites with key extracted snippets.
    - **Failed Scrapes:**  
      A list of websites that failed to be scraped.
  - All this data will be updated in real time via Socket.io, ensuring a dynamic and responsive UI.
  
- **Avoiding Additional LLM Calls:**  
  - The feature is designed to work without triggering any additional LLM calls, thereby avoiding increased API throughput and cost.
  - It relies solely on the data already provided by the website analysis agents.

### Real-Time Sources Accordion Example



---

## Summary

- **Frontend:**
  - Implements a multi-stage research process with clearly defined state management.
  - Utilizes real-time Socket.io communication for updates.
  - Incorporates a new "All Sources" accordion feature that is only visible on the report page and updated in real time.
  
- **Backend:**
  - Orchestrates deep research via multiple AI agents (Master, Website Analysis, Information Crunching, and Report Generation).
  - Provides robust error handling and continuous logging.
  - Uses Socket.io to emit real-time source updates without additional LLM calls.

This complete architecture ensures a robust, efficient, and transparent system for deep research, enabling users to receive detailed, citation-rich reports along with dynamic source tracking.

---