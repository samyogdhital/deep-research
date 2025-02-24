import { create } from 'zustand';
import { io } from 'socket.io-client';
import { getAllReports } from './db';
import { refreshSidebarAction } from './server-actions/reports'

export const socket = io(process.env.NEXT_PUBLIC_API_BASE_URL as string, {
    withCredentials: true,
    transports: ['websocket']
});

export interface OngoingResearch {
    id: string;
    prompt: string;
    startTime: number;
    status: 'collecting' | 'analyzing' | 'generating';
}

interface ResearchStore {
    ongoingResearch: OngoingResearch[];
    setOngoingResearch: (research: OngoingResearch[]) => void;
    addResearch: (research: OngoingResearch) => void;
    removeResearch: (id: string) => void;
    updateResearch: (id: string, updates: Partial<OngoingResearch>) => void;
}

export const useResearchStore = create<ResearchStore>((set) => ({
    ongoingResearch: [],
    setOngoingResearch: (research) => set({ ongoingResearch: research }),
    addResearch: (research) =>
        set((state) => ({
            ongoingResearch: [...state.ongoingResearch, research]
        })),
    removeResearch: (id) =>
        set((state) => ({
            ongoingResearch: state.ongoingResearch.filter(r => r.id !== id)
        })),
    updateResearch: (id, updates) =>
        set((state) => ({
            ongoingResearch: state.ongoingResearch.map(r =>
                r.id === id ? { ...r, ...updates } : r
            )
        }))
}));

// Keep only necessary socket events
socket.on('ongoing-research-update', (research: OngoingResearch[]) => {
    useResearchStore.getState().setOngoingResearch(research);
});

socket.on('research-completed', async ({ id }) => {
    useResearchStore.getState().removeResearch(id);
    // Refresh sidebar using server action
    await refreshSidebarAction();
});

socket.on('connect', () => {
    socket.emit('request-ongoing-research');
});
