import { create } from 'zustand';
import type { Drawing, Folder, Project, Template, ActivityEvent } from '@/types';

interface DrawingState {
  drawings: Drawing[];
  folders: Folder[];
  projects: Project[];
  templates: Template[];
  recentDrawings: Drawing[];
  activity: ActivityEvent[];
  isLoading: boolean;
  setDrawings: (drawings: Drawing[]) => void;
  setFolders: (folders: Folder[]) => void;
  setProjects: (projects: Project[]) => void;
  setTemplates: (templates: Template[]) => void;
  setRecentDrawings: (drawings: Drawing[]) => void;
  setActivity: (activity: ActivityEvent[]) => void;
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  removeDrawing: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useDrawingStore = create<DrawingState>((set) => ({
  drawings: [],
  folders: [],
  projects: [],
  templates: [],
  recentDrawings: [],
  activity: [],
  isLoading: false,
  setDrawings: (drawings) => set({ drawings }),
  setFolders: (folders) => set({ folders }),
  setProjects: (projects) => set({ projects }),
  setTemplates: (templates) => set({ templates }),
  setRecentDrawings: (recentDrawings) => set({ recentDrawings }),
  setActivity: (activity) => set({ activity }),
  addDrawing: (drawing) => set((state) => ({ drawings: [drawing, ...state.drawings] })),
  updateDrawing: (id, updates) =>
    set((state) => ({
      drawings: state.drawings.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),
  removeDrawing: (id) =>
    set((state) => ({
      drawings: state.drawings.filter((d) => d.id !== id),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}));
