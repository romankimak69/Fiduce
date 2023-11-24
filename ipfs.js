// const ipfsSettings = { host: 'ipfs.infura.io', port: 5001, protocol: 'https' };
const ipfsSettings = {
  host: (process.env.IPFS_HOST || 'localhost'),
  port: (process.env.IPFS_PORT || 5001),
  protocol: (process.env.IPFS_PROTOCOL || 'http'),
};

const ipfsClient = require('ipfs-http-client');
const fs = require('fs');
const { exec } = require('child_process');
const randomstring = require('randomstring');

const Jimp = require('jimp');

const async = require('async');

// Nodejs encryption with CTR
const crypto = require('crypto');
const path = require('path');
const File = require('./models/file');
const {
  compressPdf,
  allowedExtensionsForConvertToPdf,
} = require('./utils/pdf-tools');

module.exports.addFile = (user, file, options, callback) => {
  const key = randomstring.generate();
  module.exports.compress(options, file, (data) => {
    this.ipfs = new ipfsClient(ipfsSettings);
    const encrypted = encrypt(key, Buffer.from(data)
      .toString('base64'));

    this.ipfs.add(Buffer.from(encrypted), {
      progress: (prog) => console.log(`received: ${prog}`),
    })
      .then((response) => {
        console.log(response);
        if (!response) return;
        ipfsId = response.path;
        const newFile = File({
          hash: ipfsId,
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          owner: user.id,
          name: options.fileinputname,
          dir: options.dir,
          date: new Date().getTime(),
          key,
          extension: file.originalname.split('.')[file.originalname.split('.').length - 1],
          signed: (options.signed == 'true'),
        });

        File.createFile(newFile, (err, fileObj) => {
          if (err) throw err;

          callback(fileObj.id);
        });

        this.ipfs.pin.add(ipfsId);
      })
      .catch((err) => {
        console.error(err);
      });
  });
};

// module.exports.addFile = function (req, callback) {
//   const file = req.file;
//   const key = randomstring.generate();
//   module.exports.compress(req, file, function (data) {
//     this.ipfs = new ipfsClient(ipfsSettings);;
//     let encrypted = encrypt(key, Buffer.from(data).toString('base64'));
//     this.ipfs.add(Buffer.from(encrypted), {
//       progress: (prog) => console.log(`received: ${prog}`),
//     }).then((response) => {
//       console.log(response);
//       if (!response)
//         return;
//       ipfsId = response.path;
//       var newFile;
//       if (req.body.signed == "true") {
//         console.log("signing");
//         newFile = File({
//           hash: ipfsId,
//           filename: file.originalname,
//           size: file.size,
//           mimetype: file.mimetype,
//           owner: req.user.id,
//           name: req.body.fileinputname,
//           dir: req.body.dir,
//           date: new Date().getTime(),
//           key: key,
//           extension: file.originalname.split(".")[file.originalname.split(".").length - 1],
//           signed: true
//         });
//       } else {
//         newFile = File({
//           hash: ipfsId,
//           filename: file.originalname,
//           size: file.size,
//           mimetype: file.mimetype,
//           owner: req.user.id,
//           name: req.body.fileinputname,
//           dir: req.body.dir,
//           date: new Date().getTime(),
//           key: key,
//           extension: file.originalname.split(".")[file.originalname.split(".").length - 1]
//         });
//       }
//       File.createFile(newFile, function (err, file) {
//         if (err)
//           throw err;

//         callback(file.id);
//       });

//       this.ipfs.pin.add(ipfsId)
//         .then(cid => {
//           console.log(`${cid[0].hash} has been pined`);
//         })
//         .catch((err) => console.log(err));
//     }).catch((err) => {
//       console.error(err)
//     })
//   });

// }

// module.exports.compressImage = function (file, cb) {
//   Jimp.read(file.path, function (err, lenna) {
//     if (err)
//       throw err;
//     lenna.quality(20).write(file.path); // save
//     console.log("COMPRESSED SCANNED FILE");
//     cb(fs.readFileSync(file.path));
//   });

// }

