const mongoose = require('mongoose');

// User Schema
const ChatRoomSchema = new mongoose.Schema({
  users: {
    type: String
  },
  date: {
    type: String,
    index: true
  },
  name: {
    type: String
  }
});

const ChatRoom = module.exports = mongoose.model('ChatRoom', ChatRoomSchema);

module.exports.getChatsByUser = function (userID, callback) {
  const query = { users: { $regex: '(?=.*' + userID + ')' } };
  ChatRoom.find(query, callback);
};

module.exports.findByUsers = function (users, callback) {
  const arrUsers = users.split('-');
  arrtofinish = arrUsers.length;
  let regex = '';
  for (let i = 0; i < arrUsers.length; i++) {
    regex += '(?=.*' + arrUsers[i] + ')';
    arrtofinish--;
    if (arrtofinish == 0) {
      const query = { users: { $regex: regex } };
      MultiChat.find(query, callback);
    }
  }
};

module.exports.addUserToChatRoom = function (userID, roomID, callback) {
  ChatRoom.findById(roomID, function (err, res) {
    const users = res.users.split('-');
    if (users.indexOf(userID) > -1) {
      // In the array!
      callback(err);
    } else {
      // Not in the array
      users.push(userID);
      res.users = users.join('-');
      res.save();
    }
  });
};

module.exports.changeName = function (roomID, newName, callback) {
  ChatRoom.findById(roomID, function (err, room) {
    room.name = newName;
    room.save();
    callback(err);
  });
};

module.exports.createChatRoom = function (newChatRoom, callback) {
  newChatRoom.save(callback);
};

module.exports.getChatRoomByID = function (id, callback) {
  ChatRoom.findById(id, callback);
};
module.exports.removeChatbyHash = function (id, callback) {
  const query = { id };
  ChatRoom.findOneAndRemove(query, callback);
};

module.exports.validateChat = function (id, user, callback) {
  const query = { users: { $regex: '(?=.*' + user + ')' } };
  ChatRoom.find(query, function (err, rooms) {
    roomstogo = rooms.length;
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].id == id) {
        callback(true);
        break;
      }
      roomstogo--;
      if (roomstogo == 0) {
        callback(false);
      }
    }
  });
};

module.exports.removeUser = function (roomID, userID, cb) {
  ChatRoom.findById(roomID, function (err, res) {
    const users = res.users.split('-');
    if (users.indexOf(userID) > -1) {
      // In the array!
      const index = users.indexOf(userID);
      if (index > -1) {
        users.splice(index, 1);
      }
      res.users = users.join('-');
      res.save();
      cb();
    } else {
      // Not in the array
      cb();
    }
  });
};
