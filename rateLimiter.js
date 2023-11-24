const { RateLimiterMemory } = require("rate-limiter-flexible");
console.log('Limiter added');
const rateLimiter = new RateLimiterMemory({
  points: 3,
  duration: 1 * 60 * 60,
});

const rateLimiterMiddleware = (req, res, next) => {
console.log('++++++++++++++++++++++++++++++' + req.ip);
  if (req.url.includes(".css") || req.url.includes(".js")) {
    return next();
  }

  return rateLimiter
    .consume(req.ip)
    .then(() => {
      next();
    })
    .catch((err) => {
      res.status(429).send("Too Many Requests");
    });
};

module.exports = rateLimiterMiddleware;