module.exports.compress = function (options, file, callback) {
  if (options.scan == 'true') {
    Jimp.read(file.path, (err, lenna) => {
      if (err) throw err;
      lenna.quality(20)
        .write(file.path); // save
      console.log('COMPRESSED SCANNED FILE');
      callback(fs.readFileSync(file.path));
    });
  } else if (file.mimetype == 'application/pdf' && options.compressPdf == 'true') {
    compressPdf(file.filename)
      .then(() => callback(fs.readFileSync(`${file.destination}compressed/${file.filename}`)));
  } else {
    callback(fs.readFileSync(file.path));
  }
};

function getf(hash, callback) {
  const ipfsvar = new ipfsClient(ipfsSettings);

  File.getFilebyID(hash, async (err, val) => {
    for await (const file of ipfsvar.get(val.hash)) {
      if (!file.content) continue;

      const content = [];

      for await (const chunk of file.content) {
        content.push(chunk._bufs[0]);
      }

      decrypt(val.key, Buffer.concat(content)
        .toString('utf8'), (decrypted) => {
        const data = Buffer.from(decrypted, 'base64');
        callback(err, data);
      });
    }

    // ipfsvar.get(val.hash, function (err, files) {
    //   files.forEach((file) => {
    //     decrypt(val.key, file.content.toString('utf8'), function (decrypted) {
    //       let data = Buffer.from(decrypted, 'base64');
    //       callback(err, data);
    //     });
    //   })
    // });
  });
}

module.exports.getFile = function (hash, callback) {
  getf(hash, callback);
};

const supportedFileIcons = {
  doc: true,
  docx: true,
  jpg: true,
  jpeg: true,
  pdf: true,
  png: true,
  rtf: true,
  txt: true,
  xls: true,
  xlsx: true,
  xml: true,
};

module.exports.setFileIcon = function (file) {
  const fileData = file.toObject();
  fileData.icon = file.extension in supportedFileIcons ? file.extension : 'file';
  fileData.canConvertToPdf = allowedExtensionsForConvertToPdf.indexOf(file.extension) >= 0;
  fileData.id = fileData._id;
  return fileData;
};

module.exports.getFiles = function (array, newarray) {
  return new Promise((resolve, reject) => {
    const ipfsvar = new ipfsClient(ipfsSettings);
    const newFiles = {};

    async.each(array, async (item, callback) => {
      console.log('getting item:', item);

      for await (const file of ipfsvar.get(item.hash)) {
        console.log(file.path);

        if (!file.content) continue;

        const content = [];

        for await (const chunk of file.content) {
          content.push(chunk._bufs[0]);
        }

        decrypt(item.key, Buffer.concat(content)
          .toString('utf8'), (decrypted) => {
          const base64 = {
            baseimg: decrypted,
            id: item.id,
            name: item.name,
            extension: item.extension,
            signed: item.signed,
          };
          newFiles[item.hash] = base64;
        });
      }
      // let files = ipfsvar.get(item.hash, { timeout: 30000 });
      // ipfsvar
      //   .get(item.hash, { timeout: 30000 })
      //   .then(files => {
      //     console.log(files);
      //     if (err)
      //       return callback(err);
      //     files.forEach((file) => {
      //       console.log(file);
      //       decrypt(item.key, file.content.toString('utf8'), function (decrypted) {
      //         var base64 = {
      //           baseimg: decrypted,
      //           id: item.id,
      //           name: item.name,
      //           extension: item.extension,
      //           signed: item.signed
      //         };
      //         newFiles[item.hash] = base64;
      //         callback();
      //       });
      //     })
      //   })
      //   .catch(err => {
      //     console.log(err);
      //   });
    }, (err) => {
      if (err) {
        console.error(err.message);
      } else {
        setImmediate((arg) => {
          resolve(array.map((f) => newFiles[f.hash]));
        }, 'so immediate');
      }
    });
  });
};

function encrypt(key, data) {
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let crypted = cipher.update(data, 'utf-8', 'hex');
  crypted += cipher.final('hex');

  return crypted;
}

function decrypt(key, data, callback) {
  const decipher = crypto.createDecipher('aes-256-cbc', key);
  let decrypted = decipher.update(data, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  callback(decrypted);
}
