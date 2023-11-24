const nodemailer = require('nodemailer');

module.exports.sendMail = function (to, subject, html, name, attachments, callback, from) {
  const transporter = nodemailer.createTransport({
    pool: true,
    host: 'mail.gandi.net',
    port: 465,
    secure: true, // use TLS
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PWD,
    },
  }); // setup email data with unicode symbols
  const mailOptions = {
    from: `${name || 'Fiduce'} ${from || '<login@fiduce.net>'}`, // sender address
    to, // list of receivers
    subject, // Subject line
    html, // html body
    attachments,
  };

  // send mail with defined transport object
  transporter.sendMail(mailOptions, callback);
};
