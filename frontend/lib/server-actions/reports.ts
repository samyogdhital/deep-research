'use server'

import { revalidatePath } from 'next/cache'
import { deleteReport, clearAllReports } from '../apis'

export async function deleteReportAction(id: string) {
    const success = await deleteReport(id)
    if (success) {
        revalidatePath('/')
        revalidatePath('/report/[slug]', 'page')
    }
    return success
}

export async function clearAllReportsAction() {
    const success = await clearAllReports()
    if (success) {
        revalidatePath('/')
        revalidatePath('/report/[slug]', 'page')
    }
    return success
}