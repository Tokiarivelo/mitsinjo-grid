'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

export interface ResponsiveChartProps {
  /** One Recharts chart (`LineChart`, `BarChart`…). */
  children: ReactElement;
  minHeight?: number;
  debounce?: number;
}

/**
 * `ResponsiveContainer` drawn only while its box has a size: a chart in a hidden panel or tab
 * (0 × 0) is not drawn (before: Recharts warned « width(0) and height(0) of chart should be
 * greater than 0 » in the console). Fills its parent like `width/height="100%"`.
 */
export function ResponsiveChart({ children, minHeight, debounce }: ResponsiveChartProps) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [sized, setSized] = useState(false);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[entries.length - 1]?.contentRect;
      setSized(!!r && r.width > 0 && r.height > 0);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return (
    <div ref={setNode} className="h-full w-full" style={minHeight ? { minHeight } : undefined}>
      {sized && (
        <ResponsiveContainer
          width="100%"
          height="100%"
          {...(minHeight ? { minHeight } : {})}
          {...(debounce ? { debounce } : {})}
        >
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}
