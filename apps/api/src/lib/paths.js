/**
 * Single source of truth for the local data directory.
 *
 * Honors the COSYL_DATA_DIR environment variable so tests (and alternate
 * deployments) can point every file store at an isolated location. When unset,
 * defaults to apps/api/data — the path the app has always used.
 */
const path = require("node:path");

const dataRoot = process.env.COSYL_DATA_DIR
  ? path.resolve(process.env.COSYL_DATA_DIR)
  : path.resolve(__dirname, "..", "..", "data");

module.exports = { dataRoot };
