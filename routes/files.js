const express = require('express');

const router = express.Router();
const path = require('path');
const fs = require('fs');
const { PDFImage } = require('pdf-image');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const File = require('../models/file');
const Dir = require('../models/directory');
const ipfs = require('../ipfs');
const User = require('../models/user');

let grid = false;

const TrackedEvent = require('../models/trackedevent');
const { sendMail } = require('../utils/mailer');
const { ensureAuthenticated } = require('../utils/auth');
const {
  convertToPdf,
  allowedExtensionsForConvertToPdf,
} = require('../utils/pdf-tools');
const { calculateBalanceByUserId } = require('../models/invoice');

router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);

  if (req.query.search) {
    searchforFiles(req.user.id, req.query.search, (files, dirs) => {
      if (req.query.grid == 'true') {
        grid = true;
      } else if (req.query.grid == 'false') {
        grid = false;
      }
      File.getDeletedFiles(req.user.id, (err, deletedfiles) => {
        res.render('files', {
          balance,
          loggedin: true,
          deletedfiles,
          dirs,
          files: files.map(ipfs.setFileIcon),
          search: req.query.search,
          grid,
        });
      });
    });
  } else {
    getFilesDir(req, '', (files, dir, dirs, parents) => {
      if (req.query.grid == 'true') {
        grid = true;
      } else if (req.query.grid == 'false') {
        grid = false;
      }
      File.getDeletedFiles(req.user.id, (_, deletedfiles) => {
        console.log(files, files.map(ipfs.setFileIcon));
        res.render('files', {
          balance,
          loggedin: true,
          deletedfiles,
          dirs,
          files: files.map(ipfs.setFileIcon),
          grid,
          parents,
        });
      });
    });
  }
});

router.get('/:dir', ensureAuthenticated, (req, res) => {
  File.getDeletedFiles(req.user.id, (err, deletedfiles) => {
    getFilesDir(req, req.params.dir, (files, dir, dirs, parents) => {
      const compressPdf = parents.findIndex((x) => x.name == 'Prêt immobilier') >= 0;
      if (dir) {
        if (req.query.grid == 'true') {
          grid = true;
        } else if (req.query.grid == 'false') {
          grid = false;
        }
        if (dir.deletable) {
          if (req.query.filename) {
            Dir.changeName(dir.id, req.query.filename);
            res.redirect(`/files/${dir.parent}`);
          } else if (req.query.delete) {
            Dir.removeDirbyID(dir.id, (err, res) => {
            });
            res.redirect(`/files/${dir.parent}`);
          } else if (req.query.move) {
            Dir.changeParentDir(dir.id, req.query.move, (err, res) => {
            });
            res.redirect(`/files/${req.query.move}`);
          } else if (req.query.paste) {
            const newDir = Dir({
              owner: dir.owner,
              parent: req.query.paste,
              name: dir.name,
              shared: dir.shared,
              date: new Date().getTime(),
              deletable: dir.deletable,
            });
            Dir.createDir(newDir, (err, ndir) => {
              File.getFilesByDir(req.user.id, req.params.dir, (err, nfiles) => {
                console.log(nfiles);
                for (let f = 0; f < nfiles.length; f++) {
                  const newFile = File({
                    hash: nfiles[f].hash,
                    filename: nfiles[f].filename,
                    size: nfiles[f].size,
                    mimetype: nfiles[f].mimetype,
                    owner: nfiles[f].owner,
                    name: nfiles[f].name,
                    date: nfiles[f].date,
                    key: nfiles[f].key,
                    extension: nfiles[f].extension,
                    dir: ndir.id,
                  });
                  File.createFile(newFile, (err, file) => {
                    if (err) throw err;
                  });
                }
              });
              res.redirect(`/files/${req.query.paste}`);
            });
          } else {
            res.render('files', {
              loggedin: true,
              deletedfiles,
              dirs,
              dir,
              files: files.map(ipfs.setFileIcon),
              grid,
              parents,
              compressPdf,
            });
          }
        } else {
          res.render('files', {
            loggedin: true,
            deletedfiles,
            dirs,
            dir,
            files: files.map(ipfs.setFileIcon),
            grid,
            parents,
            compressPdf,
          });
        }
      } else {
        if (req.query.grid == 'true') {
          grid = true;
        } else if (req.query.grid == 'false') {
          grid = false;
        }
        res.render('files', {
          loggedin: true,
          deletedfiles,
          files: files.map(ipfs.setFileIcon),
          grid,
          parents,
          compressPdf,
        });
      }
    });
  });
});

