'use client';

import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'brand-gradient text-white shadow-[0_8px_30px_-8px_rgb(217_70_239/0.6)] hover:shadow-[0_12px_40px_-8px_rgb(217_70_239/0.85)]',
  secondary: 'glass text-fg hover:bg-card-strong',
  ghost: 'text-muted hover:bg-line hover:text-fg',
  danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
};

export const Button = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<'button'> & {
    variant?: ButtonVariant;
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    children?: ReactNode;
  }
>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...props },
  ref,
) {
  const inactive = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileHover={inactive ? undefined : { y: -2, scale: 1.02 }}
      whileTap={inactive ? undefined : { scale: 0.96 }}
      disabled={inactive}
      className={cn(
        'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-[background,box-shadow,color] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-9 px-4 text-sm',
        size === 'md' && 'h-11 px-5 text-sm',
        size === 'lg' && 'h-14 px-8 text-base',
        buttonStyles[variant],
        className,
      )}
      {...props}
    >
      {loading && (
        <motion.span
          className="size-4 rounded-full border-2 border-current border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
        />
      )}
      {children}
    </motion.button>
  );
});

export function Card({ className, children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div className={cn('glass rounded-3xl p-5', className)} {...props}>
      {children}
    </motion.div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, icon, type, className, ...props },
  ref,
) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      <motion.div
        key={error ?? 'ok'}
        animate={error ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          'flex h-12 items-center gap-2.5 rounded-2xl border bg-elevated/60 px-4 transition focus-within:border-fuchsia-400/60 focus-within:ring-4 focus-within:ring-[var(--ring)]',
          error ? 'border-red-400/70' : 'border-line',
        )}
      >
        {icon && <span className="text-muted">{icon}</span>}
        <input
          id={id}
          ref={ref}
          type={isPassword && show ? 'text' : type}
          aria-invalid={!!error}
          className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted/60"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-muted transition hover:text-fg"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-red-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors',
        checked ? 'brand-gradient justify-end' : 'justify-start bg-line',
      )}
    >
      <motion.span
        layout
        className="size-5 rounded-full bg-white shadow-md"
        transition={{ type: 'spring', stiffness: 700, damping: 35 }}
      />
    </button>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-500 dark:text-fuchsia-300',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-xl bg-[linear-gradient(90deg,var(--line)_25%,rgb(255_255_255/0.07)_50%,var(--line)_75%)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

export function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className={cn(
        'brand-gradient inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="glass w-full max-w-md rounded-3xl bg-card-strong p-6"
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-muted hover:bg-line hover:text-fg"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
