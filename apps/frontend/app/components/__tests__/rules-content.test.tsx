import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import { RulesContent } from '@/app/components/rules-content';

describe('RulesContent', () => {
  it('falls back to DEFAULT_SESSION_SETTINGS.rules when no rules prop is given', () => {
    render(<RulesContent />);

    for (const rule of DEFAULT_SESSION_SETTINGS.rules) {
      expect(screen.getByText(rule)).toBeInTheDocument();
    }
  });

  it('renders the injected rules array instead of the defaults', () => {
    render(<RulesContent rules={['Custom rule one.', 'Custom rule two.']} />);

    expect(screen.getByText('Custom rule one.')).toBeInTheDocument();
    expect(screen.getByText('Custom rule two.')).toBeInTheDocument();
    for (const rule of DEFAULT_SESSION_SETTINGS.rules) {
      expect(screen.queryByText(rule)).not.toBeInTheDocument();
    }
  });
});