router.post('/index/:ID', ensureAuthenticated, (req, res) => {
  const ipfsID = req.params.ID;
  File.getFilebyID(ipfsID, (err, file) => {
    if (err) throw err;
    if (file == null) {
      req.flash('error_msg', 'Erreur lors de l\'obtention du fichier.');
      res.redirect('/files');
    } else {
      let users = false;
      if (file.users != undefined) {
        users = file.users.includes(req.user.id);
      }
      if (file.owner == req.user.id || users == true) {
        if (req.query.sign) {
          ipfs.signFile(Object.keys(req.body)[0], ipfsID, (hash) => {
            file.signed = file.hash;
            file.hash = hash;
            file.save();
          });
        }
      }
    }
  });
});

router.post('/', ensureAuthenticated, (req, res) => {
  const newDir = Dir({
    owner: req.user.id,
    parent: '',
    name: req.body.folder,
    shared: '',
    date: new Date().getTime(),
    deletable: true,
  });
  Dir.createDir(newDir, (dir) => {
    res.redirect('/files/');
  });
});

router.post(
  '/shareFilesBy',
  ensureAuthenticated,
  [],
  (req, res) => {
    req.checkBody('by', 'by is required')
      .notEmpty();
    req.checkBody('to', 'Email est requis.')
      .notEmpty();
    req.checkBody('to', 'L\'e-mail n\'est pas dans un format valide')
      .isEmail();
    req.checkBody('subject', 'Sujet est requis.')
      .notEmpty();
    req.checkBody('body', 'Texte est requis.')
      .notEmpty();

    const errors = req.validationErrors();
    if (errors) {
      return res.json({
        ok: false,
        message: `Validation error: <br />${errors.map((x) => `${x.msg}<br/>`)}`,
      });
    }

    const { by } = req.body;
    const { to } = req.body;
    const subject = req.body.to;
    const mailBody = req.body.body;
    const { files } = req.body;

    switch (by) {
      case 'email':
        let ids = [];
        ids = files.map((x) => x.split('-')[0]);
        File
          .getFilesbyID(ids, (err, recFiles) => {
            if (err) {
              return res.json({
                ok: false,
                message: err.message,
              });
            }
            ipfs
              .getFiles(recFiles)
              .then((newFiles) => {
                sendMail(
                  to,
                  subject,
                  mailBody,
                  req.user.name,
                  newFiles.map((x) => ({
                    filename: `${x.name}.${x.extension}`,
                    content: x.baseimg,
                    encoding: 'base64',
                  })),
                  (err, info) => {
                    if (err) {
                      return res.json({
                        ok: false,
                        message: err.message,
                      });
                    }

                    return res.json({
                      ok: true,
                      message: 'Tous les fichiers ont été envoyés avec succès par e-mail',
                    });
                  },
                  req.user.email,
                );
              });
          });
        break;

      default:
        return res.json({
          ok: false,
          message: '"By" parameter is not valid',
        });
    }
  },
);

router.post('/:dir', ensureAuthenticated, (req, res) => {
  const newDir = Dir({
    owner: req.user.id,
    parent: req.params.dir,
    name: req.body.folder,
    shared: '',
    date: new Date().getTime(),
    deletable: true,
  });
  Dir.createDir(newDir, (dir) => {
    TrackedEvent.createTrackedEvent('Created Dir', dir.id, req.user.id, (err, event) => {
      res.redirect(`/files/${req.params.dir}`);
    });
  });
});

router.get('/restoredeleted/:ID', ensureAuthenticated, (req, res) => {
  const file = req.params.ID;
  File.restoreFile(file, req.user.id);
});

