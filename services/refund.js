const Stripe = require('stripe');

const { STATUS } = require('../models/invoice');

const stripe = Stripe(process.env.STRIPE_SK_TEST);

module.exports.makeRefund = async (invoice, amount) => {
  await invoice.set({ status: STATUS.PENDING_REFUND }).save();
  return stripe.refunds.create({ payment_intent: invoice.paymentIntent, amount });
};
