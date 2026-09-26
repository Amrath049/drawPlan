import { useDrawStore } from '../../store/useDrawStore';

const STROKE_COLORS = [
  '#1e1e1e', '#e03131', '#2f9e44', '#1971c2',
  '#f08c00', '#9c36b5', '#ffffff', '#868e96',
];

const FILL_COLORS = [
  'transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff',
  '#ffec99', '#eebefa', '#f8f9fa', '#ffd43b',
];

const FONT_SIZES = [
  { label: 'S', val: 16 },
  { label: 'M', val: 24 },
  { label: 'L', val: 36 },
  { label: 'XL', val: 48 },
];

const FONT_FAMILIES = [
  { id: 'Caveat, cursive', label: 'Virgil', className: 'font-handdrawn' },
  { id: 'Inter, system-ui, sans-serif', label: 'Normal', className: 'font-normal' },
  { id: 'Fira Code, monospace', label: 'Code', className: 'font-code' },
];

interface Props {
  onClose?: () => void;
}

export default function StylePanel({ onClose }: Props) {
  const {
    style,
    setStyle,
    selectedIds,
    updateElement,
    deleteElements,
    pushHistory,
    elements,
    activeTool,
  } = useDrawStore();

  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
  const hasTextSelected = selectedElements.some((el) => el.type === 'text');
  const isTextContext = activeTool === 'text' || hasTextSelected;
  const hasShapeSelected = selectedElements.some((el) => el.type !== 'text');
  const isShapeContext = activeTool !== 'text' || hasShapeSelected;

  const currentFontSize =
    hasTextSelected && selectedElements[0]?.fontSize
      ? selectedElements[0].fontSize
      : style.fontSize || 24;

  const currentFontFamily =
    hasTextSelected && selectedElements[0]?.fontFamily
      ? selectedElements[0].fontFamily
      : style.fontFamily || 'Caveat, cursive';

  const applyToSelected = (patch: Partial<typeof style>) => {
    setStyle(patch);
    selectedIds.forEach((id) => updateElement(id, patch as any));
  };

  const applyFontSize = (val: number) => {
    setStyle({ fontSize: val });
    selectedIds.forEach((id) => {
      const el = elements.find((e) => e.id === id);
      if (el && el.type === 'text') {
        const lines = (el.text || ' ').split('\n');
        const width = Math.max(20, ...lines.map((l) => Math.max(16, l.length * val * 0.6)));
        const height = Math.max(val * 1.25, lines.length * (val * 1.25));
        updateElement(id, { fontSize: val, width, height });
      }
    });
    pushHistory(elements);
  };

  const applyFontFamily = (val: string) => {
    setStyle({ fontFamily: val });
    selectedIds.forEach((id) => {
      const el = elements.find((e) => e.id === id);
      if (el && el.type === 'text') {
        updateElement(id, { fontFamily: val });
      }
    });
    pushHistory(elements);
  };

  const handleDelete = () => {
    if (selectedIds.length > 0) {
      pushHistory(elements);
      deleteElements(selectedIds);
    }
  };

  return (
    <div className="floating-style-panel">
      <div className="panel-header">
        <span className="panel-title">Properties</span>
        {onClose && (
          <button className="panel-close-btn" onClick={onClose} title="Hide panel">
            ✕
          </button>
        )}
      </div>

      {/* Stroke / Text color */}
      <div className="panel-section">
        <label className="panel-label">{isTextContext ? 'Text color' : 'Stroke'}</label>
        <div className="color-grid">
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch ${style.strokeColor === c ? 'active' : ''}`}
              style={{
                background: c,
                border: c === '#ffffff' ? '1.5px solid #dcdcdc' : undefined,
              }}
              title={c}
              onClick={() => applyToSelected({ strokeColor: c })}
            />
          ))}
          <input
            type="color"
            className="color-custom"
            value={style.strokeColor === 'transparent' ? '#000000' : style.strokeColor}
            onChange={(e) => applyToSelected({ strokeColor: e.target.value })}
            title="Custom stroke color"
          />
        </div>
      </div>

      {/* Background fill (shown for shapes or general) */}
      {isShapeContext && (
        <div className="panel-section">
          <label className="panel-label">Background</label>
          <div className="color-grid">
            {FILL_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${c === 'transparent' ? 'transparent-swatch' : ''} ${style.backgroundColor === c ? 'active' : ''}`}
                style={{ background: c !== 'transparent' ? c : undefined }}
                title={c === 'transparent' ? 'Transparent' : c}
                onClick={() => applyToSelected({ backgroundColor: c })}
              />
            ))}
            <input
              type="color"
              className="color-custom"
              value={
                !style.backgroundColor || style.backgroundColor === 'transparent'
                  ? '#ffffff'
                  : style.backgroundColor
              }
              onChange={(e) => applyToSelected({ backgroundColor: e.target.value })}
              title="Custom fill color"
            />
          </div>
        </div>
      )}

      {/* Text Font Size (S, M, L, XL) */}
      {isTextContext && (
        <div className="panel-section">
          <label className="panel-label">Font size</label>
          <div className="font-size-buttons">
            {FONT_SIZES.map((item) => (
              <button
                key={item.val}
                id={`font-size-${item.label.toLowerCase()}`}
                className={`font-size-btn ${currentFontSize === item.val ? 'active' : ''}`}
                onClick={() => applyFontSize(item.val)}
                title={`${item.label} (${item.val}px)`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text Font Family */}
      {isTextContext && (
        <div className="panel-section">
          <label className="panel-label">Font family</label>
          <div className="font-family-buttons">
            {FONT_FAMILIES.map((item) => (
              <button
                key={item.id}
                className={`font-family-btn ${item.className} ${currentFontFamily === item.id ? 'active' : ''}`}
                onClick={() => applyFontFamily(item.id)}
                title={item.label}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stroke width */}
      {isShapeContext && (
        <div className="panel-section">
          <label className="panel-label">Stroke width</label>
          <div className="width-buttons">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                id={`width-${w}`}
                className={`width-btn ${style.strokeWidth === w ? 'active' : ''}`}
                onClick={() => applyToSelected({ strokeWidth: w })}
                title={`${w}px`}
              >
                <div className="width-preview" style={{ height: w + 1 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stroke style */}
      {isShapeContext && (
        <div className="panel-section">
          <label className="panel-label">Stroke style</label>
          <div className="style-buttons">
            {(['solid', 'dashed', 'dotted'] as const).map((s) => (
              <button
                key={s}
                id={`stroke-${s}`}
                className={`style-btn ${style.strokeStyle === s ? 'active' : ''}`}
                onClick={() => applyToSelected({ strokeStyle: s })}
                title={s}
              >
                <div className={`line-preview line-${s}`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edges (Round vs Sharp) */}
      {isShapeContext && (
        <div className="panel-section">
          <label className="panel-label">Edges</label>
          <div className="edge-buttons">
            <button
              id="edge-round"
              className={`edge-btn ${style.roundCorners ? 'active' : ''}`}
              onClick={() => applyToSelected({ roundCorners: true })}
              title="Round edges"
            >
              <span className="edge-icon">╭─</span>
              <span className="edge-label">Round</span>
            </button>
            <button
              id="edge-sharp"
              className={`edge-btn ${!style.roundCorners ? 'active' : ''}`}
              onClick={() => applyToSelected({ roundCorners: false })}
              title="Sharp edges"
            >
              <span className="edge-icon">┌─</span>
              <span className="edge-label">Sharp</span>
            </button>
          </div>
        </div>
      )}

      {/* Sloppiness / Roughness */}
      {isShapeContext && (
        <div className="panel-section">
          <label className="panel-label">Sloppiness</label>
          <div className="sloppiness-buttons">
            {[
              { val: 0, label: 'Architect' },
              { val: 1, label: 'Artist' },
              { val: 2, label: 'Cartoonist' },
            ].map((item) => (
              <button
                key={item.val}
                className={`sloppiness-btn ${Math.round(style.roughness) === item.val ? 'active' : ''}`}
                onClick={() => applyToSelected({ roughness: item.val })}
                title={item.label}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Opacity */}
      <div className="panel-section">
        <label className="panel-label">Opacity ({Math.round(style.opacity * 100)}%)</label>
        <div className="slider-row">
          <input
            id="slider-opacity"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={style.opacity}
            onChange={(e) => applyToSelected({ opacity: parseFloat(e.target.value) })}
            className="slider"
          />
        </div>
      </div>

      {/* Actions & Layers (when element is selected) */}
      {selectedIds.length > 0 && (
        <div className="panel-section">
          <label className="panel-label">Layers</label>
          <div className="layer-buttons">
            <button
              id="btn-bring-front"
              className="layer-btn"
              onClick={() => useDrawStore.getState().bringToFront(selectedIds)}
              title="Bring to front"
            >
              ▲ Front
            </button>
            <button
              id="btn-send-back"
              className="layer-btn"
              onClick={() => useDrawStore.getState().sendToBack(selectedIds)}
              title="Send to back"
            >
              ▼ Back
            </button>
          </div>

          <button
            id="btn-delete-selection"
            className="layer-btn delete-btn"
            onClick={handleDelete}
            title="Delete selected (Delete)"
            style={{ marginTop: '6px' }}
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}
