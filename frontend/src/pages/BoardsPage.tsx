import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { boardsApi } from '../api/boards';
import { useDrawStore } from '../store/useDrawStore';
import type { Board } from '../types';

function DotGrid() {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="board-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="#d1d5db" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#board-dots)" />
    </svg>
  );
}

function PlaceholderIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'relative', zIndex: 1 }}
    >
      <rect x="4" y="10" width="32" height="22" rx="3" stroke="#c4c9d4" strokeWidth="2" fill="none" />
      <path
        d="M10 22 L16 16 L22 21 L28 14 L34 20"
        stroke="#c4c9d4"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="14" cy="17" r="2" fill="#c4c9d4" />
    </svg>
  );
}

function PencilLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="28" height="28" rx="8" fill="#ff6b35" />
      <path
        d="M18.5 7.5L20.5 9.5L10.5 19.5L8 20L8.5 17.5L18.5 7.5Z"
        fill="white"
        stroke="white"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path d="M16.5 9.5L18.5 11.5" stroke="#ff6b35" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function BoardsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useDrawStore();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadBoards();
  }, [user]);

  const loadBoards = async () => {
    try {
      const data = await boardsApi.list();
      setBoards(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const board = await boardsApi.create(newName.trim());
      navigate(`/editor/${board.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this board? This cannot be undone.')) return;
    await boardsApi.delete(id);
    setBoards((prev) => prev.filter((b) => b.id !== id));
  };

  const handleLogout = () => {
    localStorage.removeItem('drawplan_token');
    setUser(null);
    navigate('/login');
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div className="boards-page">
      {/* Top sticky header */}
      <header className="boards-header">
        <div className="boards-header-inner">
          <div className="boards-logo" onClick={() => navigate('/boards')}>
            <PencilLogo />
            <span className="logo-text">DrawPlan</span>
          </div>

          <div className="boards-header-right">
            <span className="user-email">{user?.email || 'user@example.com'}</span>
            <button id="btn-logout" className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main page content */}
      <main className="boards-main">
        <div className="boards-title-row">
          <h1 className="boards-title">My Boards</h1>
          <button
            id="btn-new-board"
            className="btn-new-board"
            onClick={() => setShowForm((prev) => !prev)}
          >
            <span className="plus-icon">+</span>
            <span>New Board</span>
          </button>
        </div>

        {/* Create new board form */}
        {showForm && (
          <form className="new-board-form" onSubmit={handleCreate}>
            <input
              id="input-board-name"
              autoFocus
              className="board-name-field"
              placeholder="Board name (e.g. Sprint Planning, Architecture Diagram)…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn-new-board"
              disabled={creating}
              style={{ padding: '9px 18px' }}
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              className="boards-header-right btn-logout"
              onClick={() => setShowForm(false)}
              style={{ fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </form>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="boards-loading">
            <div className="spinner" />
          </div>
        ) : boards.length === 0 ? (
          /* Empty state */
          <div className="boards-empty">
            <div className="empty-icon">🎨</div>
            <p style={{ margin: 0, fontSize: '16px', color: '#6b7280' }}>
              No boards yet. Create your first board to start drawing!
            </p>
            <button
              className="btn-new-board"
              onClick={() => setShowForm(true)}
              style={{ marginTop: '10px' }}
            >
              <span className="plus-icon">+</span>
              <span>New Board</span>
            </button>
          </div>
        ) : (
          /* Boards grid matching the user's reference */
          <div className="boards-grid">
            {boards.map((board) => (
              <div
                key={board.id}
                className="board-card"
                onClick={() => navigate(`/editor/${board.id}`)}
              >
                {/* Thumbnail with dot grid & placeholder icon */}
                <div className="board-card-preview">
                  <DotGrid />
                  <PlaceholderIcon />
                  <button
                    id={`btn-delete-${board.id}`}
                    className="board-card-delete"
                    title="Delete board"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(board.id);
                    }}
                  >
                    🗑
                  </button>
                </div>

                {/* Card info */}
                <div className="board-card-info">
                  <p className="board-card-name">{board.name}</p>
                  <p className="board-card-date">
                    Updated {formatDate(board.updatedAt || board.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
