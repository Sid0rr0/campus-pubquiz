'use client';

import { useParams } from 'next/navigation';
import { StaffGate } from '@/app/components/staff-gate';
import { TeamDetailPanel } from '@/app/teams/[id]/team-detail-panel';

/** One team's history across its ended sessions — /teams/<teamId>. Any
 * authenticated admin/moderator can use it, matching /teams and /stats. */
export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <StaffGate>
      <TeamDetailPanel teamId={Number(params.id)} />
    </StaffGate>
  );
}
