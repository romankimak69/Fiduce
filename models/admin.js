const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const HttpError = require('http-errors');
const { getRandomPwd } = require('../utils/utils');

const ROLES = Object.freeze({
  R: 'R', W: 'W', U: 'U', D: 'D',
});

const AdminSchema = new mongoose.Schema({
  email: {
    type: String,
    index: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  permissions: {
    enum: Object.values(ROLES),
    type: [String],
    default: ROLES.R,
  },
  salt: {
    type: Number,
    required: true,
    default: () => bcrypt.genSaltSync(10),
  },
});

AdminSchema.pre('save', async function preSave(next) {
  if (this.isNew) {
    this.password = bcrypt.hashSync(this.password, this.salt);
  }
  next();
});

AdminSchema.methods.comparePasswords = function (password) {
  return bcrypt.compare(password, this.password);
};

AdminSchema.methods.genPassword = async function () {
  const pwd = getRandomPwd();
  this.password = bcrypt.hashSync(pwd, this.salt);
  await this.save();
  return pwd;
};

AdminSchema.methods.toToken = function () {
  return {
    id: this._id.toString(),
    permissions: this.permissions,
    salt: this.salt,
  };
};

const Admin = mongoose.model('Admin', AdminSchema);
module.exports = Admin;

module.exports.ROLES = ROLES;
module.exports.createAdmin = (data) => {
  const password = getRandomPwd();
  const admin = new Admin({ ...data, password });
  return admin.save({ validateBeforeSave: true });
};
module.exports.getAdminByEmail = (email) => Admin.findOne({ email }).orFail(HttpError(404, 'Not found'));
