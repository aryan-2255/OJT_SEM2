const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/authService");

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signupPatient(req.body);
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.status(200).json(result);
});

module.exports = {
  login,
  signup,
};

