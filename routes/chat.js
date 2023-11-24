const express = require('express');

const router = express.Router();
const nodemailer = require('nodemailer');
const Chat = require('../models/chat');
const User = require('../models/user');
const File = require('../models/file');
const ipfs = require('../ipfs');
const ChatRoom = require('../models/chatroom');
const MultiChat = require('../models/multichat');
const { ensureAuthenticated } = require('../utils/auth');
const { calculateBalanceByUserId } = require('../models/invoice');

let io;

const TrackedEvent = require('../models/trackedevent');

// Get Homepage
router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  if (req.query.email) {
    User.getUserByEmail(req.query.email, (err, user) => {
      if (err) throw err;
      if (user) {
        // ADD USER
        res.redirect(`/chat/user/${user.id}`, { balance });
      } else {
        // req.flash("error_msg", "There is no user with that email.");
        req.flash('error_msg', "Il n'y a aucun utilisateur avec cet e-mail.");
        res.redirect('/chat');
      }
    });
  } else if (req.query.username) {
    User.getUserByUsername(req.query.username, (err, user) => {
      if (err) throw err;
      if (user) {
        // ADD USER
        res.redirect(`/chat/user/${user.id}`, { balance });
      } else {
        // req.flash("error_msg", "There is no user with that username.");
        req.flash('error_msg', "Il n'y a aucun utilisateur avec ce nom d'utilisateur.");
        res.redirect('/chat', { balance });
      }
    });
  } else {
    getChatRooms(req, (rooms, chats) => {
      res.render('chats', { loggedin: true, chats, multi: rooms });
    });

    // getChats(req, function(chats){
    //    chats = chats.sort(function(a, b){return b - a});
    //    res.render('chats', {loggedin: true, chats: chats});
    // });
  }
});

router.post('/multi/', ensureAuthenticated, (req, res) => {
  if (req.body.email) {
    User.getUserByEmail(req.body.email, (err, user) => {
      if (err) throw err;
      if (user) {
        // ADD USER
        const room = new ChatRoom({
          users: `${req.user.id}-${user.id}`,
          date: new Date().getTime(),
          name: '',
        });
        ChatRoom.createChatRoom(room, (err, newRoom) => {
          res.redirect(`/chat/multi/${newRoom.id}`);
        });
      } else {
        // req.flash("error_msg", "There is no user with that email.");
        req.flash('error_msg', "Il n'y a aucun utilisateur avec cet e-mail.");
        res.redirect('/chat/');
      }
    });
  } else if (req.body.username) {
    User.getUserByUsername(req.body.username, (err, user) => {
      if (err) throw err;
      if (user) {
        // ADD USER
        const room = new ChatRoom({
          users: `${req.user.id}-${user.id}`,
          date: new Date().getTime(),
          name: '',
        });
        ChatRoom.createChatRoom(room, (err, newRoom) => {
          res.redirect(`/chat/multi/${newRoom.id}`);
        });
      } else {
        // req.flash("error_msg", "There is no user with that username.")
        req.flash('error_msg', "Il n'y a aucun utilisateur avec ce nom d'utilisateur.");
        res.redirect('/chat/');
      }
    });
  } else {
    res.redirect('/chat/');
  }
});

router.get('/multi/:roomID', ensureAuthenticated, (req, res) => {
  ChatRoom.getChatRoomByID(req.params.roomID, (err, room) => {
    if (err) throw err;
    const oldroomUsers = room.users.split('-');
    const roomUsers = new Array();
    if (room == undefined) {
      res.redirect('/chat/');
    }
    totalUsers = oldroomUsers.length;
    for (let i = 0; i < oldroomUsers.length; i++) {
      User.getUserById(oldroomUsers[i], (err, roomUser) => {
        if (err) console.error(err);
        roomUsers.push(roomUser);
        totalUsers--;
        if (totalUsers == 0) {
          getMultiChats(req.params.roomID, req.user.id, (chats) => {
            getFilesSorted(req, (files) => {
              chatToFile(chats, (newChats) => {
                if (req.query.remove) {
                  MultiChat.findOneAndRemove({ _id: req.query.remove }, (err, removed) => {
                    res.redirect(`/chat/multi/${req.params.roomID}`);
                  });
                } if (req.query.removeuser) {
                  ChatRoom.removeUser(req.params.roomID, req.query.removeuser, () => {
                    res.redirect(`/chat/multi/${req.params.roomID}`);
                  });
                } else {
                  res.render('multichat', {
                    loggedin: true, files, chats: newChats, room, roomUsers,
                  });
                }
              });
            });
          });
        }
      });
    }
  });
});

