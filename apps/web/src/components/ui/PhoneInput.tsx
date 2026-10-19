'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/cn';

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

/** Dial codes offered in the picker (most common first). Extend as needed. */
export const COUNTRIES: Country[] = [
  { code: 'AE', name: 'United Arab Emirates', dial: '971', flag: '🇦🇪' },
  { code: 'IN', name: 'India', dial: '91', flag: '🇮🇳' },
  { code: 'SA', name: 'Saudi Arabia', dial: '966', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', dial: '974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', dial: '965', flag: '🇰🇼' },
  { code: 'BH', name: 'Bahrain', dial: '973', flag: '🇧🇭' },
  { code: 'OM', name: 'Oman', dial: '968', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', dial: '92', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', dial: '880', flag: '🇧🇩' },
  { code: 'LK', name: 'Sri Lanka', dial: '94', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', dial: '977', flag: '🇳🇵' },
  { code: 'PH', name: 'Philippines', dial: '63', flag: '🇵🇭' },
  { code: 'EG', name: 'Egypt', dial: '20', flag: '🇪🇬' },
  { code: 'JO', name: 'Jordan', dial: '962', flag: '🇯🇴' },
  { code: 'LB', name: 'Lebanon', dial: '961', flag: '🇱🇧' },
  { code: 'TR', name: 'Turkey', dial: '90', flag: '🇹🇷' },
  { code: 'GB', name: 'United Kingdom', dial: '44', flag: '🇬🇧' },
  { code: 'US', name: 'United States / Canada', dial: '1', flag: '🇺🇸' },
  { code: 'AU', name: 'Australia', dial: '61', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', dial: '49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', dial: '39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dial: '34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', dial: '31', flag: '🇳🇱' },
  { code: 'RU', name: 'Russia', dial: '7', flag: '🇷🇺' },
  { code: 'CN', name: 'China', dial: '86', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', dial: '81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dial: '82', flag: '🇰🇷' },
  { code: 'SG', name: 'Singapore', dial: '65', flag: '🇸🇬' },
  { code: 'MY', name: 'Malaysia', dial: '60', flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia', dial: '62', flag: '🇮🇩' },
  { code: 'ZA', name: 'South Africa', dial: '27', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', dial: '234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', dial: '254', flag: '🇰🇪' },
  { code: 'BR', name: 'Brazil', dial: '55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', dial: '52', flag: '🇲🇽' },
];

const DEFAULT_COUNTRY = 'AE';
// Longest dial code first so "+971…" is never read as "+97…".
const BY_DIAL_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/** Splits a stored "+971501234567" into its country and national number. */
export function splitPhone(value: string): { country: Country; national: string } {
  const digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+')) {
    const match = BY_DIAL_LENGTH.find((c) => digits.startsWith(c.dial));
    if (match) return { country: match, national: digits.slice(match.dial.length) };
  }
  const fallback = COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY)!;
  return { country: fallback, national: digits };
}

function join(country: Country, national: string): string {
  // A leading 0 is the local trunk prefix, not part of the international number.
  const clean = national.replace(/\D/g, '').replace(/^0+/, '');
  return clean ? `+${country.dial}${clean}` : '';
}

/**
 * Phone field with a country-code picker. The value is always stored as "+<code><number>"
 * (e.g. "+971501234567"), or '' when no number has been typed.
 */
export function PhoneInput({
  value,
  onChange,
  placeholder = '50 123 4567',
  className,
  inputClassName,
  required,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const { country, national } = useMemo(() => splitPhone(value), [value]);

  return (
    <div
      className={cn(
        'flex w-full items-stretch overflow-hidden rounded-xl border border-line bg-elevated/70 focus-within:ring-2 focus-within:ring-[var(--ring)]',
        className,
      )}
    >
      <select
        aria-label="Country code"
        value={country.code}
        disabled={disabled}
        onChange={(e) => {
          const next = COUNTRIES.find((c) => c.code === e.target.value) ?? country;
          onChange(join(next, national));
        }}
        className="max-w-[7.5rem] shrink-0 cursor-pointer border-r border-line bg-transparent px-2 text-sm text-fg outline-none"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} +{c.dial} {c.code}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={national}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(join(country, e.target.value))}
        className={cn(
          'min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-fg outline-none placeholder:text-muted/60',
          inputClassName,
        )}
      />
    </div>
  );
}
