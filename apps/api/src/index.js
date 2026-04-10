const express = require('express');
const { projectsRouter } = require('./projects/routes');
const { mediaRouter } = require('./media/routes');
const { templatesRouter } = require('./templates/routes');

const app = express();
const port = process.env.PORT || 4000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
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
app.use('/', mediaRouter);

app.listen(port, () => {
  console.log(`COSYL API listening at http://localhost:${port}`);
});
