import { create } from 'zustand';

export type CanvasTool = 'pen' | 'highlighter' | 'eraser' | 'text' | 'sticker' | 'pointer';

export const TOOL_COLORS = ['#1a1a2e', '#e63946', '#2b5cf0', '#2a9d8f', '#f4a261'] as const;

interface CanvasToolState {
  tool: CanvasTool;
  color: string;
  strokeWidth: number;
  setTool: (tool: CanvasTool) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
}

export const useCanvasStore = create<CanvasToolState>((set) => ({
  tool: 'pen',
  color: TOOL_COLORS[0],
  strokeWidth: 4,
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
}));
