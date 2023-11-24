const express = require('express');
const { ensureAuthenticated } = require('../utils/auth');

const router = express.Router();
const fs = require('fs');
const https = require('https');
const readline = require('readline');
const { google } = require('googleapis');
const async = require('async');
const files = require('ipfs-http-client/src/files');
const ipfs = require('../ipfs');
const TrackedEvent = require('../models/trackedevent');
const CloudToken = require('../models/cloud-token');
const { calculateBalanceByUserId } = require('../models/invoice');

const publicPath = `${process.env.FS_PREFIX ?? '.'}/public/uploads/`;

const API_KEY = process.env.GDRIVE_API_KEY;
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly'];

router.get('/', ensureAuthenticated, async (req, res) => {
  const balance = await calculateBalanceByUserId(req.user._id, false);
  if (req.query.provider == 'google') {
    fs.readFile('credentials.json', (err, content) => {
      if (err) {
        console.log('Error loading client secret file:', err);
        return res.render('cloud-storage', { layout: false, errors: [{ msg: `Error loading client secret file: ${err}` }] });
      }

      const credentials = JSON.parse(content);

      // Authorize a client with credentials, then call the Google Drive API.
      const {
        client_secret, client_id, redirect_uris, project_id,
      } = credentials.web;
      let redirect_uri = redirect_uris[0];
      if (req.hostname.toLowerCase().indexOf('fiduce') > 0) { redirect_uri = redirect_uris[1]; }
      const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

      // This is the callback from authorization from the google
      if (req.query.authorized == 'true') {
        oAuth2Client.getToken(req.query.code, (err, token) => {
          if (err) {
            console.error('Error retrieving access token', err);
            return res.render('cloud-storage', { balance, layout: false, errors: [{ msg: `Error retrieving access token: ${err}` }] });
          }
          // oAuth2Client.setCredentials(token);

          // Store the token to database for later use
          CloudToken.saveToken(req.query.provider, req.user, JSON.stringify(token), (err) => {
            if (err) {
              console.log('Error loading client secret file: ', err);
              return res.render('cloud-storage', { balance, layout: false, errors: [{ msg: `Cannot save token${err}` }] });
            }
            return res.render('cloud-storage', { balance, authorized: true });
          });
        });
      } else {
        // Check if we have previously stored a token.
        CloudToken.getToken(req.query.provider, req.user, (err, cloudtoken) => {
          if (!cloudtoken) {
            const authUrl = oAuth2Client.generateAuthUrl({
              access_type: 'offline',
              scope: SCOPES,
            });
            return res.render('cloud-storage', { balance, layout: false, authUrl });
          }

          const cloudTokenCode = JSON.parse(cloudtoken.code);
          oAuth2Client.setCredentials(cloudTokenCode);

          // refresh token
          oAuth2Client.getAccessToken((err, code) => {
            if (err) {
              const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
              });
              return res.render('cloud-storage', { balance, layout: false, authUrl });
            }

            if (cloudTokenCode.access_token != code) {
              cloudTokenCode.access_token = code;
              cloudtoken.code = JSON.stringify(cloudTokenCode);
              cloudtoken.save((err) => console.log(err));
            }

            return res.render('cloud-storage', {
              balance,
              layout: false,
              token: { access_token: code },
              API_KEY,
              client_id,
              project_id,
            });
          });

          // oAuth2Client.setCredentials(JSON.parse(token.code));
          // //oAuth2Client.setCredentials('abc');

          // const drive = google.drive({ version: 'v3', auth: oAuth2Client });
          // drive.files.list({
          // 	pageSize: 10,
          // 	//fields: 'nextPageToken, files(kind, id, name, webViewLink, iconLink, hasThumbnail, thumbnailLink)',
          // 	fields: '*',
          // }, (err, dres) => {
          // 	if (err) {
          // 		console.log('The API returned an error: ', err);
          // 		return res.render('cloud-storage', { layout: false, errors: [{ msg: "The API returned an error: " + err }] });
          // 	}
          // 	const files = dres.data.files;
          // 	return res.render('cloud-storage', { layout: false, files });
          // });
        });
      }
    });
  } else res.status(400).send('provider is required');
});

