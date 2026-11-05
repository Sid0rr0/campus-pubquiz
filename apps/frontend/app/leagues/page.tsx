'use client';

import { StaffGate } from '@/app/components/staff-gate';
import { LeaguesPanel } from '@/app/leagues/leagues-panel';

export default function LeaguesPage() {
  return (
    <StaffGate adminOnly>
      <LeaguesPanel />
    </StaffGate>
  );
}
