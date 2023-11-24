var mongoose = require('mongoose');
const { reject } = require('async');

var DirSchema = mongoose.Schema({
	name: {
		type: String,
		index: true,
		text: true
	},
	owner: {
		type: String
	},
	shared: {
		type: String
	},
	date: {
		type: String
	},
	parent: {
		type: String
	},
	deletable: {
		type: Boolean
	}
});

var Dir = module.exports = mongoose.model('Dir', DirSchema);

module.exports.createDir = async function (newDir, callback) {
	try {
		let res = await newDir.save();
		callback(res);
	}
	catch (err) {
		console.log(err);
	}
}

module.exports.getDirbyID = function (owner, id, callback) {
	if (mongoose.Types.ObjectId.isValid(id)) {
		let query = { $and: [{ _id: id }, { owner: owner }] };
		Dir.findOne(query, callback);
	} else {
		callback(null, null);
	}
}

module.exports.getAllParentDirectories = function (owner, id, callback) {
	if (mongoose.Types.ObjectId.isValid(id)) {
		Dir.find({ owner: owner }, function (err, data) {
			if (err) callback(err, []);

			let res = [];
			let node = data.find((x) => x._id == id);
			if (node != null) {
				res.push(node);
				while (node.parent) {
					node = data.find((x) => x._id == node.parent);
					if (node) res.push(node);
				}
			}
			callback(err, res);
		});

		// let query = {
		// 	from: "Dir",
		// 	startWith: "$parent",
		// 	connectFromField: "parent",
		// 	connectToField: "_id",
		// 	as: "parentDirectories"
		// };
		// Dir.aggregate([{ $match: { $and: [{ _id: id }, { owner: owner }] } }]).graphLookup(query).exec(callback);
	} else {
		callback(null, []);
	}
}

module.exports.removeDirbyID = function (id, callback) {
	if (mongoose.Types.ObjectId.isValid(id)) {
		var query = { _id: id };
		Dir.findOneAndRemove(query, callback);
	} else {
		callback(null, null);
	}
}

module.exports.changeName = function (id, nameNew) {
	if (mongoose.Types.ObjectId.isValid(id)) {
		var query = { _id: id };
		Dir.findOne(query, function (err, file) {
			file.name = nameNew;
			file.save();
		});
	}
}

module.exports.changeParentDir = function (id, parent, callback) {
	if (mongoose.Types.ObjectId.isValid(id)) {
		var query = { _id: id };
		Dir.findOne(query, function (err, dir) {
			if (err)
				return callback(err);
			if(dir == null)
				return callback("Répertoire introuvable");

			if (parent == "undefined") parent = "";
			dir.parent = parent;
			dir.save(callback);
		});
	}
}

module.exports.getDirsbyParent = function (owner, id, callback) {
	var query = { $and: [{ parent: id }, { owner: owner }] };
	Dir.find(query, callback);
}

module.exports.searchDirs = function (owner, searchTerm, cb) {
	Dir.find({
		$and: [{ owner: owner },
		{ $text: { $search: searchTerm } }]
	},
		{ score: { $meta: "textScore" } }
	).sort({ score: { $meta: "textScore" } }).exec(function (err, files) {
		if (err) throw err;
		if (cb) cb(files);
	});
}