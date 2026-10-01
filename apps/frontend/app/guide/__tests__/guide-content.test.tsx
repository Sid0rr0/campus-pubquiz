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

function renderGuideText(): string {
  const { container } = render(<GuideContent />);
  return container.textContent ?? '';
}

describe('GuideContent', () => {
  it('describes every question type from the registry', () => {
    const text = renderGuideText();

    for (const type of QUESTION_TYPES) {
      expect(text).toContain(`${type} (${QUESTION_KINDS[type].label})`);
      expect(text).toContain(QUESTION_KINDS[type].label);
      expect(text).toContain(QUESTION_KINDS[type].moderatorNote);
    }
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

  it('says grading can start before the break and must finish in it', () => {
    const text = renderGuideText();

    expect(text).toContain('as soon as it arrives');
    expect(text).toContain(
      'will not leave the break while an answer is ungraded',
    );
  });
});
