const { randomUUID } = require("node:crypto");

const { RENDER_JOB_STATUSES } = require("@cosyl/shared/types/production");
const { processRenderJob } = require("./workers/render.worker");

let cachedBullMq = null;
let cachedIORedis = null;

function loadBullMq() {
  if (cachedBullMq !== null) {
    return cachedBullMq;
  }

  try {
    cachedBullMq = require("bullmq");
    return cachedBullMq;
  } catch {
    cachedBullMq = undefined;
    return cachedBullMq;
  }
}

function loadIORedis() {
  if (cachedIORedis !== null) {
    return cachedIORedis;
  }

  try {
    cachedIORedis = require("ioredis");
    return cachedIORedis;
  } catch {
    cachedIORedis = undefined;
    return cachedIORedis;
  }
}

function createLocalOrchestratorQueue({ jobsRepository, projectsRepository, composeVideo }) {
  return {
    driver: "local",
    async enqueueRenderJob(projectId, payload = {}) {
      const now = new Date().toISOString();
      const job = {
        id: `render-job-${randomUUID()}`,
        projectId,
        status: RENDER_JOB_STATUSES[0],
        step: "compose_video",
        progress: 5,
        attempts: typeof payload.attempts === "number" ? payload.attempts : 1,
        retryOf: typeof payload.retryOf === "string" ? payload.retryOf : null,
        payload,
        output: {
          driver: "local",
          events: [
            {
              id: `event-${randomUUID()}`,
              level: "info",
              step: "queued",
              message: "Queued in local fallback orchestrator.",
              createdAt: now,
            },
          ],
          logs: ["Queued in local fallback orchestrator."],
        },
        createdAt: now,
        updatedAt: now,
      };

      await jobsRepository.createJob(job);

      queueMicrotask(() => {
        void processRenderJob(job, { jobsRepository, projectsRepository, composeVideo });
      });

      return job;
    },
  };
}

function createBullMqOrchestratorQueue({ jobsRepository, projectsRepository, composeVideo, redisUrl }) {
  const bullmq = loadBullMq();
  const IORedis = loadIORedis();

  if (!bullmq || !IORedis || !redisUrl) {
    return null;
  }

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const queueName = "cosyl-render-jobs";
  const queue = new bullmq.Queue(queueName, { connection });

  new bullmq.Worker(
    queueName,
    async (bullJob) => {
      const job = await jobsRepository.getJob(bullJob.data.jobId);

      if (!job) {
        return;
      }

      await processRenderJob(job, { jobsRepository, projectsRepository, composeVideo });
    },
    { connection }
  );

  return {
    driver: "bullmq",
    async enqueueRenderJob(projectId, payload = {}) {
      const now = new Date().toISOString();
      const job = {
        id: `render-job-${randomUUID()}`,
        projectId,
        status: RENDER_JOB_STATUSES[0],
        step: "compose_video",
        progress: 5,
        attempts: typeof payload.attempts === "number" ? payload.attempts : 1,
        retryOf: typeof payload.retryOf === "string" ? payload.retryOf : null,
        payload,
        output: {
          driver: "bullmq",
          events: [
            {
              id: `event-${randomUUID()}`,
              level: "info",
              step: "queued",
              message: "Queued in BullMQ orchestrator.",
              createdAt: now,
            },
          ],
          logs: ["Queued in BullMQ orchestrator."],
        },
        createdAt: now,
        updatedAt: now,
      };

      await jobsRepository.createJob(job);
      await queue.add("render-project", { jobId: job.id, projectId }, {
        removeOnComplete: 50,
        removeOnFail: 50,
      });

      return job;
    },
  };
}

function createOrchestratorQueue({ jobsRepository, projectsRepository, composeVideo }) {
  const redisUrl = process.env.REDIS_URL;
  const bullMqQueue = createBullMqOrchestratorQueue({
    jobsRepository,
    projectsRepository,
    composeVideo,
    redisUrl,
  });

  if (bullMqQueue) {
    return bullMqQueue;
  }

  return createLocalOrchestratorQueue({ jobsRepository, projectsRepository, composeVideo });
}

module.exports = {
  createOrchestratorQueue,
};
