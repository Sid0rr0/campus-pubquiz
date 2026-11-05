'use client';

import { useParams } from 'next/navigation';
import { StaffGate } from '@/app/components/staff-gate';
import { SessionDetailPanel } from '@/app/stats/[id]/session-detail-panel';

/** Deep-dive stats for one ended session — /stats/<gameSessionId>. Any
 * authenticated admin/moderator can use it, matching /stats. */
export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <StaffGate>
      <SessionDetailPanel gameSessionId={Number(params.id)} />
    </StaffGate>
  );
}
