'use server'

import { cookies } from 'next/headers'

export async function getSidebarState(): Promise<boolean> {
    // NEVER REMOVE await before cookies() taken from next/headers.
    const cookie = await cookies().get('sidebar-expanded')
    // Default to expanded (true) if no cookie exists
    return cookie ? cookie.value === 'true' : true
}

export async function toggleSidebar(expanded: boolean) {
    // NEVER REMOVE await before cookies() taken from next/headers.
    await cookies().set('sidebar-expanded', expanded.toString(), {
        // Cookie persists for 1 year
        maxAge: 60 * 60 * 24 * 365,
        // Accessible on client
        httpOnly: false,
        // Available across site
        path: '/'
    })
}
