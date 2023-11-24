const mongoose = require('mongoose');

const TrackedEventSchema = new mongoose.Schema({
  event: {
    type: String,
    index: true,
    text: true
  },
  description: {
    type: String
  },
  user: {
    type: String
  },
  date: {
    type: String
  }
});

const TrackedEvent = module.exports = mongoose.model('TrackedEvent', TrackedEventSchema);

module.exports.createTrackedEvent = function (name, desc, userid, callback) {
  const event = TrackedEvent({
    event: name,
    description: desc,
    user: userid,
    date: new Date().getTime()
  });
  console.log('Event: ' + name);
  event.save(callback);
};

module.exports.getAllEvents = function (id, callback) {
  TrackedEvent.find({ user: id }, callback);
};
