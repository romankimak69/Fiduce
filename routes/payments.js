const express = require('express');

const router = express.Router();
const Stripe = require('stripe');
const { ensureAuthenticated } = require('../utils/auth');
const { resToJson, roundNumber } = require('../utils/utils');
const { withDrawBalance } = require('../services/withdrawals');

const stripe = Stripe(process.env.STRIPE_SK_TEST);
const {
  createInvoice,
  refundInvoice,
  calculateBalanceByUserId,
} = require('../models/invoice');

router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  return res.render('payments', { balance, loggedin: true });
});

router.post('/create-payment-intent', ensureAuthenticated, async (req, res) => {
  const { user, body } = req;
  if (!user.stripeCustomer) {
    const { id: stripeCustomer } = await stripe.customers.create({
      email: user.email,
      metadata: { externalId: user._id.toString() },
    });

    await user.set({ stripeCustomer }).save();
  }

  return stripe.paymentIntents.create({
    amount: (roundNumber(+body.amount, 2)) * 100,
    customer: user.stripeCustomer,
    currency: 'eur',
    payment_method_options: { card: { setup_future_usage: 'off_session' } },
    payment_method_types: ['card'],
    metadata: { userId: user._id.toString() },
  })
    .then(({ client_secret }) => res.json({ clientSecret: client_secret }))
    .catch((err) => {
      res.status(400);
      return res.json({ error: err.raw?.message ?? err.rawType ?? 'Invalid request' });
    });
});

router.post('/reclaim-withdrawals', ensureAuthenticated, resToJson(
  (req) => withDrawBalance(req.user._id, req.body.amount),
));

router.post('/webhook', (req, response) => {
  const { rawBody, headers } = req;
  const sig = headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(err);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      createInvoice(event);
      break;
    case 'payment_method.attached':
      break;
    case 'charge.refunded':
      refundInvoice(event);
      break;
    default:
      console.log(`Unhandled event type ${event.type}.`);
  }

  response.status(200);

  return response.json('Ok');
});

module.exports = router;
