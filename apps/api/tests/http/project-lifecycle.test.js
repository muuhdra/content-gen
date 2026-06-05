/**
 * Project CRUD lifecycle over HTTP.
 *
 * Verifies the basic contract every UI client depends on:
 *   - create → 201 with a normalized payload
 *   - read   → 200 with full structure (script, audio, scenes, …)
 *   - delete → 204 and subsequent reads → 404
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { startTestServer, getProject } = require("./_helpers");

let server;
let api;

before(async () => {
  server = await startTestServer();
  api = server.api;
});

after(async () => {
  await server.close();
});

test("POST /projects → 201 et projet en Draft avec sections normalisées", async () => {
  const res = await api.post("/projects", { title: "Lifecycle A", type: "Short Form / TikTok" });
  assert.equal(res.status, 201);
  const { data } = await res.json();

  assert.match(data.id, /^lifecycle-a-/);
  assert.equal(data.title, "Lifecycle A");
  assert.equal(data.type, "Short Form / TikTok");
  assert.equal(data.status, "Draft");

  // Sections normalisées présentes
  for (const k of ["script", "scenes", "audio", "captions", "assembly", "review", "settings"]) {
    assert.ok(k in data, `${k} manquant dans la réponse de création`);
  }

  // Cleanup
  await api.delete(`/projects/${data.id}`);
});

test("GET /projects/:id inexistant → 404 avec error JSON", async () => {
  const res = await api.get("/projects/inexistant-xyz-123");
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(typeof json.error, "string");
});

test("DELETE /projects/:id → 204 puis 404 sur GET", async () => {
  const createRes = await api.post("/projects", { title: "To Delete", type: "Long Form / YouTube" });
  const { data } = await createRes.json();

  const delRes = await api.delete(`/projects/${data.id}`);
  assert.equal(delRes.status, 204);

  const getRes = await api.get(`/projects/${data.id}`);
  assert.equal(getRes.status, 404);
});

test("GET /projects → liste contient le projet créé", async () => {
  const createRes = await api.post("/projects", { title: "Listed", type: "Long Form / YouTube" });
  const { data: created } = await createRes.json();

  const listRes = await api.get("/projects");
  const { data: list } = await listRes.json();

  assert.ok(Array.isArray(list));
  assert.ok(list.some((p) => p.id === created.id), "le projet créé doit apparaître dans la liste");

  await api.delete(`/projects/${created.id}`);
});

test("Pipeline minimal: création → lecture des sous-ressources (script/audio/scenes/captions/assembly)", async () => {
  const createRes = await api.post("/projects", { title: "Pipeline Read", type: "Long Form / YouTube" });
  const { data: created } = await createRes.json();

  for (const section of ["script", "scenes", "audio", "captions", "assembly"]) {
    const res = await api.get(`/projects/${created.id}/${section}`);
    assert.equal(res.status, 200, `GET /:id/${section} doit répondre 200`);
  }

  // Snapshot via getProject helper
  const fresh = await getProject(api, created.id);
  assert.equal(fresh.id, created.id);

  await api.delete(`/projects/${created.id}`);
});
