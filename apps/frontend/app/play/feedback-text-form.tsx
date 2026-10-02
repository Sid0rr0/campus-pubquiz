import { useState } from 'react';
import {
  MAX_FEEDBACK_TOPICS,
  type AckResult,
  type SendFeedbackPayload,
  type TeamFeedbackView,
} from '@campus-pubquiz/types';
import { cleanTopics, findDraftProblems } from '@/app/play/feedback-draft';

interface FeedbackTextFormProps {
  /** What the server holds for this team. A new object (a join payload, or an acknowledged send) replaces the draft only when the draft has no unsent edits. */
  saved: TeamFeedbackView;
  onSend: (feedback: SendFeedbackPayload) => Promise<AckResult>;
}

interface Draft {
  comment: string;
  topicLines: string[];
  /** Counts edits: the draft matches the server exactly when this equals `syncedVersion`. */
  version: number;
  syncedVersion: number;
}

function draftFromSaved(saved: TeamFeedbackView): Draft {
  return {
    comment: saved.comment,
    topicLines: saved.topics.length > 0 ? [...saved.topics] : [''],
    version: 0,
    syncedVersion: 0,
  };
}

function hasContent(saved: TeamFeedbackView): boolean {
  return saved.comment !== '' || saved.topics.length > 0;
}

/** The "Anything else?" box and the topic suggestion lines, with one Send button. An edit clears "Sent ✓" until Send is pressed again. */
export function FeedbackTextForm({ saved, onSend }: FeedbackTextFormProps) {
  const [draft, setDraft] = useState(() => draftFromSaved(saved));
  const [hasSent, setHasSent] = useState(() => hasContent(saved));
  const [isSending, setIsSending] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [seenSaved, setSeenSaved] = useState(saved);

  const isInSync = draft.version === draft.syncedVersion;
  // A phone that reconnects (or a join payload that lands after the form
  // appeared) brings the server's text; unsent edits are never overwritten.
  if (seenSaved !== saved) {
    setSeenSaved(saved);
    if (isInSync) {
      setDraft(draftFromSaved(saved));
      setHasSent(hasContent(saved));
    }
  }

  const problems = findDraftProblems({
    comment: draft.comment,
    topics: draft.topicLines,
  });
  const canAddLine = draft.topicLines.length < MAX_FEEDBACK_TOPICS;

  function edit(change: Partial<Pick<Draft, 'comment' | 'topicLines'>>): void {
    setDraft((current) => ({
      ...current,
      ...change,
      version: current.version + 1,
    }));
    setHasFailed(false);
  }

  async function send(): Promise<void> {
    if (problems.length > 0 || isSending) return;
    const sentVersion = draft.version;
    setIsSending(true);
    const result = await onSend({
      comment: draft.comment,
      topics: cleanTopics(draft.topicLines),
    });
    setIsSending(false);
    if (result.success) {
      setHasSent(true);
      // Edits made while the send was in flight stay unsent.
      setDraft((current) => ({ ...current, syncedVersion: sentVersion }));
    } else {
      setHasFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Anything else?
        <textarea
          value={draft.comment}
          onChange={(event) => edit({ comment: event.target.value })}
          rows={4}
          className="rounded-md border border-foreground/20 bg-background p-2 text-base font-normal"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-extrabold">
          Topics you&apos;d like next time
        </legend>
        {draft.topicLines.map((line, index) => (
          <input
            // Lines have no identity beyond their position.
            key={index}
            type="text"
            aria-label={`Topic ${index + 1}`}
            value={line}
            onChange={(event) =>
              edit({
                topicLines: draft.topicLines.map((existing, at) =>
                  at === index ? event.target.value : existing,
                ),
              })
            }
            className="rounded-md border border-foreground/20 bg-background p-2 text-base"
          />
        ))}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canAddLine}
            onClick={() => edit({ topicLines: [...draft.topicLines, ''] })}
            className="text-sm font-extrabold text-magenta disabled:text-foreground/40"
          >
            + Add another
          </button>
          <span className="text-xs text-foreground/55">
            Up to {MAX_FEEDBACK_TOPICS} topics.
          </span>
        </div>
      </fieldset>

      {problems.length > 0 && (
        <ul role="alert" className="text-xs font-extrabold text-magenta">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {hasFailed && (
        <p role="alert" className="text-xs font-extrabold text-magenta">
          Not sent — try again.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={problems.length > 0 || isSending}
          onClick={() => void send()}
          className="rounded-md bg-magenta px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
        >
          Send
        </button>
        {hasSent && isInSync && (
          <span className="text-xs font-extrabold text-foreground/55">
            Sent ✓
          </span>
        )}
      </div>
    </div>
  );
}
