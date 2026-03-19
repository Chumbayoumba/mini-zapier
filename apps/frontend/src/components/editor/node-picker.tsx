'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useEditorStore } from '@/stores/editor-store';
import { countTriggerNodes } from '@/lib/graph-validation';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';

export interface NodeTypeDefinition {
  type: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  category: 'trigger' | 'logic' | 'action' | 'ai';
}

const NODE_CATALOG: NodeTypeDefinition[] = [
  // Triggers
  { type: 'WEBHOOK', label: 'Webhook', color: '#8B5CF6', icon: '🔗', description: 'HTTP webhook trigger', category: 'trigger' },
  { type: 'CRON', label: 'Schedule (Cron)', color: '#F59E0B', icon: '⏰', description: 'Time-based schedule', category: 'trigger' },
  { type: 'EMAIL', label: 'Email Trigger', color: '#EF4444', icon: '📧', description: 'Trigger on incoming email', category: 'trigger' },
  { type: 'TELEGRAM', label: 'Telegram Trigger', color: '#0EA5E9', icon: '💬', description: 'Telegram bot message', category: 'trigger' },
  // Logic
  { type: 'IF', label: 'If', color: '#EC4899', icon: '🔀', description: 'Conditional branching', category: 'logic' },
  { type: 'SWITCH', label: 'Switch', color: '#A855F7', icon: '🔀', description: 'Multi-way branching', category: 'logic' },
  { type: 'FILTER', label: 'Filter', color: '#14B8A6', icon: '🔍', description: 'Filter items by condition', category: 'logic' },
  { type: 'SET', label: 'Set', color: '#F97316', icon: '📝', description: 'Set variable values', category: 'logic' },
  { type: 'CODE', label: 'Code', color: '#64748B', icon: '💻', description: 'Custom JavaScript code', category: 'logic' },
  { type: 'MERGE', label: 'Merge', color: '#06B6D4', icon: '🔗', description: 'Merge multiple inputs', category: 'logic' },
  { type: 'WAIT', label: 'Wait', color: '#EAB308', icon: '⏳', description: 'Delay execution', category: 'logic' },
  { type: 'LOOP', label: 'Loop', color: '#84CC16', icon: '🔄', description: 'Iterate over items', category: 'logic' },
  { type: 'NOOP', label: 'No Operation', color: '#9CA3AF', icon: '➡️', description: 'Pass-through node', category: 'logic' },
  // Actions
  { type: 'HTTP_REQUEST', label: 'HTTP Request', color: '#3B82F6', icon: '🌐', description: 'Make HTTP API calls', category: 'action' },
  { type: 'SEND_EMAIL', label: 'Send Email', color: '#10B981', icon: '✉️', description: 'Send an email message', category: 'action' },
  { type: 'TELEGRAM_ACTION', label: 'Telegram', color: '#0EA5E9', icon: '💬', description: 'Send Telegram message', category: 'action' },
  { type: 'DATABASE', label: 'Database', color: '#F97316', icon: '🗄️', description: 'Database operations', category: 'action' },
  { type: 'TRANSFORM', label: 'Transform', color: '#6366F1', icon: '🔄', description: 'Transform data shape', category: 'action' },
  // AI
  { type: 'OPENAI', label: 'OpenAI', color: '#10A37F', icon: '🤖', description: 'GPT chat completion & DALL-E image generation', category: 'ai' },
  { type: 'ANTHROPIC', label: 'Anthropic', color: '#D97706', icon: '🧠', description: 'Claude chat completion', category: 'ai' },
  { type: 'MISTRAL', label: 'Mistral', color: '#3B82F6', icon: '🌊', description: 'Mistral AI chat completion', category: 'ai' },
  { type: 'OPENROUTER', label: 'OpenRouter', color: '#8B5CF6', icon: '🔀', description: 'Access 100+ AI models via single API', category: 'ai' },
];

export { NODE_CATALOG };

const CATEGORIES = ['trigger', 'action', 'ai', 'logic'] as const;

const CATEGORY_CONFIG = {
  trigger: { label: 'Triggers', emoji: '⚡' },
  logic: { label: 'Logic', emoji: '🔀' },
  action: { label: 'Actions', emoji: '⚙️' },
  ai: { label: 'AI', emoji: '🤖' },
} as const;

const RECENT_KEY = 'flowforge-recent-nodes';
const MAX_RECENT = 5;

