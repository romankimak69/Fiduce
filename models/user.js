const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getRandomPwd, calculateBalanceToWithdraw } = require('../utils/utils');
const { getPermittedWithdrawals } = require('./withdrawals');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    index: true,
  },
  password: {
    type: String,
    default: getRandomPwd,
    required: true,
  },
  email: String,
  name: String,
  tokens: String,
  birthdate: String,
  image: String,
  rating: String,
  shortstatus: String,
  description: String,
  accounttype: String,
  mailVerified: { type: String, default: false },
  stripeCustomer: String,
});

UserSchema.pre('save', async function preSave(next) {
  if (this.isNew) {
    const salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt);
  }
  next();
});

UserSchema.methods.genPassword = async function () {
  const pwd = getRandomPwd();
  this.password = bcrypt.hashSync(pwd, bcrypt.genSaltSync(10));
  await this.save();

  return pwd;
};

UserSchema.methods.getBalanceToWithdraw = async function () {
  return getPermittedWithdrawals(this.id)
    .then(calculateBalanceToWithdraw);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;

module.exports.createUser = function (newUser, callback) {
  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(newUser.password, salt, (err, hash) => {
      newUser.password = hash;
      newUser.save(callback);
    });
  });
};

module.exports.changePassword = function (id, newPassword) {
  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(newPassword, salt, (err, hash) => {
      User.findById(id, (err, user) => {
        if (err) console.log(err);
        user.password = hash;
        user.save();
      });
    });
  });
};

module.exports.getUserByUsername = function (username, callback) {
  const query = { username };
  User.findOne(query, callback);
};
module.exports.getUserByEmail = function (email, callback) {
  const query = { email };
  User.findOne(query, callback);
};
module.exports.getUserById = function (id, callback) {
  // User.findById(id, callback);
  if (mongoose.Types.ObjectId.isValid(id)) {
    const query = { _id: id };
    User.findOne(query, callback);
  } else {
    callback(null, null);
  }
};

module.exports.comparePassword = function (candidatePassword, hash, callback) {
  bcrypt.compare(candidatePassword, hash, (err, isMatch) => {
    if (err) throw err;
    callback(null, isMatch);
  });
};

module.exports.getAllUsers = (selector = '_id') => User.find({}).select(selector);
