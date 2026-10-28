import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownRenderer } from '../markdown-renderer';

describe('MarkdownRenderer', () => {
  it('renders null if content is empty', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders headings and paragraphs', () => {
    const markdown = `# Main Title\n## Sub Title\n### Section Title\nThis is a standard paragraph with **bold** and *italic* text.`;
    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByText('Main Title')).toBeInTheDocument();
    expect(screen.getByText('Sub Title')).toBeInTheDocument();
    expect(screen.getByText('Section Title')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
  });

  it('renders code blocks with copy button', () => {
    const markdown = '```typescript\nconst solarKw = 45;\n```';
    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText(/const solarKw = 45;/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('renders markdown tables properly', () => {
    const markdown = `| Channel | Value |\n|---|---|\n| Solar Gen | 120 kWh |\n| Unserved | 0 kWh |`;
    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByText('Channel')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Solar Gen')).toBeInTheDocument();
    expect(screen.getByText('120 kWh')).toBeInTheDocument();
  });

  it('renders bullet and ordered lists', () => {
    const markdown = `- Item 1\n- Item 2\n\n1. First step\n2. Second step`;
    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('First step')).toBeInTheDocument();
    expect(screen.getByText('Second step')).toBeInTheDocument();
  });

  it('renders markdown images and triggers onMediaClick', () => {
    const onMediaClick = vi.fn();
    const markdown = `![Microgrid Layout](https://example.com/panel.jpg)`;
    render(<MarkdownRenderer content={markdown} onMediaClick={onMediaClick} />);

    const imgBtn = screen.getByRole('button');
    expect(imgBtn).toBeInTheDocument();
    expect(screen.getByText('Microgrid Layout')).toBeInTheDocument();

    fireEvent.click(imgBtn);
    expect(onMediaClick).toHaveBeenCalledWith({
      url: 'https://example.com/panel.jpg',
      type: 'image',
      title: 'Microgrid Layout',
    });
  });

  it('renders video attachments and identifies video type', () => {
    const onMediaClick = vi.fn();
    const markdown = `![Telemetry Clip](https://example.com/simulation.mp4)`;
    render(<MarkdownRenderer content={markdown} onMediaClick={onMediaClick} />);

    expect(screen.getByText('Telemetry Clip')).toBeInTheDocument();
    expect(screen.getByText('VIDEO')).toBeInTheDocument();

    const videoBtn = screen.getByRole('button');
    fireEvent.click(videoBtn);
    expect(onMediaClick).toHaveBeenCalledWith({
      url: 'https://example.com/simulation.mp4',
      type: 'video',
      title: 'Telemetry Clip',
    });
  });

  it('renders embedded ```chart code blocks as interactive charts', () => {
    const markdown = `Here is the load profile:\n\`\`\`chart\n{\n  "type": "line",\n  "title": "Hourly Load",\n  "series": [{ "key": "val", "label": "Load" }],\n  "data": [{ "hour": "00h", "val": 10 }]\n}\n\`\`\``;
    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByText('Hourly Load')).toBeInTheDocument();
    expect(screen.getByText('line chart')).toBeInTheDocument();
  });
});
