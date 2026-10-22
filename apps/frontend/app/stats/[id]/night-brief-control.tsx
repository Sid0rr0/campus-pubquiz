'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/app/components/button';
import { downloadTextFile } from '@/app/lib/download-text-file';
import { fetchSessionBrief } from '@/app/lib/stats-api';

interface NightBriefControlProps {
  gameSessionId: number;
  sessionName: string;
  /** ISO timestamp the session was played at. */
  playedAt: string;
}

/** `Spring Quiz: Week #3` on 2026-01-05 → `night-brief-spring-quiz-week-3-2026-01-05.md`. */
export function nightBriefFilename(
  sessionName: string,
  playedAt: string,
): string {
  const slug = sessionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const date = new Date(playedAt).toISOString().slice(0, 10);
  return `night-brief-${slug ? `${slug}-` : ''}${date}.md`;
}

/** Copy or download the session's Night brief — the same Markdown text either way, fetched when pressed so it is never stale. */
export function NightBriefControl({
  gameSessionId,
  sessionName,
  playedAt,
}: NightBriefControlProps) {
  const [isBusy, setIsBusy] = useState(false);

  async function run(
    action: (brief: string) => Promise<void> | void,
    failureMessage: string,
  ) {
    setIsBusy(true);
    try {
      await action(await fetchSessionBrief(gameSessionId));
    } catch {
      toast.error(failureMessage);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Night brief"
    >
      <span className="text-sm font-extrabold">Night brief</span>
      <Button
        variant="outline"
        size="sm"
        disabled={isBusy}
        onClick={() =>
          void run(async (brief) => {
            await navigator.clipboard.writeText(brief);
            toast.success('Copied');
          }, 'Could not copy the Night brief')
        }
      >
        Copy
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isBusy}
        onClick={() =>
          void run(
            (brief) =>
              downloadTextFile(
                nightBriefFilename(sessionName, playedAt),
                brief,
                'text/markdown',
              ),
            'Could not download the Night brief',
          )
        }
      >
        Download
      </Button>
    </div>
  );
}
