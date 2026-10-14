'use client';

import { useEffect, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import type { PlayersStatePayload } from '@campus-pubquiz/types';
import { useOnLiveForwardMove } from '@/app/lib/live-change';
import type { MyAnswerGrade } from '@/app/lib/team-link';
import { vibrate } from '@/app/lib/vibrate';
import { buildOpenedQuestions } from '@/app/play/opened-questions';
import {
  describeVerdictCard,
  type VerdictCardContent,
  type VerdictCardTone,
} from '@/app/play/verdict-card';

const VERDICT_CARD_VISIBLE_MS = 3_000;

const TONE_CLASS: Record<VerdictCardTone, string> = {
  correct: 'border-green text-green',
  partial: 'border-cyan text-cyan',
  incorrect: 'border-magenta text-magenta',
  none: 'border-foreground/30 text-foreground/65',
};

interface RevealVerdictCardProps {
  view: Pick<
    PlayersStatePayload,
    'progress' | 'revealQuestions' | 'pastRevealedQuestions'
  >;
  myAnswers: Record<number, string>;
  myAnswerGrades: Record<number, MyAnswerGrade>;
  isConnected: boolean;
}

/**
 * How far the quiz has revealed, as a number that only grows going forward:
 * every question of finished blocks plus the ones the big screen has shown in
 * full so far (a closest_guess question counts once its answer is on air).
 * Previous lowers it, so the live-change gate stays silent for it.
 */
function revealedCount({
  revealQuestions,
  pastRevealedQuestions,
}: RevealVerdictCardProps['view']): number {
  return (
    pastRevealedQuestions.length +
    revealQuestions.filter(
      (question) => question.revealKind !== 'closest_guess_pending',
    ).length
  );
}

/** The verdict of the question the big screen just landed on, built from the team's own answer data; null when none is on air. */
function describeLandedQuestion({
  view,
  myAnswers,
  myAnswerGrades,
}: RevealVerdictCardProps): VerdictCardContent | null {
  const { progress, revealQuestions } = view;
  const landed = revealQuestions[progress.revealIndex];
  if (
    progress.status !== 'reveal' ||
    !landed ||
    landed.revealKind === 'closest_guess_pending'
  ) {
    return null;
  }
  const [entry] = buildOpenedQuestions(
    { [landed.id]: landed },
    myAnswers,
    myAnswerGrades,
  );
  return describeVerdictCard(entry);
}

/**
 * A self-dismissing card over the phone that tells the team how it did on the
 * question the big screen just revealed. Shown whatever the auto-advance
 * setting, never takes a tap, vibrates on a correct answer only, and only on a
 * live forward move (never on a reconnect, never on Previous).
 */
export function RevealVerdictCard(props: RevealVerdictCardProps) {
  const [card, setCard] = useState<{
    content: VerdictCardContent;
    id: number;
  } | null>(null);

  useOnLiveForwardMove(revealedCount(props.view), props.isConnected, () => {
    const content = describeLandedQuestion(props);
    if (!content) return;
    setCard((previous) => ({ content, id: (previous?.id ?? 0) + 1 }));
    if (content.shouldVibrate) vibrate('success');
  });

  const cardId = card?.id;
  useEffect(() => {
    if (cardId === undefined) return;
    const timer = setTimeout(() => setCard(null), VERDICT_CARD_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [cardId]);

  return (
    <MotionConfig reducedMotion="user">
      {card && (
        <motion.div
          key={card.id}
          role="status"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`pointer-events-none fixed inset-x-5 top-16 z-30 mx-auto max-w-sm rounded-2xl border-4 bg-white px-6 py-4 text-center font-display text-3xl shadow-lg ${TONE_CLASS[card.content.tone]}`}
        >
          {card.content.text}
        </motion.div>
      )}
    </MotionConfig>
  );
}
