import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDrawStore } from '../../store/useDrawStore';
import { boardsApi } from '../../api/boards';

export default function Header() {
  const {
    boardName, setBoardName, boardId,
    elements, setElements, pushHistory,
    user, setUser,
    isSaving, isDirty,
  } = useDrawStore();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(boardName);
  const [shareCopied, setShareCopied] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleSave = async () => {
    if (!boardId) return;
    useDrawStore.getState().setIsSaving(true);
    try {
      await boardsApi.update(boardId, { elements });
      useDrawStore.getState().setIsDirty(false);
    } finally {
      useDrawStore.getState().setIsSaving(false);
    }
  };

  const handleExportPng = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${boardName || 'drawing'}.png`;
    a.click();
    setMenuOpen(false);
  };

  const handleExportJson = () => {
    const data = JSON.stringify({ name: boardName, elements }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${boardName || 'drawing'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.elements) {
          pushHistory(elements);
          setElements(data.elements);
          if (data.name) setBoardName(data.name);
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setMenuOpen(false);
  };

  const handleClearCanvas = () => {
    if (elements.length === 0) return;
    if (window.confirm('Are you sure you want to clear the canvas?')) {
      pushHistory(elements);
      setElements([]);
      useDrawStore.getState().setSelectedIds([]);
    }
    setMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('drawplan_token');
    setUser(null);
    navigate('/login');
  };

  const commitName = async () => {
    const finalName = nameValue.trim() || 'Untitled';
    setBoardName(finalName);
    setEditingName(false);
    if (boardId) {
      await boardsApi.update(boardId, { name: finalName });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <>
      {/* Top Left Menu Button & Title */}
      <div className="floating-top-left" ref={menuRef}>
        <button
          id="btn-menu"
          className={`floating-icon-btn ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          title="Menu"
          aria-label="Menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {editingName ? (
          <input
            className="floating-board-input"
            value={nameValue}
            autoFocus
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditingName(false);
            }}
          />
        ) : (
          <div
            className="floating-board-name"
            onClick={() => {
              setNameValue(boardName);
              setEditingName(true);
            }}
            title="Click to rename board"
          >
            <span>{boardName}</span>
          </div>
        )}

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="floating-dropdown-menu" role="menu">
            <div className="menu-header">
              <span className="menu-title">DrawPlan</span>
              <span className="menu-version">v1.0</span>
            </div>

            <button className="menu-item" onClick={() => navigate('/boards')}>
              {/* <span className="menu-item-icon">📂</span> */}
              <span>All Boards</span>
            </button>

            <button className="menu-item" onClick={handleSave} disabled={isSaving}>
              {/* <span className="menu-item-icon">💾</span> */}
              <span>{isSaving ? 'Saving…' : 'Save to Cloud'}</span>
            </button>

            <div className="menu-divider" />

            <button className="menu-item" onClick={handleExportPng}>
              {/* <span className="menu-item-icon">🖼️</span> */}
              <span>Export as PNG</span>
            </button>

            <button className="menu-item" onClick={handleExportJson}>
              {/* <span className="menu-item-icon">📋</span> */}
              <span>Export JSON file</span>
            </button>

            <button className="menu-item" onClick={() => fileInputRef.current?.click()}>
              {/* <span className="menu-item-icon">📁</span> */}
              <span>Open JSON file…</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJson} />

            <div className="menu-divider" />

            <button className="menu-item text-danger" onClick={handleClearCanvas}>
              {/* <span className="menu-item-icon">🗑️</span> */}
              <span>Clear Canvas</span>
            </button>

            <div className="menu-divider" />

            <div className="menu-footer">
              <span className="menu-user-email">{user?.email}</span>
              <button className="menu-logout-btn" onClick={handleLogout}>Log out</button>
            </div>
          </div>
        )}
      </div>

      {/* Top Right Actions */}
      <div className="floating-top-right">
        {/* Autosave status */}
        <div className="save-status-pill">
          {isSaving ? (
            <span className="saving-text">Saving…</span>
          ) : isDirty ? (
            <span className="dirty-indicator" title="Unsaved changes">●</span>
          ) : (
            <span className="saved-text">Saved</span>
          )}
        </div>

        {/* Excalidraw-like purple Share button */}
        <button
          id="btn-share"
          className="share-pill-btn"
          onClick={handleShare}
          title="Copy link to clipboard"
        >
          {shareCopied ? 'Copied!' : 'Share'}
        </button>

        {/* User initials / avatar */}
        <div className="user-avatar-pill" title={user?.email || 'User'}>
          {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
        </div>
      </div>
    </>
  );
}
