'use client';

import { Lasso, PenLine, Plus, Send, Square, Trash2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { useShapeEditor } from '../hooks/use-shape-editor';
import type { EdgeMapState } from '../hooks/use-edge-map';
import { DRAW_TOOLS, type DrawTool } from '../utils/shapes';

type Editor = ReturnType<typeof useShapeEditor>;

export interface DrawPanelProps {
  editor: Editor;
  tool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  edges: EdgeMapState;
  onSend: () => void;
  onCancel: () => void;
}

const TOOL_ICON = { box: Square, free: PenLine, lasso: Lasso } as const;
const TOOL_KEY = { box: 'toolBox', free: 'toolFree', lasso: 'toolLasso' } as const;

const button =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'border border-border bg-surface text-text-primary hover:bg-surface-hover';

/**
 * Under the photo while drawing (PV-T8): tool choice, one row per shape (what it is, free text;
 * select to edit; remove), then « Send the object(s) » to the vision model.
 */
export function DrawPanel({
  editor,
  tool: current,
  onToolChange,
  edges,
  onSend,
  onCancel,
}: DrawPanelProps) {
  const t = useTranslations('features.visionInsert');
  const count = editor.shapes.length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-energy-cyan/40 bg-energy-cyan/5 p-3">
      <div role="group" aria-label={t('toolsLabel')} className="grid grid-cols-3 gap-1.5">
        {DRAW_TOOLS.map((tool: DrawTool) => {
          const Icon = TOOL_ICON[tool];
          const on = current === tool;
          return (
            <button
              key={tool}
              type="button"
              aria-pressed={on}
              onClick={() => onToolChange(tool)}
              className={cn(
                button,
                'px-2',
                on ? 'border border-energy-cyan bg-energy-cyan/15 text-text-primary' : secondary
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(TOOL_KEY[tool])}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-secondary">
        {current === 'lasso' && edges.status === 'unavailable' ? t('lassoNoEdges') : t('drawHint')}
      </p>

      {count > 0 && (
        <ul className="flex flex-col gap-2">
          {editor.shapes.map((s, i) => {
            const on = s.id === editor.activeId;
            const n = i + 1;
            return (
              <li
                key={s.id}
                className={cn(
                  'flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-end',
                  on ? 'border-solar-amber/60 bg-solar-amber/10' : 'border-border bg-surface'
                )}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => editor.select(s.id)}
                  className={cn(button, secondary, 'shrink-0 justify-start')}
                >
                  {t('shapeName', { n })}
                </button>
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-text-secondary">
                  {t('hintLabel')}
                  <input
                    value={s.hint}
                    maxLength={40}
                    onChange={(e) => editor.setHint(s.id, e.target.value)}
                    onFocus={() => editor.select(s.id)}
                    placeholder={t('hintPlaceholder')}
                    className="min-h-11 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-cyan"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => editor.remove(s.id)}
                  aria-label={t('removeShape', { n })}
                  className={cn(button, secondary, 'w-11 shrink-0 px-0 hover:text-critical-red')}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {editor.full && <p className="text-xs text-text-muted">{t('shapesLimit')}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={editor.addBox}
            disabled={editor.full}
            className={cn(button, secondary)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('addBox')}
          </button>
          {count > 0 && (
            <button type="button" onClick={editor.clear} className={cn(button, secondary)}>
              {t('clearShapes')}
            </button>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={onCancel} className={cn(button, secondary)}>
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={count === 0}
            className={cn(button, 'bg-energy-cyan px-4 text-slate-950 hover:bg-energy-cyan/90')}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {count > 1 ? t('sendMany', { count }) : t('sendOne')}
          </button>
        </div>
      </div>
    </div>
  );
}
