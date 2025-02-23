// Remove IndexedDB related imports and interfaces
export async function saveReport(report: {
    report_title: string;
    report: string;
    sourcesLog: any;
}) {
    if (!report.report_title?.trim() || !report.report?.trim()) {
        console.error('Invalid report data:', report);
        throw new Error('Invalid report data: Missing title or content');
    }

    try {
        // Only save to backend
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/research/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(report)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || 'Failed to save report');
        }

        const data = await response.json();
        return data.id;
    } catch (error) {
        console.error('Save report error:', error);
        throw new Error('Failed to save report');
    }
}

// Simplify to only fetch from backend
export async function getReport(id: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${id}`);
    if (!response.ok) return null;
    return response.json();
}

export async function getAllReports() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports`);
    if (!response.ok) return [];
    return response.json();
}

export async function updateReportTitle(id: string, title: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${id}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
    });

    if (!response.ok) throw new Error('Failed to update report title');
}

export async function deleteReport(id: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${id}`, {
        method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete report');
}

export async function clearAllReports() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports`, {
        method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to clear reports');
}
