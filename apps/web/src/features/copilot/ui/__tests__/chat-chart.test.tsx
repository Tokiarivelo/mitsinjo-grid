import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatChart } from '../chat-chart';
import type { ChatChartData } from '../../types';

describe('ChatChart', () => {
  it('returns null if data array is empty or undefined', () => {
    // @ts-expect-error test invalid data
    const { container } = render(<ChatChart data={{ type: 'line', data: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders line chart with title and subtitle', () => {
    const chartData: ChatChartData = {
      type: 'line',
      title: '24h Solar Production',
      subtitle: 'Simulated Solar Curve',
      xAxisKey: 'hour',
      series: [{ key: 'solar', label: 'Solar PV (kW)', color: '#f59e0b' }],
      data: [
        { hour: '00h', solar: 0 },
        { hour: '12h', solar: 45 },
      ],
    };

    render(<ChatChart data={chartData} />);
    expect(screen.getByText('24h Solar Production')).toBeInTheDocument();
    expect(screen.getByText('Simulated Solar Curve')).toBeInTheDocument();
    expect(screen.getByText('line chart')).toBeInTheDocument();
  });

  it('renders bar and area charts with badges', () => {
    const barData: ChatChartData = {
      type: 'bar',
      title: 'Sector Deficit',
      xAxisKey: 'sector',
      series: [{ key: 'unserved', label: 'Deficit (kWh)' }],
      data: [{ sector: 'health', unserved: 12 }],
    };

    const { rerender } = render(<ChatChart data={barData} />);
    expect(screen.getByText('Sector Deficit')).toBeInTheDocument();
    expect(screen.getByText('bar chart')).toBeInTheDocument();

    const areaData: ChatChartData = {
      type: 'area',
      title: 'Battery SoC Profile',
      xAxisKey: 'hour',
      series: [{ key: 'soc', label: 'SoC (%)' }],
      data: [{ hour: '00h', soc: 60 }],
    };

    rerender(<ChatChart data={areaData} />);
    expect(screen.getByText('Battery SoC Profile')).toBeInTheDocument();
    expect(screen.getByText('area chart')).toBeInTheDocument();
  });
});
