'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { type NodeProps, NodeResizer } from '@xyflow/react';
import { useEditorStore } from '@/stores/editor-store';

const STICKY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  yellow: { bg: '#FEF9C3', border: '#FACC15', text: '#713F12' },
  green: { bg: '#DCFCE7', border: '#4ADE80', text: '#14532D' },
  blue: { bg: '#DBEAFE', border: '#60A5FA', text: '#1E3A5F' },
  pink: { bg: '#FCE7F3', border: '#F472B6', text: '#831843' },
  purple: { bg: '#F3E8FF', border: '#C084FC', text: '#581C87' },
  orange: { bg: '#FFF7ED', border: '#FB923C', text: '#7C2D12' },
  gray: { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151' },
};

const COLOR_KEYS = Object.keys(STICKY_COLORS);

function StickyNote({ id, data, selected }: NodeProps) {
  const text = (data?.text as string) || '';
  const colorKey = (data?.color as string) || 'yellow';
  const colors = STICKY_COLORS[colorKey] || STICKY_COLORS.yellow;
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateNodeData = useEditorStore((s) => s.updateNodeData);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { text: e.target.value });
    },
    [id, updateNodeData],
  );

  const handleColorChange = useCallback(
    (newColor: string) => {
      updateNodeData(id, { color: newColor });
    },
    [id, updateNodeData],
  );

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineStyle={{ borderColor: colors.border }}
        handleStyle={{ backgroundColor: colors.border, width: 8, height: 8 }}
      />
      <div
        className="w-full h-full rounded-lg shadow-md flex flex-col overflow-hidden"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 2,
          borderStyle: 'solid',
          minWidth: 120,
          minHeight: 80,
        }}
        onDoubleClick={() => setIsEditing(true)}
      >
        {/* Color picker strip */}
        {selected && (
          <div className="flex gap-1 px-2 py-1 border-b" style={{ borderColor: `${colors.border}60` }}>
            {COLOR_KEYS.map((c) => (
              <button
                key={c}
                onClick={() => handleColorChange(c)}
                className={`w-4 h-4 rounded-full border-2 transition-transform ${
                  c === colorKey ? 'scale-125 border-gray-600' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: STICKY_COLORS[c].border }}
                title={c}
              />
            ))}
          </div>
        )}

        {/* Text area */}
        <div className="flex-1 p-2">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsEditing(false);
                e.stopPropagation();
              }}
              className="w-full h-full bg-transparent resize-none outline-none text-sm"
              style={{ color: colors.text }}
              placeholder="Type your note..."
            />
          ) : (
            <div
              className="w-full h-full text-sm whitespace-pre-wrap break-words cursor-text"
              style={{ color: colors.text }}
            >
              {text || (
                <span style={{ opacity: 0.5 }}>Double-click to edit...</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(StickyNote);
