/**
 * File-backed render-jobs store — same mutex pattern as projects/store.js.
 */
const fs = require("node:fs/promises");
const path = require("node:path");

const { Mutex } = require("../lib/mutex");
const { dataRoot } = require("../lib/paths");

const dataDirectory = dataRoot;
const renderJobsFile = path.join(dataDirectory, "render-jobs.json");

const writeMutex = new Mutex();

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

async function _atomicWrite(mutateFn) {
  return writeMutex.lock(async () => {
    const jobs = await readRenderJobs();
    return mutateFn(jobs);
  });
}

async function writeRenderJobs(renderJobs) {
  await ensureRenderJobsFile();
  await fs.writeFile(renderJobsFile, JSON.stringify(renderJobs, null, 2), "utf8");
}

async function createJob(job) {
  return _atomicWrite(async (jobs) => {
    jobs.push(job);
    await writeRenderJobs(jobs);
    return job;
  });
}

async function updateJob(jobId, nextJob) {
  return _atomicWrite(async (jobs) => {
    const index = jobs.findIndex((j) => j.id === jobId);
    if (index === -1) return null;
    jobs[index] = nextJob;
    await writeRenderJobs(jobs);
    return nextJob;
  });
}

module.exports = {
  readRenderJobs,
  writeRenderJobs,
  createJob,
  updateJob,
};
