var mongoose = require('mongoose');

var LoanSchema = mongoose.Schema({
	name: {
		type: String,
		index: true,
		text: true
	},
	owner: {
		type: String
	},
    broker: {
        type: String
    },
	date: {
        type: String
	},
	address: {
		type: String
	},
    history: {
        type: String
	},
	currentstatus: {
		type: String
	},
	description: {
		type: String
	}
});

var Loan = module.exports = mongoose.model('Loan', LoanSchema);

module.exports.createLoan = function(newloan, callback){
	newloan.save(callback);
}

module.exports.getLoans = function(owner, cb){
	var query = {owner: owner};
	Loan.find(query,  cb);
}

module.exports.getLoanbyID = function(owner, id, callback){
	if(mongoose.Types.ObjectId.isValid(id)){
		var query = {$and: [{_id: id},{owner: owner}]};
		Loan.findOne(query, callback);
	}else{
		callback(null, null);
	}
}

module.exports.removeLoanbyID = function(id, callback){
	if(mongoose.Types.ObjectId.isValid(id)){
	var query = {_id: id};
	Loan.findOneAndRemove(query, callback);
	}else{
		callback(null, null);
	}
}

module.exports.changeName = function(id, nameNew){
	if(mongoose.Types.ObjectId.isValid(id)){
		var query = {_id: id};
		Loan.findOne(query, function(err, file){
			file.name = nameNew;
			file.save();
		});
	}
}

module.exports.searchLoans = function(owner, searchTerm, cb){
	Loan.find({$and: [{owner: owner},
		{ $text: { $search: searchTerm} }]},
		{ score: { $meta: "textScore" } }
	 ).sort( { score: { $meta: "textScore" } } ).exec(function(err,files){
		if (err) throw err;
		if(cb) cb(files);
	});
}