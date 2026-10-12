function requireRole(...roles) {
  return (req, res, next) => {
    const now = Date.now();
    const doctorTimeoutMs = 15 * 60 * 1000;

    if (req.session.doctorUser && req.session.doctorLastSeen && now - req.session.doctorLastSeen > doctorTimeoutMs) {
      delete req.session.doctorUser;
      delete req.session.doctorLastSeen;
      if (req.session.user?.role === 'DOCTOR') delete req.session.user;
    }

    const roleUsers = {
      PATIENT: req.session.patientUser,
      DOCTOR: req.session.doctorUser,
      ADMIN: req.session.adminUser,
    };
    const matchedRole = roles.find((role) => roleUsers[role]?.role === role);
    if (matchedRole) {
      req.authUser = roleUsers[matchedRole];
      req.session.user = req.authUser;
      if (matchedRole === 'DOCTOR') req.session.doctorLastSeen = now;
      return next();
    }

    const userRole = req.session.user?.role;
    if (roles.includes(userRole)) {
      req.authUser = req.session.user;
      if (userRole === 'DOCTOR') req.session.doctorLastSeen = now;
      return next();
    }

    return res.status(401).json({ message: `Login required for ${roles.join(' or ')} access.` });
  };
}

module.exports = { requireRole };
