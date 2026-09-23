import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScenarioPool } from '../components/scenarios/ScenarioPool';
import { navItems } from '../lib/navigation';
import { previewScenarioPool } from '../lib/scenarios/preview';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/' }));

describe('the scenario pool', () => {
  it('shows the pool as it really stands, drafts included', () => {
    render(<ScenarioPool scenarios={previewScenarioPool} />);

    expect(screen.getByText('1 / 10')).toBeTruthy();
    expect(screen.getByText('A teammate is about to walk away')).toBeTruthy();
    expect(screen.getAllByText('Draft')).toHaveLength(9);
  });

  it('lists ready scenarios first, least used at the top — the order they are assigned in', () => {
    const pool = [
      { scenarioId: 'b', title: 'B', status: 'ready' as const, competencies: [], assignedCount: 4 },
      { scenarioId: 'c', title: 'C', status: 'draft' as const, competencies: [], assignedCount: 0 },
      { scenarioId: 'a', title: 'A', status: 'ready' as const, competencies: [], assignedCount: 1 },
    ];
    render(<ScenarioPool scenarios={pool} />);

    const titles = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(titles).toEqual(['Aa', 'Bb', 'Cc']);
  });

  it('never shows a draft as something a candidate could be given', () => {
    render(<ScenarioPool scenarios={previewScenarioPool} />);
    expect(screen.getAllByText('after the bench')).toHaveLength(9);
  });

  it('says nothing a candidate could prepare from', () => {
    const { container } = render(<ScenarioPool scenarios={previewScenarioPool} />);
    // The story, the hidden motive and the branches stay inside the ML service.
    expect(container.textContent).not.toMatch(/hidden|motive|beat|branch/i);
  });
});

describe('the admin sidebar', () => {
  it('takes the admin to the pool, and nobody else', () => {
    const scenarios = navItems.find((item) => item.id === 'scenarios');
    expect(scenarios?.href).toBe('/admin/scenarios');
    expect(scenarios?.roles).toEqual(['admin']);
  });
});
