import { type LucideIcon, Monitor, Smartphone, Tablet } from 'lucide-react';
import type { Device } from '@/lib/types';

export const DEVICE_META: Record<Device, { label: string; icon: LucideIcon }> = {
  desktop: { label: 'Desktop', icon: Monitor },
  tablet: { label: 'Tablet', icon: Tablet },
  mobile: { label: 'Phone', icon: Smartphone },
};

/** A device bucket as icon + text (icons always come with a label). */
export default function DeviceLabel({ device }: { device: Device }) {
  const { label, icon: Icon } = DEVICE_META[device];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
      {label}
    </span>
  );
}
