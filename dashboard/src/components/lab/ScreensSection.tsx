'use client';

import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { DEVICE_META } from '@/components/DeviceLabel';
import { TAB_META } from '@/components/Tabs';
import type { Device } from '@/lib/types';
import { dashboardHref, type Tab } from '@/lib/url';

const WIDTHS: Record<Device, number> = { desktop: 1280, tablet: 768, mobile: 390 };
const FRAME_HEIGHT = 860;
const ZOOMS = [0.35, 0.5, 0.75, 1];
type Theme = 'light' | 'dark';

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium ${
    on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
  }`;

/**
 * The real dashboard (live local data) in frames at each device width and
 * theme, side by side. Frames are same-origin pages, so links inside them work.
 */
export default function ScreensSection() {
  const [tab, setTab] = useState<Tab>('sessions');
  const [extra, setExtra] = useState('');
  const [devices, setDevices] = useState<Device[]>(['desktop', 'tablet', 'mobile']);
  const [themes, setThemes] = useState<Theme[]>(['light', 'dark']);
  const [zoom, setZoom] = useState(0.5);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  // The frame's URL: the chosen tab, any extra query (e.g. session=…), and the theme.
  const srcFor = (theme: Theme) => {
    const query = new URLSearchParams(extra.replace(/^[?&]/, ''));
    return dashboardHref(query, { tab, theme });
  };

  return (
    <section aria-labelledby="screens" className="space-y-4">
      <h2 id="screens" className="text-lg font-semibold">Screens</h2>
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-line bg-surface p-3 shadow-xs">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-3">View</span>
          <div className="flex gap-1">
            {(Object.keys(TAB_META) as Tab[]).map((value) => {
              const { label, icon: Icon } = TAB_META[value];
              return (
                <button key={value} type="button" onClick={() => setTab(value)} className={chip(tab === value)}>
                  <Icon className="size-4" aria-hidden="true" /> {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-3">Widths</span>
          <div className="flex gap-1">
            {(Object.keys(WIDTHS) as Device[]).map((device) => {
              const { label, icon: Icon } = DEVICE_META[device];
              return (
                <button key={device} type="button" onClick={() => setDevices(toggle(devices, device))} className={chip(devices.includes(device))}>
                  <Icon className="size-4" aria-hidden="true" /> {label} {WIDTHS[device]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-3">Themes</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setThemes(toggle(themes, 'light'))} className={chip(themes.includes('light'))}>
              <Sun className="size-4" aria-hidden="true" /> Light
            </button>
            <button type="button" onClick={() => setThemes(toggle(themes, 'dark'))} className={chip(themes.includes('dark'))}>
              <Moon className="size-4" aria-hidden="true" /> Dark
            </button>
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-3">Zoom</span>
          <select
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
          >
            {ZOOMS.map((value) => (
              <option key={value} value={value}>
                {Math.round(value * 100)}%
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-56 flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-3">Extra query (optional)</span>
          <input
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
            placeholder="session=seed_… or mode=grid&device=mobile"
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-sm"
          />
        </label>
      </div>

      {themes.map((theme) => (
        <div key={theme} className="space-y-2">
          <h3 className="text-sm font-medium text-ink-2">{theme === 'light' ? 'Light' : 'Dark'}</h3>
          <div className="flex gap-4 overflow-x-auto pb-3">
            {devices.map((device) => {
              const width = WIDTHS[device];
              return (
                <figure key={device} className="shrink-0">
                  <figcaption className="mb-1 text-xs text-ink-3">
                    {DEVICE_META[device].label} · {width} px
                  </figcaption>
                  <div
                    className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"
                    style={{ width: width * zoom, height: FRAME_HEIGHT * zoom }}
                  >
                    <iframe
                      src={srcFor(theme)}
                      title={`${DEVICE_META[device].label} ${theme}`}
                      width={width}
                      height={FRAME_HEIGHT}
                      className="origin-top-left border-0"
                      style={{ transform: `scale(${zoom})` }}
                    />
                  </div>
                </figure>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
