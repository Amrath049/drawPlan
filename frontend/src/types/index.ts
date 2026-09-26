export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'diamond'
  | 'freehand'
  | 'text';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface DrawElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: [number, number][];
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  opacity: number;
  strokeStyle: StrokeStyle;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  zIndex: number;
  roughness?: number;
  roundCorners?: boolean;
  angle?: number;
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  elements: DrawElement[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
}

export type ToolType =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'diamond'
  | 'freehand'
  | 'text'
  | 'eraser'
  | 'pan';

export interface SelectionHandle {
  x: number;
  y: number;
  cursor: string;
  position: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
}

export interface ViewTransform {
  x: number; // pan offset X
  y: number; // pan offset Y
  scale: number; // zoom scale
}
