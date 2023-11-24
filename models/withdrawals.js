const mongoose = require('mongoose');
const moment = require('moment');
const { roundNumber } = require('../utils/utils');

const { Schema } = mongoose;

const STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  WITHDRAWN: 'WITHDRAWN',
});

const WithdrawalsSchema = new Schema({
  status: {
    type: String,
    required: true,
    enum: Object.keys(STATUS),
    default: STATUS.ACTIVE,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  invoices: [{ type: Schema.Types.ObjectId, ref: 'Invoice' }],
  amountCents: {
    type: Number,
    required: true,
  },
  percent: {
    type: Number,
    required: true,
  },
  earnedCents: {
    type: Number,
    required: true,
    default: (doc) => {
      const earned = doc.amountCents * (doc.percent / 100);
      return roundNumber(earned / process.env.WITHDRAWAL_DAY_RANGE ?? 1, 0);
    },
  },
  uniqueIndex: {
    type: String,
    unique: true,
    required: true,
    default: (doc) => `${doc.user}@${moment().format('DD-MM-YYYY')}`,
  },
  withdrawnCents: {
    type: Number,
    required: true,
    default: 0,
  },
}, { timestamps: true });

WithdrawalsSchema.pre('save', function (next) {
  if (this.withdrawnCents >= this.earnedCents) {
    this.status = STATUS.WITHDRAWN;
  }

  return next();
});

const Withdrawal = mongoose.model('Withdrawal', WithdrawalsSchema);

module.exports = Withdrawal;

module.exports.createWithdrawal = (data) => {
  const withdrawal = new Withdrawal(data);

  return withdrawal.save();
};

module.exports.getPermittedWithdrawals = (userId, date) => {
  const queryDate = moment(date ?? moment().subtract(1, 'day')).endOf('day').toDate();

  return Withdrawal
    .find({ user: userId, status: STATUS.ACTIVE, createdAt: { $lt: queryDate } })
    .sort({ createdAt: 1 });
};
