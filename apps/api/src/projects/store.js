const fs = require("node:fs/promises");
const path = require("node:path");

const { defaultProjects } = require("./defaults");

const dataDirectory = path.join(__dirname, "..", "..", "data");
const projectsFile = path.join(dataDirectory, "projects.json");

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

async function writeProjects(projects) {
  await ensureProjectsFile();
  await fs.writeFile(projectsFile, JSON.stringify(projects, null, 2), "utf8");
}

module.exports = {
  readProjects,
  writeProjects,
};
