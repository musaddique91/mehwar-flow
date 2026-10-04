import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';

interface WordmarkProps {
  className?: string;
  href?: string;
  height?: number;
  priority?: boolean;
}

export function Wordmark({ className, href, height = 32, priority = false }: WordmarkProps) {
  const width = Math.round(height * (900 / 271));

  const content = (
    <div className={cn('relative inline-flex items-center', className)}>
      <Image
        src="/brand/maverick-wordmark.png"
        alt="Maverick Ignite Solutions"
        width={width}
        height={height}
        className="block dark:hidden object-contain"
        priority={priority}
      />
      <Image
        src="/brand/maverick-wordmark-white.png"
        alt="Maverick Ignite Solutions"
        width={width}
        height={height}
        className="hidden dark:block object-contain"
        priority={priority}
      />
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-block transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      >
        {content}
      </Link>
    );
  }

  return content;
}
