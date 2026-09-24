// Minimal REST client for setup/test-data creation.
// Intended use: create inbox messages, register users, place bets, etc. via
// API to fast-setup state, then assert results through the UI.
//
// NOTE: Endpoints are placeholder-backed. Replace with the real Cazweb API
// contract once available. Selectors and endpoints here are starting points.

/**
 * @param {string} baseURL the environment base URL
 * @param {object} [opts]
 */
export function createApiClient(baseURL, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };

  async function request(method, path = '', body) {
    const res = await fetch(`${baseURL.replace(/\/$/, '')}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`API ${method} ${path} failed: ${res.status} ${await res.text()}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b),
    put: (p, b) => request('PUT', p, b),
    delete: (p) => request('DELETE', p),

    // Convenience wrappers for known setup needs (endpoints are illustrative).
    createInboxMessage: (payload) => request('POST', '/api/inbox/messages', payload),
    registerUser: (payload) => request('POST', '/api/auth/register', payload),
  };
}

export default createApiClient;