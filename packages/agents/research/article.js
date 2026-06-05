/**
 * Web article extraction.
 *
 * Fetches a URL and pulls readable text out of the HTML with a lightweight,
 * dependency-free cleaner: strip scripts/styles/nav, drop tags, collapse
 * whitespace, truncate. Good enough to feed an LLM as source material without
 * pulling in jsdom/readability.
 */
const MAX_ARTICLE_CHARS = 10000;
const FETCH_TIMEOUT_MS = 15000;

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
}

function htmlToText(html) {
  return html
    // Drop non-content blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    // Preserve paragraph breaks
    .replace(/<\/(p|div|section|article|h[1-6]|li|br)>/gi, "\n")
    // Drop all remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode the few entities that matter
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * @returns {Promise<{ ok: boolean, title?: string, text?: string, error?: string }>}
 */
async function fetchArticle(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // A realistic UA avoids some basic bot blocks.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return { ok: false, error: `Fetch failed (HTTP ${res.status}).` };
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return { ok: false, error: `Unsupported content type (${contentType || "unknown"}).` };
    }

    const html = await res.text();
    const title = extractTitle(html);
    const text = htmlToText(html).slice(0, MAX_ARTICLE_CHARS);

    if (text.length < 200) {
      return { ok: false, error: "Could not extract meaningful text from this page." };
    }
    return { ok: true, title, text };
  } catch (err) {
    const aborted = err && err.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "Request timed out." : err instanceof Error ? err.message : "Unable to fetch this page.",
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchArticle };
