const fs = require("node:fs/promises");
const path = require("node:path");

const { DEFAULT_TEMPLATES } = require("@cosyl/config/templates");
const { dataRoot } = require("../lib/paths");

const dataDirectory = dataRoot;
const templatesFile = path.join(dataDirectory, "templates.json");

async function ensureTemplatesFile() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    await fs.access(templatesFile);
  } catch {
    await fs.writeFile(templatesFile, JSON.stringify(DEFAULT_TEMPLATES, null, 2), "utf8");
  }
}

async function readTemplates() {
  await ensureTemplatesFile();
  const rawTemplates = await fs.readFile(templatesFile, "utf8");

  try {
    const parsedTemplates = JSON.parse(rawTemplates);
    return Array.isArray(parsedTemplates) ? parsedTemplates : DEFAULT_TEMPLATES;
  } catch {
    await fs.writeFile(templatesFile, JSON.stringify(DEFAULT_TEMPLATES, null, 2), "utf8");
    return DEFAULT_TEMPLATES;
  }
}

async function writeTemplates(templates) {
  await ensureTemplatesFile();
  await fs.writeFile(templatesFile, JSON.stringify(templates, null, 2), "utf8");
}

module.exports = {
  readTemplates,
  writeTemplates,
};
