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

  it('appends a selfie bonus explainer when "selfie" is an enabled bonus category', () => {
    render(
      <RulesContent
        rules={['House rule.']}
        enabledBonusCategories={['selfie']}
      />,
    );

    expect(screen.getByText('House rule.')).toBeInTheDocument();
    expect(screen.getByText(/Selfie bonus:/)).toBeInTheDocument();
    expect(
      screen.getByText(/tag @esn\.cut and @isc_hub\.cz/i),
    ).toBeInTheDocument();
  });

  it('appends a shot bonus explainer when "shot" is an enabled bonus category', () => {
    render(
      <RulesContent
        rules={['House rule.']}
        enabledBonusCategories={['shot']}
      />,
    );

    expect(screen.getByText(/Shot bonus:/)).toBeInTheDocument();
    expect(
      screen.getByText(/order and drink that many shots/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Selfie bonus:/)).not.toBeInTheDocument();
  });

  it('appends both bonus explainers when both categories are enabled', () => {
    render(
      <RulesContent
        rules={['House rule.']}
        enabledBonusCategories={['shot', 'selfie', 'custom']}
      />,
    );

    expect(screen.getByText(/Shot bonus:/)).toBeInTheDocument();
    expect(screen.getByText(/Selfie bonus:/)).toBeInTheDocument();
  });

  it('does not mention any bonus when no bonus categories are enabled', () => {
    render(<RulesContent rules={['House rule.']} />);

    expect(screen.queryByText(/Shot bonus:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Selfie bonus:/)).not.toBeInTheDocument();
  });
});
