import type { IconType } from 'react-icons';
import {
  SiFacebook,
  SiInstagram,
  SiSnapchat,
  SiThreads,
  SiTiktok,
  SiX,
  SiYoutube,
} from 'react-icons/si';
import type { Platform } from '@mehwar/shared';

export interface PlatformBrand {
  icon: IconType;
  /** Solid brand color. */
  color: string;
  /** Gradient used for rings and chips. */
  gradient: string;
}

export const PLATFORM_BRAND: Record<Platform, PlatformBrand> = {
  x: { icon: SiX, color: '#e7e9ea', gradient: 'linear-gradient(135deg,#3f3f46,#0a0a0a)' },
  facebook: {
    icon: SiFacebook,
    color: '#1877f2',
    gradient: 'linear-gradient(135deg,#60a5fa,#1877f2)',
  },
  instagram: {
    icon: SiInstagram,
    color: '#e1306c',
    gradient: 'linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)',
  },
  threads: {
    icon: SiThreads,
    color: '#f5f5f5',
    gradient: 'linear-gradient(135deg,#52525b,#18181b)',
  },
  youtube: {
    icon: SiYoutube,
    color: '#ff0033',
    gradient: 'linear-gradient(135deg,#ff6b6b,#ff0033)',
  },
  tiktok: {
    icon: SiTiktok,
    color: '#25f4ee',
    gradient: 'linear-gradient(135deg,#25f4ee,#000000 55%,#fe2c55)',
  },
  snapchat: {
    icon: SiSnapchat,
    color: '#fffc00',
    gradient: 'linear-gradient(135deg,#fffc00,#facc15)',
  },
};

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = PLATFORM_BRAND[platform].icon;
  return <Icon className={className} aria-hidden />;
}
