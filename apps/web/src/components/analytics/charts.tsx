'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e!.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

function niceMax(v: number): number {
  if (v <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export interface Point {
  date: string;
  value: number;
}

/**
 * Single-series line chart with a crosshair tooltip. One series per chart: two measures on
 * different scales are shown as two charts, never on a dual axis.
 */
export function LineChart({ data, color, label }: { data: Point[]; color: string; label: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 180;
  const pad = { l: 36, r: 12, t: 12, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const x = (i: number) => pad.l + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => pad.t + h - (v / max) * h;
  const path = data
    .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(' ');
  const area = `${path} L${x(data.length - 1)},${pad.t + h} L${x(0)},${pad.t + h} Z`;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(w / 70)));

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label} per day`}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const rel = e.clientX - rect.left - pad.l;
          setHover(
            Math.min(data.length - 1, Math.max(0, Math.round((rel / w) * (data.length - 1)))),
          );
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" />
            <text
              x={pad.l - 6}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-[var(--muted)] text-[10px] tabular-nums"
            >
              {compact.format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.date}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              className="fill-[var(--muted)] text-[10px]"
            >
              {new Date(`${d.date}T12:00:00Z`).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </text>
          ) : null,
        )}
        <motion.path
          d={area}
          fill={color}
          opacity={0.12}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.12 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {hover !== null && data[hover] && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={pad.t + h}
              stroke="var(--muted)"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover)}
              cy={y(data[hover].value)}
              r={5}
              fill={color}
              stroke="var(--bg-elevated)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      <AnimatePresence>
        {hover !== null && data[hover] && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass pointer-events-none absolute top-0 z-10 rounded-xl bg-card-strong px-3 py-2 text-xs shadow-xl"
            style={{ left: Math.min(Math.max(x(hover) - 60, 0), width - 130) }}
          >
            <p className="text-muted">
              {new Date(`${data[hover].date}T12:00:00Z`).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="flex items-center gap-1.5 font-semibold text-fg">
              <span className="size-2 rounded-full" style={{ background: color }} />
              {data[hover].value.toLocaleString()} {label.toLowerCase()}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Horizontal bars (one measure, one color); identity comes from the row label + icon. */
export function BarList({
  rows,
  color,
  unit,
}: {
  rows: { key: string; label: ReactNode; value: number; detail?: string }[];
  color: string;
  unit: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div
          key={r.key}
          className="relative"
          onMouseEnter={() => setHover(r.key)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">{r.label}</span>
            <span className="tabular-nums text-muted">{r.value.toLocaleString()}</span>
          </div>
          <div className="h-2.5 rounded-full bg-line">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color, opacity: hover && hover !== r.key ? 0.5 : 1 }}
              initial={{ width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
          <AnimatePresence>
            {hover === r.key && r.detail && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass pointer-events-none absolute -top-9 right-0 z-10 rounded-xl bg-card-strong px-3 py-1.5 text-xs shadow-xl"
              >
                {r.value.toLocaleString()} {unit} · {r.detail}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
