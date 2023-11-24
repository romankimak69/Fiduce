const { createUserWithdrawal } = require('../services/withdrawals');
const { getAllUsers } = require('../models/user');

module.exports = async () => {
  const users = await getAllUsers();
  const result = await Promise.allSettled(users.map(({ _id }) => createUserWithdrawal(_id)));
  console.debug(result);
};
