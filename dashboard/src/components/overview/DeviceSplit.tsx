import { DEVICE_META } from '@/components/DeviceLabel';
import { ALL_DEVICES } from '@/lib/filters';
import { shares } from '@/lib/overview';
import type { Device, OverviewResponse } from '@/lib/types';

// Colour follows the device, never its rank (categorical slots 1–3, validated in globals.css).
const SWATCH: Record<Device, string> = { desktop: 'bg-series-1', tablet: 'bg-series-2', mobile: 'bg-series-3' };

/**
 * Part-to-whole for three devices: one thin stacked bar with 2 px surface gaps,
 * and a legend that also carries every value, so nothing depends on colour or hover.
 */
export default function DeviceSplit({ devices }: { devices: OverviewResponse['devices'] }) {
  const counts = ALL_DEVICES.map((device) => devices.find((row) => row.device === device)?.sessions ?? 0);
  const percents = shares(counts);
  const present = ALL_DEVICES.filter((_, i) => counts[i] > 0);

  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded bg-surface" aria-hidden="true">
        {present.map((device) => {
          const i = ALL_DEVICES.indexOf(device);
          return <div key={device} className={`${SWATCH[device]} first:rounded-l last:rounded-r`} style={{ flexGrow: counts[i] }} />;
        })}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {ALL_DEVICES.map((device, i) => {
          const { label, icon: Icon } = DEVICE_META[device];
          return (
            <li key={device} className="flex items-center gap-2">
              <span className={`h-2.5 w-3.5 rounded-[2px] ${SWATCH[device]}`} aria-hidden="true" />
              <Icon className="size-4 text-ink-3" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <span className="tabular-nums text-ink-2">{counts[i].toLocaleString('en')}</span>
              <span className="w-10 text-right tabular-nums text-ink-3">{percents[i]}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
