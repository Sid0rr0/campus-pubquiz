'use client';

import { StaffGate } from '@/app/components/staff-gate';
import { UsersPanel } from '@/app/users/users-panel';

export default function UsersPage() {
  return (
    <StaffGate adminOnly>
      <UsersPanel />
    </StaffGate>
  );
}
