const express = require('express');

const router = express.Router();
const JSZip = require('jszip');
const fs = require('fs');
const XLSX = require('xlsx');
const User = require('../models/user');
const File = require('../models/file');
const ipfs = require('../ipfs');
const Dir = require('../models/directory');
const Chat = require('../models/chat');
const PR = require('../models/resetpassword');
const trevents = require('../models/trackedevent');
const { ensureAuthenticated } = require('../utils/auth');
const { calculateBalanceByUserId } = require('../models/invoice');

function sheet_to_workbook(sheet/*: Worksheet */, opts)/*: Workbook */ {
  const n = opts && opts.sheet ? opts.sheet : 'Events';
  const sheets = {}; sheets[n] = sheet;
  return { SheetNames: [n], Sheets: sheets };
}

function aoa_to_workbook(data/*: Array<Array<any> > */, opts)/*: Workbook */ {
  return sheet_to_workbook(XLSX.utils.aoa_to_sheet(data, opts), opts);
}

function sortFunction(a, b) {
  if (a[2] === b[2]) {
    return 0;
  }

  return (a[2] < b[2]) ? -1 : 1;
}

router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  res.render('settingsgeneral', { loggedin: true, balance });
});

router.get('/exportevents', ensureAuthenticated, (req, res) => {
  const all = trevents.getAllEvents(req.user.id, (err, result) => {
    let lefttocomp = result.length;
    const events = [];
    for (let i = 0; i < result.length; i++) {
      const resu = result[i];
      console.log(resu);
      if (resu != undefined) {
        events.push([resu.event, resu.description, new Date(resu.date * 1).toLocaleDateString('en-US'), new Date(resu.date * 1).toLocaleTimeString('en-US')]);
      }
      lefttocomp--;
      if (lefttocomp == 0) {
        console.log(events);
        events.sort(sortFunction);
        events.unshift(['Event', 'Desc', 'Date', 'Time']);
        const wb = aoa_to_workbook(events);
        const filen = `/temp${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, __dirname + filen); // save to test.xlsx
        res.contentType('application/vnd.ms-excel');
        res.download(__dirname + filen, 'Export of events.xlsx');
      }
    }
  });
});
router.get('/privacy', ensureAuthenticated, (req, res) => {
  res.render('settingsprivacy', { loggedin: true });
});
router.get('/data', ensureAuthenticated, (req, res) => {
  res.render('settingsdata', { loggedin: true });
});
router.get('/exportfiles', ensureAuthenticated, (req, res) => {
  exportAll(req, res);
});
router.post('/deleteacc', ensureAuthenticated, (req, res) => {
  password = req.body.password;
  if (password == undefined) {
    password = '';
  }
  User.comparePassword(password, req.user.password, (err, isMatch) => {
    if (err) throw err;
    if (isMatch) {
      deleteUser(req, res);
    } else {
      req.flash('error_msg', 'Votre mot de passe est incorrect.');
      res.redirect('/settings/data');
    }
  });
});

router.post('/privacy', ensureAuthenticated, (req, res) => {
  const { oldpassword } = req.body;
  const { password } = req.body;
  const { passwordre } = req.body;

  // Validation
  req.checkBody('password', 'Mot de passe requis').notEmpty();
  req.checkBody('oldpassword', 'Un ancien mot de passe est requis').notEmpty();
  req.checkBody('passwordre', 'La confirmation du mot de passe est requise').notEmpty();
  req.checkBody('passwordre', 'Les mots de passe ne correspondent pas').equals(req.body.password);

  let errors;

  if (oldpassword == password) {
    errors = [{ param: 'oldpassword', msg: "Votre nouveau mot de passe ne peut pas être le même que l'ancien.", value: oldpassword }].concat(req.validationErrors());
    if (errors[errors.length - 1] == false) {
      errors.splice(-1, 1);
    }
  } else {
    errors = req.validationErrors();
  }

  if (errors) {
    console.log(errors);
    res.render('settingsprivacy', {
      errors,
    });
  } else {
    User.comparePassword(oldpassword, req.user.password, (err, isMatch) => {
      if (err) throw err;
      if (isMatch) {
        User.changePassword(req.user.id, password);
        setTimeout(() => {
          req.flash('success_msg', 'Vos changements ont été enregistrés.');
          res.redirect('/settings/privacy');
        }, 500);
      } else {
        req.flash('error_msg', 'Votre ancien mot de passe est incorrect.');
        res.redirect('/settings/privacy');
      }
    });
  }
});

router.post('/', ensureAuthenticated, (req, res) => {
  User.getUserById(req.user.id, (error, user) => {
    const { name } = req.body;
    const { email } = req.body;
    const { username } = req.body;
    const { birthdate } = req.body;

    // Validation
    req.checkBody('name', 'Le nom est requis').notEmpty();
    req.checkBody('email', 'Email est requis').notEmpty();
    req.checkBody('email', "L'email n'est pas valide").isEmail();
    req.checkBody('username', "Nom d'utilisateur est nécessaire").notEmpty();
    req.checkBody('birthdate', 'La date de naissance est obligatoire').notEmpty();

    if (gregorianAge(req.body.birthdate, undefined) < 18) {
      req.checkBody('birthdate', "Vous n'êtes pas assez vieux. Pour utiliser Fiduce, vous devez avoir au moins 18 ans.").equals('');
    }

    const errors = req.validationErrors();

    if (errors) {
      console.log(errors);
      res.render('settingsgeneral', {
        errors,
      });
    } else {
      if (name != user.name) {
        user.name = name;
      }
      if (email != user.email) {
        user.email = email;
      }
      if (username != user.username) {
        user.username = username;
      }
      if (birthdate != user.birthdate) {
        user.birthdate = birthdate;
      }
      user.save();
      setTimeout(() => {
        req.flash('success_msg', 'Vos changements ont été enregistrés.');
        res.redirect('/settings');
      }, 500);
    }
  });
});

function gregorianAge(birthDate, ageAtDate) {
  // convert birthDate to date object if already not
  if (Object.prototype.toString.call(birthDate) !== '[object Date]') { birthDate = new Date(birthDate); }

  // use today's date if ageAtDate is not provided
  if (typeof ageAtDate === 'undefined') { ageAtDate = new Date(); }

  // convert ageAtDate to date object if already not
  else if (Object.prototype.toString.call(ageAtDate) !== '[object Date]') { ageAtDate = new Date(ageAtDate); }

  // if conversion to date object fails return null
  if (ageAtDate == null || birthDate == null) { return null; }

  const _m = ageAtDate.getMonth() - birthDate.getMonth();

  // answer: ageAt year minus birth year less one (1) if month and day of
  // ageAt year is before month and day of birth year
  return (ageAtDate.getFullYear()) - birthDate.getFullYear()
	  - ((_m < 0 || (_m === 0 && ageAtDate.getDate() < birthDate.getDate())) ? 1 : 0);
}

function deleteUser(req, res) {
  User.findByIdAndRemove(req.user.id, (err) => {
    File.remove({ owner: req.user.id }, (err) => {
      Dir.remove({ owner: req.user.id }, (err) => {
        Dir.remove({ owner: req.user.id }, (err) => {
          PR.remove({ owner: req.user.id }, (err) => {
            Chat.remove({ $or: [{ user_from: req.user.id }, { user_to: req.user.id }] }, (err) => {
              res.redirect('/logout');
            });
          });
        });
      });
    });
  });
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

function exportAll(req, res) {
  Chat.getAllChatsFromUsername(req.user.id, (err, chats) => {
    if (err) console.error(err);

    const zip = new JSZip();
    const folderfiles = zip.folder('Files');
    const chatfiles = zip.folder('Chats');

    chats.push({});
    let chatscompleted = chats.length;
    const chat = {};
    for (let j = 0; j < chats.length; j++) {
      var other;
      var person;
      if (chats[j].user_from == req.user.id) {
        other = chats[j].user_to;
        person = 'Me: ';
      } else {
        other = chats[j].user_from;
        person = 'Other user: ';
      }
      if (!(chat[other])) {
        chat[other] = new Array();
      }
      const message = `${person + chats[j].encrypted}\r\n`;
      chat[other] += message;
      chatscompleted--;
      if (chatscompleted == 0) {
        var chatcompleted = Object.keys(chat).length;
        Object.keys(chat).forEach((key) => {
          const val = chat[key];
          User.getUserById(key, (err, user) => {
            if (err) console.error(err);
            if (user == undefined) {
              chatfiles.file('Fiduce.txt', 'Bonjour, ce dossier contient tous vos chats.');
            } else {
              chatfiles.file(`${user.username}.txt`, val);
            }
            chatcompleted--;
            if (chatcompleted == 0) {
              File.getFilesByUserID(req.user.id, (err, files) => {
                if (err) console.error(err);
                let filescompleted = files.length;
                for (let i = 0; i < files.length + 1; i++) {
                  if (files[i] != undefined) {
                    ipfs.getFile(files[i].id, (err, data) => {
                      if (err) throw err;
                      folderfiles.file(`${files[i].name}.${files[i].extension}`, data, { base64: true });
                      if (files[i].users != undefined) {
                        let fileUsrString = '';
                        const arrUsrs = files[i].users.split(' ');
                        arrUsrs.shift();
                        usrscompl = arrUsrs.length;
                        for (let a = 0; a < arrUsrs.length; a++) {
                          User.getUserById(arrUsrs[a], (err, user) => {
                            fileUsrString += `User: ${user.username}, Profile link: https://fiduce.fr/users/profile/${user.id}\r\n`;
                            usrscompl--;
                            if (usrscompl == 0) {
                              folderfiles.file(`Access to file: '${files[i].name}.${files[i].extension}'.txt`, fileUsrString);
                              filescompleted--;
                              if (filescompleted == -1) {
                                zip.generateAsync({ type: 'nodebuffer' })
                                  .then((content) => {
                                    zipdata = new Buffer(content).toString('base64');
                                    res.end(zipdata, 'base64');
                                  });
                              }
                            }
                          });
                        }
                      } else {
                        filescompleted--;
                        if (filescompleted == -1) {
                          zip.generateAsync({ type: 'nodebuffer' })
                            .then((content) => {
                              zipdata = new Buffer(content).toString('base64');
                              res.end(zipdata, 'base64');
                            });
                        }
                      }
                    });
                  } else {
                    filescompleted--;
                    if (filescompleted == -1) {
                      zip.generateAsync({ type: 'nodebuffer' })
                        .then((content) => {
                          zipdata = new Buffer(content).toString('base64');
                          res.end(zipdata, 'base64');
                        });
                    }
                  }
                }
              });
            }
          });
        });
      }
    }
  });
}

module.exports = router;
