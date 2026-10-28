'use client';

import { useState, useRef, useEffect, type PointerEvent } from 'react';
import { PenTool, Eraser, Trash2, Check, X, Edit3 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMediaItem } from '../types';

export interface CanvasSketchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (media: ChatMediaItem) => void;
}

const COLOR_PRESETS = [
  { id: 'cyan', color: '#38bdf8', label: 'Energy Cyan' },
  { id: 'amber', color: '#f59e0b', label: 'Solar Amber' },
  { id: 'violet', color: '#a855f7', label: 'AI Violet' },
  { id: 'red', color: '#ef4444', label: 'Critical Red' },
  { id: 'white', color: '#f8fafc', label: 'White' },
  { id: 'slate', color: '#64748b', label: 'Slate' },
];

const STROKE_SIZES = [
  { size: 2, label: 'Fine' },
  { size: 4, label: 'Medium' },
  { size: 8, label: 'Thick' },
];

export function CanvasSketchDialog({ isOpen, onClose, onAttach }: CanvasSketchDialogProps) {
  const tCopilot = useTranslations('features.copilot');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#38bdf8');
  const [strokeSize, setStrokeSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  // Initialize canvas background when opened
  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure canvas element dimensions are mounted
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#090d16'; // dark canvas background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Light initial grid dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      const step = 24;
      for (let x = 12; x < canvas.width; x += step) {
        for (let y = 12; y < canvas.height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // redraw grid dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    const step = 24;
    for (let x = 12; x < canvas.width; x += step) {
      for (let y = 12; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const getCanvasCoords = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const coords = getCanvasCoords(e);
    setLastPoint(coords);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(coords.x, coords.y, strokeSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'eraser' ? '#090d16' : color;
    ctx.fill();
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPoint) return;
    const coords = getCanvasCoords(e);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = tool === 'eraser' ? '#090d16' : color;
    ctx.lineWidth = tool === 'eraser' ? strokeSize * 3 : strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    setLastPoint(coords);
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    setLastPoint(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleAttach = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let dataUrl = '';
    try {
      dataUrl = canvas.toDataURL('image/png') || '';
    } catch {
      dataUrl = '';
    }

    if (!dataUrl) {
      dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }

    const mediaItem: ChatMediaItem = {
      id: `sketch-${Date.now()}`,
      url: dataUrl,
      type: 'image',
      name: `sketch-${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '')}.png`,
    };

    onAttach(mediaItem);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sketch-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-surface-elevated flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-energy-cyan/15 text-energy-cyan">
              <Edit3 className="h-4 w-4" />
            </div>
            <div>
              <h3 id="sketch-dialog-title" className="text-sm font-semibold text-text-primary">
                {tCopilot('canvasTitle')}
              </h3>
              <p className="text-[11px] text-text-secondary">{tCopilot('canvasInstructions')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tCopilot('closeLightbox')}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-border/70 bg-surface flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tools: Pen & Eraser */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTool('pen')}
              aria-label={tCopilot('penTool')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
                tool === 'pen'
                  ? 'bg-energy-cyan/20 border border-energy-cyan/40 text-energy-cyan'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              )}
            >
              <PenTool className="h-3.5 w-3.5" />
              <span>{tCopilot('penTool')}</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              aria-label={tCopilot('eraserTool')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer',
                tool === 'eraser'
                  ? 'bg-solar-amber/20 border border-solar-amber/40 text-solar-amber'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              )}
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>{tCopilot('eraserTool')}</span>
            </button>
          </div>

          {/* Color Presets */}
          {tool === 'pen' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted font-mono uppercase">
                {tCopilot('strokeColor')}:
              </span>
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setColor(preset.color)}
                    aria-label={preset.label}
                    title={preset.label}
                    className={cn(
                      'w-5 h-5 rounded-full border transition-all cursor-pointer',
                      color === preset.color
                        ? 'border-white scale-110 shadow-sm ring-2 ring-energy-cyan/50'
                        : 'border-white/20 opacity-80 hover:opacity-100'
                    )}
                    style={{ backgroundColor: preset.color }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Stroke Widths */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted font-mono uppercase">
              {tCopilot('strokeSize')}:
            </span>
            <div className="flex items-center gap-1">
              {STROKE_SIZES.map((s) => (
                <button
                  key={s.size}
                  type="button"
                  onClick={() => setStrokeSize(s.size)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer',
                    strokeSize === s.size
                      ? 'bg-energy-cyan/20 text-energy-cyan border border-energy-cyan/40'
                      : 'bg-surface-elevated text-text-muted hover:text-text-primary'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Canvas */}
          <button
            type="button"
            onClick={handleClear}
            aria-label={tCopilot('clearCanvas')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-critical-red bg-critical-red/10 border border-critical-red/30 hover:bg-critical-red/20 transition-colors cursor-pointer ml-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{tCopilot('clearCanvas')}</span>
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-4 bg-canvas/60 flex items-center justify-center overflow-auto">
          <canvas
            ref={canvasRef}
            width={760}
            height={460}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="rounded-xl border border-border shadow-inner cursor-crosshair touch-none max-w-full h-auto bg-[#090d16]"
          />
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-border bg-surface-elevated flex items-center justify-end gap-2.5">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {tCopilot('proposalReject')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAttach}
            icon={<Check className="h-3.5 w-3.5" />}
            className="bg-energy-cyan hover:bg-energy-cyan/90 text-surface font-semibold"
          >
            {tCopilot('attachDrawing')}
          </Button>
        </div>
      </div>
    </div>
  );
}
