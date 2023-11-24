const express = require('express');

const router = express.Router();
const multer = require('multer');
const path = require('path');
const ipfs = require('../ipfs');

const TrackedEvent = require('../models/trackedevent');
const { ensureAuthenticated } = require('../utils/auth');
const { calculateBalanceByUserId } = require('../models/invoice');

const publicPath = `${process.env.FS_PREFIX ?? '.'}/public/uploads/`;
router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  res.render('upload', {
    balance,
    loggedin: true,
    dir: req.query.dir,
    compressPdf: req.query.compressPdf,
  });
});

router.post('/', ensureAuthenticated, (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(422).json({
        error: err,
      });
    }
    if (req.file == undefined) {
      return res.status(422).json({
        error: 'Aucun fichier sélectionné.',
      });
    }
    const { fileinputname } = req.body;
    if (!fileinputname) {
      return res.status(422).json({
        error: 'Le nom de fichier est requis',
      });
    }

    ipfs.addFile(req.user, req.file, {
      fileinputname: req.body.fileinputname,
      dir: req.body.dir,
      signed: req.body.signed,
      scan: req.body.scan,
      compressPdf: req.body.compressPdf,
    }, (ipfsId) => {
      req.flash('success_msg', 'Fichiers téléchargés');
      TrackedEvent.createTrackedEvent('Upload', ipfsId, req.user.id, (err, event) => res.status(200).send('OK'));
    });
  });
});

const storage = multer.diskStorage({
  destination: publicPath,
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Init Upload
const upload = multer({
  storage,
  limits: { fileSize: 104857600 },
}).single('file');

module.exports = router;
