import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

// Only variants reused 3+ times across the app survive here — everything
// else (danger outlines, pill actions, dark-drawer icons, one-off adaptive
// colors, ...) turned out to be used once or twice and is cheaper to keep
// as a plain className at its call site than to carry as a named variant.
export type ButtonVariant =
  | 'solid'
  | 'solid-flat'
  | 'outline'
  | 'outline-muted'
  | 'outline-dashed'
  | 'icon'
  | 'icon-danger'
  | 'text-quiet';

// Only sizes reused 3+ times survive here — icon-xl (one mobile nav
// trigger), xl (one CTA tile), and pill (two bonus-form buttons) turned out
// to be single-use and are cheaper to keep as a plain className at their
// call site than to carry as a named size.
export type ButtonSize =
  | 'icon-sm'
  | 'icon-md'
  | 'icon-lg'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Square icon-button dimensions, smallest to largest, plus the handful of
// rectangular geometries reused across the app. `shrink-0` is baked into
// every icon tier unconditionally: it only has an effect when a flex parent
// would otherwise squeeze the button for space, which is never desirable for
// a fixed-size icon button — so it's a safe default even on tiers where the
// original per-call-site class happened to omit it.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  'icon-sm': 'flex h-7 w-7 shrink-0 items-center justify-center',
  'icon-md': 'flex h-8 w-8 shrink-0 items-center justify-center',
  'icon-lg': 'flex h-9 w-9 shrink-0 items-center justify-center',
  xs: 'flex items-center gap-1.5 px-3 py-1.5 text-xs',
  sm: 'flex items-center gap-1.5 px-3 py-1.5 text-sm',
  md: 'flex min-h-10 items-center gap-1.5 px-4',
  lg: 'flex min-h-11 items-center justify-center gap-2 text-sm',
};

// Only the color/shape tokens that are genuinely identical across call
// sites live here — sizing, spacing, and state modifiers (min-h-*, gap-*,
// flex-1, ...) stay in each call site's className so this can't silently
// change layout anywhere it's used. `font-extrabold` and `disabled:*` are
// safe to bake in unconditionally: they're no-ops on icon-only buttons
// (nothing to bold) and on buttons that never receive the `disabled`
// attribute (the `disabled:` variant simply never matches).
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  solid: 'bg-magenta font-display text-white shadow-[0_3px_0_#b8006d]',
  'solid-flat': 'rounded-lg bg-magenta text-sm font-extrabold text-white',
  outline: 'rounded-lg border-2 border-cyan font-extrabold text-cyan',
  'outline-muted':
    'rounded-lg border-2 border-foreground/30 font-extrabold disabled:opacity-40',
  'outline-dashed':
    'rounded-lg border-2 border-dashed border-foreground/30 font-extrabold text-foreground',
  icon: 'rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30',
  'icon-danger':
    'rounded-lg border-2 border-magenta/30 font-extrabold text-magenta disabled:opacity-30',
  'text-quiet':
    'items-center gap-1 text-xs font-extrabold text-foreground/45 underline',
};

/** The single element every button in the app renders through. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant, size, type = 'button', className = '', ...props },
    ref,
  ) {
    const variantClassName = variant ? VARIANT_CLASSES[variant] : '';
    const sizeClassName = size ? SIZE_CLASSES[size] : '';
    return (
      <button
        ref={ref}
        type={type}
        className={[variantClassName, sizeClassName, className]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    );
  },
);
