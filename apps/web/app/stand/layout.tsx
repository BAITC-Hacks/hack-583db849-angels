import { AuthProvider } from '../../lib/auth/AuthContext';
import { MswProvider } from '../../mocks/MswProvider';

/**
 * The demo stand — inVision's own sign-in, form and test — keeps its session
 * and its mocks to itself. Product screens reach our API through the BFF and
 * never ask the stand who is signed in.
 */
export default function StandLayout({ children }: { children: React.ReactNode }) {
  return (
    <MswProvider>
      <AuthProvider>{children}</AuthProvider>
    </MswProvider>
  );
}
