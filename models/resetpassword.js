var mongoose = require('mongoose');

var ResetPasswordSchema = mongoose.Schema({
    urlval: {
		type: String,
		index:true
	},
	date: {
		type: String
	},
	dateexpiring: {
		type: String
	},
	owner: {
		type: String
	}
});

var ResetPassword = module.exports = mongoose.model('ResetPassword', ResetPasswordSchema);

module.exports.getResetPassword = function(urlval, callback){
	var query = {urlval: urlval};
	ResetPassword.findOne(query, callback);
}

module.exports.new = function(reset, callback){
    reset.save(callback);
}

