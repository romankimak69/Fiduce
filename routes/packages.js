const express = require('express');

const { resToJson } = require('../utils/utils');
const { ROLES } = require('../models/admin');
const {
  updatePackage, getPackagesList, createPackage, removePackage,
} = require('../models/packages');
const { authenticate, restrict } = require('../utils/admin-passport');

const router = express.Router();

router.get('/list', resToJson(getPackagesList));

router.get('/', (req, res) => res.render('packages'));
router.put('/', authenticate, restrict(ROLES.U), resToJson(async (req) => {
  const { id, ...data } = req.body;
  return updatePackage(id, data);
}));

router.post('/', authenticate, restrict(ROLES.W), resToJson((req) => createPackage(req.body)));
router.delete('/:packageId', authenticate, restrict(ROLES.D), resToJson((req) => removePackage(req.params.packageId)));

module.exports = router;
