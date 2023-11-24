const passport = require('passport');
const { Strategy, ExtractJwt } = require('passport-jwt');
const HttpError = require('http-errors');
const JWT = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const verify = (user, done) => done(null, user);

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
};

passport.use('jwt-bearer-access', new Strategy(options, verify));

module.exports.authenticate = (req, res, next) => passport.authenticate('jwt-bearer-access', options, (err, user) => {
  if (!user) return next(HttpError(401, err));

  return req.login(user, { session: false }, next);
})(req, res, next);

module.exports.restrict = (roles) => (req, res, next) => {
  const { permissions } = req.user;
  const rolesSet = [].concat(roles);

  if (rolesSet.some((r) => permissions.includes(r))) {
    return next();
  }
  return next(HttpError(403, 'Forbidden endpoint'));
};

// passport.serializeUser((user, done) => done(null, user));

module.exports.signJwt = (data) => JWT.sign(data, JWT_SECRET);

module.exports.verifyJwt = (token) => JWT.verify(token, JWT_SECRET);
