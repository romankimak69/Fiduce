const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const handl = require('express-handlebars');
const expressValidator = require('express-validator');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mongo = require('mongodb');
const mongoose = require('mongoose');
const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access');
const Handlebars = require('handlebars');
const IPFS = require('./ipfs.js');
const tasks = require('./tasks');

const { fulfillPackages } = require('./models/packages');

mongoose.connect(
  process.env.MONGO_URL,
  {
    bufferCommands: true,
    serverSelectionTimeoutMS: 5000,
  },
  (err) => {
    if (err) {
      console.log('error DB >> ', err);
    } else {
      console.log('>> success connexion Ok');
    }
    fulfillPackages();
  },
);
const db = mongoose.connection;

const routes = require('./routes/index');
const users = require('./routes/users');
const upload = require('./routes/upload');
const files = require('./routes/files');
const brokers = require('./routes/brokers');
const borrowers = require('./routes/borrowers');
const tokens = require('./routes/tokens');
const chat = require('./routes/chat');
const scan = require('./routes/scan');
const settings = require('./routes/settings');
const followup = require('./routes/followup');
const cloudstorage = require('./routes/cloud-storage');
const payments = require('./routes/payments');
const admin = require('./routes/admin');
const invoices = require('./routes/invoice');
const packages = require('./routes/packages');

// 404 Errors
const fourOfour = require('./routes/404');

// Init App
const app = express();

// If equals helper
const exphbs = handl.create({
  helpers: {
    ifCond(v1, v2, options) {
      if (v1 === v2) {
        return options.fn(this);
      }
      return options.inverse(this);
    },
    startsWith(text, testText, options) {
      if (!text) {
        return options.inverse(this);
      }
      if (!testText) {
        return options.fn(this);
      }
      if (text.startsWith(testText)) {
        return options.fn(this);
      }
      return options.inverse(this);
    },
    descShow(type, options) {
      if (type === 'Assureur') {
        return options.fn(this);
      }
      if (type === 'Organisme de caution') {
        return options.fn(this);
      }
      if (type === 'Courtier') {
        return options.fn(this);
      }
      if (type === 'Banquier') {
        return options.fn(this);
      }
      if (type === 'Notaire') {
        return options.fn(this);
      }
      if (type === 'Agent immobilier') {
        return options.fn(this);
      }
      if (type === 'Promoteur') {
        return options.fn(this);
      }
      return options.inverse(this);
    },
  },
  defaultLayout: 'layout',
  handlebars: allowInsecurePrototypeAccess(Handlebars),
});

// View Engine
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs.engine);

app.set('view engine', 'handlebars');

// BodyParser Middleware
app.use(bodyParser.json({
  limit: '50mb',
  verify: (req, res, buf, encoding) => {
    req.rawBody = buf.toString(encoding || 'utf8');
  },
  type: 'application/json',
  extended: false,
}));

app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: false,
}));

app.use(cookieParser());

// Set Static Folder
app.use(express.static(path.join(__dirname, 'public')));

// Express Session
app.use(session({
  secret: 'secret',
  saveUninitialized: true,
  cookie: { maxAge: 300000 },
  resave: true,
  rolling: true,
}));

// Passport init
app.use(passport.initialize());
app.use(passport.session());

// Express Validator
app.use(expressValidator({
  errorFormatter(param, msg, value) {
    const namespace = param.split('.');
    const root = namespace.shift();
    let formParam = root;

    while (namespace.length) {
      formParam += `[${namespace.shift()}]`;
    }
    return {
      param: formParam,
      msg,
      value,
    };
  },
}));

// Connect Flash
app.use(flash());

// Global Vars
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.currentYear = new Date().getFullYear();
  next();
});

app.use('/', routes);
app.use('/users', users);
app.use('/upload', upload);
app.use('/files', files);
app.use('/brokers', brokers);
app.use('/borrowers', borrowers);
app.use('/tokens', tokens);
app.use('/chat', chat);
app.use('/scan', scan);
app.use('/settings', settings);
app.use('/followup', followup);
app.use('/cloudstorage', cloudstorage);
app.use('/payments', payments);
app.use('/admin', admin);
app.use('/invoices', invoices);
app.use('/packages', packages);

app.use('/', fourOfour);

if (process.env.NODE_ENV !== 'production') {
  process.on('uncaughtException', (err) => {
    console.error('FATAL: Uncaught exception.');
    console.error(err.stack || err);
  });
}

module.exports = app;
