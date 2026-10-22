import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  QUESTION_KINDS,
  QUESTION_TYPES,
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
const MAX_GUIDE_WORDS = 1300;
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

  it('explains that the joker round counts double and how the Teams table marks it', () => {
    const text = renderGuideText();

    expect(text).toContain('count double');
    expect(text).toContain('bonus awards never');
    expect(text).toContain('🃏');
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
    expect(text).toContain('scoring: "all_or_nothing"');
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

  it('says grading can start before the break and must finish in it', () => {
    const text = renderGuideText();

    expect(text).toContain('as soon as it arrives');
    expect(text).toContain(
      'will not leave the break while an answer is ungraded',
    );
  });
});
