'use client';

import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function FadeIn({
  delay = 0,
  y = 16,
  className,
  children,
  inView = false,
  ...rest
}: HTMLMotionProps<'div'> & { delay?: number; y?: number; inView?: boolean }) {
  const initial = { opacity: 0, y, filter: 'blur(6px)' };
  const visible = { opacity: 1, y: 0, filter: 'blur(0px)' };
  return (
    <motion.div
      initial={initial}
      {...(inView
        ? { whileInView: visible, viewport: { once: true, margin: '-60px' } }
        : { animate: visible })}
      transition={{ duration: 0.6, delay, ease: EASE_OUT }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE_OUT } },
};

export function Stagger({
  className,
  children,
  inView = false,
}: {
  className?: string;
  children: ReactNode;
  inView?: boolean;
}) {
  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      {...(inView
        ? { whileInView: 'show', viewport: { once: true, margin: '-60px' } }
        : { animate: 'show' })}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

/** Slowly drifting colour blobs behind the whole app: the "alive" background. */
export function GradientBlobs({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const blobs = [
    {
      color: 'var(--blob-a)',
      size: 520,
      x: ['-6%', '8%', '-6%'],
      y: ['-6%', '6%', '-6%'],
      pos: 'left-[-10%] top-[-10%]',
    },
    {
      color: 'var(--blob-b)',
      size: 460,
      x: ['0%', '-12%', '0%'],
      y: ['0%', '10%', '0%'],
      pos: 'right-[-8%] top-[10%]',
    },
    {
      color: 'var(--blob-c)',
      size: 420,
      x: ['0%', '10%', '0%'],
      y: ['0%', '-8%', '0%'],
      pos: 'bottom-[-15%] left-[30%]',
    },
  ];
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}
    >
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={cn('absolute rounded-full opacity-40 blur-[110px] dark:opacity-30', b.pos)}
          style={{ width: b.size, height: b.size, background: b.color }}
          animate={reduce ? undefined : { x: b.x, y: b.y, scale: [1, 1.08, 1] }}
          transition={{ duration: 18 + i * 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--line)_1px,transparent_0)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
    </div>
  );
}

export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'group relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]',
        className,
      )}
    >
      <div className="flex w-max shrink-0 animate-marquee gap-12 pr-12 group-hover:[animation-play-state:paused]">
        {children}
        {children}
      </div>
    </div>
  );
}
