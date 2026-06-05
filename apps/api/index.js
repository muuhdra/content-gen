/**
 * COSYL API entry point.
 *
 * - `createApp()` builds the Express app *without* listening, so tests and
 *   embedding hosts can use it directly.
 * - When this file is run directly (`node apps/api/index.js`), the server
 *   binds the configured port and starts listening.
 */
const express = require('express');
const { projectsRouter } = require('./src/projects/routes');
const { mediaRouter } = require('./src/media/routes');
const { templatesRouter } = require('./src/templates/routes');
const { thumbnailsRouter } = require('./src/thumbnails/routes');
const { referencesRouter } = require('./src/thumbnails/references-routes');
const { voiceClonesRouter } = require('./src/voice-clones/routes');

function createApp() {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }

    next();
  });

  app.use(express.json({ limit: '25mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'cosyl-api' });
  });

  app.use('/projects', projectsRouter);
  app.use('/templates', templatesRouter);
  app.use('/thumbnails/references', referencesRouter); // before the generic /thumbnails router
  app.use('/thumbnails', thumbnailsRouter);
  app.use('/voice-clones', voiceClonesRouter);
  app.use('/', mediaRouter);

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 4000;
  createApp().listen(port, () => {
    console.log(`COSYL API listening at http://localhost:${port}`);
  });
}

module.exports = { createApp };
