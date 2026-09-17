/**
 * Boot configuration. Everything comes from the environment and is validated once, at
 * startup: a broker that starts with a missing SESSION_SECRET would happily mint
 * unforgeable-looking cookies signed with `undefined`.
 */

const REQUIRED = [
  'PORT',
  'MANIFEST_PATH',
  'DOCKER_API',
  'SESSION_SECRET',
  'COOKIE_NAME',
  'AUTH_VERIFY_URL',
  'AUTH_SIGNIN_PATH',
  'INSTANCE_NETWORK',
  'INSTANCE_ENV_DIR',
];

const NUMERIC_DEFAULTS = {
  IDLE_TTL_SECONDS: 1200,
  READY_TIMEOUT_SECONDS: 90,
  MAX_ANON_INSTANCES: 2,
  MAX_ADMIN_INSTANCES: 2,
  /**
   * Ceiling across both kinds, which is what the box's RAM actually constrains: the two
   * caps above are independent, so anon=1 + admin=1 can still put two instances on a
   * machine that fits one. 0 means "anon + admin", i.e. no extra limit.
   */
  MAX_TOTAL_INSTANCES: 0,
  /** How long an oauth2-proxy verdict is reused; one page load fires dozens of requests. */
  IDENTITY_TTL_SECONDS: 15,
  REAP_INTERVAL_SECONDS: 30,
};

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter(key => !env[key] || !env[key].trim());
  if (missing.length > 0) {
    throw new Error(`broker: missing required environment: ${missing.join(', ')}`);
  }

  if (env.SESSION_SECRET.trim().length < 32) {
    throw new Error('broker: SESSION_SECRET must be at least 32 characters');
  }

  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`broker: PORT must be a positive integer, got ${env.PORT}`);
  }

  const numbers = {};
  for (const [key, fallback] of Object.entries(NUMERIC_DEFAULTS)) {
    const raw = env[key];
    if (raw === undefined || raw.trim() === '') {
      numbers[key] = fallback;
      continue;
    }
    const value = Number(raw);
    // MAX_TOTAL_INSTANCES alone accepts 0, its documented "no extra limit".
    const floor = key === 'MAX_TOTAL_INSTANCES' ? 0 : 1;
    if (!Number.isInteger(value) || value < floor) {
      throw new Error(`broker: ${key} must be an integer >= ${floor}, got ${raw}`);
    }
    numbers[key] = value;
  }

  const cookieName = env.COOKIE_NAME.trim();
  const cookieSecure = env.COOKIE_SECURE === 'true';
  if (cookieName.startsWith('__Host-') && !cookieSecure) {
    throw new Error('broker: a __Host- cookie requires COOKIE_SECURE=true');
  }

  return {
    port,
    manifestPath: env.MANIFEST_PATH.trim(),
    dockerApi: env.DOCKER_API.trim().replace(/\/+$/, ''),
    sessionSecret: env.SESSION_SECRET,
    cookieName,
    cookieSecure,
    authVerifyUrl: env.AUTH_VERIFY_URL.trim(),
    authSigninPath: env.AUTH_SIGNIN_PATH.trim(),
    instanceNetwork: env.INSTANCE_NETWORK.trim(),
    instanceEnvDir: env.INSTANCE_ENV_DIR.trim(),
    idleTtlMs: numbers.IDLE_TTL_SECONDS * 1000,
    readyTimeoutMs: numbers.READY_TIMEOUT_SECONDS * 1000,
    reapIntervalMs: numbers.REAP_INTERVAL_SECONDS * 1000,
    identityTtlMs: numbers.IDENTITY_TTL_SECONDS * 1000,
    maxInstances: {
      anon: numbers.MAX_ANON_INSTANCES,
      admin: numbers.MAX_ADMIN_INSTANCES,
      total: numbers.MAX_TOTAL_INSTANCES || numbers.MAX_ANON_INSTANCES + numbers.MAX_ADMIN_INSTANCES,
    },
  };
}
