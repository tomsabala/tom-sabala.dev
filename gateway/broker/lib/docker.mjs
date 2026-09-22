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
      // A 404 here is the *image*, not the container - the daemon refuses to create from
      // one that is not on the box. request() flattens every 404 to a null body so an
      // absent container reads as null in inspect(); without this, that null surfaces as
      // "Cannot read properties of null (reading 'Id')", which names neither the image nor
      // the fix. The broker never pulls by design, so this is a real operational state.
      if (!body?.Id) {
        throw new Error(`image ${spec.Image} is not present on this host - pull it (gateway/deploy.sh --images-only)`);
      }
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
