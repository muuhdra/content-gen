/**
 * Backward-compatible entry point.
 *
 * The implementation now lives in `./routes/` split by domain (script, scenes,
 * audio, captions, render, reference-assets, CRUD). The aggregator in
 * `./routes/index.js` mounts them in the order Express needs.
 */
module.exports = require("./routes/index");
