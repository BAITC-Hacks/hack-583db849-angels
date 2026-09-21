import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The stand client ships as TypeScript source inside the workspace; Next
  // compiles it with the app rather than the package carrying a build step.
  transpilePackages: ['@invision/stand-client'],
  // The repository has its own AGENTS.md; keep `next dev` from overwriting it
  // with a generated Next.js pointer file on every start.
  agentRules: false,
};

export default nextConfig;
