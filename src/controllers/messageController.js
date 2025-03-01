const Message = require('../models/Message');

// Get all messages
exports.getMessages = async (req, res) => {
  try {
    const { limit = 50, phoneNumber } = req.query;
    
    let query = {};
    if (phoneNumber) {
      query.phoneNumber = phoneNumber;
    }
    
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
      
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Get message by ID
exports.getMessageById = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json(message);
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
};

// Create a new message (for testing purposes)
exports.createMessage = async (req, res) => {
  try {
    const { messageId, phoneNumber, content } = req.body;
    
    if (!messageId || !phoneNumber || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newMessage = new Message({
      messageId,
      phoneNumber,
      content,
      timestamp: new Date(),
      responseStatus: 'Pending'
    });
    
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
};

// Update message status
exports.updateMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { responseStatus } = req.body;
    
    if (!responseStatus || !['Pending', 'Responded'].includes(responseStatus)) {
      return res.status(400).json({ error: 'Invalid response status' });
    }
    
    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { responseStatus },
      { new: true }
    );
    
    if (!updatedMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    res.json(updatedMessage);
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ error: 'Failed to update message status' });
  }
};