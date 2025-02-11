const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB connection
mongoose.connect('mongodb://localhost/chat-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const groupSchema = new mongoose.Schema({
  groupId: { type: String, required: true, unique: true },
  name: String,
  members: [String],
  messages: [
    {
      user: String,
      text: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

const Group = mongoose.model('Group', groupSchema);

// Middleware for serving static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create a new group
app.post('/create-group', async (req, res) => {
  const groupId = generateGroupId(); // Generate a unique group ID
  const group = new Group({ groupId, name: `Group ${groupId}`, members: [] });
  await group.save();
  res.json({ groupId });
});

// Join an existing group
app.post('/join-group/:groupCode', async (req, res) => {
  const { groupCode } = req.params;
  const group = await Group.findOne({ groupId: groupCode });

  if (group) {
    res.json({ success: true, groupId: groupCode });
  } else {
    res.json({ success: false });
  }
});

// Fetch messages for a specific group
app.get('/group/:groupId/messages', async (req, res) => {
  const { groupId } = req.params;
  const group = await Group.findOne({ groupId });

  if (group) {
    res.json(group.messages);
  } else {
    res.status(404).json({ message: 'Group not found' });
  }
});

// Handle socket connections and messaging
io.on('connection', (socket) => {
  let currentGroupId = null;

  // When a user joins a group
  socket.on('join group', async ({ groupId, username }) => {
    currentGroupId = groupId;
    const group = await Group.findOne({ groupId });
    if (group) {
      group.members.push(username);
      await group.save();
      socket.join(groupId); // Join the specific room
      socket.emit('chat message', { user: 'System', text: `Welcome to ${group.name}`, timestamp: new Date() });
    }
  });

  // When a user creates a new group
  socket.on('create group', async ({ groupId, username }) => {
    const group = await Group.findOne({ groupId });
    if (!group) {
      const newGroup = new Group({ groupId, members: [username] });
      await newGroup.save();
      socket.join(groupId);
      socket.emit('chat message', { user: 'System', text: `Welcome to the new group ${groupId}`, timestamp: new Date() });
    }
  });

  // Handling chat messages
  socket.on('chat message', async ({ text, user, groupId }) => {
    const group = await Group.findOne({ groupId });
    if (group) {
      const message = { user, text, timestamp: new Date() };
      group.messages.push(message);
      await group.save();
      io.to(groupId).emit('chat message', message);
    }
  });

  // Handling file messages (Optional feature for file uploads)
  socket.on('file message', async ({ fileUrl, fileName, user, groupId }) => {
    const group = await Group.findOne({ groupId });
    if (group) {
      const message = { user, text: `<a href="${fileUrl}" target="_blank">${fileName}</a>`, timestamp: new Date() };
      group.messages.push(message);
      await group.save();
      io.to(groupId).emit('chat message', message);
    }
  });

  socket.on('disconnect', () => {
    if (currentGroupId) {
      socket.leave(currentGroupId);
    }
  });
});

// Helper function to generate a unique group ID
function generateGroupId() {
  return Math.random().toString(36).substr(2, 9); // Generates a random group ID
}

// Start the server
const port = 3000;
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
