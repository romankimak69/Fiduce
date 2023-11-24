const mongoose = require('mongoose');

let CloudTokenSchema = mongoose.Schema({
	provider: {
		type: String
	},
	code: {
		type: String,
		index: true
	},
	owner: {
		type: String
	}
});

var CloudToken = module.exports = mongoose.model('CloudToken', CloudTokenSchema);

module.exports.saveToken = function (provider, user, code, callback) {
	let query = { $and: [{ provider: provider }, { owner: user.id }] };
	CloudToken.findOne(query, (err, token) => {
		if (!token) {
			token = new CloudToken({
				provider: provider,
				code: code,
				owner: user.id
			});
		}
		else {
			token.code = code;
		}
		token.save(callback);
	});
}

module.exports.getToken = function (provider, user, callback) {
	let query = { $and: [{ provider: provider }, { owner: user.id }] };
	CloudToken.findOne(query, callback);
}


