import { v4 as uuid } from 'uuid';
import type { DrawElement, ElementType } from '../types';

export function createElement(
  type: ElementType,
  x: number,
  y: number,
  style: {
    strokeColor: string;
    backgroundColor: string;
    strokeWidth: number;
    opacity: number;
    strokeStyle: 'solid' | 'dashed' | 'dotted';
    roughness: number;
    roundCorners?: boolean;
    fontSize?: number;
    fontFamily?: string;
  },
  zIndex: number,
): DrawElement {
  return {
    id: uuid(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    points: type === 'freehand' || type === 'line' || type === 'arrow' ? [[x, y]] : undefined,
    strokeColor: style.strokeColor,
    backgroundColor: style.backgroundColor,
    strokeWidth: style.strokeWidth,
    opacity: style.opacity,
    strokeStyle: style.strokeStyle,
    roughness: style.roughness,
    roundCorners: type === 'rectangle' ? (style.roundCorners ?? true) : undefined,
    fontSize: style.fontSize || 24,
    fontFamily: style.fontFamily || 'Caveat, cursive',
    zIndex,
    text: type === 'text' ? '' : undefined,
    angle: 0,
  };
}

export function getBoundingBox(el: DrawElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  // Freehand: derive bounding box from all points
  if (el.type === 'freehand' && el.points?.length) {
    const xs = el.points.map((p) => p[0]);
    const ys = el.points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
    };
  }

  // Line / Arrow: ALWAYS derive bounding box from points (source of truth).
  // Never use x/y/width/height which may be stale after a move.
  if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 2) {
    const xs = el.points.map((p) => p[0]);
    const ys = el.points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
    };
  }

  // Text: use stored width/height if set, otherwise compute from content
  if (el.type === 'text') {
    const fontSize = el.fontSize || 24;
    const lines = (el.text || ' ').split('\n');
    const computedW = Math.max(20, ...lines.map((l) => Math.max(16, l.length * fontSize * 0.6)));
    const computedH = Math.max(fontSize * 1.25, lines.length * (fontSize * 1.25));
    return {
      x: el.x,
      y: el.y,
      width: el.width > 0 ? el.width : computedW,
      height: el.height > 0 ? el.height : computedH,
    };
  }

  return { x: el.x, y: el.y, width: Math.abs(el.width), height: Math.abs(el.height) };
}

/**
 * Hit-test: is the point (px, py) on/inside the element?
 *
 * Design rules (matching Excalidraw behaviour):
 * - ALL shapes: 8px click tolerance padding around their geometry.
 * - Unfilled shapes: clickable anywhere inside the bounding box (not just on the border).
 *   This avoids the "have to click exactly on the stroke" frustration.
 * - Freehand: proximity to any stroke point (with strokeWidth tolerance).
 * - Line/Arrow: distance from line segment ≤ 10px.
 * - Diamond: L1-norm polygon test (exact, plus padding via bounding-box pre-filter).
 * - Ellipse: normalised ellipse distance with tolerance.
 * - Rectangle / Text: full bounding-box with 8px padding.
 */
export function isPointInElement(
  px: number,
  py: number,
  el: DrawElement,
): boolean {
  // ── Freehand: check proximity to any stroke sample point ──────────
  if (el.type === 'freehand' && el.points) {
    const tolerance = Math.max(10, el.strokeWidth * 3 + 8);
    return el.points.some(([ex, ey]) => Math.hypot(px - ex, py - ey) < tolerance);
  }

  // ── Line / Arrow: distance to segment ────────────────────────────
  if (el.type === 'line' || el.type === 'arrow') {
    if (!el.points || el.points.length < 2) return false;
    const p1 = el.points[0];
    const p2 = el.points[el.points.length - 1];
    const tolerance = Math.max(10, el.strokeWidth * 2 + 8);
    return distanceToSegment(px, py, p1[0], p1[1], p2[0], p2[1]) <= tolerance;
  }

  // ── All box-based shapes: bounding-box pre-filter with padding ────
  const PAD = 8;
  const { x, y, width, height } = getBoundingBox(el);
  const normW = Math.abs(width);
  const normH = Math.abs(height);
  const minX = Math.min(x, x + width);
  const minY = Math.min(y, y + height);

  const inBox =
    px >= minX - PAD &&
    px <= minX + normW + PAD &&
    py >= minY - PAD &&
    py <= minY + normH + PAD;

  if (!inBox) return false;

  // ── Text: full bounding box ───────────────────────────────────────
  if (el.type === 'text') return true;

  // ── Rectangle: full bounding box (unfilled OR filled) ────────────
  // Excalidraw treats the whole rect area as clickable regardless of fill.
  if (el.type === 'rectangle') return true;

  // ── Ellipse ───────────────────────────────────────────────────────
  if (el.type === 'ellipse') {
    const cx = minX + normW / 2;
    const cy = minY + normH / 2;
    const rx = normW / 2 + PAD;
    const ry = normH / 2 + PAD;
    if (rx === 0 || ry === 0) return false;
    return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
  }

  // ── Diamond ───────────────────────────────────────────────────────
  if (el.type === 'diamond') {
    const cx = minX + normW / 2;
    const cy = minY + normH / 2;
    const hw = normW / 2 + PAD;
    const hh = normH / 2 + PAD;
    if (hw === 0 || hh === 0) return false;
    return Math.abs(px - cx) / hw + Math.abs(py - cy) / hh <= 1;
  }

  return true;
}


function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function isElementInRect(
  el: DrawElement,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const { x, y, width, height } = getBoundingBox(el);
  const left = Math.min(rx, rx + rw);
  const top = Math.min(ry, ry + rh);
  const right = Math.max(rx, rx + rw);
  const bottom = Math.max(ry, ry + rh);
  return x >= left && y >= top && x + width <= right && y + height <= bottom;
}

export function getResizeHandles(el: DrawElement): {
  x: number;
  y: number;
  position: 'nw' | 'ne' | 'se' | 'sw';
  cursor: string;
}[] {
  const { x, y, width, height } = getBoundingBox(el);

  return [
    { x, y, position: 'nw', cursor: 'nw-resize' },
    { x: x + width, y, position: 'ne', cursor: 'ne-resize' },
    { x: x + width, y: y + height, position: 'se', cursor: 'se-resize' },
    { x, y: y + height, position: 'sw', cursor: 'sw-resize' },
  ];
}

export function applyResize(
  el: DrawElement,
  handle: string,
  dx: number,
  dy: number,
): Partial<DrawElement> {
  let { x, y, width, height } = el;

  switch (handle) {
    case 'se': width += dx; height += dy; break;
    case 'sw': x += dx; width -= dx; height += dy; break;
    case 'ne': width += dx; y += dy; height -= dy; break;
    case 'nw': x += dx; width -= dx; y += dy; height -= dy; break;
  }

  // For text elements, scale font size proportionally with height change
  if (el.type === 'text') {
    const origH = Math.max(16, el.height || 28);
    const newH = Math.max(14, height);
    const scale = newH / origH;
    const newFontSize = Math.max(12, Math.min(120, Math.round((el.fontSize || 24) * scale)));
    const lines = (el.text || ' ').split('\n');
    const computedW = Math.max(20, ...lines.map((l) => Math.max(16, l.length * newFontSize * 0.6)));
    const computedH = Math.max(newFontSize * 1.25, lines.length * (newFontSize * 1.25));
    return {
      x,
      y,
      fontSize: newFontSize,
      width: Math.max(computedW, Math.abs(width)),
      height: computedH,
    };
  }

  return { x, y, width, height };
}
