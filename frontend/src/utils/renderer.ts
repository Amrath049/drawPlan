import rough from 'roughjs';
import type { DrawElement, ViewTransform } from '../types';
import { getBoundingBox, getResizeHandles } from './elements';
import { getStroke } from 'perfect-freehand';



export function renderCanvas(
  canvas: HTMLCanvasElement,
  elements: DrawElement[],
  selectedIds: string[],
  viewTransform: ViewTransform,
  activeDrawingEl?: DrawElement | null,
  selectionRect?: { x: number; y: number; w: number; h: number } | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw grid / background
  drawBackground(ctx, canvas, viewTransform);

  // Apply view transform
  ctx.save();
  ctx.translate(viewTransform.x, viewTransform.y);
  ctx.scale(viewTransform.scale, viewTransform.scale);

  // Sort by zIndex and draw
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    drawElement(ctx, canvas, el);
  }

  // Active drawing element preview
  if (activeDrawingEl) {
    drawElement(ctx, canvas, activeDrawingEl);
  }

  // Draw selection outlines and handles
  for (const id of selectedIds) {
    const el = elements.find((e) => e.id === id);
    if (el) drawSelection(ctx, el, selectedIds.length === 1);
  }

  // Drag-select rectangle
  if (selectionRect) {
    ctx.strokeStyle = '#4f93f5';
    ctx.fillStyle = 'rgba(79, 147, 245, 0.08)';
    ctx.lineWidth = 1 / viewTransform.scale;
    ctx.setLineDash([5 / viewTransform.scale, 3 / viewTransform.scale]);
    ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  vt: ViewTransform,
) {
  // White paper-like background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle dot grid — only visible at reasonable zoom levels
  if (vt.scale > 0.3) {
    const dotSpacing = 24 * vt.scale;
    const dotRadius = Math.min(1, vt.scale * 0.8);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';

    const startX = ((vt.x % dotSpacing) + dotSpacing) % dotSpacing;
    const startY = ((vt.y % dotSpacing) + dotSpacing) % dotSpacing;

    for (let gx = startX; gx < canvas.width; gx += dotSpacing) {
      for (let gy = startY; gy < canvas.height; gy += dotSpacing) {
        ctx.beginPath();
        ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  el: DrawElement,
) {
  ctx.save();
  ctx.globalAlpha = el.opacity;

  if (el.type === 'text') {
    drawTextElement(ctx, el);
    ctx.restore();
    return;
  }

  if (el.type === 'freehand') {
    drawFreehand(ctx, el);
    ctx.restore();
    return;
  }

  // Use rough.js for all shape types
  const rc = rough.canvas(canvas);
  const opts = getRoughOptions(el);

  if (el.type === 'rectangle') {
    const { x, y, width, height } = normalizeRect(el);
    if (el.roundCorners && width > 4 && height > 4) {
      const r = Math.min(14, width / 4, height / 4);
      const path =
        `M ${x + r} ${y} ` +
        `L ${x + width - r} ${y} ` +
        `Q ${x + width} ${y} ${x + width} ${y + r} ` +
        `L ${x + width} ${y + height - r} ` +
        `Q ${x + width} ${y + height} ${x + width - r} ${y + height} ` +
        `L ${x + r} ${y + height} ` +
        `Q ${x} ${y + height} ${x} ${y + height - r} ` +
        `L ${x} ${y + r} ` +
        `Q ${x} ${y} ${x + r} ${y} Z`;
      rc.path(path, opts);
    } else {
      rc.rectangle(x, y, width, height, opts);
    }
  } else if (el.type === 'ellipse') {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    rc.ellipse(cx, cy, Math.abs(el.width), Math.abs(el.height), opts);
  } else if (el.type === 'diamond') {
    drawDiamond(rc, el, opts);
  } else if (el.type === 'line' || el.type === 'arrow') {
    drawLineOrArrow(ctx, rc, el, opts);
  }

  ctx.restore();
}

function getRoughOptions(el: DrawElement) {
  const dashArray =
    el.strokeStyle === 'dashed'
      ? [12, 6]
      : el.strokeStyle === 'dotted'
      ? [2, 8]
      : undefined;

  return {
    stroke: el.strokeColor,
    fill: el.backgroundColor === 'transparent' ? undefined : el.backgroundColor,
    fillStyle: 'solid',
    strokeWidth: el.strokeWidth,
    roughness: el.roughness ?? 1,
    strokeLineDash: dashArray,
    seed: hashCode(el.id), // stable seed so shape doesn't flicker on re-render
  };
}

function normalizeRect(el: DrawElement) {
  return {
    x: el.width < 0 ? el.x + el.width : el.x,
    y: el.height < 0 ? el.y + el.height : el.y,
    width: Math.abs(el.width),
    height: Math.abs(el.height),
  };
}

function drawDiamond(rc: ReturnType<typeof rough.canvas>, el: DrawElement, opts: object) {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const points: [number, number][] = [
    [cx, el.y],
    [el.x + el.width, cy],
    [cx, el.y + el.height],
    [el.x, cy],
  ];
  rc.polygon(points, opts);
}

function drawLineOrArrow(
  ctx: CanvasRenderingContext2D,
  rc: ReturnType<typeof rough.canvas>,
  el: DrawElement,
  opts: object,
) {
  if (!el.points || el.points.length < 2) return;
  const [p1, p2] = [el.points[0], el.points[el.points.length - 1]];

  rc.line(p1[0], p1[1], p2[0], p2[1], opts);

  if (el.type === 'arrow') {
    drawArrowhead(ctx, p1, p2, el);
  }
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  el: DrawElement,
) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const size = el.strokeWidth * 5 + 8;

  ctx.save();
  ctx.strokeStyle = el.strokeColor;
  ctx.fillStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(
    to[0] - size * Math.cos(angle - Math.PI / 6),
    to[1] - size * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    to[0] - size * Math.cos(angle + Math.PI / 6),
    to[1] - size * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFreehand(ctx: CanvasRenderingContext2D, el: DrawElement) {
  if (!el.points || el.points.length < 2) return;

  const stroke = getStroke(el.points, {
    size: el.strokeWidth * 4,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });

  if (!stroke.length) return;

  ctx.fillStyle = el.strokeColor;
  ctx.beginPath();
  ctx.moveTo(stroke[0][0], stroke[0][1]);
  for (let i = 1; i < stroke.length; i++) {
    ctx.lineTo(stroke[i][0], stroke[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}

function drawTextElement(ctx: CanvasRenderingContext2D, el: DrawElement) {
  if (!el.text) return;
  const fontSize = el.fontSize || 24;
  const fontFamily = el.fontFamily || '"Caveat", cursive, sans-serif';
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = el.strokeColor || '#1e1e1e';
  ctx.textBaseline = 'top';

  const lines = el.text.split('\n');
  const lineHeight = fontSize * 1.25;
  lines.forEach((line, i) => {
    ctx.fillText(line, el.x, el.y + i * lineHeight);
  });
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  el: DrawElement,
  showHandles: boolean,
) {
  ctx.save();

  // ── Line / Arrow: draw endpoint handles directly on the line (Excalidraw-style) ──
  if (el.type === 'line' || el.type === 'arrow') {
    if (!el.points || el.points.length < 2) { ctx.restore(); return; }
    const p1 = el.points[0];
    const p2 = el.points[el.points.length - 1];
    const mid: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

    const drawCircleHandle = (cx: number, cy: number, filled = false) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = filled ? '#6e56cf' : '#ffffff';
      ctx.strokeStyle = '#6e56cf';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
    };

    if (showHandles) {
      drawCircleHandle(p1[0], p1[1], false);   // start — hollow
      drawCircleHandle(mid[0], mid[1], true);   // midpoint — filled (like Excalidraw)
      drawCircleHandle(p2[0], p2[1], false);    // end — hollow
    } else {
      // multi-select: just draw a subtle tinted line highlight
      ctx.strokeStyle = 'rgba(110, 86, 207, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // ── All other elements: bounding box + corner handles ──
  const { x, y, width, height } = getBoundingBox(el);
  const pad = 8;
  const bx = x - pad;
  const by = y - pad;
  const bw = width + pad * 2;
  const bh = height + pad * 2;

  // Selection border
  ctx.strokeStyle = '#6e56cf';
  ctx.lineWidth = 1.5;
  ctx.setLineDash(showHandles ? [] : [6, 3]);
  roundRect(ctx, bx, by, bw, bh, 4);
  ctx.stroke();
  ctx.setLineDash([]);

  if (showHandles) {
    const HANDLE_SIZE = 8;
    const HANDLE_RADIUS = 2;
    const handles = getResizeHandles(el);

    for (const h of handles) {
      const hx = h.x - HANDLE_SIZE / 2;
      const hy = h.y - HANDLE_SIZE / 2;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#6e56cf';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 3;
      roundRect(ctx, hx, hy, HANDLE_SIZE, HANDLE_SIZE, HANDLE_RADIUS);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
    }

    // Rotate handle — circle above top-center
    const ROTATE_OFFSET = 22;
    const ROTATE_R = 5;
    const rx = bx + bw / 2;
    const ry = by - ROTATE_OFFSET;

    ctx.strokeStyle = '#6e56cf';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(rx, by);
    ctx.lineTo(rx, ry + ROTATE_R);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6e56cf';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(rx, ry, ROTATE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