function getRecentNodes(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentNode(type: string) {
  const recent = getRecentNodes().filter((t) => t !== type);
  recent.unshift(type);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

interface NodePickerProps {
  isOpen: boolean;
  onClose: () => void;
  connectFrom?: { nodeId: string; handleId?: string } | null;
}

export function NodePicker({ isOpen, onClose, connectFrom }: NodePickerProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { getViewport } = useReactFlow();
  const addNode = useEditorStore((s) => s.addNode);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setActiveCategory(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const recentTypes = useMemo(() => getRecentNodes(), [isOpen]);

  const filteredItems = useMemo(() => {
    let items = NODE_CATALOG;
    if (activeCategory) items = items.filter((n) => n.category === activeCategory);
    if (query.trim()) {
      items = items.filter(
        (n) =>
          fuzzyMatch(n.label, query) ||
          fuzzyMatch(n.description, query) ||
          fuzzyMatch(n.type, query),
      );
    }
    return items;
  }, [query, activeCategory]);

  const flatList = useMemo(() => {
    const items: NodeTypeDefinition[] = [];
    for (const cat of CATEGORIES) {
      items.push(...filteredItems.filter((i) => i.category === cat));
    }
    return items;
  }, [filteredItems]);

  const handleSelect = useCallback(
    (def: NodeTypeDefinition) => {
      const { nodes } = useEditorStore.getState();

      if (def.category === 'trigger' && countTriggerNodes(nodes) >= 1) {
        toast.warning('Only one trigger per workflow');
        return;
      }

      let position: { x: number; y: number };
      if (connectFrom) {
        const sourceNode = nodes.find((n) => n.id === connectFrom.nodeId);
        position = sourceNode
          ? { x: sourceNode.position.x, y: sourceNode.position.y + 150 }
          : getCenterPosition(getViewport);
      } else {
        position = getCenterPosition(getViewport);
      }

      let nodeFlowType = 'actionNode';
      let idPrefix = 'action';
      if (def.category === 'trigger') { nodeFlowType = 'triggerNode'; idPrefix = 'trigger'; }
      else if (def.category === 'logic') { nodeFlowType = 'logicNode'; idPrefix = 'logic'; }
      else if (def.category === 'ai') { nodeFlowType = 'actionNode'; idPrefix = 'ai'; }

      const nodeDataType = def.type === 'TELEGRAM_ACTION' ? 'TELEGRAM' : def.type;

      const newNode: Node = {
        id: `${idPrefix}-${Date.now()}`,
        type: nodeFlowType,
        position,
        data: { label: def.label, type: nodeDataType, config: {}, description: '' },
      };

      addNode(newNode);

      if (connectFrom) {
        const newEdge: Edge = {
          id: `edge-${Date.now()}`,
          source: connectFrom.nodeId,
          sourceHandle: connectFrom.handleId || undefined,
          target: newNode.id,
          type: 'smoothstep',
          animated: true,
        };
        useEditorStore.getState().setEdges([...useEditorStore.getState().edges, newEdge]);
      }

      addRecentNode(def.type);
      onClose();
    },
    [addNode, onClose, connectFrom, getViewport],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((p) => Math.min(p + 1, flatList.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((p) => Math.max(p - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (flatList[activeIndex]) handleSelect(flatList[activeIndex]); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    },
    [flatList, activeIndex, handleSelect, onClose],
  );

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => { setActiveIndex(0); }, [query, activeCategory]);

  if (!isOpen) return null;

  const recentItems = recentTypes
    .map((t) => NODE_CATALOG.find((n) => n.type === t))
    .filter(Boolean) as NodeTypeDefinition[];

  let itemIndex = 0;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 node-picker-backdrop" onClick={onClose} />
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[12vh]">
        <div
          className="w-[480px] max-h-[65vh] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onKeyDown={handleKeyDown}
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nodes..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 px-2 py-1.5 border-b overflow-x-auto">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                !activeCategory ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  activeCategory === cat ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {CATEGORY_CONFIG[cat].emoji} {CATEGORY_CONFIG[cat].label}
              </button>
            ))}
          </div>

          {/* List */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-1.5">
            {flatList.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">No nodes found</div>
            )}

            {CATEGORIES.map((cat) => {
              const catItems = filteredItems.filter((i) => i.category === cat);
              if (catItems.length === 0) return null;
              const cfg = CATEGORY_CONFIG[cat];

              return (
                <div key={cat} className="mb-1">
                  {!activeCategory && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {cfg.emoji} {cfg.label}
                    </div>
                  )}
                  {catItems.map((item) => {
                    const idx = itemIndex++;
                    return (
                      <button
                        key={item.type}
                        data-index={idx}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          idx === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                          style={{ backgroundColor: item.color + '20' }}
                        >
                          {item.icon}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium">{item.label}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{item.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Recently used */}
            {!query && !activeCategory && recentItems.length > 0 && (
              <div className="mt-1 pt-1 border-t">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  🕐 Recently Used
                </div>
                {recentItems.map((item) => (
                  <button
                    key={`recent-${item.type}`}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground flex gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </>
  );
}

function getCenterPosition(getViewport: () => { x: number; y: number; zoom: number }) {
  const vp = getViewport();
  return {
    x: (-vp.x + window.innerWidth / 2) / vp.zoom - 100,
    y: (-vp.y + window.innerHeight / 2) / vp.zoom - 40,
  };
}
