'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import type { ActiveShowdownView } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface ShowdownPanelProps {
  /** True once the admin is allowed to compose/save a tiebreaker question — from the moment the final block is fully graded (see AdminPage's isShowdownEligible), through the rest of the quiz's own reveal walk and into 'ended'. */
  isEligible: boolean;
  activeShowdown: ActiveShowdownView | null;
  /** Teams currently tied for 1st, in leaderboard order — empty when nobody's tied. */
  tiedTeamNames: string[];
  onCreateShowdownRound: (
    question: string,
    answer: string,
    points: number,
  ) => void;
  className?: string;
}

const DEFAULT_POINTS = 1;

/**
 * Lets the admin open a modal and type up a tiebreaker question once two or
 * more teams are tied for 1st and isEligible, then shows live guess status
 * (no values) while the round is in progress. Reused as-is for sudden
 * death: isTie leaves the same teams tied, so the trigger reappears with an
 * "Ask another question" label once the round's outcome (isTie) is visible.
 */
export function ShowdownPanel({
  isEligible,
  activeShowdown,
  tiedTeamNames,
  onCreateShowdownRound,
  className = '',
}: ShowdownPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [points, setPoints] = useState(String(DEFAULT_POINTS));

  if (!isEligible) return null;
  if (!activeShowdown && tiedTeamNames.length < 2) return null;

  const parsedPoints = Number(points);
  const canSubmit =
    question.trim().length > 0 &&
    answer.trim().length > 0 &&
    Number.isFinite(Number(answer)) &&
    Number.isFinite(parsedPoints) &&
    parsedPoints > 0;

  function handleSave(): void {
    if (!canSubmit) return;
    onCreateShowdownRound(question.trim(), answer.trim(), parsedPoints);
    setQuestion('');
    setAnswer('');
    setPoints(String(DEFAULT_POINTS));
    setIsModalOpen(false);
  }

  // A resolved tie (visible once the reveal reaches its final step) leaves
  // the same teams tied for 1st — offer a fresh sudden-death round for them.
  const showTrigger = !activeShowdown || activeShowdown.isTie === true;
  const triggerLabel = activeShowdown
    ? 'Ask another question'
    : 'Create showdown';

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <h2 className="text-sm font-extrabold">Showdown tiebreaker</h2>
      {!activeShowdown && (
        <p className="text-xs opacity-70">
          Tied for 1st: {tiedTeamNames.join(', ')}
        </p>
      )}
      {activeShowdown && (
        <ul className="flex flex-col gap-1 text-xs">
          {activeShowdown.participants.map((participant) => (
            <li
              key={participant.teamId}
              className="flex items-center justify-between gap-2"
            >
              <span>{participant.teamName}</span>
              <span aria-hidden="true">
                {participant.hasGuessed ? '✓' : '— waiting'}
              </span>
              <span className="sr-only">
                {participant.hasGuessed ? 'guessed' : 'waiting for guess'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {activeShowdown?.isTie === true && (
        <p className="text-xs opacity-70">
          It&apos;s a tie — ask another question to break it.
        </p>
      )}
      {showTrigger && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
        >
          {triggerLabel}
        </Button>
      )}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl bg-foreground p-5 text-background">
            <Dialog.Title className="font-display text-lg">
              {triggerLabel}
            </Dialog.Title>
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-extrabold"
                htmlFor="showdown-question"
              >
                Question
              </label>
              <input
                id="showdown-question"
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="How many people are in this room?"
                className="min-h-10 rounded-lg border-2 border-background/30 bg-transparent px-3 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <label
                  className="text-xs font-extrabold"
                  htmlFor="showdown-answer"
                >
                  Answer
                </label>
                <input
                  id="showdown-answer"
                  type="number"
                  inputMode="decimal"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="min-h-10 w-full rounded-lg border-2 border-background/30 bg-transparent px-3 text-sm"
                />
              </div>
              <div className="flex w-20 flex-col gap-1.5">
                <label
                  className="text-xs font-extrabold"
                  htmlFor="showdown-points"
                >
                  Points
                </label>
                <input
                  id="showdown-points"
                  type="number"
                  step={1}
                  value={points}
                  onChange={(event) => setPoints(event.target.value)}
                  className="min-h-10 w-full rounded-lg border-2 border-background/30 bg-transparent px-3 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-bold text-background/70"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="solid-flat"
                disabled={!canSubmit}
                onClick={handleSave}
                className="disabled:opacity-40"
              >
                Save
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
