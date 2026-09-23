import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../components/shell/AppShell';
import { DemoRoleProvider } from '../lib/DemoRoleProvider';
import { DEMO_ROLE_COOKIE } from '../lib/roles';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => '/interviewer',
}));

function shell(role: 'interviewer' | 'commission' = 'interviewer') {
  return render(
    <DemoRoleProvider role={role}>
      <AppShell>
        <p>a screen</p>
      </AppShell>
    </DemoRoleProvider>,
  );
}

describe('switching the demo role', () => {
  it('changes the shell in this tab at once, and writes the cookie the server reads', () => {
    shell();
    expect(screen.getAllByText('Interviewer').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /Interviewer/ })[0]);
    fireEvent.click(screen.getAllByRole('menuitemradio', { name: /Commission/ })[0]);

    // The presenter must never see one role's sidebar on another role's screen:
    // Next may serve the new route from a payload prefetched with the old cookie.
    expect(screen.getAllByText('Commission').length).toBeGreaterThan(0);
    expect(document.cookie).toContain(`${DEMO_ROLE_COOKIE}=commission`);
    expect(push).toHaveBeenCalledWith('/commission');
    expect(refresh).toHaveBeenCalled();
  });
});
