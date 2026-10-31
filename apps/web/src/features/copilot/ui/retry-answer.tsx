import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';

/** "Retry" under the last answer, or the note on an answer that was redone. */
export function RetryAnswer({ onRetry, retried }: { onRetry?: () => void; retried?: boolean }) {
  const t = useTranslations('features.copilot.retry');
  if (retried) {
    return <p className="text-[11px] font-mono text-text-muted">{t('retriedNote')}</p>;
  }
  if (!onRetry) return null;
  return (
    <div className="flex">
      <Button
        variant="secondary"
        size="sm"
        onClick={onRetry}
        icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
        title={t('hint')}
        className="min-h-11 w-full @md:w-auto justify-center"
      >
        {t('button')}
      </Button>
    </div>
  );
}
