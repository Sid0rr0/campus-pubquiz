'use client';

import { useState } from 'react';
import type { ActiveShowdownView, GameStatus } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface ShowdownPanelProps {
  progressStatus: GameStatus;
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

const DEFAULT_POINTS = 5;

/**
 * Lets the admin type up a tiebreaker question once two or more teams are
 * tied for 1st at `ended`, then shows live guess status (no values) while
 * the round is in progress. Reused as-is for sudden death: isTie leaves the
 * same teams tied, so the create form reappears with an "Ask another
 * question" label once the round's outcome (isTie) is visible.
 */
export function ShowdownPanel({
  progressStatus,
  activeShowdown,
  tiedTeamNames,
  onCreateShowdownRound,
  className = '',
}: ShowdownPanelProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [points, setPoints] = useState(String(DEFAULT_POINTS));

  if (progressStatus !== 'ended') return null;
  if (!activeShowdown && tiedTeamNames.length < 2) return null;

  const parsedPoints = Number(points);
  const canSubmit =
    question.trim().length > 0 &&
    answer.trim().length > 0 &&
    Number.isFinite(Number(answer)) &&
    Number.isFinite(parsedPoints) &&
    parsedPoints > 0;

  function handleSubmit(): void {
    if (!canSubmit) return;
    onCreateShowdownRound(question.trim(), answer.trim(), parsedPoints);
    setQuestion('');
    setAnswer('');
    setPoints(String(DEFAULT_POINTS));
  }

  // A resolved tie (visible once the reveal reaches its final step) leaves
  // the same teams tied for 1st — offer a fresh sudden-death round for them.
  const showForm = !activeShowdown || activeShowdown.isTie === true;

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
      {showForm && (
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
            className="min-h-10 rounded-lg border border-background/30 bg-transparent px-3 text-sm"
          />
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
                className="min-h-10 w-full rounded-lg border border-background/30 bg-transparent px-3 text-sm"
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
                className="min-h-10 w-full rounded-lg border border-background/30 bg-transparent px-3 text-sm"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="disabled:opacity-40"
          >
            {activeShowdown ? 'Ask another question' : 'Start showdown'}
          </Button>
        </div>
      )}
    </div>
  );
}
