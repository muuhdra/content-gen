/**
 * Audio cascade over HTTP — locks in Incohérence #1 fix at the API boundary.
 *
 * Flow:
 *   1. Create project + save a script + generate audio → audio is "generated"
 *   2. Change the script → narration/music/sfx all reset to "draft",
 *      generatedAt → null. The render gate now blocks until regeneration.
 *
 * The render gate behavior is also exercised: render without HITL approvals
 * must return 400 with a clear error.
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

test("script changé après audio généré → narration/music/sfx → draft", async () => {
  const id = await createProject(api, { title: "Cascade Audio" });

  // 1. Save script
  await api.post(`/projects/${id}/script/save`, {
    mode: "manual",
    content: "First version of the script about AI.",
    topic: "AI",
  });

  // 2. Generate audio stack
  const genRes = await api.post(`/projects/${id}/audio/generate`, {});
  assert.equal(genRes.status, 200);

  let project = await getProject(api, id);
  assert.equal(project.audio.narration.status, "generated", "narration doit être generated");
  assert.equal(project.audio.music.status, "generated",     "music doit être generated");
  assert.equal(project.audio.sfx.status, "generated",       "sfx doit être generated");
  assert.notEqual(project.audio.generatedAt, null,          "generatedAt doit être défini");

  // 3. Change the script
  await api.post(`/projects/${id}/script/save`, {
    mode: "manual",
    content: "DIFFERENT version about quantum computing.",
    topic: "Quantum",
  });

  // 4. Audio doit avoir été invalidé
  project = await getProject(api, id);
  assert.equal(project.audio.narration.status, "draft", "narration doit être remis en draft");
  assert.equal(project.audio.music.status, "draft",     "music doit être remis en draft");
  assert.equal(project.audio.sfx.status, "draft",       "sfx doit être remis en draft");
  assert.equal(project.audio.generatedAt, null,         "generatedAt doit être null");

  await api.delete(`/projects/${id}`);
});

test("render bloqué (HITL) → 400 avec message d'erreur clair", async () => {
  const id = await createProject(api, { title: "Render Gate" });

  // Pas de script, pas de scène, pas d'approbation → doit être bloqué
  const res = await api.post(`/projects/${id}/render`, {});
  assert.equal(res.status, 400, "render sans approbation doit retourner 400");

  const json = await res.json();
  assert.equal(typeof json.error, "string");
  assert.ok(json.error.length > 0, "doit fournir un message d'erreur");

  await api.delete(`/projects/${id}`);
});

test("PATCH avec scenes change + tentative approbation review → reset prime (HITL préservé)", async () => {
  const id = await createProject(api, { title: "Review Reset HTTP" });

  // Save script first so the scene change has a base
  await api.post(`/projects/${id}/script/save`, {
    mode: "manual",
    content: "Some content.",
    topic: "X",
  });

  // Patch simultané: changement de scènes + tentative d'approbation
  await api.patch(`/projects/${id}`, {
    scenes: [{ sceneId: 1, narration: "S", visualIntent: "V", duration: 5 }],
    review: { scenePlan: { status: "approved" } },
  });

  const project = await getProject(api, id);
  assert.equal(project.review.scenePlan.status, "pending",
    "le reset doit primer sur l'approbation entrante quand le contenu change");
  assert.equal(project.review.finalAssembly.status, "pending");

  await api.delete(`/projects/${id}`);
});
