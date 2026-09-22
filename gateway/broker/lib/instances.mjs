/**
 * One container per (app, identity).
 *
 * This is where the isolation actually lives. There is no browser-level boundary on this
 * origin (same-origin iframes by design), so what separates two visitors is that they are
 * talking to two different containers, each with its own filesystem, its own SQLite file and
 * its own generated secret key:
 *
 *   anon  → tmpfs over the app's data directory; the data dies with the container, and the
 *           container is removed once the session goes idle.
 *   admin → named volume; the container is stopped when idle, never removed, so state
 *           survives restarts and broker deploys.
 */

import { readFile } from 'node:fs/promises';
import { LABELS, containerName, keyKind, volumeName } from './identity.mjs';

const ENV_LINE = /^[A-Za-z_][A-Za-z0-9_]*=/;
/** How long a resolved image id is reused; a `docker pull` takes effect within this. */
const IMAGE_ID_TTL_MS = 30_000;
/** Same idea for the gateway secret: an edited env file takes effect within this. */
const SECRET_TTL_MS = 30_000;

export class CapacityError extends Error {
  constructor(scope, limit) {
    super(`no free ${scope} slot (limit ${limit})`);
    this.code = 'capacity';
  }
}

export class ReadyTimeoutError extends Error {
  constructor(name, ms) {
    super(`${name} was not ready within ${ms}ms`);
    this.code = 'timeout';
  }
}

