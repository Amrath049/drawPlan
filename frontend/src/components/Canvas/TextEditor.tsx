import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  x: number;
  y: number;
  initialText: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  scale?: number;
  onCommit: (text: string) => void;
}

export default function TextEditor({
  x,
  y,
  initialText,
  fontSize = 24,
  fontFamily = 'Caveat, cursive',
  color = '#1e1e1e',
  scale = 1,
  onCommit,
}: Props) {
  const [text, setText] = useState(initialText);
  const ref = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);

  const displayFontSize = Math.max(14, fontSize * scale);

  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.width = 'auto';
    el.style.height = `${Math.max(displayFontSize * 1.3, el.scrollHeight)}px`;
    el.style.width = `${Math.max(24, el.scrollWidth + 10)}px`;
  }, [displayFontSize]);

  useEffect(() => {
    // Focus immediately
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        if (initialText) {
          ref.current.select();
        }
        autoResize();
      }
    }, 10);
    return () => clearTimeout(t);
  }, [autoResize, initialText]);

  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(text);
  }, [text, onCommit]);

  return (
    <>
      {/* Invisible backdrop to capture clicks outside and commit */}
      <div
        className="text-editor-backdrop"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          commit();
        }}
      />

      {/* Direct inline transparent input — matches Excalidraw native text entry */}
      <textarea
        ref={ref}
        className="text-editor-direct"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          fontSize: `${displayFontSize}px`,
          fontFamily: fontFamily || '"Caveat", cursive, sans-serif',
          color: color || '#1e1e1e',
          caretColor: color || '#1e1e1e',
          lineHeight: 1.25,
        }}
        value={text}
        autoFocus
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          autoResize();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            commit();
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            commit();
          }
          // Normal Enter adds newline
        }}
      />
    </>
  );
}
