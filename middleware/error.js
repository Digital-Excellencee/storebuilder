function route(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      console.error(`[ERROR] ${req.method} ${req.path}`, error.message || error);
      next(error);
    }
  };
}

module.exports = { route };
