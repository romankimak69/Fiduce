const { CronJob } = require('cron');
const withdrawals = require('./withdrawals');

const withdrawalsJob = new CronJob('* * 23 * * *', withdrawals, null, true);

module.exports = [withdrawalsJob];
