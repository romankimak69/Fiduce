const express = require('express');
const HttpErrors = require('http-errors');

const router = express.Router();

const { ensureAuthenticated } = require('../utils/auth');
const { resToJson } = require('../utils/utils');

const { makeRefund } = require('../services/refund');

const {
  calculateBalanceByUserId,
  getUserInvoices,
  countUserInvoices,
  getById,
} = require('../models/invoice');

router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  return res.render('invoices', { balance, loggedin: true });
});

router.get('/list', ensureAuthenticated, resToJson(async (req) => {
  const { skip, limit } = req.query;

  const invoices = await getUserInvoices(req.user._id, +skip, +limit);
  const count = await countUserInvoices(req.user._id);
  return { invoices, count };
}));

router.put('/refund/:invoiceId', ensureAuthenticated, resToJson(async (req) => {
  const { invoiceId } = req.params;
  const { amount } = req.body;

  const invoice = await getById(invoiceId);

  if (!invoice.user.equals(req.user._id)) {
    throw new HttpErrors(403, 'Forbidden invoice');
  }
  const maxAvailable = invoice.amountCents - invoice.refundedCents;

  const amountToRefund = amount === '' ? maxAvailable : Math.max(0, Math.min(maxAvailable, +amount * 100));

  try {
    const refund = await makeRefund(invoice, amountToRefund);
    return refund;
  } catch (err) {
    throw new HttpErrors(400, err.message);
  }
}));

module.exports = router;