router.post('/multi/:roomID', ensureAuthenticated, (req, res) => {
  if (req.body.email) {
    User.getUserByEmail(req.body.email, (err, user) => {
      if (err) throw err;
      if (user) {
        // ADD USER
        ChatRoom.addUserToChatRoom(user.id, req.params.roomID, (err) => {
          if (err) console.error(err);
        });
      } else {
        // req.flash("error_msg", "There is no user with that email.");
        req.flash('error_msg', "Il n'y a aucun utilisateur avec cet e-mail.");
      }
      res.redirect(`/chat/multi/${req.params.roomID}`);
    });
  } else if (req.body.username) {
    User.getUserByUsername(req.body.username, (err, user) => {
      if (err) throw err;
      if (user) {
        // ADD USER
        ChatRoom.addUserToChatRoom(user.id, req.params.roomID, (err) => {
          if (err) console.error(err);
        });
      } else {
        // req.flash("error_msg", "There is no user with that username.");
        req.flash('error_msg', "Il n'y a aucun utilisateur avec ce nom d'utilisateur.");
      }
      res.redirect(`/chat/multi/${req.params.roomID}`);
    });
  } else if (req.body.roomName) {
    ChatRoom.changeName(req.params.roomID, req.body.roomName, (err) => {
      if (err) console.error(err);
      res.redirect(`/chat/multi/${req.params.roomID}`);
    });
  } else {
    ChatRoom.validateChat(req.params.roomID, req.user.id, (isValid) => {
      if (isValid) {
        const msg = Object.keys(req.body)[0];
        sendMultiChat(req.user.id, req.params.roomID, msg, (sent) => {
          io.emit('chat', {});
        });
      }
    });
  }
});

router.get('/user/:username', ensureAuthenticated, (req, res) => {
  getSpecificChat(req.user.id, req.params.username, (first, chats) => {
    getFilesSorted(req, (files) => {
      User.getUserById(req.params.username, (err, user) => {
        if (err) {
          res.render('404', { loggedin: true });
        } else if (user) {
          if (req.query.remove) {
            Chat.findOneAndRemove({ _id: req.query.remove }, () => {
              res.redirect(`/chat/user/${req.params.username}`);
            });
          } else if (first) {
            res.render('chat', { loggedin: true, User: user });
          } else {
            Chat.seen(req.params.username, req.user.id);
            chatToFile(chats, (newChats) => {
              res.render('chat', {
                loggedin: true, User: user, files, chats: newChats,
              });
            });
          }
        } else {
          res.render('404', { loggedin: true });
        }
      });
    });
  });
});

router.post('/user/:username', ensureAuthenticated, (req, res) => {
  checkChat(req, (response) => {
    if (response) {
      const msg = Object.keys(req.body)[0];
      sendChat(req.user.id, req.params.username, msg, (sent) => {
        getSpecificChat(req.user.id, req.params.username, (chats) => {
          res.sendStatus(200);
          io.emit('chat', { msg, user: sent.user_from, me: req.user.id });
        });
      });
    }
  });
});

function checkChat(text, callback) {
  callback(true);
}

function getSpecificChat(me, other, callback) {
  Chat.getAllChatsFromTwoProfiles(me, other, (err, chats) => {
    if (err) throw err;
    const chatsFixed = new Array();
    chats.forEach((chat) => {
      let mine = false;
      if (chat.user_from == me) {
        mine = true;
      }
      chat.mine = mine;
      chatsFixed.push(chat);
    });
    if (chats.length == 0) {
      callback(true, chats);
    } else {
      callback(false, chats);
    }
  });
}

function chatToFile(chats, callback) {
  const newChats = chats;
  for (const chat of newChats) {
    if (chat.encrypted.startsWith('{files/')) {
      File.getFilebyID(chat.encrypted.replace('{files/', ''), (err, fileres) => {
        if (err) reject(err);
        if (fileres != undefined) {
          chat.file = fileres;
        } else {
          chat.encrypted = '**DELETED FILE**';
        }
      });
    }
  }
  callback(newChats);
}

function sendChat(from, to, text, cb) {
  User.getUserById(to, (err, userto) => {
    if (text.startsWith('{files/')) {
      TrackedEvent.createTrackedEvent('Chat sent file', `to: ${userto.username}(${userto.id}), file: ${text.replace('{files/', '')}`, from, (err, event) => {
        File.addAUser(text.replace('{files/', ''), to);
      });
    }
    const chat = new Chat({
      user_from: from,
      user_to: to,
      date: new Date().getTime(),
      seen: false,
      encrypted: text,
    });
    Chat.createChat(chat, (err, chat) => {
      if (err) throw err;
      //        User.getUserById(from, function(err, userfrom){
      //            User.getUserById(to, function(err, userto){
      //                nodemailer.createTestAccount((err, account) => {
      //                   // create reusable transporter object using the default SMTP transport
      //                    let transporter = nodemailer.createTransport({
      //                        host: 'smtp.ethereal.email',
      //                        port: 587,
      //                        secure: false, // true for 465, false for other ports
      //                        auth: {
      //                            user: account.user, // generated ethereal user
      //                            pass: account.pass // generated ethereal password
      //                        }
      //                    });
      //
      //                    // setup email data with unicode symbols
      //                    let mailOptions = {
      //                        from: '"Fiduce" <fiduce@mail.com>', // sender address
      //                       to: userto.email, // list of receivers
      //                        subject: "You've got a message!", // Subject line
      //                        text: 'Hi, the user "' + userfrom.username + '" has sent you the following message: ' + text,
      //                        html: 'Hi, the user "' + userfrom.username + '" has sent you the following message:</br></br></br>' + text
      //                    };
      //
      //                   // send mail with defined transport object
      //                    transporter.sendMail(mailOptions, (error, info) => {
      //                        if (error) {
      //                            return console.log(error);
      //                        }
      //                        console.log('Message sent: %s', info.messageId);
      //                        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      //                        res.render('passwordreset', {success_msg: "Email sent. Please check your email inbox for further instructions (Check spam also)" });
      //                    });
      //                });
      //            });
      //        });
      TrackedEvent.createTrackedEvent('Chat sent', `${userto.username}(${userto.id})`, from, (err, event) => {
        cb(chat);
      });
    });
  });
}

