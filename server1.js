const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;
const mongoURI = 'mongodb://localhost:27017/chat-app'; // Change this to your MongoDB URI

// MongoDB Models
const Group = require('./models/group');
const Message = require('./models/message');

// Middleware to serve static files (like your private.html)
app.use(express.static('public')); // Ensure your private.html is inside a folder named "public"

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error: ', err));

// Handle group creation
io.on('connection', (socket) => {
  let currentGroupCode = '';

  // Join group or create new group
  socket.on('join group', (groupCode, callback) => {
    Group.findOne({ code: groupCode }, (err, group) => {
      if (err || !group) {
        callback({ success: false });
      } else {
        socket.join(groupCode);
        currentGroupCode = groupCode;
        callback({ success: true });
      }
    });
  });

  socket.on('create group', (groupCode, callback) => {
    const newGroup = new Group({ code: groupCode });

    newGroup.save((err, savedGroup) => {
      if (err) {
        callback({ success: false });
      } else {
        socket.join(savedGroup.code);
        currentGroupCode = savedGroup.code;
        callback({ success: true });
      }
    });
  });

  // Handle sending chat messages
  socket.on('chat message', (data) => {
    const newMessage = new Message({
      text: data.text,
      groupCode: currentGroupCode,
      sender: socket.id, // Store socket id as sender
    });

    newMessage.save((err, savedMessage) => {
      if (err) return console.error('Message save error: ', err);
      
      // Emit the message to everyone in the group
      io.to(currentGroupCode).emit('chat message', {
        user: socket.id, // Sending socket id for simplicity; you can use a username
        text: data.text,
      });
    });
  });

  // Handle reactions
  socket.on('reaction', (reactionData) => {
    io.to(currentGroupCode).emit('reaction', {
      user: socket.id,
      reaction: reactionData.reaction,
    });
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.broadcast.to(currentGroupCode).emit('typing');
  });

  // Disconnecting from group
  socket.on('disconnect', () => {
    if (currentGroupCode) {
      socket.leave(currentGroupCode);
      console.log(`User disconnected from group: ${currentGroupCode}`);
    }
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
