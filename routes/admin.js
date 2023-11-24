const express = require('express');
const HttpError = require('http-errors');
const { Readable } = require('node:stream');
const {
  resToJson,
  roundNumber,
  promisify,
} = require('../utils/utils');
const {
  createAdmin,
  getAdminByEmail,
} = require('../models/admin');
const { getAllUsers } = require('../models/user');
const {
  getFilesByUserIDSorted,
  getFilebyID,
} = require('../models/file');
const { sendMail } = require('../utils/mailer');
const { getFile } = require('../ipfs');

const { withDrawBalance } = require('../services/withdrawals');

const {
  signJwt,
  authenticate,
} = require('../utils/admin-passport');

const router = express.Router();
router.get('/', (_, res) => res.render('admin'));
router.get('/user-list', authenticate, resToJson(async () => {
  const users = await getAllUsers('_id email username');

  const list = await Promise.all(users.map(
    (user) => user.getBalanceToWithdraw()
      .then((balance) => ({
        balance: roundNumber(balance / 100, 2),
        user,
      })),
  ));

  return list.filter(({ balance }) => !!balance);
}));

router.get(
  '/files-list/:userId',
  authenticate,
  resToJson(async (req) => promisify(getFilesByUserIDSorted)(req.params.userId, 'date')),
);
router.get('/user-file/:fileId', authenticate, async (req, res) => {
  const file = await promisify(getFilebyID)(req.params.fileId);
  const buff = await promisify(getFile)(req.params.fileId);
  const readable = new Readable();
  readable.push(buff);
  readable.push(null);

  res.attachment(`${file.filename}`);

  readable.pipe(res);
});

router.post('/users/reclaim-withdrawal', authenticate, resToJson(async (req, res) => {
  const {
    user,
    amount,
  } = req.body;

  return withDrawBalance(user, amount);
}));

router.post('/', resToJson(async (req) => {
  const { body } = req;

  if (body.token !== process.env.CREATE_ADMIN_TOKEN) {
    throw new HttpError(403, 'Invalid token ');
  }

  const admin = await createAdmin(body);

  return {
    ...admin,
    token: signJwt(admin.toToken()),
  };
}));

router.post('/login', resToJson(async (req) => {
  const { body } = req;
  const admin = await getAdminByEmail(body.email);

  if (!await admin.comparePasswords(body.password)) {
    throw HttpError(403, 'Invalid credentials');
  }

  return signJwt(admin.toToken());
}));

router.post('/password', resToJson(async (req, res) => {
  const { body } = req;

  const admin = await getAdminByEmail(body.email);
  const password = await admin.genPassword();

  await sendMail(body.email, 'Support', `Your password is ${password}`);

  res.status(202);

  return 'sended';
}));

module.exports = router;
