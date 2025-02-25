'use server'

import { deleteReport, clearAllReports } from '../db'

export async function deleteReportAction(id: string) {
    try {
        await deleteReport(id)
    } catch (error) {
        throw new Error('Failed to delete report')
    }
}

export async function clearAllReportsAction() {
    try {
        await clearAllReports()
    } catch (error) {
        throw new Error('Failed to clear all reports')
    }
}