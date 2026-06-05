/**
 * Shared Express helpers.
 */

/**
 * Wrap an async route handler so thrown errors become a 500 JSON response
 * instead of an unhandled rejection.
 */
function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("API error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unexpected server error",
      });
    }
  };
}

module.exports = { withErrorHandling };
