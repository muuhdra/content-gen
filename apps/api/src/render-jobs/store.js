const fs = require("node:fs/promises");
const path = require("node:path");

const dataDirectory = path.join(__dirname, "..", "..", "data");
const renderJobsFile = path.join(dataDirectory, "render-jobs.json");

async function ensureRenderJobsFile() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    await fs.access(renderJobsFile);
  } catch {
    await fs.writeFile(renderJobsFile, JSON.stringify([], null, 2), "utf8");
  }
}

async function readRenderJobs() {
  await ensureRenderJobsFile();
  const rawRenderJobs = await fs.readFile(renderJobsFile, "utf8");

  try {
    const parsedRenderJobs = JSON.parse(rawRenderJobs);
    return Array.isArray(parsedRenderJobs) ? parsedRenderJobs : [];
  } catch {
    await fs.writeFile(renderJobsFile, JSON.stringify([], null, 2), "utf8");
    return [];
  }
}

async function writeRenderJobs(renderJobs) {
  await ensureRenderJobsFile();
  await fs.writeFile(renderJobsFile, JSON.stringify(renderJobs, null, 2), "utf8");
}

module.exports = {
  readRenderJobs,
  writeRenderJobs,
};
