import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react';
import { useDrawStore } from '../../store/useDrawStore';
import { renderCanvas } from '../../utils/renderer';
import {
  createElement,
  isPointInElement,
  isElementInRect,
  getResizeHandles,
  applyResize,
} from '../../utils/elements';
import type { DrawElement } from '../../types';
import TextEditor from './TextEditor';

interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  activeEl: DrawElement | null;
}

interface SelectionState {
  isSelecting: boolean;
  startX: number;
  startY: number;
  rect: { x: number; y: number; w: number; h: number } | null;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  origPositions: Map<string, { x: number; y: number; points?: [number, number][] }>;
}

interface ResizeState {
  isResizing: boolean;
  handle: string;
  startX: number;
  startY: number;
  origEl: DrawElement | null;
}

interface PanState {
  isPanning: boolean;
  startX: number;
  startY: number;
  origVx: number;
  origVy: number;
}

interface TextEditorState {
  visible: boolean;
  screenX: number;
  screenY: number;
  canvasX: number;
  canvasY: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  elId: string | null;
  text: string;
}

const HANDLE_HIT = 12;

export default function DrawCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    elements, addElement, updateElement, deleteElements,
    selectedIds, setSelectedIds,
    activeTool, setActiveTool,
    isToolLocked,
    style,
    viewTransform, setViewTransform,
    pushHistory, undo, redo,
  } = useDrawStore();

  const drawing = useRef<DrawingState>({ isDrawing: false, startX: 0, startY: 0, activeEl: null });
  const selecting = useRef<SelectionState>({ isSelecting: false, startX: 0, startY: 0, rect: null });
  const dragging = useRef<DragState>({ isDragging: false, startX: 0, startY: 0, origPositions: new Map() });
  const resizing = useRef<ResizeState>({ isResizing: false, handle: '', startX: 0, startY: 0, origEl: null });
  const panning = useRef<PanState>({ isPanning: false, startX: 0, startY: 0, origVx: 0, origVy: 0 });
  const spaceDown = useRef(false);

  const [textEditor, setTextEditor] = useState<TextEditorState>({
    visible: false,
    screenX: 0,
    screenY: 0,
    canvasX: 0,
    canvasY: 0,
    fontSize: 24,
    fontFamily: 'Caveat, cursive',
    color: '#1e1e1e',
    elId: null,
    text: '',
  });
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [, forceRender] = useState(0);

  // ── Coordinate conversion ──────────────────────────────────────────
  const toCanvas = useCallback(
    (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const vt = viewTransform;
      return {
        x: (clientX - rect.left - vt.x) / vt.scale,
        y: (clientY - rect.top - vt.y) / vt.scale,
      };
    },
    [viewTransform],
  );

  // ── Keep a ref that always mirrors the store's elements array ──────
  // This lets us mutate positions during drag without going through
  // Zustand → React re-render on every mousemove (which causes the lag).
  const elementsRef = useRef<DrawElement[]>(elements);
  useEffect(() => {
    elementsRef.current = elements;
  });

  // ── Render loop ────────────────────────────────────────────────────
  // Runs after every React commit (no dep array = every render).
  // During drag we call renderCanvas directly, so this handles all other cases.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCanvas(
      canvas,
      elementsRef.current,
      selectedIds,
      viewTransform,
      drawing.current.activeEl,
      selectionRect,
    );
  });

  // ── Prevent browser page-zoom on Ctrl+scroll ───────────────────────
  useEffect(() => {
    const prevent = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    window.addEventListener('wheel', prevent, { passive: false });
    return () => window.removeEventListener('wheel', prevent);
  }, []);

  // ── Resize canvas to container ─────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      forceRender((n) => n + 1);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ') { e.preventDefault(); spaceDown.current = true; }

      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) {
        pushHistory(elements);
        deleteElements(selectedIds);
      }

      // Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      // Tool shortcuts
      const toolMap: Record<string, typeof activeTool> = {
        v: 'select', '1': 'select',
        h: 'pan',
        r: 'rectangle', '2': 'rectangle',
        d: 'diamond', '3': 'diamond',
        o: 'ellipse', e: 'ellipse', '4': 'ellipse',
        a: 'arrow', '5': 'arrow',
        l: 'line', '6': 'line',
        p: 'freehand', '7': 'freehand',
        t: 'text', '8': 'text',
        '0': 'eraser',
      };
      if (toolMap[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
        setActiveTool(toolMap[e.key.toLowerCase()]);
      }

      // Escape
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setActiveTool('select');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') spaceDown.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [elements, selectedIds, activeTool, undo, redo, pushHistory, deleteElements, setActiveTool, setSelectedIds]);

  // ── Hit-test helpers ───────────────────────────────────────────────
  const getTopElementAt = (x: number, y: number): DrawElement | null => {
    const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
    return sorted.find((el) => isPointInElement(x, y, el)) ?? null;
  };

  // ── Touch & Pointer Tracking for multi-touch (pinch-zoom & two-finger pan) ──
  const activePointers = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchState = useRef<{
    initialDistance: number;
    initialScale: number;
    initialMidX: number;
    initialMidY: number;
    initialVx: number;
    initialVy: number;
  } | null>(null);

  const getHandleAt = (x: number, y: number, el: DrawElement, hitRadius: number = HANDLE_HIT): string | null => {
    // Line / Arrow: endpoints are the interactive handles
    if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 2) {
      const p1 = el.points[0];
      const p2 = el.points[el.points.length - 1];
      if (Math.hypot(x - p1[0], y - p1[1]) <= hitRadius) return 'start';
      if (Math.hypot(x - p2[0], y - p2[1]) <= hitRadius) return 'end';
      return null;
    }
    for (const h of getResizeHandles(el)) {
      if (Math.abs(x - h.x) <= hitRadius && Math.abs(y - h.y) <= hitRadius) {
        return h.position;
      }
    }
    return null;
  };

  // ── Pointer events (Mouse, Pen, Touch) ──────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

      // Capture pointer so move/up continue even if finger/cursor leaves canvas
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}

      // Multi-touch gesture (Pinch-to-zoom and two-finger pan)
      if (activePointers.current.size === 2) {
        // Cancel single-pointer drawing, dragging, resizing, or selecting
        if (drawing.current.isDrawing) {
          drawing.current = { isDrawing: false, startX: 0, startY: 0, activeEl: null };
          forceRender((n) => n + 1);
        }
        if (dragging.current.isDragging) {
          dragging.current = { isDragging: false, startX: 0, startY: 0, origPositions: new Map() };
        }
        if (resizing.current.isResizing) {
          resizing.current = { isResizing: false, handle: '', startX: 0, startY: 0, origEl: null };
        }
        if (selecting.current.isSelecting) {
          selecting.current = { isSelecting: false, startX: 0, startY: 0, rect: null };
          setSelectionRect(null);
        }

        const pts = Array.from(activePointers.current.values());
        const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        const midX = (pts[0].clientX + pts[1].clientX) / 2;
        const midY = (pts[0].clientY + pts[1].clientY) / 2;
        pinchState.current = {
          initialDistance: Math.max(1, dist),
          initialScale: viewTransform.scale,
          initialMidX: midX,
          initialMidY: midY,
          initialVx: viewTransform.x,
          initialVy: viewTransform.y,
        };
        return;
      }

      if (activePointers.current.size > 2) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x, y } = toCanvas(e.clientX, e.clientY, canvas);
      const isTouch = e.pointerType === 'touch';
      const handleHitDist = isTouch ? 18 : HANDLE_HIT;

      // Middle mouse, space+drag, or pan tool => pan
      if (e.button === 1 || spaceDown.current || activeTool === 'pan') {
        panning.current = {
          isPanning: true,
          startX: e.clientX,
          startY: e.clientY,
          origVx: viewTransform.x,
          origVy: viewTransform.y,
        };
        return;
      }

      // Right click = deselect
      if (e.button === 2) { setSelectedIds([]); return; }

      // ── Eraser tool ──
      if (activeTool === 'eraser') {
        const hit = getTopElementAt(x, y);
        if (hit) {
          pushHistory(elements);
          deleteElements([hit.id]);
        }
        return;
      }

      // ── Text tool ──
      if (activeTool === 'text') {
        e.preventDefault();
        const existing = getTopElementAt(x, y);
        const rect = canvas.getBoundingClientRect();

        if (existing && existing.type === 'text') {
          const screenX = rect.left + viewTransform.x + existing.x * viewTransform.scale;
          const screenY = rect.top + viewTransform.y + existing.y * viewTransform.scale;
          setTextEditor({
            visible: true,
            screenX,
            screenY,
            canvasX: existing.x,
            canvasY: existing.y,
            fontSize: existing.fontSize || 24,
            fontFamily: existing.fontFamily || style.fontFamily || 'Caveat, cursive',
            color: existing.strokeColor || '#1e1e1e',
            elId: existing.id,
            text: existing.text || '',
          });
          setSelectedIds([existing.id]);
          return;
        }

        const screenX = rect.left + viewTransform.x + x * viewTransform.scale;
        const screenY = rect.top + viewTransform.y + y * viewTransform.scale;
        setTextEditor({
          visible: true,
          screenX,
          screenY,
          canvasX: x,
          canvasY: y,
          fontSize: style.fontSize || 24,
          fontFamily: style.fontFamily || 'Caveat, cursive',
          color: style.strokeColor || '#1e1e1e',
          elId: null,
          text: '',
        });
        return;
      }

      // ── Select tool ──
      if (activeTool === 'select') {
        // Check resize handles first
        if (selectedIds.length === 1) {
          const selEl = elements.find((el) => el.id === selectedIds[0]);
          if (selEl) {
            const handle = getHandleAt(x, y, selEl, handleHitDist);
            if (handle) {
              resizing.current = { isResizing: true, handle, startX: x, startY: y, origEl: { ...selEl } };
              return;
            }
          }
        }

        // Check if clicking on a selected element → drag
        const hit = getTopElementAt(x, y);
        if (hit && selectedIds.includes(hit.id)) {
          const positions = new Map<string, { x: number; y: number; points?: [number, number][] }>();
          selectedIds.forEach((id) => {
            const el = elements.find((e) => e.id === id);
            if (el) positions.set(id, { x: el.x, y: el.y, points: el.points ? el.points.map(p => [p[0], p[1]] as [number, number]) : undefined });
          });
          dragging.current = { isDragging: true, startX: x, startY: y, origPositions: positions };
          return;
        }

        // Click on unselected element
        if (hit) {
          if (e.shiftKey) {
            setSelectedIds([...selectedIds, hit.id]);
          } else {
            setSelectedIds([hit.id]);
          }
          const positions = new Map([[hit.id, { x: hit.x, y: hit.y, points: hit.points ? hit.points.map(p => [p[0], p[1]] as [number, number]) : undefined }]]);
          dragging.current = { isDragging: true, startX: x, startY: y, origPositions: positions };
          return;
        }

        // Click on empty → drag-select
        if (!e.shiftKey) setSelectedIds([]);
        selecting.current = { isSelecting: true, startX: x, startY: y, rect: { x, y, w: 0, h: 0 } };
        return;
      }

      // ── Drawing tools ──
      const maxZ = elements.length ? Math.max(...elements.map((el) => el.zIndex)) : 0;
      const el = createElement(activeTool as any, x, y, style, maxZ + 1);
      drawing.current = { isDrawing: true, startX: x, startY: y, activeEl: el };
    },
    [activeTool, elements, selectedIds, style, viewTransform, toCanvas, deleteElements, pushHistory, setSelectedIds],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      }

      // Multi-touch pinch-to-zoom and two-finger pan
      if (activePointers.current.size >= 2 && pinchState.current) {
        const pts = Array.from(activePointers.current.values());
        const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        const midX = (pts[0].clientX + pts[1].clientX) / 2;
        const midY = (pts[0].clientY + pts[1].clientY) / 2;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const centerCanvasX = midX - rect.left;
        const centerCanvasY = midY - rect.top;

        const scaleRatio = dist / pinchState.current.initialDistance;
        const newScale = Math.min(5, Math.max(0.1, pinchState.current.initialScale * scaleRatio));

        const initialWorldX = (pinchState.current.initialMidX - rect.left - pinchState.current.initialVx) / pinchState.current.initialScale;
        const initialWorldY = (pinchState.current.initialMidY - rect.top - pinchState.current.initialVy) / pinchState.current.initialScale;

        const newVx = centerCanvasX - initialWorldX * newScale;
        const newVy = centerCanvasY - initialWorldY * newScale;

        setViewTransform({
          scale: newScale,
          x: newVx,
          y: newVy,
        });
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x, y } = toCanvas(e.clientX, e.clientY, canvas);

      // Panning
      if (panning.current.isPanning) {
        const dx = e.clientX - panning.current.startX;
        const dy = e.clientY - panning.current.startY;
        setViewTransform({
          ...viewTransform,
          x: panning.current.origVx + dx,
          y: panning.current.origVy + dy,
        });
        return;
      }

      // Eraser drag
      if (activeTool === 'eraser' && (e.buttons === 1 || e.pointerType === 'touch')) {
        const hit = getTopElementAt(x, y);
        if (hit) {
          deleteElements([hit.id]);
        }
        return;
      }

      // Resizing / endpoint-dragging — bypass Zustand, mutate ref + redraw directly
      if (resizing.current.isResizing && resizing.current.origEl) {
        const orig = resizing.current.origEl;
        const handle = resizing.current.handle;
        let patch: Partial<DrawElement>;

        if ((orig.type === 'line' || orig.type === 'arrow') && orig.points && orig.points.length >= 2) {
          const origPoints = orig.points.map(p => [p[0], p[1]] as [number, number]);
          if (handle === 'start') origPoints[0] = [x, y];
          if (handle === 'end') origPoints[origPoints.length - 1] = [x, y];
          const xs = origPoints.map(p => p[0]);
          const ys = origPoints.map(p => p[1]);
          patch = { x: Math.min(...xs), y: Math.min(...ys), points: origPoints };
        } else {
          const dx = x - resizing.current.startX;
          const dy = y - resizing.current.startY;
          patch = applyResize(orig, handle, dx, dy);
        }

        // Mutate the ref directly and redraw — no setState, no lag
        elementsRef.current = elementsRef.current.map(el =>
          el.id === orig.id ? { ...el, ...patch } : el
        );
        const canvas = canvasRef.current;
        if (canvas) renderCanvas(canvas, elementsRef.current, selectedIds, viewTransform, null, null);
        return;
      }

      // Dragging — bypass Zustand, mutate ref + redraw directly (zero lag)
      if (dragging.current.isDragging) {
        const dx = x - dragging.current.startX;
        const dy = y - dragging.current.startY;

        // Build the set of patches without touching state
        const patches = new Map<string, Partial<DrawElement>>();
        dragging.current.origPositions.forEach((orig, id) => {
          if (orig.points) {
            const newPoints = orig.points.map(([px, py]) => [px + dx, py + dy] as [number, number]);
            const xs = newPoints.map(p => p[0]);
            const ys = newPoints.map(p => p[1]);
            patches.set(id, { x: Math.min(...xs), y: Math.min(...ys), points: newPoints });
          } else {
            patches.set(id, { x: orig.x + dx, y: orig.y + dy });
          }
        });

        // Apply patches to the ref and redraw synchronously
        elementsRef.current = elementsRef.current.map(el => {
          const patch = patches.get(el.id);
          return patch ? { ...el, ...patch } : el;
        });
        const canvas = canvasRef.current;
        if (canvas) renderCanvas(canvas, elementsRef.current, selectedIds, viewTransform, null, null);
        return;
      }

      // Drawing
      if (drawing.current.isDrawing && drawing.current.activeEl) {
        const el = drawing.current.activeEl;
        if (el.type === 'freehand') {
          drawing.current.activeEl = {
            ...el,
            points: [...(el.points ?? []), [x, y]],
          };
        } else if (el.type === 'line' || el.type === 'arrow') {
          drawing.current.activeEl = {
            ...el,
            width: x - drawing.current.startX,
            height: y - drawing.current.startY,
            points: [[drawing.current.startX, drawing.current.startY], [x, y]],
          };
        } else {
          drawing.current.activeEl = {
            ...el,
            width: x - drawing.current.startX,
            height: y - drawing.current.startY,
          };
        }
        forceRender((n) => n + 1);
        return;
      }

      // Drag-selecting
      if (selecting.current.isSelecting) {
        const rect = {
          x: selecting.current.startX,
          y: selecting.current.startY,
          w: x - selecting.current.startX,
          h: y - selecting.current.startY,
        };
        selecting.current.rect = rect;
        setSelectionRect(rect);
      }
    },
    [activeTool, viewTransform, toCanvas, setViewTransform, selectedIds, deleteElements],
  );

  const handlePointerUp = useCallback(
    (e?: React.PointerEvent<HTMLCanvasElement>) => {
      if (e) {
        activePointers.current.delete(e.pointerId);
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
      }

      // If pinch was active, clean up pinch state without committing single-pointer logic
      if (pinchState.current) {
        if (activePointers.current.size < 2) {
          pinchState.current = null;
        }
        return;
      }

      // End pan
      if (panning.current.isPanning) {
        panning.current.isPanning = false;
        return;
      }

      // End resize — commit the ref's current state to Zustand
      if (resizing.current.isResizing) {
        resizing.current.isResizing = false;
        pushHistory(elementsRef.current);
        useDrawStore.getState().setElements(elementsRef.current);
        return;
      }

      // End drag — commit the ref's current state to Zustand
      if (dragging.current.isDragging) {
        dragging.current = { isDragging: false, startX: 0, startY: 0, origPositions: new Map() };
        pushHistory(elementsRef.current);
        useDrawStore.getState().setElements(elementsRef.current);
        return;
      }

      // End drawing
      if (drawing.current.isDrawing && drawing.current.activeEl) {
        const el = drawing.current.activeEl;
        const isValid =
          el.type === 'freehand'
            ? (el.points?.length ?? 0) > 2
            : Math.abs(el.width) > 4 || Math.abs(el.height) > 4;

        if (isValid) {
          addElement(el);
          pushHistory([...elements, el]);
        }
        drawing.current = { isDrawing: false, startX: 0, startY: 0, activeEl: null };

        // Freehand: always keep pencil active.
        // Other shapes: auto-switch to Select UNLESS the tool is locked.
        if (el.type === 'freehand') {
          setSelectedIds([]);
          // pencil tool stays active
        } else if (isToolLocked) {
          // locked — stay on current tool, clear selection
          setSelectedIds([]);
        } else {
          // normal — switch to select and pre-select new element
          setActiveTool('select');
          if (isValid) setSelectedIds([el.id]);
        }
        forceRender((n) => n + 1);
      }

      // End drag-select
      if (selecting.current.isSelecting) {
        const rect = selecting.current.rect;
        if (rect) {
          const inRect = elements.filter((el) =>
            isElementInRect(el, rect.x, rect.y, rect.w, rect.h),
          );
          setSelectedIds(inRect.map((e) => e.id));
        }
        selecting.current.isSelecting = false;
        selecting.current.rect = null;
        setSelectionRect(null);
      }
    },
    [elements, isToolLocked, addElement, pushHistory, setSelectedIds, setActiveTool],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activePointers.current.delete(e.pointerId);
      handlePointerUp(e);
    },
    [handlePointerUp],
  );

  // Double click on canvas to edit text
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = toCanvas(e.clientX, e.clientY, canvas);
    const hit = getTopElementAt(x, y);
    if (hit && hit.type === 'text') {
      const rect = canvas.getBoundingClientRect();
      const screenX = rect.left + viewTransform.x + hit.x * viewTransform.scale;
      const screenY = rect.top + viewTransform.y + hit.y * viewTransform.scale;
      setTextEditor({
        visible: true,
        screenX,
        screenY,
        canvasX: hit.x,
        canvasY: hit.y,
        fontSize: hit.fontSize || 24,
        fontFamily: hit.fontFamily || style.fontFamily || 'Caveat, cursive',
        color: hit.strokeColor || '#1e1e1e',
        elId: hit.id,
        text: hit.text || '',
      });
      setSelectedIds([hit.id]);
    }
  }, [elements, toCanvas, style, viewTransform, setSelectedIds]);

  // ── Zoom ────────────────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newScale = Math.min(5, Math.max(0.1, viewTransform.scale * zoomFactor));
        const scaleDiff = newScale / viewTransform.scale;

        setViewTransform({
          scale: newScale,
          x: mouseX - scaleDiff * (mouseX - viewTransform.x),
          y: mouseY - scaleDiff * (mouseY - viewTransform.y),
        });
      } else {
        setViewTransform({
          ...viewTransform,
          x: viewTransform.x - e.deltaX,
          y: viewTransform.y - e.deltaY,
        });
      }
    },
    [viewTransform, setViewTransform],
  );

  // ── Cursor ─────────────────────────────────────────────────────────
  const getCursor = () => {
    if (spaceDown.current || activeTool === 'pan') return 'grab';
    if (panning.current.isPanning) return 'grabbing';
    if (activeTool === 'select') return 'default';
    if (activeTool === 'text') return 'text';
    if (activeTool === 'eraser') return 'cell';
    return 'crosshair';
  };

  // ── Text editing commit ─────────────────────────────────────────────
  const handleTextCommit = (text: string) => {
    const trimmed = text.trim();
    if (textEditor.elId) {
      if (!trimmed) {
        deleteElements([textEditor.elId]);
      } else {
        const fontSize = textEditor.fontSize || 24;
        const lines = text.split('\n');
        const width = Math.max(20, ...lines.map((l) => Math.max(16, l.length * fontSize * 0.6)));
        const height = Math.max(fontSize * 1.25, lines.length * (fontSize * 1.25));
        updateElement(textEditor.elId, {
          text,
          width,
          height,
          fontSize,
          fontFamily: textEditor.fontFamily || style.fontFamily,
        });
        pushHistory(elements);
        setSelectedIds([textEditor.elId]);
      }
    } else if (trimmed) {
      const fontSize = textEditor.fontSize || 24;
      const lines = text.split('\n');
      const width = Math.max(20, ...lines.map((l) => Math.max(16, l.length * fontSize * 0.6)));
      const height = Math.max(fontSize * 1.25, lines.length * (fontSize * 1.25));
      const maxZ = elements.length ? Math.max(...elements.map((el) => el.zIndex)) : 0;
      const el = createElement('text', textEditor.canvasX, textEditor.canvasY, {
        ...style,
        fontSize,
        fontFamily: textEditor.fontFamily || style.fontFamily,
        strokeColor: textEditor.color,
      }, maxZ + 1);
      el.text = text;
      el.width = width;
      el.height = height;
      el.fontSize = fontSize;
      el.fontFamily = textEditor.fontFamily || style.fontFamily;
      addElement(el);
      pushHistory([...elements, el]);
      setSelectedIds([el.id]);
      if (!isToolLocked) {
        setActiveTool('select');
      }
    }
    setTextEditor({
      visible: false,
      screenX: 0,
      screenY: 0,
      canvasX: 0,
      canvasY: 0,
      fontSize: 24,
      fontFamily: style.fontFamily || 'Caveat, cursive',
      color: '#1e1e1e',
      elId: null,
      text: '',
    });
  };

  return (
    <div ref={containerRef} className="canvas-container">
      <canvas
        ref={canvasRef}
        style={{ cursor: getCursor(), touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse' && e.buttons === 0) {
            handlePointerUp(e);
          }
        }}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      {textEditor.visible && (
        <TextEditor
          x={textEditor.screenX}
          y={textEditor.screenY}
          initialText={textEditor.text}
          fontSize={textEditor.fontSize}
          fontFamily={textEditor.fontFamily}
          color={textEditor.color}
          scale={viewTransform.scale}
          onCommit={handleTextCommit}
        />
      )}
    </div>
  );
}
