const express = require('express');

const router = express.Router();
const { ensureAuthenticated } = require('../utils/auth');
const { calculateBalanceByUserId } = require('../models/invoice');
const { getProfit } = require('../models/packages');
const { getPermittedWithdrawals } = require('../models/withdrawals');
const { calculateBalanceToWithdraw } = require('../utils/utils');
const { roundNumber } = require('../utils/utils');

// Get Homepage
router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  const withdrawals = await getPermittedWithdrawals(req.user._id);
  const profit = await calculateBalanceToWithdraw(withdrawals);
  const { percent } = await getProfit(balance * 100);

  res.render('tokens', {
    loggedin: true,
    percent,
    currency: 'EUR',
    balance: roundNumber(balance),
    profit: roundNumber(profit / 100),
  });
});

router.get('/buy', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  res.render('buytokens', { loggedin: true, balance });
});

module.exports = router;
