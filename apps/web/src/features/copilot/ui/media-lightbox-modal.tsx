'use client';

import { useState, useRef, useEffect, type MouseEvent, type WheelEvent } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Grid,
  Crosshair,
  Sliders,
  Image as ImageIcon,
  Play,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface ActiveMedia {
  url: string;
  type: 'image' | 'video';
  title?: string;
  caption?: string;
}

export interface MediaLightboxModalProps {
  isOpen: boolean;
  media: ActiveMedia | null;
  onClose: () => void;
}

export function MediaLightboxModal({ isOpen, media, onClose }: MediaLightboxModalProps) {
  const tCopilot = useTranslations('features.copilot');

  const [mode, setMode] = useState<'media' | 'canvas'>('media');
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pixelColor, setPixelColor] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Reset transforms when media changes or opens
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setScale(1);
      setPan({ x: 0, y: 0 });
      setMode('media');
      setCursorPos(null);
      setPixelColor(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, media?.url]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Canvas drawing routine
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Apply pan & scale centered
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(scale, scale);
    ctx.translate(-img.width / 2, -img.height / 2);

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Optional Grid Overlay
    if (showGrid) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)'; // energy-cyan subtle grid
      ctx.lineWidth = 1 / scale;
      const step = 50;
      for (let x = 0; x <= img.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, img.height);
        ctx.stroke();
      }
      for (let y = 0; y <= img.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(img.width, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // Load image object for canvas rendering
  useEffect(() => {
    if (!media || media.type !== 'image' || !isOpen) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = media.url;
    img.onload = () => {
      loadedImageRef.current = img;
      setImageLoaded(true);
    };
  }, [media, isOpen]);

  useEffect(() => {
    if (mode === 'canvas' && imageLoaded) {
      drawCanvas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scale, pan, showGrid, imageLoaded]);

  if (!isOpen || !media) return null;

  // Zoom handlers
  const handleZoomIn = () => setScale((s) => Math.min(s * 1.25, 5));
  const handleZoomOut = () => setScale((s) => Math.max(s / 1.25, 0.25));
  const handleResetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    // Update canvas crosshair & pixel picker
    if (mode === 'canvas' && canvasRef.current && loadedImageRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const img = loadedImageRef.current;
      const cx = canvasRef.current.width / 2 + pan.x;
      const cy = canvasRef.current.height / 2 + pan.y;

      const imgX = Math.round((mouseX - cx) / scale + img.width / 2);
      const imgY = Math.round((mouseY - cy) / scale + img.height / 2);

      if (imgX >= 0 && imgX < img.width && imgY >= 0 && imgY < img.height) {
        setCursorPos({ x: imgX, y: imgY });
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          try {
            const pixel = ctx.getImageData(mouseX, mouseY, 1, 1).data;
            setPixelColor(`rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`);
          } catch {
            // cross-origin restriction safeguard
          }
        }
      } else {
        setCursorPos(null);
        setPixelColor(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = media.url;
    a.download = media.title || `mitsinjo-${media.type}-${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={media.title || tCopilot('mediaMode')}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Top Action & Navigation Bar */}
      <header className="px-4 py-3 border-b border-white/10 bg-black/40 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-white/10 text-white shrink-0">
            {media.type === 'video' ? (
              <Play className="h-4 w-4" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-white truncate">
              {media.title || media.caption || (media.type === 'video' ? 'Video' : 'Image')}
            </h2>
            {media.caption && <p className="text-[11px] text-white/60 truncate">{media.caption}</p>}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher for Images (Media vs Canvas Inspector) */}
          {media.type === 'image' && (
            <div className="flex items-center rounded-lg bg-white/10 p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setMode('media')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                  mode === 'media'
                    ? 'bg-white/20 text-white shadow-xs'
                    : 'text-white/60 hover:text-white'
                )}
              >
                {tCopilot('mediaMode')}
              </button>
              <button
                type="button"
                onClick={() => setMode('canvas')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1',
                  mode === 'canvas'
                    ? 'bg-energy-cyan/20 border border-energy-cyan/40 text-energy-cyan shadow-xs'
                    : 'text-white/60 hover:text-white'
                )}
              >
                <Sliders className="h-3 w-3" />
                <span>{tCopilot('canvasMode')}</span>
              </button>
            </div>
          )}

          {/* Canvas Mode Extras: Grid Overlay */}
          {mode === 'canvas' && (
            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              aria-label={tCopilot('gridOverlay')}
              title={tCopilot('gridOverlay')}
              className={cn(
                'p-2 rounded-lg border text-xs transition-colors cursor-pointer',
                showGrid
                  ? 'bg-energy-cyan/20 border-energy-cyan text-energy-cyan'
                  : 'bg-white/10 border-white/10 text-white/70 hover:text-white hover:bg-white/20'
              )}
            >
              <Grid className="h-4 w-4" />
            </button>
          )}

          {/* Zoom Controls */}
          {media.type === 'image' && (
            <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5 border border-white/10">
              <button
                type="button"
                onClick={handleZoomOut}
                aria-label={tCopilot('zoomOut')}
                title={tCopilot('zoomOut')}
                className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 text-[11px] font-mono text-white/80 min-w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                aria-label={tCopilot('zoomIn')}
                title={tCopilot('zoomIn')}
                className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label={tCopilot('resetZoom')}
                title={tCopilot('resetZoom')}
                className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            aria-label={tCopilot('downloadMedia')}
            title={tCopilot('downloadMedia')}
            className="p-2 rounded-lg bg-white/10 border border-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label={tCopilot('closeLightbox')}
            title={tCopilot('closeLightbox')}
            className="p-2 rounded-lg bg-critical-red/20 border border-critical-red/40 text-critical-red hover:bg-critical-red/30 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Viewport Content Area */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {media.type === 'video' ? (
          <div className="max-w-5xl max-h-[85vh] p-4 flex items-center justify-center">
            {/* Video Player */}
            <video
              src={media.url}
              controls
              autoPlay
              playsInline
              className="max-h-[80vh] max-w-full rounded-xl shadow-2xl border border-white/10 bg-black"
            >
              <track kind="captions" />
            </video>
          </div>
        ) : mode === 'canvas' ? (
          // Canvas Mode Viewport
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            className="max-w-full max-h-[85vh] rounded-xl border border-white/10 shadow-2xl bg-slate-950"
          />
        ) : (
          // Normal Media View
          <div
            className="transition-transform duration-75 ease-out flex items-center justify-center w-full h-full p-4"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.url}
              alt={media.title || media.caption || 'Microgrid Media'}
              draggable={false}
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl pointer-events-none"
            />
          </div>
        )}

        {/* Live Canvas Inspector HUD Overlay */}
        {mode === 'canvas' && cursorPos && (
          <div className="absolute bottom-4 left-4 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 text-xs font-mono text-white shadow-lg pointer-events-none">
            <div className="flex items-center gap-1.5 text-energy-cyan">
              <Crosshair className="h-3.5 w-3.5" />
              <span>
                {tCopilot('inspectCoordinates')}: X={cursorPos.x}, Y={cursorPos.y}
              </span>
            </div>
            {pixelColor && (
              <div className="flex items-center gap-1.5 pl-3 border-l border-white/20">
                <span
                  className="w-3 h-3 rounded-full border border-white/40"
                  style={{ backgroundColor: pixelColor }}
                />
                <span className="text-[11px] text-white/80">{pixelColor}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
