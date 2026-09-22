import { AppShell } from '../../components/shell/AppShell';
import { getStaffLocale } from '../../lib/i18n/server';
import { StaffLocaleProvider } from '../../lib/i18n/StaffLocaleProvider';

/** Every product screen — staff and candidate — sits inside the same shell. */
export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffLocaleProvider locale={await getStaffLocale()}>
      <AppShell>{children}</AppShell>
    </StaffLocaleProvider>
  );
}
