import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDrawStore } from '../store/useDrawStore';
import { boardsApi } from '../api/boards';
import DrawCanvas from '../components/Canvas/DrawCanvas';
import Toolbar from '../components/Toolbar/Toolbar';
import StylePanel from '../components/StylePanel/StylePanel';
import Header from '../components/Header/Header';
import ZoomDock from '../components/Canvas/ZoomDock';

const AUTOSAVE_DELAY = 2000; // ms

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    user, setBoardId, setBoardName,
    setElements, elements,
    pushHistory, isDirty, setIsDirty, setIsSaving,
    selectedIds, activeTool,
  } = useDrawStore();

  const [panelClosed, setPanelClosed] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  // Load board
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const board = await boardsApi.get(id);
        setBoardId(board.id);
        setBoardName(board.name);
        const els = Array.isArray(board.elements) ? board.elements : [];
        setElements(els);
        pushHistory(els);
        setIsDirty(false);
      } catch {
        alert('Failed to load board');
        navigate('/boards');
      }
    })();
  }, [id]);

  // Auto-save on element changes
  const triggerAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      if (!id) return;
      setIsSaving(true);
      try {
        await boardsApi.update(id, { elements });
        setIsDirty(false);
      } finally {
        setIsSaving(false);
      }
    }, AUTOSAVE_DELAY);
  }, [id, elements, setIsDirty, setIsSaving]);

  useEffect(() => {
    if (isDirty) triggerAutosave();
  }, [isDirty, elements]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
  }, []);

  // When selection changes or tool changes to a drawing tool, auto-reopen panel
  useEffect(() => {
    if (selectedIds.length > 0) {
      setPanelClosed(false);
    }
  }, [selectedIds]);

  // Show style panel when shapes are selected or when actively using drawing tools
  const isDrawingTool = ['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'freehand', 'text'].includes(activeTool);
  const shouldShowPanel = !panelClosed && (selectedIds.length > 0 || isDrawingTool);

  return (
    <div className="excalidraw-container">
      {/* 100% full-screen canvas */}
      <DrawCanvas />

      {/* Floating Top Left Menu & Top Right Actions */}
      <Header />

      {/* Floating Centered Toolbar */}
      <Toolbar />

      {/* Floating Left Style Panel */}
      {shouldShowPanel && <StylePanel onClose={() => setPanelClosed(true)} />}

      {/* Floating Toggle button if panel was closed manually */}
      {panelClosed && isDrawingTool && (
        <button
          className="floating-panel-toggle"
          onClick={() => setPanelClosed(false)}
          title="Show style properties"
        >
          🎨
        </button>
      )}

      {/* Floating Bottom Left Zoom & History Dock */}
      <ZoomDock />
    </div>
  );
}
