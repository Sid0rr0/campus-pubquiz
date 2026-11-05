'use client';

import { StaffGate } from '@/app/components/staff-gate';
import { GuideContent } from '@/app/guide/guide-content';

export default function GuidePage() {
  return (
    <StaffGate>
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
        <GuideContent />
      </main>
    </StaffGate>
  );
}