router.post('/', ensureAuthenticated, (req, res) => {
  if (req.query.provider == 'google') {
    fs.readFile('credentials.json', (err, content) => {
      if (err) {
        return res.render('cloud-storage', { layout: false, errors: [{ msg: `Erreur lors du chargement du fichier secret du client: ${err}` }] });
      }

      const credentials = JSON.parse(content);

      // Authorize a client with credentials, then call the Google Drive API.
      const {
        client_secret, client_id, redirect_uris, project_id,
      } = credentials.web;
      let redirect_uri = redirect_uris[0];
      if (req.hostname.toLowerCase().indexOf('fiduce') > 0) { redirect_uri = redirect_uris[1]; }
      const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

      // Check if we have previously stored a token.
      CloudToken.getToken(req.query.provider, req.user, (err, cloudtoken) => {
        if (!cloudtoken) {
          const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
          });
          return res.render('cloud-storage', { layout: false, authUrl });
        }

        const cloudTokenCode = JSON.parse(cloudtoken.code);
        oAuth2Client.setCredentials(cloudTokenCode);

        // refresh token
        oAuth2Client.getAccessToken((err, code) => {
          if (err) {
            const authUrl = oAuth2Client.generateAuthUrl({
              access_type: 'offline',
              scope: SCOPES,
            });
            return res.render('cloud-storage', { layout: false, authUrl });
          }

          if (cloudTokenCode.access_token != code) {
            cloudTokenCode.access_token = code;
            cloudtoken.code = JSON.stringify(cloudTokenCode);
            cloudtoken.save((err) => console.log(err));
          }

          const { docs } = req.body;
          const { dir } = req.body;
          const { compressPdf } = req.body;

          oAuth2Client.setCredentials(cloudTokenCode);

          async.each(docs, (doc, callback) => {
            try {
              doc.name = replaceAll(doc.name, '/', '-');
              googleDownloadFile(oAuth2Client, doc, (err, file) => {
                if (err) { return callback(err); }
                ipfs.addFile(req.user, file, {
                  fileinputname: doc.name.split('.').slice(0, -1).join('.'),
                  dir,
                  compressPdf,
                }, (ipfsId) => {
                  req.flash('success_msg', 'Fichiers téléchargés');
                  TrackedEvent.createTrackedEvent('Upload', ipfsId, req.user.id, (err, event) => {
                    callback();
                  });
                });
              });
            } catch (err) { callback(err); }
          }, (err) => {
            if (err) {
              console.error(err);
              return res.render('cloud-storage', { layout: false, errors: [{ msg: JSON.stringify(err) }] });
            }
            return res.render('cloud-storage', { layout: false, uploadFinished: true });
          });
        });
      });
    });
  } else if (req.query.provider == 'microsoft') {
    const { docs } = req.body;
    const { dir } = req.body;
    const { compressPdf } = req.body;

    async.each(docs.value, (doc, callback) => {
      try {
        doc.name = replaceAll(doc.name, '/', '-');
        oneDriveDownloadFile(doc, (err, file) => {
          if (err) { return callback(err); }
          ipfs.addFile(req.user, file, {
            fileinputname: doc.name.split('.').slice(0, -1).join('.'),
            dir,
            compressPdf,
          }, (ipfsId) => {
            req.flash('success_msg', 'Fichiers téléchargés');
            TrackedEvent.createTrackedEvent('Upload', ipfsId, req.user.id, (err, event) => {
              callback();
            });
          });
        });
      } catch (err) { callback(err); }
    }, (err) => {
      if (err) {
        console.error(err);
        return res.render('cloud-storage', { layout: false, errors: [{ msg: JSON.stringify(err) }] });
      }
      console.log('all files downloaded');
      return res.render('cloud-storage', { layout: false, uploadFinished: true });
    });
  } else if (req.query.provider == 'dropbox') {
    const { docs } = req.body;
    const { dir } = req.body;
    const { compressPdf } = req.body;

    async.each(docs, (doc, callback) => {
      try {
        doc.name = replaceAll(doc.name, '/', '-');
        dropboxDownloadFile(doc, (err, file) => {
          if (err) { return callback(err); }
          ipfs.addFile(req.user, file, {
            fileinputname: doc.name.split('.').slice(0, -1).join('.'),
            dir,
            compressPdf,
          }, (ipfsId) => {
            req.flash('success_msg', 'Fichiers téléchargés');
            TrackedEvent.createTrackedEvent('Upload', ipfsId, req.user.id, (err, event) => {
              callback();
            });
          });
        });
      } catch (err) { callback(err); }
    }, (err) => {
      if (err) {
        console.error(err);
        return res.render('cloud-storage', { layout: false, errors: [{ msg: JSON.stringify(err) }] });
      }
      console.log('all files downloaded');
      return res.render('cloud-storage', { layout: false, uploadFinished: true });
    });
  } else res.status(400).send('provider is required');
});

