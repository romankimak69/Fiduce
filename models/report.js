const mongoose = require('mongoose');

// User Schema
const ReportSchema = new mongoose.Schema({
  owner: {
    type: String
  },
  date: {
    type: String,
    index: true
  },
  report: {
    type: String
  },
  loanid: {
    type: String
  }
});

const Report = module.exports = mongoose.model('Report', ReportSchema);

module.exports.createReport = function (newReport, callback) {
  newReport.save(callback);
};

module.exports.getReportbyID = function (id, callback) {
  const query = { id };
  Report.findOne(query, callback);
};
module.exports.removeReportbyHash = function (hash, callback) {
  const query = { hash };
  Report.findOneAndRemove(query, callback);
};
module.exports.getAllReportsFromLoan = function (loan, callback) {
  const query = { loanid: loan };
  Report.find(query).sort({ date: 1 }).exec(callback); ;
};
