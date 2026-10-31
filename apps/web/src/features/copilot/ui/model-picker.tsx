import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** i18n key describing each Meta model's job in the picker. */
const MODEL_ROLE_KEYS: Record<string, 'modelRoleChat' | 'modelRoleReasoning' | 'modelRoleImage'> = {
  'muse-spark-1.3': 'modelRoleChat',
  'muse-wonder-1.0': 'modelRoleReasoning',
  'muse-image-1.0': 'modelRoleImage',
};

export interface ModelPickerProps {
  models: string[];
  value: string;
  onChange: (model: string) => void;
  /** `md` page header · `sm` panel header · `terminal` glass terminal status line. */
  size?: 'md' | 'sm' | 'terminal';
  disabled?: boolean;
  className?: string;
}

/** "Model: Auto (Adaptive)" chooser, a plain label when only one model is offered. */
export function ModelPicker({
  models,
  value,
  onChange,
  size = 'md',
  disabled,
  className,
}: ModelPickerProps) {
  const t = useTranslations('features.copilot');
  const label = (m: string) => {
    if (m === 'auto') return t('modelAuto');
    const role = MODEL_ROLE_KEYS[m];
    return role ? `${m} (${t(role)})` : m;
  };
  const text = size === 'md' ? 'text-xs' : 'text-[11px]';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 font-mono min-w-0 max-w-full',
        size === 'md' &&
          'gap-2 px-3 py-1.5 rounded-md bg-surface-elevated border border-border/70 text-xs',
        size === 'sm' && 'px-2 py-1 rounded bg-surface-elevated border border-border text-[11px]',
        size === 'terminal' &&
          'min-h-10 px-3 rounded-full bg-surface/40 border border-border/40 text-[11px]',
        className
      )}
    >
      <span
        className={cn(
          'text-text-muted uppercase font-semibold shrink-0',
          size === 'md' ? 'text-[10px]' : 'text-[9px]'
        )}
      >
        {t('modelSelectorLabel')}
      </span>
      {models.length > 1 ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={t('modelSelectorLabel')}
          className={cn(
            'min-w-0 max-w-full truncate bg-transparent text-energy-cyan font-medium border-none focus:outline-none cursor-pointer disabled:opacity-50',
            text
          )}
        >
          {models.map((m) => (
            <option key={m} value={m} className="bg-surface text-text-primary">
              {label(m)}
            </option>
          ))}
        </select>
      ) : (
        <span className={cn('text-energy-cyan font-medium', text)}>{label(value || 'auto')}</span>
      )}
    </div>
  );
}
