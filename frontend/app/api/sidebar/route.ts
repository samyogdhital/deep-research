import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const SIDEBAR_STATE = 'sidebar-state'

export async function GET() {
    const cookieStore = await cookies()
    const expanded = cookieStore.get(SIDEBAR_STATE)?.value === 'true'

    // Fetch reports from backend API
    const reportsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports`, {
        cache: 'no-store'
    })

    const reports = await reportsResponse.json()

    return NextResponse.json({
        isExpanded: expanded,
        reports
    })
}

export async function POST(request: Request) {
    const { expanded } = await request.json()

    // Set cookie with a long expiration (1 year)
    cookies().set(SIDEBAR_STATE, String(expanded), {
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
        path: '/'
    })

    return NextResponse.json({ success: true })
}
