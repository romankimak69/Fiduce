const mongoose = require('mongoose');
const HttpErrors = require('http-errors');
const { CURRENCY } = require('./constants');
const { roundNumber } = require('../utils/utils');

const { Schema } = mongoose;

const data = require('./packages.json');

const PackagesScheme = new Schema({
  amountCents: {
    type: Number,
    required: true,
    set(amount) {
      return roundNumber(amount, 0);
    },
  },
  percent: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: CURRENCY.eur,
    required: true,
    enum: Object.values(CURRENCY),
  },
});

const Packages = mongoose.model('Packages', PackagesScheme);

module.exports = Packages;

module.exports.fulfillPackages = async () => {
  const count = await Packages.find().countDocuments();
  if (!count) {
    await Packages.create(data);
  }
};

module.exports.getProfit = async (balance, currency = CURRENCY.eur) => {
  const packages = await Packages.find({ currency }).sort({ amountCents: 1 });
  return packages.reduce(
    (accum, pack) => (balance >= pack.amountCents ? pack : accum),
    packages[0],
  );
};

module.exports.updatePackage = async (id, updateData) => {
  const pkg = await Packages.findById(id).orFail(HttpErrors(404, 'Package not found'));
  return pkg.set(updateData).save();
};
module.exports.getPackagesList = () => Packages.find().sort({ percent: 1 });
module.exports.createPackage = (pkgData) => {
  const { amountCents = 0, percent = 0, currency = 'eur' } = pkgData;
  const pkg = new Packages({ currency, amountCents, percent });
  return pkg.save();
};

module.exports.removePackage = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpErrors(400, 'Invalid  params');
  }

  return Packages.deleteOne({ _id: id });
};
