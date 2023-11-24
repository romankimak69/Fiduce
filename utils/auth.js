module.exports.ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', "Vous n'êtes pas connecté.");
  return res.redirect('/users/login');
};
