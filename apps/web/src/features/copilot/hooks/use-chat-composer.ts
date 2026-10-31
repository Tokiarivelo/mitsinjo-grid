import {
  useCallback,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { readAsDataUrl } from '@/lib/files';
import type { ChatMediaItem } from '../types';

/** Reads image / video files as data URLs (uploaded to storage when sent). */
async function readMedia(file: File): Promise<ChatMediaItem | null> {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) return null;
  const url = await readAsDataUrl(file);
  return url
    ? {
        id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url,
        type: isVideo ? 'video' : 'image',
        name: file.name,
        size: file.size,
      }
    : null;
}

/**
 * State of a chat input: text, attachments (picker, paste, drag & drop, sketch) and send.
 * Shared by the copilot workspace and the full-screen terminal.
 */
export function useChatComposer({
  onSend,
  pending,
}: {
  onSend: (prompt: string, media?: ChatMediaItem[]) => void;
  pending: boolean;
}) {
  const [input, setInput] = useState('');
  const [attachedMedia, setAttachedMedia] = useState<ChatMediaItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const addMedia = useCallback((media: ChatMediaItem) => {
    setAttachedMedia((prev) => [...prev, media]);
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      void readMedia(file).then((media) => {
        if (media) setAttachedMedia((prev) => [...prev, media]);
      });
    }
  }, []);

  const removeMedia = useCallback((id: string) => {
    setAttachedMedia((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /** Speech-to-text result goes after what is already typed, editable before sending. */
  const appendText = useCallback(
    (text: string) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text)),
    []
  );

  const canSend = (input.trim().length > 0 || attachedMedia.length > 0) && !pending;

  const send = useCallback(() => {
    if (!canSend) return;
    onSend(input, attachedMedia);
    setInput('');
    setAttachedMedia([]);
  }, [canSend, onSend, input, attachedMedia]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.clipboardData.files.length > 0) addFiles(e.clipboardData.files);
  };

  const dropZone = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsDraggingOver(true);
    },
    onDragLeave: () => setIsDraggingOver(false),
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
  };

  return {
    input,
    setInput,
    attachedMedia,
    addMedia,
    addFiles,
    removeMedia,
    appendText,
    isDraggingOver,
    canSend,
    send,
    onKeyDown,
    onPaste,
    dropZone,
  };
}

export type ChatComposerState = ReturnType<typeof useChatComposer>;
