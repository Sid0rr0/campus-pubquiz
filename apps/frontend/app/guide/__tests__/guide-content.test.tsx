import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  QUESTION_KINDS,
  QUESTION_TYPES,
  SCORING_MODES_BY_TYPE,
  type GameStatus,
} from '@campus-pubquiz/types';
import { ADMIN_SHORTCUTS } from '@/app/control/admin-keyboard-shortcuts';
import { GuideContent } from '@/app/guide/guide-content';

const STATUS_NAMES: GameStatus[] = [
  'lobby',
  'rules',
  'round_overview',
  'round_intro',
  'question_open',
  'locking',
  'break_intro',
  'break',
  'break_round_intro',
  'reveal_intro',
  'reveal',
  'ended',
];

const MIN_GUIDE_WORDS = 1000;
const MAX_GUIDE_WORDS = 1400;
const MAX_PARAGRAPH_CHARS = 300;

function renderGuideText(): string {
  const { container } = render(<GuideContent />);
  return container.textContent ?? '';
}

describe('GuideContent', () => {
  it('explains the player count, the over-cap flag and how to correct a count', () => {
    const text = renderGuideText();

    expect(text).toContain('player count');
    expect(text).toContain('over the player cap');
    expect(text).toContain('press Edit');
  });

  it('explains the Collect feedback switch and where teams and the moderator see feedback', () => {
    const text = renderGuideText();

    expect(text).toContain('Collect feedback');
    expect(text).toContain('Rate these rounds');
    expect(text).toContain('Quiz complete!');
    expect(text).toContain('session stats');
  });

  it('explains the Jokers setting and how to run the joker pick', () => {
    const text = renderGuideText();

    expect(text).toContain('"Jokers" switch');
    expect(text).toContain('round overview');
    expect(text).toContain('joker pick');
    expect(text).toContain('Close pick');
    expect(text).toContain('random round');
    expect(text).toContain('N/M picked');
    expect(text).toContain('"Countdown sound"');
  });

  it('explains the Power-ups tab, starting coins and the Coins column', () => {
    const text = renderGuideText();

    expect(text).toContain('"Power-ups" tab');
    expect(text).toContain('starting coins');
    expect(text).toContain('cost and uses');
    expect(text).toContain('Coins column');
  });

  it('explains the coin a shot or selfie gives and the bonus form’s Coins field', () => {
    const text = renderGuideText();

    expect(text).toContain('a shot or selfie also gives 1 coin');
    expect(text).toContain('Coins field');
  });

  it('explains that the joker round counts double and how the Teams table marks it', () => {
    const text = renderGuideText();

    expect(text).toContain('count double');
    expect(text).toContain('bonus awards never');
    expect(text).toContain('🃏');
  });

  it('explains changing a team’s joker', () => {
    const text = renderGuideText();

    expect(text).toContain('joker list');
    expect(text).toContain('until that round has started');
    expect(text).toContain('changed by the quiz master');
  });

  it('explains the 2× stamp on the leaderboard', () => {
    const text = renderGuideText();

    expect(text).toContain('"2×" stamp');
    expect(text).toContain('even on 0 points');
  });

  it('explains unlisted sessions: the switch, the badge, the display link and both ways to join', () => {
    const text = renderGuideText();

    expect(text).toContain('"Show in the game list" switch');
    expect(text).toContain('Unlisted');
    expect(text).toContain('Open display');
    expect(text).toContain('scanning its QR code');
    expect(text).toContain('"Have a game code?"');
  });

  it('describes every question type from the registry', () => {
    const text = renderGuideText();

    for (const type of QUESTION_TYPES) {
      expect(text).toContain(`${QUESTION_KINDS[type].label} — `);
      expect(text).toContain(QUESTION_KINDS[type].moderatorNote);
    }
  });

  it('describes the Number question margin controls and the CSV margin and scoring keys', () => {
    const text = renderGuideText();

    expect(text).toContain('margin row');
    expect(text).toContain('% / absolute');
    expect(text).toContain('margin: "5%"');
    for (const type of QUESTION_TYPES.filter(
      (t) => t in SCORING_MODES_BY_TYPE,
    )) {
      const modes =
        SCORING_MODES_BY_TYPE[type as keyof typeof SCORING_MODES_BY_TYPE];
      const last = modes[modes.length - 1];
      expect(text).toContain(
        `${QUESTION_KINDS[type].label}: ${modes.slice(0, -1).join(', ')} or ${last}`,
      );
    }
    expect(text).not.toContain('all_or_nothing');
  });

  it('describes the Hide video checkbox and the hideVideo CSV key', () => {
    const text = renderGuideText();

    expect(text).toContain('Hide video (sound only)');
    expect(text).toContain('hideVideo: true');
  });

  it('lists every keyboard shortcut the control page listens for', () => {
    const text = renderGuideText();

    for (const shortcut of Object.values(ADMIN_SHORTCUTS)) {
      expect(text).toContain(shortcut.keyName);
      expect(text).toContain(shortcut.description);
    }
  });

  it('uses glossary terms and never a raw status name', () => {
    const text = renderGuideText();

    for (const status of STATUS_NAMES.filter((name) => name.includes('_'))) {
      expect(text).not.toContain(status);
    }
    expect(text).not.toMatch(/\blocked\b/i);
    for (const term of ['block', 'break review', 'round title card']) {
      expect(text.toLowerCase()).toContain(term);
    }
  });

  it('stays short: 1,000 to 1,300 words and no paragraph over 300 characters', () => {
    const { container } = render(<GuideContent />);
    const blocks = Array.from(
      container.querySelectorAll('h1, h2, p, li > span:last-child, a'),
    );
    const words = blocks
      .map((block) => block.textContent ?? '')
      .join(' ')
      .split(/\s+/)
      .filter(Boolean);

    expect(words.length).toBeGreaterThanOrEqual(MIN_GUIDE_WORDS);
    expect(words.length).toBeLessThanOrEqual(MAX_GUIDE_WORDS);
    for (const paragraph of Array.from(container.querySelectorAll('p'))) {
      expect(paragraph.textContent?.length ?? 0).toBeLessThanOrEqual(
        MAX_PARAGRAPH_CHARS,
      );
    }
  });

  it('tells the moderator what a stuck phone and the big screen show when reconnecting', () => {
    const text = renderGuideText();

    expect(text).toContain('Tap to reconnect');
    expect(text).toContain('Reconnecting…');
  });

  it('points the moderator to Quiz preview rather than a throwaway session for checking content', () => {
    const text = renderGuideText();

    expect(text).toContain('check it with Quiz preview');
    expect(text).toContain('not a throwaway session');
  });

  it('tells the moderator what to do when a team forgot its code', () => {
    const text = renderGuideText();

    expect(text).toContain('A team forgot its code');
    expect(text).toContain('rejoin with its name and code');
    expect(text).toContain('Merge with…');
    expect(text).toContain("can't be undone");
  });

  it('says an over-cap penalty is a negative bonus', () => {
    const text = renderGuideText();

    expect(text).toContain('negative bonus');
  });

  it('names the CSV columns edited by hand and the CSV identifier of each type', () => {
    const text = renderGuideText();

    for (const column of [
      'round_note',
      'show_round_note',
      'category',
      'author',
      'notes',
      'break_after',
    ]) {
      expect(text).toContain(column);
    }
    for (const type of QUESTION_TYPES) {
      expect(text).toContain(type);
    }
  });

  it('describes the Control layout: timer, detail column, title and break cards, look-ahead and grading list', () => {
    const text = renderGuideText();

    expect(text).toContain('phase timer sits beside "Quiz Master"');
    expect(text).toContain('detail column');
    expect(text).toContain('(category, author, Round note)');
    expect(text).toContain('"Break N"');
    expect(text).toContain('Click a question number, T or B');
    expect(text).toContain('follows the big screen again');
    expect(text).toContain('grading list sits full width below');
  });

  it('says grading can start before the break and must finish in it', () => {
    const text = renderGuideText();

    expect(text).toContain('as soon as it arrives');
    expect(text).toContain(
      'will not leave the break while an answer is ungraded',
    );
  });
});
