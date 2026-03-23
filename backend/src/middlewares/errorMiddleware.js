function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  const statusCode =
    error.statusCode ||
    (error.code === "P2002" ? 409 : error.code === "P2034" ? 409 : 500);

  const message =
    error.code === "P2002"
      ? "A record with the same unique value already exists."
      : error.code === "P2034"
        ? "This action conflicted with another transaction. Please try again."
        : error.message || "Internal server error.";

  res.status(statusCode).json({
    message,
  });
}

module.exports = {
  errorHandler,
  notFound,
};