function sendMultiChat(from, roomID, text, cb) {
  if (text.startsWith('{files/')) {
    ChatRoom.getChatRoomByID(roomID, (err, room) => {
      TrackedEvent.createTrackedEvent('MultiChat sent file', `room: ${roomID}, file: ${text.replace('{files/', '')}`, from, (err, event) => {
        const arrUsers = room.users.split('-');
        for (let i = 0; i < arrUsers.length; i++) {
          File.addAUser(text.replace('{files/', ''), arrUsers[i]);
        }
      });
    });
  }
  const multichat = new MultiChat({
    user_from: from,
    room: roomID,
    date: new Date().getTime(),
    seen: from,
    encrypted: text,
  });
  MultiChat.createChat(multichat, (err, chat) => {
    if (err) throw err;
    TrackedEvent.createTrackedEvent('MultiChat sent', roomID, from, (err, event) => {
      cb(chat);
    });
  });
}

function getChats(req, cb) {
  Chat.getAllChatsFromUsername(req.user.id, (err, res) => {
    if (err) throw err;

    const users = new Array();
    const Users = new Array();

    for (const inRes of res) {
      if (inRes != undefined) {
        let User_to;
        let seen;
        if (inRes.user_from == req.user.id) {
          User_to = inRes.user_to;
          seen = true;
        } else {
          User_to = inRes.user_from;
          seen = inRes.seen;
        }

        if (userInArr(User_to, users) == false) {
          if (err) throw err;
          users.push({
            id: User_to,
            date: parseInt(inRes.date),
            seen,
          });
        }
      }
    }
    users.forEach((user) => {
      User.getUserById(user.id, (err, ele) => {
        Users.push({
          username: ele.name,
          id: ele.id,
          seen: user.seen,
        });
      });
    });
    cb(Users);
  });
}

function userInArr(target, array) {
  for (let i = 0; i < array.length; i++) {
    if (array[i].id === target) {
      return true;
    }
  }
  return false;
}

module.exports = router;
module.exports.setIO = function (sio) {
  io = sio;
};

function getFilesSorted(req, cb) {
  File.getFilesByUserIDSorted(req.user.id, 'daterev', (err, files) => {
    if (err) throw err;
    if (!files) {
      return null;
    }
    ipfs.getFiles(files).then((result) => {
      cb(result);
    });
  });
}

function getChatRooms(req, callback) {
  ChatRoom.getChatsByUser(req.user.id, (err, chatrooms) => {
    if (err) console.error(err);
    if (chatrooms.length == 0) {
      getChats(req, (chats) => {
        callback(null, chats);
      });
    } else {
      totalChats = chatrooms.length;
      for (let i = 0; i < chatrooms.length; i++) {
        if (chatrooms[i].name == '') {
          const arrUsers = chatrooms[i].users.split('-');
          totalUsers = arrUsers.length - 1;
          for (let u = 0; u < arrUsers.length; u++) {
            User.getUserById(arrUsers[u], (err, user) => {
              if (!(user.id == req.user.id)) {
                totalUsers--;
                if (totalUsers == 0) {
                  chatrooms[i].name = chatrooms[i].name + user.username;
                } else {
                  chatrooms[i].name = `${chatrooms[i].name + user.username}, `;
                }
              }
            });
          }
        }
        totalChats--;
        if (totalChats == 0) {
          getChats(req, (chats) => {
            callback(chatrooms, chats);
          });
        }
      }
    }
  });
}

function getMultiChats(roomID, userID, callback) {
  ChatRoom.validateChat(roomID, userID, (isValid) => {
    if (isValid) {
      MultiChat.getChatByRoom(roomID, (err, chats) => {
        if (err) console.error(err);
        if (chats.length == 0) {
          callback([]);
        } else {
          totalChats = chats.length;
          for (let i = 0; i < chats.length; i++) {
            if (chats[i].user_from == userID) {
              chats[i].mine = true;
            } else {
              User.getUserById(chats[i].user_from, (err, user) => {
                chats[i].mine = false;
                chats[i].user_from = user.username;
              });
            }
            totalChats--;
            if (totalChats == 0) {
              callback(chats);
            }
          }
        }
      });
    }
  });
}
