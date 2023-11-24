const express = require('express');

const router = express.Router();
const File = require('../models/file');
const ipfs = require('../ipfs');
const { ensureAuthenticated } = require('../utils/auth');
const { calculateBalanceByUserId } = require('../models/invoice');
// Get Homepage
router.get('/', async (req, res) => {
  if (req.isAuthenticated()) {
    const balance = await calculateBalanceByUserId(req.user._id, false);
    res.redirect(200, '/dashboard', { balance });
    // res.render('index', {loggedin: true});
  } else {
    res.redirect('/users/login');
    // res.render('index');
  }
});
// Get dashboard
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  getFilesSorted(req, (files) => {
    files.length = 2;
	    res.render('dashboard', { loggedin: true, files, balance });
  });
});

function getFilesSorted(req, cb) {
  File.getFilesByUserIDSorted(req.user.id, 'daterev', (err, res) => {
    if (err) throw err;
    if (!res) {
      return null;
    }
    cb(res.map(ipfs.setFileIcon));
    // ipfs.getFiles(res).then(function(result){
    //     cb(result.map (ipfs.setFileIcon));
    // });
  });
}

module.exports = router;
