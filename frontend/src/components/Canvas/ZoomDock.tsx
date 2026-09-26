import { useDrawStore } from '../../store/useDrawStore';

export default function ZoomDock() {
  const { viewTransform, setViewTransform, undo, redo, history, historyIndex } = useDrawStore();

  const handleZoomIn = () => {
    const newScale = Math.min(5, Math.round(viewTransform.scale * 1.15 * 100) / 100);
    setViewTransform({ ...viewTransform, scale: newScale });
  };

  const handleZoomOut = () => {
    const newScale = Math.max(0.1, Math.round((viewTransform.scale / 1.15) * 100) / 100);
    setViewTransform({ ...viewTransform, scale: newScale });
  };

  const handleZoomReset = () => {
    setViewTransform({ x: 0, y: 0, scale: 1 });
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="floating-bottom-dock" role="toolbar" aria-label="Zoom and History">
      <button
        id="dock-zoom-out"
        className="dock-btn"
        onClick={handleZoomOut}
        title="Zoom out"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        id="dock-zoom-reset"
        className="dock-btn dock-zoom-label"
        onClick={handleZoomReset}
        title="Click to reset zoom to 100%"
      >
        {Math.round(viewTransform.scale * 100)}%
      </button>
      <button
        id="dock-zoom-in"
        className="dock-btn"
        onClick={handleZoomIn}
        title="Zoom in"
        aria-label="Zoom in"
      >
        +
      </button>

      <div className="dock-separator" />

      <button
        id="dock-undo"
        className={`dock-btn ${!canUndo ? 'disabled' : ''}`}
        onClick={() => undo()}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>
      <button
        id="dock-redo"
        className={`dock-btn ${!canRedo ? 'disabled' : ''}`}
        onClick={() => redo()}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </button>
    </div>
  );
}
