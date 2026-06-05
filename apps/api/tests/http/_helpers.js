/**
 * Test helpers for HTTP integration tests.
 *
 * Spins up the Express app on an ephemeral port (so tests can run while a dev
 * server is already on :4000) and exposes a tiny request client over Node 22's
 * native `fetch`.
 *
 * Isolation: each test FILE runs in its own process. Before the app (and thus
 * the file stores) load, we point COSYL_DATA_DIR at a unique temp directory so
 * parallel test files never share `projects.json` / `render-jobs.json` on disk.
 * The in-process mutex only serializes writes within ONE process — cross-process
 * isolation requires separate data dirs.
 *
 * Zero extra dependencies.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Must run BEFORE requiring the app: stores resolve the data dir at module load.
if (!process.env.COSYL_DATA_DIR) {
  process.env.COSYL_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cosyl-test-"));
}

const { createApp } = require("../../index");

async function startTestServer() {
  const app = createApp();

  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, (err) => (err ? reject(err) : resolve(s)));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function close() {
    await new Promise((resolve) => server.close(resolve));
  }

  // Thin helper so tests read like `await api.post('/projects', { body })`.
  function request(method, urlPath, options = {}) {
    const init = {
      method,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    };
    if (options.body !== undefined && options.body !== null) {
      init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }
    return fetch(`${baseUrl}${urlPath}`, init);
  }

  const api = {
    get:    (p, o) => request("GET",    p, o),
    post:   (p, body, o) => request("POST",   p, { ...o, body }),
    patch:  (p, body, o) => request("PATCH",  p, { ...o, body }),
    delete: (p, body, o) => request("DELETE", p, { ...o, body }),
  };

  return { baseUrl, close, api };
}

/**
 * Create a project for use in tests. Returns the project id; the caller is
 * responsible for `DELETE /projects/:id` in cleanup.
 */
async function createProject(api, overrides = {}) {
  const res = await api.post("/projects", {
    title: "HTTP Test",
    type: "Long Form / YouTube",
    ...overrides,
  });
  if (!res.ok) {
    throw new Error(`Project setup failed: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data.id;
}

async function getProject(api, projectId) {
  const res = await api.get(`/projects/${projectId}`);
  if (!res.ok) throw new Error(`getProject(${projectId}) → HTTP ${res.status}`);
  return (await res.json()).data;
}

module.exports = { startTestServer, createProject, getProject };