router.get('/index/:ID', ensureAuthenticated, (req, res) => {
  const ipfsID = req.params.ID;
  File.getFilebyID(ipfsID, (err, file) => {
    if (err) throw err;
    if (file == null) {
      req.flash('error_msg', 'Error while getting file.');
      res.redirect('/files');
    } else {
      let users = false;
      if (file.users != undefined) {
        users = file.users.includes(req.user.id);
      }
      if (file.owner == req.user.id || users == true) {
        if (req.query.delete) {
          File.removeFilebyHash(ipfsID, req.user.id, () => {
            TrackedEvent.createTrackedEvent('Deleted File', ipfsID, req.user.id, (err, event) => {
              req.flash('success_msg', 'Fichier supprimé avec succès.');
              if (!req.query.dir) {
                res.redirect('/files');
              } else {
                res.redirect(`/files/${req.query.dir}`);
              }
            });
          });
        } else if (req.query.download == 'true') {
          res.setHeader('Content-disposition', `attachment; filename=${file.name}.${file.extension}`);
          res.setHeader('Content-type', file.mimetype);
          ipfs.getFile(ipfsID, (err, data) => {
            TrackedEvent.createTrackedEvent('Downloaded file', ipfsID, req.user.id, (err, event) => {
              res.end(data, 'binary');
            });
          });
        } else if (req.query.convertto == 'pdf') {
          ipfs.getFile(ipfsID, (err, data) => {
            convertFileToPdf(file, data, (pdfFile, err, finishCallback) => {
              if (err) {
                return res.status(400)
                  .send(err);
              }

              ipfs.addFile(req.user, pdfFile, {
                fileinputname: pdfFile.filename.split('.')
                  .slice(0, -1)
                  .join('.'),
                dir: file.dir,
                compressPdf: 'false',
              }, (ipfsId) => {
                req.flash('success_msg', 'fichier converti avec succès en pdf.');
                TrackedEvent.createTrackedEvent('Convert to pdf', ipfsId, req.user.id, (err, event) => res.status(200)
                  .send('OK'));
                if (finishCallback) finishCallback();
              });
            });
          });
        } else if (req.query.filename) {
          File.changeFilename(ipfsID, req.query.filename);
          req.flash('success_msg', 'Renommer le fichier réussi.');
          if (req.query.dirto == 'undefined') {
            res.redirect('/files');
          } else {
            res.redirect(`/files/${req.query.dirto}`);
          }
        } else if (req.query.share) {
          User.getUserByEmail(req.query.share, (err, useremail) => {
            if (err) throw err;
            if (useremail == undefined) {
              User.getUserByUsername(req.query.share, (err, userusername) => {
                if (err) throw err;
                if (userusername) {
                  TrackedEvent.createTrackedEvent('Shared file', `with: ${userusername.id}, file: ${ipfsID}`, req.user.id, (err, event) => {
                  });
                  File.addAUser(ipfsID, userusername.id);
                } else {
                }
              });
            } else {
              TrackedEvent.createTrackedEvent('Shared file', `with: ${useremail.id}, file: ${ipfsID}`, req.user.id, (err, event) => {
              });
              File.addAUser(ipfsID, useremail.id);
            }
          });
          res.redirect('/files');
        } else if (req.query.paste) {
          if (file.dir != req.query.paste) {
            let pasteto = req.query.paste;
            if (pasteto == 'undefined') pasteto = '';
            const newFile = File({
              hash: file.hash,
              filename: file.filename,
              size: file.size,
              mimetype: file.mimetype,
              owner: file.owner,
              name: file.name,
              date: file.date,
              key: file.key,
              extension: file.extension,
              dir: pasteto,
            });
            File.createFile(newFile, (err, file) => {
              if (err) throw err;
              TrackedEvent.createTrackedEvent('Pasted File', file.id, req.user.id, (err, event) => {
              });
            });
          }
        } else if (req.query.move) {
          if (file.dir != req.query.move) {
            let moveto = req.query.move;
            if (moveto == 'undefined') moveto = '';
            file.dir = moveto;
            TrackedEvent.createTrackedEvent('Moved File', file.id, req.user.id, (err, event) => {
            });
            file.save();
          }
        } else if (req.query.sign) {
          ipfs.getFile(ipfsID, (err, data) => {
            res.render('esign', {
              loggedin: true,
              file,
              img: data.toString('base64'),
            });
          });
        } else {
          ipfs.getFile(ipfsID, (err, data) => {
            TrackedEvent.createTrackedEvent('Viewed file', ipfsID, req.user.id, (err, event) => {
              res.contentType(file.mimetype);
              res.end(data, 'binary');
            });
          });
        }
      } else {
        req.flash('error_msg', 'You can\'t view that document.');
        res.redirect('/files');
      }
    }
  });
});

router.get('/move/:ID', ensureAuthenticated, (req, res) => {
  const id = req.params.ID;
  const { to } = req.query;
  const isFolder = req.query.isFolder == 'true';

  if (!id || !to) {
    return res.status(400)
      .send('"id" et "to" sont obligatoires.');
  }

  if (isFolder) {
    Dir.changeParentDir(id, to, (err) => {
      if (err) {
        return res.status(404)
          .send(err);
      }
      return res.status(200)
        .send('Done');
    });
  } else {
    File.getFilebyID(id, (err, file) => {
      if (err) {
        return res.status(503)
          .send(err);
      }
      if (file.dir != to) {
        file.dir = to;

        file.save()
          .then(() => {
            TrackedEvent.createTrackedEvent('Moved File', id, req.user.id);
            return res.status(200)
              .send('Done');
          });
      }
    });
  }
});

