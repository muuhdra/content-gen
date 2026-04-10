#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function resolveAjv2020() {
  const candidates = [
    "ajv/dist/2020",
    path.resolve(process.cwd(), "node_modules/ajv-formats/node_modules/ajv/dist/2020"),
    path.resolve(process.cwd(), "node_modules/@modelcontextprotocol/sdk/node_modules/ajv/dist/2020"),
  ];

  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const resolved = require(candidate);
      return resolved.default || resolved;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(
    "Ajv 2020 validator not found. Install or expose an Ajv v8 runtime before running schema validation."
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listFiles(dirPath, predicate) {
  return fs
    .readdirSync(dirPath)
    .filter((entry) => predicate(entry))
    .sort()
    .map((entry) => path.join(dirPath, entry));
}

function main() {
  const root = process.cwd();
  const schemasDir = path.join(root, "Production", "schemas");
  const examplesDir = path.join(root, "Production", "examples");
  const sharedSchemaPath = path.join(schemasDir, "shared.schema.json");
  const manifestPath = path.join(schemasDir, "pipeline.manifest.json");

  const Ajv2020 = resolveAjv2020();
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });

  const sharedSchema = readJson(sharedSchemaPath);
  ajv.addSchema(sharedSchema, sharedSchema.$id);
  ajv.addSchema(sharedSchema, "shared.schema.json");

  const schemaFiles = listFiles(
    schemasDir,
    (entry) =>
      entry.endsWith(".schema.json") &&
      entry !== "shared.schema.json"
  );

  for (const schemaPath of schemaFiles) {
    const schema = readJson(schemaPath);
    ajv.addSchema(schema, schema.$id || path.basename(schemaPath));
    ajv.addSchema(schema, path.basename(schemaPath));
  }

  const manifest = readJson(manifestPath);
  const exampleFiles = listFiles(
    examplesDir,
    (entry) => entry.endsWith(".example.json")
  );

  const results = [];

  for (const step of manifest.pipeline) {
    const schemaRef = step.schema.replace(/^\.\//, "");
    const examplePrefix = `${String(step.order).padStart(2, "0")}-`;
    const examplePath = exampleFiles.find((filePath) =>
      path.basename(filePath).startsWith(examplePrefix)
    );

    if (!examplePath) {
      results.push({
        ok: false,
        label: `${step.agent} ${step.stage}`,
        message: `Missing example file for step ${step.order}.`,
      });
      continue;
    }

    const validate = ajv.getSchema(schemaRef);

    if (!validate) {
      results.push({
        ok: false,
        label: `${step.agent} ${step.stage}`,
        message: `Schema not registered: ${schemaRef}`,
      });
      continue;
    }

    const data = readJson(examplePath);
    const valid = validate(data);

    if (!valid) {
      const errors = (validate.errors || [])
        .map((error) => `${error.instancePath || "/"} ${error.message}`)
        .join("; ");

      results.push({
        ok: false,
        label: `${step.agent} ${step.stage}`,
        message: errors || "Unknown validation error.",
      });
      continue;
    }

    results.push({
      ok: true,
      label: `${step.agent} ${step.stage}`,
      message: `${path.basename(examplePath)} matches ${schemaRef}`,
    });
  }

  const failed = results.filter((result) => !result.ok);

  for (const result of results) {
    const prefix = result.ok ? "PASS" : "FAIL";
    process.stdout.write(`${prefix} ${result.label}: ${result.message}\n`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
    return;
  }

  process.stdout.write("All production schema examples are valid.\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Schema validation failed."}\n`);
  process.exitCode = 1;
}
