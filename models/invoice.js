const mongoose = require('mongoose');
const moment = require('moment');
const HttpErrors = require('http-errors');

const { CURRENCY } = require('./constants');
const { roundNumber } = require('../utils/utils');

const { Schema } = mongoose;

const STATUS = Object.freeze({
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  PENDING_REFUND: 'PENDING_REFUND',
  REFUNDED: 'REFUNDED',
});

const getStatusFromTWHType = (type) => {
  let status;
  switch (type) {
    case 'payment_intent.succeeded':
      status = STATUS.SUCCEEDED;
      break;
    case 'payment_intent.created':
      status = STATUS.PENDING;
      break;
    default:
      status = STATUS.PENDING;
  }

  return status;
};

const InvoiceSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  currency: {
    type: String,
    enum: Object.values(CURRENCY),
    required: true,
  },
  amountCents: {
    type: Number,
    required: true,
  },
  refunded: {
    type: Boolean,
    default: false,
  },
  refundedCents: {
    type: Number,
    default: 0,
  },
  customer: String,
  status: {
    type: String,
    enum: Object.values(STATUS),
    required: true,
  },
  createdAtTimestamp: {
    type: Number,
    default: () => moment().unix(),
  },
  metadata: {
    eventId: String,
    stripeStatus: String,
    paymentMethodTypes: [String],
    type: { type: String },
    request: {
      id: String,
      idempotency_key: String,
    },
  },
  paymentIntent: {
    type: String, index: true, required: true, unique: true,
  },
  latestCharge: { type: String, index: true },
}, {
  timestamps: true,
});

InvoiceSchema.methods.refund = function refund(amount) {
  this.refundedCents = amount;
  this.status = STATUS.SUCCEEDED;
  if (this.refundedCents >= this.amountCents) {
    this.refunded = true;
    this.status = STATUS.REFUNDED;
  }
  return this.save();
};

const Invoice = mongoose.model('Invoice', InvoiceSchema);

module.exports = Invoice;
module.exports.STATUS = STATUS;

const formInvoiceData = (payment) => ({
  metadata: {
    eventId: payment.id,
    stripeStatus: payment.data.object.status,
    paymentMethodTypes: payment.data.object.payment_method_types,
    type: payment.type,
    request: payment.request,
  },
  status: getStatusFromTWHType(payment.type),
  currency: payment.data.object.currency,
  user: payment.data.object.metadata.userId,
  amountCents: payment.data.object.amount,
  paymentIntent: payment.data.object.id,
  customer: payment.data.object.customer,
  latestCharge: payment.data.object.latest_charge,
});

module.exports.createInvoice = (payment) => new Invoice(formInvoiceData(payment)).save();

module.exports.getById = (id) => Invoice.findById(id).orFail(HttpErrors(404, 'Invoice not found'));

module.exports.refundInvoice = async (payment) => {
  const { object } = payment.data;
  return Invoice.findOne({ paymentIntent: object.payment_intent })
    .then((invoice) => invoice.refund(object.amount_refunded));
};

module.exports.calculateBalanceByUserId = async (userId, inCents = true) => {
  const invoices = await Invoice.find(
    { user: userId, status: STATUS.SUCCEEDED, refunded: false },
    'amountCents refundedCents',
  );

  const balance = invoices.reduce(
    (amount, { amountCents, refundedCents }) => amount + (amountCents - refundedCents),
    0,
  );

  return inCents ? balance : roundNumber(balance / 100);
};

module.exports.getUserInvoices = async (userId, skip = 0, limit = 10) => Invoice
  .find({ user: userId })
  .sort({ createdAtTimestamp: -1 })
  .skip(skip)
  .limit(limit)
  .select('_id refunded  refundedCents status currency amountCents paymentIntent createdAt');

module.exports.getWithdrawalData = async (userId) => Invoice
  .aggregate()
  .match({ user: mongoose.Types.ObjectId(userId), status: STATUS.SUCCEEDED })
  .group({
    _id: '$user',
    amountCents: { $sum: '$amountCents' },
    refundedCents: { $sum: '$refundedCents' },
    invoices: { $push: '$_id' },
  });

module.exports.countUserInvoices = async (userId) => Invoice
  .find({ user: userId })
  .countDocuments();
