import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EvidenceQuote } from '../components/evidence/EvidenceQuote';
import { ScoreMeter } from '../components/evidence/ScoreMeter';
import { Sidebar } from '../components/shell/Sidebar';
import { withQuery } from './apiHarness';
import { StaffLocaleProvider } from '../lib/i18n/StaffLocaleProvider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/demo/candidates',
}));

const noop = () => {};

describe('staff screens in Russian', () => {
  it('translates the interface around a quote, never the quote', () => {
    render(
      <StaffLocaleProvider locale="ru">
        <EvidenceQuote quote="Nobody asked you first." source={{ kind: 'simulation_turn', id: 'turn_04' }} />
        <ScoreMeter score={null} />
      </StaffLocaleProvider>,
    );
    expect(screen.getByText('Ход 04')).toBeTruthy();
    expect(screen.getByText('Показать в контексте')).toBeTruthy();
    expect(screen.getByText('Недостаточно доказательств')).toBeTruthy();
    const quote = screen.getByText('“Nobody asked you first.”');
    expect(quote.getAttribute('lang')).toBe('en');
  });

  it('shows staff the navigation and the language switch in Russian', () => {
    render(
      <Sidebar role="interviewer" onRoleChange={noop} locale="ru" onLocaleChange={noop} collapsed={false} />,
    );
    expect(screen.getByText('Мои интервью')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Язык интерфейса' })).toBeTruthy();
    expect(screen.queryByText('Отчёты симуляций')).toBeNull();
  });

  it('keeps a candidate in English, with no language switch at all', () => {
    // The candidate role also shows whose screens these are, from the API: the query needs its client.
    withQuery(<Sidebar role="candidate" onRoleChange={noop} locale="ru" onLocaleChange={noop} collapsed={false} />);
    expect(screen.getByText('My simulation')).toBeTruthy();
    expect(screen.getByText('Workspace')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText('Мои интервью')).toBeNull();
  });
});
