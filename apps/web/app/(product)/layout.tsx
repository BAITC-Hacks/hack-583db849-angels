import { AppShell } from '../../components/shell/AppShell';
import { QueryProvider } from '../../lib/api/QueryProvider';
import { DemoRoleProvider } from '../../lib/DemoRoleProvider';
import { getStaffLocale } from '../../lib/i18n/server';
import { StaffLocaleProvider } from '../../lib/i18n/StaffLocaleProvider';
import { getDemoRole } from '../../lib/rolesServer';

/** Every product screen — staff and candidate — sits inside the same shell. */
export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const [locale, role] = await Promise.all([getStaffLocale(), getDemoRole()]);

  return (
    <StaffLocaleProvider locale={locale}>
      <DemoRoleProvider role={role}>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </DemoRoleProvider>
    </StaffLocaleProvider>
  );
}
