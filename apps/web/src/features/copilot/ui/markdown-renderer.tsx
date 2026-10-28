'use client';

import { useState, type ReactNode } from 'react';
import { Copy, Check, ExternalLink, Play, Image as ImageIcon } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ChatChart } from './chat-chart';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  onMediaClick?: (media: { url: string; type: 'image' | 'video'; title?: string }) => void;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const tCopilot = useTranslations('features.copilot');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <div className="my-2.5 rounded-lg border border-border/80 bg-canvas overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-elevated/80 border-b border-border/60 text-[10px] font-mono text-text-muted">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? tCopilot('codeCopied') : tCopilot('codeCopy')}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-energy-cyan" />
              <span className="text-energy-cyan font-medium">{tCopilot('codeCopied')}</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>{tCopilot('codeCopy')}</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono text-text-primary overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInlineFormatting(
  text: string,
  onMediaClick?: (media: { url: string; type: 'image' | 'video'; title?: string }) => void
): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenize regex for: images ![alt](url), links [text](url), inline code `code`, bold **text**, italic *text*, strikethrough ~~text~~
  const tokenRegex =
    /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(~~([^~]+)~~)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];

    // Image: ![alt](url)
    if (fullMatch.startsWith('![')) {
      const alt = match[2] || '';
      const url = match[3] || '';
      const isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
      nodes.push(
        <button
          key={`media-${keyIdx++}`}
          type="button"
          onClick={() => onMediaClick?.({ url, type: isVideo ? 'video' : 'image', title: alt })}
          className="inline-flex items-center gap-1.5 my-1.5 p-1 rounded-lg border border-border/80 bg-surface hover:border-energy-cyan/80 transition-all cursor-pointer group text-left max-w-full"
        >
          {isVideo ? (
            <div className="relative w-16 h-12 rounded bg-black/60 flex items-center justify-center overflow-hidden shrink-0">
              <Play className="h-5 w-5 text-white fill-white/80" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={alt}
              className="w-16 h-12 object-cover rounded shrink-0 bg-surface-elevated"
              loading="lazy"
            />
          )}
          <div className="px-1.5 text-left min-w-0">
            <span className="text-[11px] font-medium text-text-primary group-hover:text-energy-cyan truncate block">
              {alt || url.split('/').pop()}
            </span>
            <span className="text-[9px] font-mono text-text-muted flex items-center gap-1">
              {isVideo ? <Play className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
              {isVideo ? 'VIDEO' : 'IMAGE'}
            </span>
          </div>
        </button>
      );
    }
    // Link: [text](url)
    else if (match[4]) {
      const linkText = match[5] || '';
      const linkUrl = match[6] || '#';
      nodes.push(
        <a
          key={`link-${keyIdx++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-energy-cyan hover:underline underline-offset-2 font-medium"
        >
          <span>{linkText}</span>
          <ExternalLink className="h-2.5 w-2.5 inline opacity-70" />
        </a>
      );
    }
    // Inline code: `code`
    else if (match[7]) {
      nodes.push(
        <code
          key={`code-${keyIdx++}`}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-surface-elevated border border-border/60 text-[11px] font-mono text-energy-cyan"
        >
          {match[8] || ''}
        </code>
      );
    }
    // Bold: **text**
    else if (match[9]) {
      nodes.push(
        <strong key={`bold-${keyIdx++}`} className="font-semibold text-text-primary">
          {match[10] || ''}
        </strong>
      );
    }
    // Italic: *text*
    else if (match[11]) {
      nodes.push(
        <em key={`italic-${keyIdx++}`} className="italic text-text-primary">
          {match[12] || ''}
        </em>
      );
    }
    // Strikethrough: ~~text~~
    else if (match[13]) {
      nodes.push(
        <s key={`strike-${keyIdx++}`} className="line-through text-text-muted">
          {match[14] || ''}
        </s>
      );
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function MarkdownRenderer({ content, className, onMediaClick }: MarkdownRendererProps) {
  if (!content) return null;

  // Split into blocks: code blocks, tables, blockquotes, lists, headings, paragraphs
  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let blockKey = 0;

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    if (rawLine === undefined) {
      i++;
      continue;
    }
    const line = rawLine.trim();

    // 1. Code Block or Interactive Chart: ```chart
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine === undefined || nextLine.trim().startsWith('```')) {
          break;
        }
        codeLines.push(nextLine);
        i++;
      }
      i++; // skip closing ```

      if (lang === 'chart' || lang === 'json:chart') {
        let chartData: { data?: unknown[] } | null = null;
        try {
          chartData = JSON.parse(codeLines.join('\n'));
        } catch {
          // fall through to code block on malformed JSON
        }
        if (chartData && chartData.data && Array.isArray(chartData.data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          elements.push(<ChatChart key={`chart-${blockKey++}`} data={chartData as any} />);
          continue;
        }
      }

      elements.push(
        <CodeBlock key={`block-${blockKey++}`} code={codeLines.join('\n')} language={lang} />
      );
      continue;
    }

    // 2. Headings: #, ##, ###
    const headingMatch = rawLine.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const parsedHeading = renderInlineFormatting(headingText, onMediaClick);

      if (level === 1) {
        elements.push(
          <h1
            key={`h1-${blockKey++}`}
            className="text-base font-semibold font-display text-text-primary mt-3 mb-1.5"
          >
            {parsedHeading}
          </h1>
        );
      } else if (level === 2) {
        elements.push(
          <h2
            key={`h2-${blockKey++}`}
            className="text-sm font-semibold font-display text-text-primary mt-2.5 mb-1"
          >
            {parsedHeading}
          </h2>
        );
      } else {
        elements.push(
          <h3
            key={`h3-${blockKey++}`}
            className="text-xs font-semibold uppercase tracking-wider font-mono text-energy-cyan mt-2 mb-1"
          >
            {parsedHeading}
          </h3>
        );
      }
      i++;
      continue;
    }

    // 3. Blockquote: > text
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const qLine = lines[i];
        if (qLine === undefined || !qLine.trim().startsWith('>')) {
          break;
        }
        quoteLines.push(qLine.replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote
          key={`quote-${blockKey++}`}
          className="my-2 pl-3 border-l-2 border-ai-violet/50 text-xs italic text-text-secondary leading-relaxed bg-surface/40 py-1 rounded-r"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{renderInlineFormatting(ql, onMediaClick)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 4. Markdown Table: starts with | and contains |
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length) {
        const tLine = lines[i];
        if (tLine === undefined || !tLine.trim().startsWith('|') || !tLine.trim().endsWith('|')) {
          break;
        }
        tableLines.push(tLine.trim());
        i++;
      }

      if (tableLines.length >= 2 && tableLines[0]) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        // line 1 is separator |---|---|
        const bodyRows = tableLines.slice(2).map((row) =>
          row
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        );

        elements.push(
          <div
            key={`table-${blockKey++}`}
            className="my-3 overflow-x-auto rounded-lg border border-border/70 bg-surface shadow-xs"
          >
            <table className="w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="border-b border-border/60 bg-surface-elevated text-text-muted text-[10px]">
                  {headerRow.map((col, cIdx) => (
                    <th key={cIdx} className="py-1.5 px-3 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 text-text-primary">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-surface-elevated/40">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="py-1.5 px-3">
                        {renderInlineFormatting(cell, onMediaClick)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 5. Unordered List: - or *
    if (/^\s*[-*]\s+/.test(rawLine)) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const lLine = lines[i];
        if (lLine === undefined || !/^\s*[-*]\s+/.test(lLine)) {
          break;
        }
        listItems.push(lLine.replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${blockKey++}`} className="my-1.5 space-y-1 pl-4 list-disc text-xs">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx} className="text-text-primary leading-relaxed marker:text-energy-cyan">
              {renderInlineFormatting(item, onMediaClick)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Ordered List: 1.
    if (/^\s*\d+\.\s+/.test(rawLine)) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const oLine = lines[i];
        if (oLine === undefined || !/^\s*\d+\.\s+/.test(oLine)) {
          break;
        }
        listItems.push(oLine.replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${blockKey++}`} className="my-1.5 space-y-1 pl-4 list-decimal text-xs">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx} className="text-text-primary leading-relaxed marker:text-ai-violet">
              {renderInlineFormatting(item, onMediaClick)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Regular paragraph / empty line
    if (!line) {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i];
      if (
        pLine === undefined ||
        !pLine.trim() ||
        pLine.trim().startsWith('```') ||
        pLine.trim().startsWith('#') ||
        pLine.trim().startsWith('>') ||
        /^\s*[-*]\s+/.test(pLine) ||
        /^\s*\d+\.\s+/.test(pLine) ||
        (pLine.trim().startsWith('|') && pLine.trim().endsWith('|'))
      ) {
        break;
      }
      paraLines.push(pLine);
      i++;
    }

    elements.push(
      <p key={`p-${blockKey++}`} className="text-text-primary text-xs leading-relaxed my-1">
        {paraLines.map((pl, plIdx) => (
          <span key={plIdx}>
            {plIdx > 0 && <br />}
            {renderInlineFormatting(pl, onMediaClick)}
          </span>
        ))}
      </p>
    );
  }

  return <div className={cn('space-y-1', className)}>{elements}</div>;
}
