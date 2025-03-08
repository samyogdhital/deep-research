import { ResearchData } from '@deep-research/db/schema';

export async function getReport(id: string): Promise<ResearchData | null> {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${id}`);
        if (!response.ok) {
            // For 404, return null instead of throwing
            if (response.status === 404) {
                return null;
            }
            // For other errors, throw with details
            const errorData = await response.json();
            throw new Error(errorData.details || 'Failed to fetch report');
        }

        return await response.json();

    } catch (error) {
        // Log error but don't throw
        console.error('Get report error:', error);
        return null;
    }
}

export async function getAllReports(): Promise<ResearchData[]> {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports`, {
            next: { tags: ['reports'] }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return [];
            }
            throw new Error('Failed to fetch reports');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Get all reports error:', error);
        return [];
    }
}

export async function updateReportTitle(id: string, title: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${id}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
    });
    if (!response.ok) throw new Error('Failed to update report title');
    return response.json();
}

export async function deleteReport(id: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete report');
    return response.json();
}

export async function clearAllReports() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to clear reports');
    return response.json();
}

export async function markReportAsVisited(id: string) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${id}/visit`, {
            method: 'PATCH'
        });

        if (!response.ok) {
            if (response.status === 404) {
                return false;
            }
            throw new Error('Failed to mark report as visited');
        }

        return true;
    } catch (error) {
        console.error('Mark report as visited error:', error);
        return false;
    }
}


export async function getRunningResearches(): Promise<string[]> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/running_researches`, {
        next: { tags: ['running_researches'] }
    });
    if (!response.ok) throw new Error('Failed to fetch running researches');
    return response.json();
}


