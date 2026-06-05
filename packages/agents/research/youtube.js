/**
 * YouTube transcript extraction.
 *
 * Reads a video's caption track via the `youtube-transcript` package (no API
 * key — it scrapes the public timedtext endpoint). Returns the concatenated
 * transcript text, truncated to keep token usage sane.
 */
const { YoutubeTranscript } = require("youtube-transcript");

const MAX_TRANSCRIPT_CHARS = 12000;

const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtu\.be)$/i;

function isYouTubeUrl(url) {
  try {
    const host = new URL(url).hostname;
    return YOUTUBE_HOST.test(host);
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ ok: boolean, text?: string, error?: string }>}
 */
async function fetchYouTubeTranscript(url) {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(url);
    if (!Array.isArray(segments) || segments.length === 0) {
      return { ok: false, error: "No transcript available for this video." };
    }

    const text = segments
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TRANSCRIPT_CHARS);

    if (!text) {
      return { ok: false, error: "Transcript was empty." };
    }
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unable to read this video's captions.",
    };
  }
}

module.exports = { isYouTubeUrl, fetchYouTubeTranscript };
