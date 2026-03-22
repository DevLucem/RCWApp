'use client';

import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface NodeProps {
  value: JsonValue;
  /** Key name from parent object (undefined for array items / root) */
  propKey?: string;
  /** Array index from parent array (undefined for object props / root) */
  propIndex?: number;
  depth: number;
  /** Whether this node starts collapsed */
  initiallyCollapsed?: boolean;
  isLast?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const INDENT = 16; // px per depth level

function getPreview(value: JsonValue): string {
  if (Array.isArray(value)) return `[…] ${value.length} item${value.length !== 1 ? 's' : ''}`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    return `{ ${keys.join(', ')} }`;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Primitive leaf
// ---------------------------------------------------------------------------
function PrimitiveValue({ value }: { value: string | number | boolean | null }) {
  if (value === null) return <span className="text-rose-600 dark:text-rose-400">null</span>;
  if (typeof value === 'boolean')
    return <span className="text-amber-600 dark:text-amber-300">{String(value)}</span>;
  if (typeof value === 'number')
    return <span className="text-cyan-700 dark:text-cyan-300">{String(value)}</span>;
  // string
  return (
    <span className="text-emerald-700 dark:text-emerald-300">
      &quot;{value}&quot;
    </span>
  );
}

// ---------------------------------------------------------------------------
// Key label
// ---------------------------------------------------------------------------
function KeyLabel({ name }: { name: string }) {
  return <span className="text-violet-700 dark:text-violet-300">&quot;{name}&quot;</span>;
}

// ---------------------------------------------------------------------------
// Collapse toggle button
// ---------------------------------------------------------------------------
function Toggle({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center w-4 h-4 mr-0.5 rounded hover:bg-white/10 transition-colors shrink-0 text-muted-foreground hover:text-foreground"
      aria-label={collapsed ? 'Expand' : 'Collapse'}
    >
      {collapsed ? (
        <ChevronRight className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Bracket colours
// ---------------------------------------------------------------------------
const BRACKET_COLORS = [
  'text-yellow-600 dark:text-yellow-300',
  'text-pink-600 dark:text-pink-300',
  'text-blue-600 dark:text-blue-300',
  'text-orange-600 dark:text-orange-300',
  'text-teal-600 dark:text-teal-300',
];
function bracketColor(depth: number) {
  return BRACKET_COLORS[depth % BRACKET_COLORS.length];
}

// ---------------------------------------------------------------------------
// Main recursive node
// ---------------------------------------------------------------------------
function JsonNode({ value, propKey, propIndex, depth, initiallyCollapsed = false, isLast = true }: NodeProps) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const toggle = useCallback(() => setCollapsed(c => !c), []);

  const isArray = Array.isArray(value);
  const isObject = !isArray && value !== null && typeof value === 'object';
  const isComplex = isArray || isObject;

  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';
  const bColor = bracketColor(depth);

  // Label prefix (key or index)
  const label =
    propKey !== undefined ? (
      <>
        <KeyLabel name={propKey} />
        <span className="text-muted-foreground">: </span>
      </>
    ) : propIndex !== undefined ? null : null;

  const comma = !isLast ? <span className="text-muted-foreground">,</span> : null;

  if (!isComplex) {
    return (
      <div className="flex items-start leading-6" style={{ paddingLeft: depth * INDENT }}>
        <span className="w-4 shrink-0" /> {/* spacer where toggle would be */}
        <span>
          {label}
          <PrimitiveValue value={value as string | number | boolean | null} />
          {comma}
        </span>
      </div>
    );
  }

  // Complex node
  const entries = isArray
    ? (value as JsonValue[]).map((v, i) => ({ key: undefined as string | undefined, index: i, val: v }))
    : Object.entries(value as Record<string, JsonValue>).map(([k, v]) => ({
        key: k,
        index: undefined as number | undefined,
        val: v,
      }));

  return (
    <div style={{ paddingLeft: depth === 0 ? 0 : depth * INDENT }}>
      {/* Opening line */}
      <div className="flex items-center leading-6 group overflow-hidden whitespace-nowrap">
        <Toggle collapsed={collapsed} onClick={toggle} />
        <span className="flex items-center min-w-0">
          <span className="shrink-0">
            {label}
            <span className={cn('font-semibold', bColor)}>{open}</span>
          </span>
          {collapsed && (
            <>
              <span
                className="text-muted-foreground/60 text-xs cursor-pointer hover:text-foreground transition-colors mx-1 select-none truncate"
                onClick={toggle}
              >
                {getPreview(value)}
              </span>
              <span className={cn('font-semibold shrink-0', bColor)}>{close}</span>
              <span className="shrink-0">{comma}</span>
            </>
          )}
        </span>
      </div>

      {/* Children */}
      {!collapsed && (
        <>
          {entries.map((entry, i) => (
            <JsonNode
              key={entry.key ?? entry.index}
              value={entry.val}
              propKey={entry.key}
              propIndex={entry.index}
              depth={depth + 1}
              initiallyCollapsed={false}
              isLast={i === entries.length - 1}
            />
          ))}
          {/* Closing bracket */}
          <div className="flex items-center leading-6" style={{ paddingLeft: (depth + 1) * INDENT - INDENT }}>
            <span className="w-4 shrink-0" />
            <span>
              <span className={cn('font-semibold', bColor)}>{close}</span>
              {comma}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
interface JsonViewerProps {
  value: string; // raw JSON string
  className?: string;
}

export function JsonViewer({ value, className }: JsonViewerProps) {
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(value);
  } catch {
    // Not valid JSON — fall back to plain text
    return (
      <pre className={cn('p-4 font-code text-sm whitespace-pre-wrap break-all text-foreground', className)}>
        <code>{value}</code>
      </pre>
    );
  }

  return (
    <div className={cn('p-4 font-code text-sm select-text', className)}>
      <JsonNode value={parsed} depth={0} initiallyCollapsed={false} isLast={true} />
    </div>
  );
}
