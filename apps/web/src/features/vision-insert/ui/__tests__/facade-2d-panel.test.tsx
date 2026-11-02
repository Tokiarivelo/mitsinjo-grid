import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { Facade2dPanel } from '../facade-2d-panel';
import type { FacadeData } from '../../hooks/use-facade-2d';

const sampleFacade: FacadeData = {
  imageUrl: 'https://r2.example.com/facade.png',
  fileKey: 'vision/facades/det-1.png',
  prompt: 'Architectural front elevation',
  archetype: 'house',
  detectionId: 'det-1',
  source: 'mock',
};

const renderWithI18n = (ui: React.ReactElement) => render(<I18nProvider>{ui}</I18nProvider>);

describe('Facade2dPanel', () => {
  it('renders idle state with generate button and calls onGenerate on click', () => {
    const onGenerate = vi.fn();
    renderWithI18n(
      <Facade2dPanel
        status="idle"
        userPrompt=""
        onUserPromptChange={vi.fn()}
        onGenerate={onGenerate}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onValidate={vi.fn()}
      />
    );

    const btn = screen.getByRole('button', { name: /imagine 2d facade/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('renders generating state with loader', () => {
    renderWithI18n(
      <Facade2dPanel
        status="generating"
        userPrompt=""
        onUserPromptChange={vi.fn()}
        onGenerate={vi.fn()}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onValidate={vi.fn()}
      />
    );

    expect(screen.getByText(/imagining 2d facade/i)).toBeInTheDocument();
  });

  it('renders ready state with image, input, retry, delete, and validate buttons', () => {
    const onRetry = vi.fn();
    const onDelete = vi.fn();
    const onValidate = vi.fn();
    const onPromptChange = vi.fn();

    renderWithI18n(
      <Facade2dPanel
        status="ready"
        facade={sampleFacade}
        userPrompt="blue wooden door"
        onUserPromptChange={onPromptChange}
        onGenerate={vi.fn()}
        onRetry={onRetry}
        onDelete={onDelete}
        onValidate={onValidate}
      />
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', sampleFacade.imageUrl);

    const input = screen.getByPlaceholderText(/add custom details/i);
    expect(input).toHaveValue('blue wooden door');
    fireEvent.change(input, { target: { value: 'red roof' } });
    expect(onPromptChange).toHaveBeenCalledWith('red roof');

    const retryBtn = screen.getByRole('button', { name: /retry with details/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);

    const deleteBtn = screen.getByRole('button', { name: /delete image/i });
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);

    const validateBtn = screen.getByRole('button', { name: /validate & generate 3d/i });
    fireEvent.click(validateBtn);
    expect(onValidate).toHaveBeenCalledTimes(1);
  });

  it('renders deleting state', () => {
    renderWithI18n(
      <Facade2dPanel
        status="deleting"
        userPrompt=""
        onUserPromptChange={vi.fn()}
        onGenerate={vi.fn()}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onValidate={vi.fn()}
      />
    );

    expect(screen.getByText(/deleting/i)).toBeInTheDocument();
  });
});