router.get('/converttopdf/:ID', ensureAuthenticated, (req, res) => {
  convertToPdf('sample.docx')
    .then(() => {
      fs.readFile('./public/convert/sample.pdf', (err, data) => {
        if (err) {
          console.log(err);
        } else {
          res.setHeader('Content-type', 'application/pdf');
          return res.end(data, 'binary', () => console.log('Download Finished'));
        }
      });
    });
});

function convertFileToPdf(file, data, cb) {
  if (file.mimetype == 'application/pdf') {
    return cb(data);
  }

  if (allowedExtensionsForConvertToPdf.indexOf(file.extension) < 0) {
    return cb(null, 'La conversion de ce type de fichier n\'est pas prise en charge.');
  }

  const tempFileName = `${Date.now()}-${file.filename}`;
  const outFileName = `${tempFileName.split('.')
    .slice(0, -1)
    .join('.')}.pdf`;
  const relPath = './public/convert/';

  fs.writeFile(relPath + tempFileName, data, 'base64', (err) => {
    if (err) return cb(null, err);
    convertToPdf(tempFileName, relPath)
      .then(() => {
        const pdfFile = new File({
          filename: outFileName,
          mimetype: 'application/pdf',
          name: outFileName,
          extension: 'pdf',
          dir: file.dir,
        });
        pdfFile.path = relPath + outFileName;
        pdfFile.originalname = outFileName;

        cb(pdfFile, null, () => {
          fs.unlinkSync(relPath + tempFileName);
          fs.unlinkSync(relPath + outFileName);
        });
      });
  });
}

function getFilesSorted(req, cb) {
  if (req.query.sort) {
    File.getFilesByUserIDSorted(req.user.id, req.query.sort, (err, res) => {
      if (err) throw err;
      if (!res) {
        return null;
      }
      // ipfs.getFiles(res).then(function(result){
      //     cb(result);
      // });
      cb(res);
    });
  } else {
    File.getFilesByUserID(req.user.id, (err, res) => {
      if (err) throw err;
      if (!res) {
        return null;
      }
      // ipfs.getFiles(res).then(function(result){
      //     cb(result);
      // });
      cb(res);
    });
  }
}

function getFilesDir(req, dir, cb) {
  File.getFilesByDir(req.user.id, dir, (err, res) => {
    if (err) throw err;
    if (!res) {
      return null;
    }
    // ipfs.getFiles(res).then(function(result){
    //     Dir.getDirbyID(req.user.id, dir,  function(err, dire){
    //         if (err) throw err;
    //         if(dire != null){
    //             Dir.getDirsbyParent(req.user.id, dire.id, function(err, dirs){
    //                 cb(result, dire, dirs);
    //             });
    //         }else{
    //             Dir.getDirsbyParent(req.user.id, "", function(err, dirs){
    //                 cb(result, dire, dirs);
    //             });
    //         }
    //     });
    // });
    Dir.getDirbyID(req.user.id, dir, (err, dire) => {
      if (err) throw err;
      let directoryId = '';
      if (dire != null) {
        directoryId = dire.id;
      }

      Dir.getDirsbyParent(req.user.id, directoryId, (err, dirs) => {
        Dir.getAllParentDirectories(req.user.id, directoryId, (err2, parents) => {
          if (err2) console.log(err2);
          parents.push({
            name: `Le dossier de ${req.user.name}`,
            id: '',
          });
          cb(res, dire, dirs, parents.reverse());
        });
      });
      // if(dire != null){
      //     Dir.getDirsbyParent(req.user.id, dire.id, function(err, dirs){
      //         cb(res, dire, dirs);
      //     });
      // }else{
      //     Dir.getDirsbyParent(req.user.id, "", function(err, dirs){
      //         cb(res, dire, dirs);
      //     });
      // }
    });
  });
}

function searchforFiles(owner, searchText, callback) {
  File.searchFiles(owner, searchText, (files) => {
    Dir.searchDirs(owner, searchText, (dirs) => {
      callback(files, dirs);
    });
  });
}

module.exports = router;
