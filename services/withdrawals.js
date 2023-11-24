const HttpErrors = require('http-errors');
const { getWithdrawalData } = require('../models/invoice');
const { getProfit } = require('../models/packages');
const { createWithdrawal, getPermittedWithdrawals } = require('../models/withdrawals');
const { roundNumber, calculateBalanceToWithdraw } = require('../utils/utils');

const collectWithdrawalsFromInvoices = async (userId) => {
  const batchInvoice = await getWithdrawalData(userId);
  if (!batchInvoice.length) return null;
  const [{ amountCents, refundedCents, invoices }] = batchInvoice;

  return {
    invoices,
    amountCents: roundNumber(amountCents - refundedCents, 0),
  };
};

const createUserWithdrawal = async (userId) => {
  const payments = await collectWithdrawalsFromInvoices(userId);
  if (!payments) return null;
  const currentPackage = await getProfit(payments.amountCents);

  return createWithdrawal({ percent: currentPackage.percent, user: userId, ...payments });
};

const withDrawBalance = async (userId, amount) => {
  const withdraws = await getPermittedWithdrawals(userId);

  const permittedAmount = await calculateBalanceToWithdraw(withdraws);
  if (amount > permittedAmount) throw new HttpErrors(405, 'Not enough balance');

  let restAmount = amount ?? permittedAmount;
  const updatedWithdrawals = withdraws.map((el) => {
    if (restAmount <= 0) return null;
    const withdrawnCents = roundNumber(Math.min(restAmount, el.earnedCents - el.withdrawnCents));
    el.set({ withdrawnCents: el.withdrawnCents + withdrawnCents });
    restAmount -= withdrawnCents;
    return el.save();
  });

  return Promise.all(updatedWithdrawals);
};

module.exports = { createUserWithdrawal, withDrawBalance };
