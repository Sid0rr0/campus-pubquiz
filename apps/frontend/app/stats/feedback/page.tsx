'use client';

import { StaffGate } from '@/app/components/staff-gate';
import { FeedbackTrendsPanel } from '@/app/stats/feedback/feedback-trends-panel';

/** Feedback across sessions — /stats/feedback. Any authenticated admin/moderator can use it, matching /stats. */
export default function FeedbackTrendsPage() {
  return (
    <StaffGate>
      <FeedbackTrendsPanel />
    </StaffGate>
  );
}
