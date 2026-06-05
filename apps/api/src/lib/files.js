/**
 * Shared filesystem helpers used across the media + projects layers.
 */

/** Turn an arbitrary value into a safe, lowercase path segment. */
function sanitizeFileSegment(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "asset";
}

/** Human-readable file size label (KB / MB). */
function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown size";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

module.exports = { sanitizeFileSegment, formatFileSize };
