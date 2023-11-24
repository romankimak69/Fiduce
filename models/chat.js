const mongoose = require('mongoose');

// User Schema
const ChatSchema = new mongoose.Schema({
  user_from: {
    type: String
  },
  user_to: {
    type: String
  },
  date: {
    type: String,
    index: true
  },
  seen: {
    type: Boolean
  },
  encrypted: {
    type: String
  }
});

const Chat = module.exports = mongoose.model('Chat', ChatSchema);

module.exports.createChat = function (newChat, callback) {
  newChat.save(callback);
};

module.exports.getChatbyID = function (id, callback) {
  const query = { id };
  Chat.findOne(query, callback);
};
module.exports.removeChatbyHash = function (hash, callback) {
  const query = { hash };
  Chat.findOneAndRemove(query, callback);
};
module.exports.getAllChatsFromUsername = function (username, callback) {
  const query = { $or: [{ user_from: username }, { user_to: username }] };
  Chat.find(query).sort({ date: 1 }).exec(callback);
};

module.exports.seen = function (username_from, username_me) {
  const query = { $and: [{ user_from: username_from }, { user_to: username_me }] };
  Chat.find(query).sort({ date: -1 }).exec(function (err, seen) {
    if (err) throw err;
    if (seen[seen.length - 1] != undefined) {
      seen[seen.length - 1].seen = true;
      seen[seen.length - 1].save();
    }
  });
};

module.exports.getAllChatsFromTwoProfiles = function (username1, username2, callback) {
  const query = { $or: [{ $and: [{ user_from: username1 }, { user_to: username2 }] }, { $and: [{ user_from: username2 }, { user_to: username1 }] }] };
  Chat.find(query).sort({ date: 1 }).exec(callback);
};
