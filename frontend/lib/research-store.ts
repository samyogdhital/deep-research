import { create } from 'zustand';
import { io } from 'socket.io-client';

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
    reports: Report[];
    ongoingResearch: OngoingResearch[];
    setReports: (reports: Report[]) => void;
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

if (typeof window !== 'undefined') {
    socket.on('ongoing-research-update', (research: OngoingResearch[]) => {
        useResearchStore.getState().setOngoingResearch(research);
    });

    socket.on('research-completed', async ({ id, researchId }) => {
        useResearchStore.getState().removeResearch(researchId);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports`);
            if (response.ok) {
                const reports = await response.json();
                useResearchStore.getState().setReports(reports);
            }
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        }
    });

    socket.on('connect', () => {
        socket.emit('request-ongoing-research');
    });
}
