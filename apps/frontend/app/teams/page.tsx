'use client';

import { StaffGate } from '@/app/components/staff-gate';
import { TeamsDirectoryPanel } from '@/app/teams/teams-directory-panel';

export default function TeamsPage() {
  return (
    <StaffGate>
      <TeamsDirectoryPanel />
    </StaffGate>
  );
}
