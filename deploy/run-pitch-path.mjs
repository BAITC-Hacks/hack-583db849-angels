/** Run inside the API container: read role keys without printing their values. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const roles = ['platform', 'interviewer', 'commission', 'admin'];
const configuredKeys = new Map();
for (const pair of (process.env.API_KEYS ?? '').split(',')) {
  const separator = pair.lastIndexOf(':');
  if (separator <= 0) continue;
  const key = pair.slice(0, separator).trim();
  const role = pair.slice(separator + 1).trim();
  if (key && roles.includes(role)) configuredKeys.set(role, key);
}

const env = { ...process.env, API: 'http://api:3001/v1' };
for (const role of roles) {
  const key = configuredKeys.get(role);
  if (!key) {
    console.error(`API_KEYS is missing a key for the ${role} role.`);
    process.exit(1);
  }
  env[`E2E_KEY_${role.toUpperCase()}`] = key;
}

const script = fileURLToPath(new URL('../scripts/e2e/pitch-path.mjs', import.meta.url));
const result = spawnSync(process.execPath, [script], {
  env,
  stdio: 'inherit',
});
if (result.error) {
  console.error('Could not start the pitch path inside the API container.');
  process.exit(1);
}
process.exit(result.status ?? 1);