export function createInstanceManager({ docker, config, log, now = () => Date.now() }) {
  /** name → promise, so the iframe's parallel asset requests create exactly one container. */
  const inflight = new Map();
  /** name → last request timestamp; drives the reaper. */
  const lastSeen = new Map();
  /** image reference → { id, expires }; see imageMatches(). */
  const imageIds = new Map();
  /** `${slug}.${kind}` → { value, expires }; see proxySecret(). */
  const secrets = new Map();
  let reaperTimer = null;

  async function envLines(slug, kind) {
    const file = `${config.instanceEnvDir}/${slug}.${kind}.env`;
    try {
      return (await readFile(file, 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => ENV_LINE.test(line));
    } catch (error) {
      // The file is bind-mounted read-only from the host, and this process is the image's
      // unprivileged `node` user. A host-side `chmod 600` on a root-owned env file is
      // therefore invisible until a visitor asks for the app and every request 503s.
      if (error.code === 'EACCES') {
        throw new Error(`${file} is not readable by the broker (uid 1000): chown root:1000 and chmod 640 it on the host`);
      }
      if (error.code !== 'ENOENT') throw error;
      log.warn(`no env file at ${file}; starting ${slug} (${kind}) with defaults only`);
      return [];
    }
  }

  /**
   * The shared secret that proves to the app that `X-Apps-Tenant` came from this broker
   * and not from a client. Read from the instance's own env file — the same file the app
   * reads `GATEWAY_SECRET` from — so the two sides cannot drift apart. Empty when the app
   * does not use header tenancy, in which case no secret header is sent at all.
   */
  async function proxySecret(slug, kind) {
    const cacheKey = `${slug}.${kind}`;
    const cached = secrets.get(cacheKey);
    if (cached && cached.expires > now()) return cached.value;

    const prefix = 'GATEWAY_SECRET=';
    const line = (await envLines(slug, kind)).find(entry => entry.startsWith(prefix));
    const value = line ? line.slice(prefix.length) : '';
    secrets.set(cacheKey, { value, expires: now() + SECRET_TTL_MS });
    return value;
  }

  async function instanceEnv(slug, kind, runtime) {
    const lines = await envLines(slug, kind);

    // Keeps the app's Playwright print pass inside the container instead of looping back
    // out through the authenticated gateway, which would render a login page into the PDF.
    lines.push(`FRONTEND_BASE_URL=http://127.0.0.1:${runtime.port}/a/${slug}`);
    return lines;
  }

  async function containerSpec(app, key, kind) {
    const { runtime } = app;
    const hostConfig = {
      NetworkMode: config.instanceNetwork,
      Memory: runtime.memoryMb * 1024 * 1024,
      // Equal to Memory: swap disabled, so a runaway instance is killed rather than
      // swapping the whole box to a halt.
      MemorySwap: runtime.memoryMb * 1024 * 1024,
      // Chromium (PDF export) crashes on Docker's 64MB default /dev/shm.
      ShmSize: runtime.shmSizeMb * 1024 * 1024,
      PidsLimit: 512,
      CapDrop: ['ALL'],
      CapAdd: runtime.capAdd,
      SecurityOpt: ['no-new-privileges:true'],
      RestartPolicy: { Name: 'no' },
    };

    // Anonymous state is thrown away with the container, so it lives on tmpfs. Admin and
    // shared state is the point of those modes, so it lives on a named volume.
    if (kind === 'anon') {
      hostConfig.Tmpfs = { [runtime.dataPath]: `rw,size=${runtime.dataTmpfsMb}m,mode=1777` };
    } else {
      hostConfig.Mounts = [
        { Type: 'volume', Source: volumeName(app.slug, key), Target: runtime.dataPath },
      ];
    }

    return {
      Image: runtime.image,
      Env: await instanceEnv(app.slug, kind, runtime),
      Labels: {
        [LABELS.slug]: app.slug,
        [LABELS.key]: key,
        [LABELS.kind]: kind,
        [LABELS.image]: runtime.image,
      },
      HostConfig: hostConfig,
    };
  }

  /**
   * Refused before any container is created or started. Both ceilings matter: the per-kind
   * caps keep one kind from starving the other, and the total is what the box's RAM can
   * actually hold — without it, anon=1 plus admin=1 puts two instances on a machine sized
   * for one, and the kernel decides which dies instead of the visitor getting a 503.
   */
  async function assertCapacity(kind) {
    const running = await docker.list({ label: [LABELS.slug], status: ['running'] });
    if (running.length >= config.maxInstances.total) {
      throw new CapacityError('instance', config.maxInstances.total);
    }

    // Shared apps have no per-kind cap: there is exactly one instance per app either way,
    // and the total above is what the box can hold.
    const limit = config.maxInstances[kind];
    if (limit === undefined) return;
    const ofKind = running.filter(c => c.Labels?.[LABELS.kind] === kind).length;
    if (ofKind >= limit) throw new CapacityError(kind, limit);
  }

  /**
   * Whether a container is running the image its tag points at *now*.
   *
   * The label only records the reference string, so a moving tag like `:apps-mount` looks
   * unchanged after a `docker pull` even though the digest moved — an admin or shared
   * instance would then serve the old build until someone noticed. Comparing the container's
   * resolved image id catches it, so the deploy step really is just `docker pull`.
   *
   * Cached briefly: `ensure` runs on every proxied request, and this must not add a Docker
   * round trip to each one. An image id nobody can look up (pull in progress, image removed)
   * is treated as a match — refusing to serve would be worse than serving the old build.
   */
  async function imageMatches(detail, reference) {
    const cached = imageIds.get(reference);
    let id = cached && cached.expires > now() ? cached.id : null;
    if (!id) {
      try {
        id = (await docker.inspectImage(reference))?.Id ?? null;
      } catch (error) {
        log.warn(`could not resolve ${reference}: ${error.message}`);
        return true;
      }
      if (!id) return true;
      imageIds.set(reference, { id, expires: now() + IMAGE_ID_TTL_MS });
    }
    return detail.Image === id;
  }

  function endpointOf(detail, runtime) {
    const networks = detail.NetworkSettings?.Networks ?? {};
    const ip =
      networks[config.instanceNetwork]?.IPAddress ||
      Object.values(networks).find(net => net?.IPAddress)?.IPAddress;
    if (!ip) throw new Error(`container ${detail.Name} has no address on ${config.instanceNetwork}`);
    return `http://${ip}:${runtime.port}`;
  }

  async function waitReady(id, runtime, deadline) {
    let detail = null;

    // Phase 1: the image's own HEALTHCHECK, which knows when the internal backend is up.
    for (;;) {
      detail = await docker.inspect(id);
      if (!detail) throw new Error(`container ${id} vanished while starting`);
      if (!detail.State?.Running) throw new Error(`container ${id} exited while starting`);
      const health = detail.State?.Health?.Status;
      if (!health || health === 'healthy') break;
      if (health === 'unhealthy') throw new Error(`container ${id} reported unhealthy`);
      if (now() > deadline) throw new ReadyTimeoutError(id, config.readyTimeoutMs);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Phase 2: the public port answers. A 404 counts as ready — an app built with a
    // basePath has no route at "/", and all we need to know is that it is serving.
    const endpoint = endpointOf(detail, runtime);
    for (;;) {
      try {
        const response = await fetch(`${endpoint}${runtime.readyPath}`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(5000),
        });
        if (response.status < 500) return endpoint;
      } catch {
        // connection refused / still binding
      }
      if (now() > deadline) throw new ReadyTimeoutError(id, config.readyTimeoutMs);
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  async function ensureNow(app, key) {
    const kind = keyKind(key);
    const name = containerName(app.slug, key);
    const deadline = now() + config.readyTimeoutMs;

    let detail = await docker.inspect(name);

    if (detail) {
      const staleImage =
        detail.Config?.Labels?.[LABELS.image] !== app.runtime.image ||
        !(await imageMatches(detail, app.runtime.image));
      const running = detail.State?.Running === true;

      if (running && !staleImage) {
        return { name, endpoint: endpointOf(detail, app.runtime), secret: await proxySecret(app.slug, kind) };
      }

      // A stopped anonymous container has already lost its tmpfs, so restarting it would
      // hand the visitor a half-initialised instance. Recreate instead — clean slate is the
      // contract. A stale image is recreated whatever the kind.
      if (staleImage || (!running && kind === 'anon')) {
        log.info(`recreating ${name} (${staleImage ? 'image changed' : 'stopped anon instance'})`);
        await docker.remove(detail.Id, { force: true });
        detail = null;
      }
    }

    if (!detail) {
      await assertCapacity(kind);
      const id = await docker.create(name, await containerSpec(app, key, kind));
      log.info(`created ${name} (${kind}) from ${app.runtime.image}`);
      await docker.start(id);
    } else {
      await assertCapacity(kind);
      log.info(`restarting ${name} (${kind})`);
      await docker.start(detail.Id);
    }

    try {
      const endpoint = await waitReady(name, app.runtime, deadline);
      return { name, endpoint, secret: await proxySecret(app.slug, kind) };
    } catch (error) {
      // Read before anything is torn down. "exited while starting" says only that the app
      // died, not why; the why is in the container's own output, and for an anon instance
      // the next line deletes it. Without this an app that crashes on boot is invisible
      // from the box as well as from outside.
      const output = await docker.logs(name);
      if (output) log.error(`${name} output before it failed:\n${output}`);

      // A wedged anonymous instance is worth less than a fresh attempt; an admin or shared
      // one is kept for inspection because its volume holds real work.
      if (kind === 'anon') {
        const current = await docker.inspect(name);
        if (current) await docker.remove(current.Id, { force: true });
        lastSeen.delete(name);
      } else {
        log.error(`${kind} instance ${name} failed to become ready; keeping it for inspection`);
      }
      throw error;
    }
  }

  async function reapOnce() {
    const containers = await docker.list({ label: [LABELS.slug], all: true });
    for (const container of containers) {
      const name = (container.Names?.[0] ?? '').replace(/^\//, '');
      if (!name) continue;

      // Adopt anything we have not seen: the lastSeen map is in-memory, so after a broker
      // restart an active session must not be reaped out from under the visitor.
      const seen = lastSeen.get(name);
      if (seen === undefined) {
        lastSeen.set(name, now());
        continue;
      }
      if (now() - seen < config.idleTtlMs) continue;

      // Only anonymous instances are removed: their data is meant to disappear. Admin and
      // shared instances are stopped, freeing the RAM while the volume stays put, and the
      // next request restarts them (~6 s).
      const kind = container.Labels?.[LABELS.kind] ?? 'anon';
      const running = container.State === 'running';
      try {
        if (kind === 'anon') {
          await docker.remove(container.Id, { force: true });
          lastSeen.delete(name);
          log.info(`removed idle anonymous instance ${name}`);
        } else if (running) {
          await docker.stop(container.Id);
          log.info(`stopped idle ${kind} instance ${name}; volume retained`);
        }
      } catch (error) {
        log.error(`reaping ${name} failed: ${error.message}`);
      }
    }
  }

  return {
    /** Adopts containers left by a previous broker process so they are not reaped at once. */
    async adopt() {
      const containers = await docker.list({ label: [LABELS.slug], all: true });
      for (const container of containers) {
        const name = (container.Names?.[0] ?? '').replace(/^\//, '');
        if (name) lastSeen.set(name, now());
      }
      if (containers.length > 0) log.info(`adopted ${containers.length} existing instance(s)`);
    },

    ensure(app, key) {
      const name = containerName(app.slug, key);
      lastSeen.set(name, now());

      const pending = inflight.get(name);
      if (pending) return pending;

      const promise = ensureNow(app, key).finally(() => inflight.delete(name));
      inflight.set(name, promise);
      return promise;
    },

    touch(name) {
      if (name) lastSeen.set(name, now());
    },

    reapOnce,

    startReaper() {
      reaperTimer = setInterval(() => {
        reapOnce().catch(error => log.error(`reaper failed: ${error.message}`));
      }, config.reapIntervalMs);
      reaperTimer.unref();
    },

    stopReaper() {
      if (reaperTimer) clearInterval(reaperTimer);
      reaperTimer = null;
    },
  };
}
