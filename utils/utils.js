module.exports.roundNumber = (number, digit = 2) => {
  const multiplier = 10 ** digit;
  return Math.round(number * multiplier) / multiplier;
};

module.exports.resToJson = (fn) => async (req, res, next) => {
  try {
    const result = await fn(req, res, next);
    return res.json(result);
  } catch (err) {
    if (err.statusCode) {
      res.status(err.statusCode);
      return res.json(err);
    }
    return next(err);
  }
};

module.exports.getRandomPwd = () => Math.random().toString(36).slice(-15);

module.exports.calculateBalanceToWithdraw = async (withdraws) => withdraws.reduce(
  (accum, { withdrawnCents, earnedCents }) => accum + earnedCents - withdrawnCents,
  0,
);

module.exports.promisify = (fn) => (...args) => new Promise((resolve, reject) => {
  fn(...args, (err, resp) => (err ? reject(err) : resolve(resp)));
});