router.get('/onedrive', ensureAuthenticated, (req, res) => res.render('cloud-storage-onedrive', { layout: false }));

router.get('/dropbox', ensureAuthenticated, (req, res) => res.render('cloud-storage-dropbox', { layout: false }));

function googleDownloadFile(auth, f, callback) {
  const drive = google.drive({ version: 'v3', auth });
  const fileId = f.id;
  const path = `${publicPath + Date.now()}-${f.name}`;
  const dest = fs.createWriteStream(path);
  const file = {
    path,
    destination: publicPath,
    originalname: f.name,
    filename: f.name,
    size: f.sizeBytes,
    mimetype: f.mimeType,
  };

  // File is downloadable
  // if (f.sizeBytes > 0) {
  drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' },
    (err, res) => {
      if (err) {
        streamToString(err.response.data, (errString) => {
          const errObj = JSON.parse(errString);
          console.log(errObj);
          return callback(errObj.error.message, null);
        });
      } else {
        res.data
          .on('end', () => {
            callback(null, file);
          })
          .on('error', (err) => {
            callback(`Erreur lors du téléchargement: ${err}`, file);
          })
          .pipe(dest);
      }
    },
  );
  // }
  // else {
  // 	// File is not downloadable, use export instead
  // 	drive.files.export({ fileId: fileId, alt: 'media', mimeType: f.mimeType }, { responseType: 'stream' },
  // 		function (err, res) {
  // 			if (err) {
  // 				console.log(err);
  // 				return callback(err, null);
  // 			}
  // 			res.data
  // 				.on('end', () => {
  // 					console.log('Done');
  // 					callback(null, file);
  // 				})
  // 				.on('error', err => {
  // 					console.log('Error during download', err);
  // 					callback('Error during download' + err, file);
  // 				})
  // 				.pipe(dest);
  // 		});
  // }
}

function oneDriveDownloadFile(f, callback) {
  const path = `${publicPath + Date.now()}-${f.name}`;
  const dest = fs.createWriteStream(path);
  const file = {
    path,
    destination: publicPath,
    originalname: f.name,
    filename: f.name,
    size: f.size,
  };

  https.get(f['@microsoft.graph.downloadUrl'], (res) => {
    if (res.statusCode !== 200) {
      return callback(res.statusCode.toString(), file);
    }

    file.mimetype = res.headers['content-type'];

    res
      .on('end', () => {
        callback(null, file);
      })
      .on('error', (err) => {
        callback(`Erreur lors du téléchargement: ${err}`, file);
      })
      .pipe(dest);
  });
}

function dropboxDownloadFile(f, callback) {
  const path = `${publicPath + Date.now()}-${f.name}`;
  const dest = fs.createWriteStream(path);
  const file = {
    path,
    destination: publicPath,
    originalname: f.name,
    filename: f.name,
    size: f.bytes,
  };

  https.get(f.link, (res) => {
    if (res.statusCode !== 200) {
      return callback(res.statusCode.toString(), file);
    }

    file.mimetype = res.headers['content-type'];

    res
      .on('end', () => {
        callback(null, file);
      })
      .on('error', (err) => {
        callback(`Erreur lors du téléchargement: ${err}`, file);
      })
      .pipe(dest);
  });
}

function streamToString(stream, cb) {
  const chunks = [];
  stream.on('data', (chunk) => {
    chunks.push(chunk.toString());
  });
  stream.on('end', () => {
    cb(chunks.join(''));
  });
}

function replaceAll(s, search, replace) {
  return s.split(search).join(replace);
}

module.exports = router;
