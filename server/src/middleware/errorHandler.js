export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler({ isProduction }) {
  // Express recognises error handlers by their four parameters.
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);

    // body-parser errors carry their own status: 400 bad JSON, 413 too large.
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600
      ? err.status
      : 500;
    if (status >= 500) console.error(err);

    const hide = status >= 500 && isProduction;
    res.status(status).json({ error: hide ? 'Internal server error' : err.message });
  };
}
