'use client';

import { useEffect, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import type { PlayersStatePayload } from '@campus-pubquiz/types';
import { useOnLiveForwardMove } from '@/app/lib/live-change';
import type { MyAnswerGrade } from '@/app/lib/team-link';
import { vibrate } from '@/app/lib/vibrate';
import { jokerExtraPoints } from '@/app/play/joker-round';
import { buildOpenedQuestions } from '@/app/play/opened-questions';
import {
  describeVerdictCard,
  VERDICT_TONE_BORDER_CLASS,
  VERDICT_TONE_TEXT_CLASS,
  type VerdictCardContent,
} from '@/app/play/verdict-card';

const VERDICT_CARD_VISIBLE_MS = 3_000;

interface RevealVerdictCardProps {
  view: Pick<
    PlayersStatePayload,
    'progress' | 'revealQuestions' | 'pastRevealedQuestions'
  >;
  myAnswers: Record<number, string>;
  myAnswerGrades: Record<number, MyAnswerGrade>;
  isConnected: boolean;
  /** The round number of the team's joker round, or null while it has none. */
  jokerRoundNumber: number | null;
}

/** The verdict plus the extra points the joker adds to it (null outside the joker round). */
type RevealedVerdict = VerdictCardContent & { jokerExtra: number | null };

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
  jokerRoundNumber,
}: RevealVerdictCardProps): RevealedVerdict | null {
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
  return {
    ...describeVerdictCard(entry),
    jokerExtra: jokerExtraPoints(
      entry.pointsAwarded,
      entry.roundNumber,
      jokerRoundNumber,
    ),
  };
}

/**
 * A self-dismissing card over the phone that tells the team how it did on the
 * question the big screen just revealed. Shown whatever the auto-advance
 * setting, never takes a tap, vibrates on a correct answer only, and only on a
 * live forward move (never on a reconnect, never on Previous).
 */
export function RevealVerdictCard(props: RevealVerdictCardProps) {
  const [card, setCard] = useState<{
    content: RevealedVerdict;
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
          className={`pointer-events-none fixed inset-x-5 top-16 z-30 mx-auto max-w-sm rounded-2xl border-4 bg-white px-6 py-4 text-center font-display text-3xl shadow-lg ${VERDICT_TONE_BORDER_CLASS[card.content.tone]} ${VERDICT_TONE_TEXT_CLASS[card.content.tone]}`}
        >
          {card.content.text}
          {card.content.jokerExtra !== null && (
            <div className="mt-1 text-2xl">
              {`🃏 Joker +${card.content.jokerExtra}`}
            </div>
          )}
        </motion.div>
      )}
    </MotionConfig>
  );
}
