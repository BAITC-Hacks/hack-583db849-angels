import { cookies } from 'next/headers';
import { DEMO_ROLE_COOKIE, readDemoRole, type DemoRole } from './roles';

/** The demo role for this request, read on the server so the first paint is already right. */
export async function getDemoRole(): Promise<DemoRole> {
  return readDemoRole((await cookies()).get(DEMO_ROLE_COOKIE)?.value);
}
