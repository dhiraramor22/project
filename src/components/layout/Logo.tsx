import { Leaf } from 'lucide-react';
import { cx } from '../ui/primitives';

export function Logo({
  size = 'md',
  inverted = false,
  withText = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean;
  withText?: boolean;
}) {
  const box = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  }[size];
  return (
    <div className="flex items-center gap-3">
      <div
        className={cx(
          'relative flex shrink-0 items-center justify-center rounded-2xl border',
          box,
          inverted
            ? 'border-forest-500/50 bg-forest-800 text-sand-100'
            : 'border-forest-200 bg-forest-50 text-forest-800',
        )}
        aria-hidden
      >
        <Leaf size={size === 'lg' ? 28 : size === 'md' ? 21 : 17} strokeWidth={1.8} />
        <span
          className={cx(
            'absolute -bottom-1 -end-1 h-2.5 w-2.5 rounded-full border',
            inverted ? 'border-forest-900 bg-clay-400' : 'border-white bg-clay-500',
          )}
        />
      </div>
      {withText ? (
        <div className="min-w-0">
          <p
            className={cx(
              'truncate font-display text-sm font-bold leading-tight',
              inverted ? 'text-sand-50' : 'text-ink-900',
            )}
          >
            El Oued
          </p>
          <p className={cx('text-[10px] uppercase tracking-[0.16em]', inverted ? 'text-sand-300' : 'text-ink-500')}>
            DSA prototype
          </p>
        </div>
      ) : null}
    </div>
  );
}
