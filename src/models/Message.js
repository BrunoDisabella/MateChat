const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  responseStatus: {
    type: String,
    enum: ['Pending', 'Responded'],
    default: 'Pending'
  }
});

module.exports = mongoose.model('Message', messageSchema);