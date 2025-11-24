const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { json } = require("express");

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(500).json({ error: "Authentication error" });
  }
};

const adminOnly = (req, res, next) => {
  const checkToken = (req, res) => {
    const authHeader = req.headers && req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token missing" });
      return Promise.reject();
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err && err.name === "TokenExpiredError") {
        res.status(401).json({ error: "Expired token" });
      } else {
        res.status(401).json({ error: "Invalid token" });
      }
      return Promise.reject();
    }
    return User.findById(decoded.userId)
      .then((user) => {
        if (!user || !user.isActive) {
          res.status(401).json({ error: "No active user" });
          return Promise.reject();
        }
        req.user = user;
        return user;
      })
      .catch(() => {
        res.status(500).json({ error: "Server auth error" });
        return Promise.reject();
      });
  };

  checkToken(req, res)
    .then((user) => {
      if (user.role !== "ADMIN") {
        return res.status(403).json({ error: "Forbidden: admin only" });
      }
      req.user = user;
      next();
    })
    .catch((error) => {
      return res.status(401).json({ error }); // Response already sent in checkToken
    });
};

module.exports = { authMiddleware, adminOnly };
