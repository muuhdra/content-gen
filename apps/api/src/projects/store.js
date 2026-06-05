/**
 * File-backed project store.
 *
 * All mutating operations (create / update / delete) run inside a per-file
 * Mutex so concurrent requests cannot clobber each other's writes.
 * Read-only operations (readProjects) are lock-free — they only race with
 * writes, and the write lock guarantees a consistent snapshot is always on
 * disk between mutations.
 */
const fs = require("node:fs/promises");
const path = require("node:path");

const { Mutex } = require("../lib/mutex");
const { dataRoot } = require("../lib/paths");
const { defaultProjects } = require("./defaults");

const dataDirectory = dataRoot;
const projectsFile = path.join(dataDirectory, "projects.json");

// One mutex per file — all write operations on projects.json are serialized.
const writeMutex = new Mutex();

async function ensureProjectsFile() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    await fs.access(projectsFile);
  } catch {
    await fs.writeFile(projectsFile, JSON.stringify(defaultProjects, null, 2), "utf8");
  }
}

async function readProjects() {
  await ensureProjectsFile();
  const rawProjects = await fs.readFile(projectsFile, "utf8");

  try {
    const parsedProjects = JSON.parse(rawProjects);
    return Array.isArray(parsedProjects) ? parsedProjects : defaultProjects;
  } catch {
    await fs.writeFile(projectsFile, JSON.stringify(defaultProjects, null, 2), "utf8");
    return defaultProjects;
  }
}

// Atomic read-modify-write: runs exclusively inside the mutex.
async function _atomicWrite(mutateFn) {
  return writeMutex.lock(async () => {
    const projects = await readProjects();
    return mutateFn(projects);
  });
}

async function writeProjects(projects) {
  await ensureProjectsFile();
  await fs.writeFile(projectsFile, JSON.stringify(projects, null, 2), "utf8");
}

// ─── Exported atomic mutations ────────────────────────────────────────────────

async function createProject(project) {
  return _atomicWrite(async (projects) => {
    projects.push(project);
    await writeProjects(projects);
    return project;
  });
}

async function updateProject(projectId, nextProject) {
  return _atomicWrite(async (projects) => {
    const index = projects.findIndex((p) => p.id === projectId);
    if (index === -1) return null;
    projects[index] = nextProject;
    await writeProjects(projects);
    return nextProject;
  });
}

async function deleteProject(projectId) {
  return _atomicWrite(async (projects) => {
    const next = projects.filter((p) => p.id !== projectId);
    if (next.length === projects.length) return false;
    await writeProjects(next);
    return true;
  });
}

module.exports = {
  readProjects,
  writeProjects,
  createProject,
  updateProject,
  deleteProject,
};
