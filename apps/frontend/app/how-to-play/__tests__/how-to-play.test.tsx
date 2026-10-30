import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  POWER_UP_LABELS,
  QUESTION_KINDS,
  QUESTION_TYPES,
} from '@campus-pubquiz/types';
import HowToPlayPage from '@/app/how-to-play/page';

describe('HowToPlayPage', () => {
  it('covers every topic, question type and power-up', () => {
    const { container } = render(<HowToPlayPage />);

    for (const name of [
      'Basics',
      'Scoring',
      'Bonuses',
      'Joker',
      'Power-ups',
      'Question types',
    ]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    for (const type of QUESTION_TYPES) {
      expect(container.textContent).toContain(QUESTION_KINDS[type].playerNote);
    }
    for (const label of Object.values(POWER_UP_LABELS)) {
      expect(container.textContent).toContain(label);
    }
  });
});
