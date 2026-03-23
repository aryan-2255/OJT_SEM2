const httpError = require("../utils/httpError");
const { verifyToken } = require("../utils/jwt");

function authenticate(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return next(httpError(401, "Authentication token is required."));
  }

  const token = authorizationHeader.replace("Bearer ", "").trim();

  try {
    const payload = verifyToken(token);

    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      email: payload.email,
      name: payload.name,
    };

    return next();
  } catch (error) {
    return next(httpError(401, "Invalid or expired token."));
  }
}

function authorize(...allowedRoles) {
  return function authorizeRole(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(httpError(403, "You are not allowed to access this resource."));
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorize,
};

