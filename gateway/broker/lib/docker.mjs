/**
 * Minimal Docker Engine API client.
 *
 * Speaks HTTP to `tecnativa/docker-socket-proxy`, never to the socket itself: the broker is
 * the thing exposed to the internet, so it gets no `/var/run/docker.sock` and only the
 * handful of endpoints the proxy is configured to pass through.
 */

export function createDockerClient({ baseUrl, fetchImpl = fetch }) {
  async function request(method, path, body) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 404) return { status: 404, body: null };
    if (response.status === 204 || response.status === 304) return { status: response.status, body: null };

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`docker ${method} ${path} → ${response.status}: ${text.slice(0, 300)}`);
    }
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  return {
    /** Container detail by name or id; null when there is no such container. */
    async inspect(nameOrId) {
      const { body } = await request('GET', `/containers/${encodeURIComponent(nameOrId)}/json`);
      return body;
    },

    /** Image detail by reference or id; null when the image is not present locally. */
    async inspectImage(reference) {
      const { body } = await request('GET', `/images/${encodeURIComponent(reference)}/json`);
      return body;
    },

    async list({ label = [], status = [], all = false } = {}) {
      const filters = {};
      if (label.length > 0) filters.label = label;
      if (status.length > 0) filters.status = status;
      const query = new URLSearchParams({ filters: JSON.stringify(filters) });
      if (all) query.set('all', 'true');
      const { body } = await request('GET', `/containers/json?${query}`);
      return body ?? [];
    },

    async create(name, spec) {
      const { body } = await request('POST', `/containers/create?name=${encodeURIComponent(name)}`, spec);
      return body.Id;
    },

    async start(id) {
      await request('POST', `/containers/${encodeURIComponent(id)}/start`);
    },

    async stop(id, { timeoutSeconds = 10 } = {}) {
      await request('POST', `/containers/${encodeURIComponent(id)}/stop?t=${timeoutSeconds}`);
    },

    /** `v=true` reaps only anonymous volumes; a named admin volume survives. */
    async remove(id, { force = false } = {}) {
      await request('DELETE', `/containers/${encodeURIComponent(id)}?v=true&force=${force}`);
    },
  };
}
