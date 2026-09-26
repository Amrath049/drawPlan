import { create } from 'zustand';
import type { DrawElement, ToolType, ViewTransform, User } from '../types';

interface StyleState {
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  opacity: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  roundCorners: boolean;
}

interface CanvasState {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;

  // Board meta
  boardId: string | null;
  boardName: string;
  setBoardId: (id: string | null) => void;
  setBoardName: (name: string) => void;

  // Elements
  elements: DrawElement[];
  setElements: (elements: DrawElement[]) => void;
  addElement: (el: DrawElement) => void;
  updateElement: (id: string, patch: Partial<DrawElement>) => void;
  deleteElements: (ids: string[]) => void;
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;

  // Selection
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;

  // Active tool & lock
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  isToolLocked: boolean;
  setIsToolLocked: (v: boolean) => void;
  toggleToolLock: () => void;

  // Style
  style: StyleState;
  setStyle: (patch: Partial<StyleState>) => void;

  // View transform (pan/zoom)
  viewTransform: ViewTransform;
  setViewTransform: (t: ViewTransform) => void;

  // History
  history: DrawElement[][];
  historyIndex: number;
  pushHistory: (elements: DrawElement[]) => void;
  undo: () => DrawElement[] | null;
  redo: () => DrawElement[] | null;

  // Save status
  isDirty: boolean;
  setIsDirty: (v: boolean) => void;
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
}

export const useDrawStore = create<CanvasState>((set, get) => ({
  // Auth
  user: (() => {
    try {
      const raw = localStorage.getItem('drawplan_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })(),
  setUser: (user) => {
    if (user) localStorage.setItem('drawplan_user', JSON.stringify(user));
    else localStorage.removeItem('drawplan_user');
    set({ user });
  },

  // Board meta
  boardId: null,
  boardName: 'Untitled Board',
  setBoardId: (boardId) => set({ boardId }),
  setBoardName: (boardName) => set({ boardName }),

  // Elements
  elements: [],
  setElements: (elements) => set({ elements }),
  addElement: (el) =>
    set((s) => ({ elements: [...s.elements, el], isDirty: true })),
  updateElement: (id, patch) =>
    set((s) => ({
      elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      isDirty: true,
    })),
  deleteElements: (ids) =>
    set((s) => ({
      elements: s.elements.filter((e) => !ids.includes(e.id)),
      selectedIds: [],
      isDirty: true,
    })),
  bringToFront: (ids) =>
    set((s) => {
      const maxZ = Math.max(0, ...s.elements.map((e) => e.zIndex));
      return {
        elements: s.elements.map((e, i) =>
          ids.includes(e.id) ? { ...e, zIndex: maxZ + i + 1 } : e,
        ),
        isDirty: true,
      };
    }),
  sendToBack: (ids) =>
    set((s) => {
      const minZ = Math.min(0, ...s.elements.map((e) => e.zIndex));
      return {
        elements: s.elements.map((e, i) =>
          ids.includes(e.id) ? { ...e, zIndex: minZ - ids.length + i } : e,
        ),
        isDirty: true,
      };
    }),

  // Selection
  selectedIds: [],
  setSelectedIds: (selectedIds) => set({ selectedIds }),

  // Active tool & lock
  activeTool: 'select',
  setActiveTool: (activeTool) => set({ activeTool, selectedIds: [] }),
  isToolLocked: true,
  setIsToolLocked: (isToolLocked) => set({ isToolLocked }),
  toggleToolLock: () => set((s) => ({ isToolLocked: !s.isToolLocked })),

  // Style
  style: {
    strokeColor: '#1a1a1a',
    backgroundColor: 'transparent',
    strokeWidth: 2,
    fontSize: 24,
    fontFamily: 'Caveat, cursive',
    opacity: 1,
    strokeStyle: 'solid',
    roughness: 1,
    roundCorners: true,
  },
  setStyle: (patch) =>
    set((s) => ({ style: { ...s.style, ...patch } })),

  // View transform
  viewTransform: { x: 0, y: 0, scale: 1 },
  setViewTransform: (viewTransform) => set({ viewTransform }),

  // History (max 50 entries)
  history: [[]],
  historyIndex: 0,
  pushHistory: (elements) =>
    set((s) => {
      const newHistory = s.history.slice(0, s.historyIndex + 1);
      newHistory.push(elements);
      if (newHistory.length > 50) newHistory.shift();
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return null;
    const newIndex = historyIndex - 1;
    const elements = history[newIndex];
    set({ historyIndex: newIndex, elements, isDirty: true });
    return elements;
  },
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return null;
    const newIndex = historyIndex + 1;
    const elements = history[newIndex];
    set({ historyIndex: newIndex, elements, isDirty: true });
    return elements;
  },

  // Save status
  isDirty: false,
  setIsDirty: (isDirty) => set({ isDirty }),
  isSaving: false,
  setIsSaving: (isSaving) => set({ isSaving }),
}));
