/**
 * State machine — locks in Incohérence #2 fix at the HTTP boundary.
 *
 *   New project ............................ Draft
 *   First authoring action (script/save) .... Active
 *   Forced Completed, then re-edit .......... Active
 *   Forced Completed, PATCH meta-only ....... Completed (no promotion on title)
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { startTestServer, createProject, getProject } = require("./_helpers");

let server;
let api;

before(async () => {
  server = await startTestServer();
  api = server.api;
});

after(async () => {
  await server.close();
});

test("Création → statut Draft", async () => {
  const id = await createProject(api, { title: "Status Draft" });
  const project = await getProject(api, id);
  assert.equal(project.status, "Draft");
  await api.delete(`/projects/${id}`);
});

test("Première action d'authoring (script/save) → Active", async () => {
  const id = await createProject(api, { title: "Status Promote" });

  const saveRes = await api.post(`/projects/${id}/script/save`, {
    mode: "manual",
    content: "Test script.",
    topic: "Test",
  });
  assert.equal(saveRes.status, 200);

  const project = await getProject(api, id);
  assert.equal(project.status, "Active", "Draft doit être promu à Active");

  await api.delete(`/projects/${id}`);
});

test("Ré-édition d'un projet Completed → revient à Active", async () => {
  const id = await createProject(api, { title: "Status Re-edit" });

  // Force le projet en Completed via PATCH méta
  await api.patch(`/projects/${id}`, { status: "Completed" });
  let project = await getProject(api, id);
  assert.equal(project.status, "Completed");

  // Une vraie action d'authoring doit le faire revenir à Active
  await api.post(`/projects/${id}/script/save`, {
    mode: "manual",
    content: "Revised script.",
    topic: "Revised",
  });
  project = await getProject(api, id);
  assert.equal(project.status, "Active", "Completed → Active sur ré-édition");

  await api.delete(`/projects/${id}`);
});

test("PATCH méta-seul (titre) sur Completed → reste Completed (pas de promo accidentelle)", async () => {
  const id = await createProject(api, { title: "Status Meta" });
  await api.patch(`/projects/${id}`, { status: "Completed" });

  await api.patch(`/projects/${id}`, { title: "Renamed only" });

  const project = await getProject(api, id);
  assert.equal(project.status, "Completed", "renommage seul ne doit pas remettre en Active");
  assert.equal(project.title, "Renamed only");

  await api.delete(`/projects/${id}`);
});
