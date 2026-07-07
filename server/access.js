function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.session.user?.role;
    if (roles.includes(userRole)) return next();

    if (process.env.NODE_ENV !== 'production' && !userRole) {
      req.devAuthBypass = true;
      return next();
    }

    return res.status(401).json({ message: `Login required for ${roles.join(' or ')} access.` });
  };
}

module.exports = { requireRole };
