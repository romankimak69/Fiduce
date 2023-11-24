const mongoose = require('mongoose');

const FileSchema = mongoose.Schema({
  hash: {
    type: String,
    index: true,
  },
  filename: {
    type: String,
  },
  size: {
    type: String,
  },
  mimetype: {
    type: String,
  },
  owner: {
    type: String,
  },
  users: {
    type: String,
  },
  name: {
    type: String,
    text: true,
  },
  date: {
    type: String,
  },
  key: {
    type: String,
  },
  extension: {
    type: String,
  },
  dir: {
    type: String,
  },
  signed: {
    type: Boolean,
  },
  deleted: {
    type: Boolean,
  },
});

const File = module.exports = mongoose.model('File', FileSchema);

module.exports.createFile = function (newFile, callback) {
  newFile.save(callback);
};
module.exports.addAUser = function (id, user) {
  const query = { _id: id };
  File.findOne(query, (err, file) => {
    if (err) throw err;
    if (file) {
      if (file.users === undefined) {
        file.users = '';
      }
      if (file.users.includes(user) === false) {
        file.users = `${file.users} ${user}`;
      }
      file.save();
    }
  });
};

module.exports.getFilesByUserID = function (id, callback) {
  const query = { $and: [{ owner: id }, { deleted: { $ne: true } }] };
  File.find(query, null, { sort: { date: -1 } }, callback);
};

module.exports.getFilesByUserIDSorted = function (id, sortby, callback) {
  const query = { $and: [{ owner: id }, { deleted: { $ne: true } }] };
  if (sortby === 'date') {
    File.find(query).sort({ date: 1 }).exec(callback);
  } else if (sortby === 'daterev') {
    File.find(query).sort({ date: -1 }).exec(callback);
  } else if (sortby === 'type') {
    File.find(query).sort({ mimetype: 1 }).exec(callback);
  } else if (sortby === 'typerev') {
    File.find(query).sort({ mimetype: -1 }).exec(callback);
  } else if (sortby === 'size') {
    File.find(query).sort({ size: 1 }).exec(callback);
  } else if (sortby === 'sizerev') {
    File.find(query).sort({ size: -1 }).exec(callback);
  }
};

module.exports.getFilesByDir = function (id, dir, callback) {
  const query = { $and: [{ owner: id }, { dir }, { deleted: { $ne: true } }] };
  File.find(query, callback);
};

module.exports.getFileByHash = function (hash, callback) {
  const query = { hash };
  File.findOne(query, callback);
};
module.exports.getFilebyID = function (id, callback) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    const query = { $and: [{ _id: id }, { deleted: { $ne: true } }] };
    File.findOne(query, callback);
  } else {
    callback(null, null);
  }
};
module.exports.getFilesbyID = function (ids, callback) {
  if (ids && ids.length > 0) {
    const query = { $and: [{ $or: [{ _id: { $in: ids } }, { dir: { $in: ids } }] }, { deleted: { $ne: true } }] };
    File.find(query, callback);
  } else {
    callback(null, null);
  }
};
module.exports.removeFilebyHash = function (fileid, ownerid, callback) {
  File.findById(fileid, (err, file) => {
    if (file.owner === ownerid) {
      file.deleted = true;
      file.save();
    }
    callback(null, null);
  });
};

module.exports.changeFilename = function (id, filenameNew) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    const query = { _id: id };
    File.findOne(query, (err, file) => {
      file.name = filenameNew;
      file.save();
    });
  } else {
    callback(null, null);
  }
};

module.exports.searchFiles = function (owner, searchTerm, cb) {
  File.find(
    {
      $and: [{ owner },
        { $text: { $search: searchTerm } }],
    },
    { score: { $meta: 'textScore' } },
  ).sort({ score: { $meta: 'textScore' } }).exec((err, files) => {
    if (err) throw err;
    if (cb) cb(files);
  });
};

module.exports.getDeletedFiles = function (ownerid, callback) {
  const query = { $and: [{ owner: ownerid }, { deleted: true }] };
  File.find(query, callback);
};

module.exports.restoreFile = function (fileid, ownerid) {
  const query = { $and: [{ _id: fileid }, { owner: ownerid }, { deleted: true }] };
  File.findOne(query, (err, file) => {
    file.deleted = false;
    file.save();
  });
};
