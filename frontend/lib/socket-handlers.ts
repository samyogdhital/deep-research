import { useResearchStore } from './research-store';
import { ResearchData } from '@/types/research';

// Update research state based on the event and data
export const handleResearchEvent = (event: string, data: ResearchData) => {
    const store = useResearchStore.getState();

    // Update research status based on event
    switch (event) {
        // Stage 1: Research Start Process
        case 'generating_followups':
            store.updateResearch(data.report_id, { status: 'collecting' });
            break;
        case 'followups_generated':
            store.updateResearch(data.report_id, {
                status: 'collecting',
                followUps_QnA: data.followUps_QnA
            });
            break;

        // Stage 2: Information Gathering Process
        case 'new_serp_query':
            store.updateResearch(data.report_id, {
                status: 'collecting',
                serpQueries: data.serpQueries
            });
            break;
        case 'new_website_successfully_scrape':
            store.updateResearch(data.report_id, {
                status: 'collecting',
                serpQueries: data.serpQueries
            });
            break;
        case 'website_analyzer_agent':
            store.updateResearch(data.report_id, {
                status: 'analyzing',
                serpQueries: data.serpQueries
            });
            break;

        // Stage 3: Information Crunching Process
        case 'crunching_serp_query':
            store.updateResearch(data.report_id, {
                status: 'analyzing',
                information_crunching_agent: data.information_crunching_agent
            });
            break;
        case 'crunched_information':
            store.updateResearch(data.report_id, {
                status: 'analyzing',
                information_crunching_agent: data.information_crunching_agent
            });
            break;

        // Stage 4: Report Writing Process
        case 'report_writing_start':
            store.updateResearch(data.report_id, {
                status: 'generating'
            });
            break;
        case 'report_writing_successfull':
            store.updateResearch(data.report_id, {
                status: 'complete',
                report: data.report
            });
            // Remove from ongoing research since it's complete
            store.removeResearch(data.report_id);
            break;

        // Error handling
        case 'research_error':
            store.updateResearch(data.report_id, {
                status: 'failed'
            });
            store.removeResearch(data.report_id);
            break;
    }
}; 