import { create } from 'zustand';
import { io } from 'socket.io-client';
import { ResearchData } from '@deep-research/db/schema';

export const socket = io(process.env.NEXT_PUBLIC_API_BASE_URL as string, {
    withCredentials: true,
    transports: ['websocket']
});

export interface OngoingResearch extends ResearchData {
    id: string;
    startTime: number;
    status: 'collecting' | 'analyzing' | 'generating' | 'complete' | 'failed';
}

interface ResearchStore {
    reports: ResearchData[];
    ongoingResearch: OngoingResearch[];
    setReports: (reports: ResearchData[]) => void;
    setOngoingResearch: (research: OngoingResearch[]) => void;
    addResearch: (research: OngoingResearch) => void;
    removeResearch: (id: string) => void;
    updateResearch: (id: string, updates: Partial<OngoingResearch>) => void;
}

export const useResearchStore = create<ResearchStore>((set) => ({
    reports: [],
    ongoingResearch: [],
    setReports: (reports) => set({ reports }),
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

// Only set up socket listeners once in the browser
if (typeof window !== 'undefined') {
    socket.on('ongoing-research-update', (research: OngoingResearch[]) => {
        useResearchStore.getState().setOngoingResearch(research);
    });

    socket.on('research-completed', ({ researchId }) => {
        useResearchStore.getState().removeResearch(researchId);
        // Router refresh will be handled by the component
    });

    socket.on('connect', () => {
        socket.emit('request-ongoing-research');
    });
}
