import { create } from 'zustand';
import { io } from 'socket.io-client';
import { getAllReports } from './db';

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
    refreshSidebar: () => Promise<void>;
    reports: any[];
    refreshReports: () => Promise<void>;
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
        })),
    refreshSidebar: async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports`);
            if (!response.ok) return;
            const reports = await response.json();
            // Update your sidebar state here
        } catch (error) {
            console.error('Failed to refresh sidebar:', error);
        }
    },
    reports: [],
    refreshReports: async () => {
        try {
            const reports = await getAllReports();
            set({ reports });
        } catch (error) {
            console.error('Failed to refresh reports:', error);
        }
    }
}));

// Listen for socket events
socket.on('ongoing-research-update', (research: OngoingResearch[]) => {
    useResearchStore.getState().setOngoingResearch(research);
});

socket.on('research-completed', async ({ id, report_title }) => {
    const store = useResearchStore.getState();
    store.removeResearch(id);
    await store.refreshReports(); // Refresh reports when research completes
});

// Request current research on connect
socket.on('connect', () => {
    socket.emit('request-ongoing-research');
    useResearchStore.getState().refreshReports();
});

// Listen for report updates from other clients
socket.on('reports-updated', () => {
    useResearchStore.getState().refreshReports();
});
