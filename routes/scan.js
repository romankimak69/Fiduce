const express = require('express');

const router = express.Router();
const { ensureAuthenticated } = require('../utils/auth');
const { calculateBalanceByUserId } = require('../models/invoice');
// Get Homepage
router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  res.render('scan', { loggedin: true, balance });
});

module.exports = router;
