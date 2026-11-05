'use client';

import { StaffGate } from '@/app/components/staff-gate';
import { PlayedSessionsPanel } from '@/app/stats/played-sessions-panel';

export default function StatsPage() {
  return (
    <StaffGate>
      <PlayedSessionsPanel />
    </StaffGate>
  );
}
