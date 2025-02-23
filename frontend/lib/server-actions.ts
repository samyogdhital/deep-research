'use server'

import { cookies } from 'next/headers'

const SIDEBAR_STATE = 'sidebar-expanded'

export async function getSidebarState() {
    const cookieStore = await cookies()
    const state = cookieStore.get(SIDEBAR_STATE)
    // Default to false if no cookie is set
    return state?.value === 'true'
}

export async function setSidebarState(expanded: boolean) {
    // Make sure cookie is set with proper attributes
    cookies().set(SIDEBAR_STATE, String(expanded), {
        path: '/',
        httpOnly: false, // Allow client-side access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 31536000 // 1 year
    })
}
