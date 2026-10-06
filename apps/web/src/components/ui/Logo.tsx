import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}

export function Logo({
  className,
  href = '/',
  size = 'md',
  subtitle,
}: LogoProps) {
  const iconDimensions = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;
  const containerClasses =
    size === 'sm'
      ? 'size-7 rounded-lg p-0.5'
      : size === 'lg'
        ? 'size-11 rounded-2xl p-1'
        : 'size-9 rounded-xl p-1';

  return (
    <Link
      href={href}
      className={cn('group flex items-center gap-2.5 font-bold tracking-tight', className)}
    >
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-md shadow-cyan-500/10 ring-1 ring-black/10 transition-transform group-hover:scale-105 group-hover:rotate-3 dark:ring-white/20',
          containerClasses,
        )}
      >
        <Image
          src="/brand/maverick-pwa-192.png"
          alt="Mehwar - Maverick Social Hub Logo"
          width={iconDimensions}
          height={iconDimensions}
          className="size-full object-contain"
          priority
        />
      </span>
      <div className="flex flex-col leading-tight">
        <span className={cn('font-bold tracking-tight', size === 'lg' ? 'text-xl' : 'text-lg')}>
          Mehwar<span className="brand-text">Flow</span>
        </span>
        {subtitle && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {subtitle}
          </span>
        )}
      </div>
    </Link>
  );
}
