'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { deleteReport, clearAllReports } from '../db'

export async function deleteReportAction(id: string) {
    try {
        await deleteReport(id)
        // Revalidate both the specific report page and the reports list
        revalidatePath(`/report/${id}`)
        revalidateTag('reports')
    } catch (error) {
        throw new Error('Failed to delete report')
    }
}

export async function clearAllReportsAction() {
    try {
        await clearAllReports()
        // Revalidate all reports-related pages
        revalidateTag('reports')
    } catch (error) {
        throw new Error('Failed to clear all reports')
    }
}

export async function refreshSidebarAction() {
    'use server'
    // Revalidate reports tag to refresh sidebar
    revalidateTag('reports')
}
