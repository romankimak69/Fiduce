const express = require('express');

const router = express.Router();
const { ensureAuthenticated } = require('../utils/auth');
const Loan = require('../models/loan');
const User = require('../models/user');
const Report = require('../models/report');
const { calculateBalanceByUserId } = require('../models/invoice');
// Get Homepage
router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  Loan.getLoans(req.user.id, (err, loans) => {
    processLoans(loans, (newloans) => {
      res.render('followup', { balance, loggedin: true, loans: newloans });
    });
  });
});
router.get('/loan/:ID', ensureAuthenticated, (req, res) => {
  getLoan(req, (loan) => {
    if (req.user.id == loan.owner || req.user.id == loan.broker) {
      Report.getAllReportsFromLoan(loan.id, (err, prereports) => {
        processReports(prereports, (reports) => {
          res.render('loan', {
            balance, loggedin: true, loan, reports,
          });
        });
      });
    } else {
      res.render('loan');
    }
  });
});

router.post('/loan/:ID', ensureAuthenticated, (req, res) => {
  const newreport = new Report({
    report: req.body.report,
    owner: req.user.id,
    date: new Date().getTime(),
    loanid: req.params.ID,
  });

  Report.createReport(newreport, (err, report) => {
    if (err) console.error(err);
    res.redirect(`/followup/loan/${req.params.ID}`);
  });
});

function getLoan(req, cb) {
  Loan.getLoanbyID(req.user.id, req.params.ID, (err, loan) => {
    if (err) console.error(err);
    User.getUserById(loan.broker, (err, broker) => {
      if (err) console.error(err);
      loan.broker = broker.name;
      cb(loan);
    });
  });
}

function processLoans(loans, cb) {
  const newLoans = [];
  let remL = loans.length;
  loans.forEach((element) => {
    User.getUserById(element.owner, (err, owner) => {
      User.getUserById(element.broker, (err, broker) => {
        remL--;
        newLoans.push({
          owner: owner.name,
          broker: broker.name,
          date: new Date(element.date * 1).toLocaleDateString('en-US'),
          currentstatus: element.currentstatus,
          address: element.address,
          description: element.description,
          name: element.name,
          id: element.id,
        });
        if (remL == 0) {
          cb(newLoans);
        }
      });
    });
  });
}

function processReports(reports, cb) {
  const newReports = [];
  let remL = reports.length;
  reports.forEach((element) => {
    User.getUserById(element.owner, (err, owner) => {
      remL--;
      newReports.push({
        owner: owner.name,
        date: new Date(element.date * 1).toLocaleDateString('en-US'),
        unix: element.date,
        report: element.report,
      });
      if (remL == 0) {
        sort(newReports, (Nreports) => {
          cb(Nreports);
        });
      }
    });
  });
}
function sort(report, cb) {
  report.sort((a, b) => {
    console.log(b.unix - a.unix);
    return b.unix - a.unix;
  });
  cb(report);
}

module.exports = router;
