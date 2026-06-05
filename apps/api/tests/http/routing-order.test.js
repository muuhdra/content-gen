/**
 * Routing order — locks in the Phase 3 mount sequence.
 *
 * After splitting routes by domain, the aggregator mounts specific paths
 * (reference-assets, script, scenes, audio, captions, render) *before* the
 * CRUD router whose `GET /:id` would otherwise catch `/reference-assets`.
 *
 * If any future refactor breaks the mount order, these tests fail.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { startTestServer } = require("./_helpers");

let server;
let api;

before(async () => {
  server = await startTestServer();
  api = server.api;
});

after(async () => {
  await server.close();
});

test("GET /projects/reference-assets?draftId=... → 200 (pas 404 de GET /:id)", async () => {
  const res = await api.get("/projects/reference-assets?draftId=routing-test-draft");
  assert.equal(res.status, 200, "doit être intercepté par le router reference-assets, pas par GET /:id");
  const json = await res.json();
  assert.ok(Array.isArray(json.data), "format de réponse cohérent");
});

test("GET /projects/reference-assets sans draftId/projectId → 400 (validation, pas 404)", async () => {
  const res = await api.get("/projects/reference-assets");
  assert.equal(res.status, 400, "valide la query, ne tombe pas dans GET /:id");
});

test("DELETE /projects/reference-assets/scope → 400 sans payload (atteint le bon handler)", async () => {
  const res = await api.delete("/projects/reference-assets/scope", {});
  assert.equal(res.status, 400, "atteint le handler scope, qui rejette le payload vide");
});

test("/health monté à la racine, pas sous /projects", async () => {
  const res = await api.get("/health");
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, "ok");
});

test("Route inexistante → 404", async () => {
  const res = await api.get("/projects/does-not-exist-xyz");
  assert.equal(res.status, 404);
});
