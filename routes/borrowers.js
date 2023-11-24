const express = require('express');

const router = express.Router();
const { calculateBalanceByUserId } = require('../models/invoice');

// Get Homepage
router.get('/', async (req, res) => {
  if (req.isAuthenticated()) {
    const balance = await calculateBalanceByUserId(req.user._id, false);
    res.render('borrowers', { loggedin: true, balance });
  } else {
    res.render('borrowers');
  }
});

module.exports = router;
