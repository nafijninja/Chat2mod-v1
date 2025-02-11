const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB model for Group
const groupSchema = new mongoose.Schema({
  groupCode: { type: String, unique: true },
  members: [String]
});
const Group = mongoose.model('Group', groupSchema);

// Connect to MongoDB
mongoose.connect('mongodb://localhost/chatApp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Serve static files (your group chat HTML)
app.use(express.static('public'));

// Create a new group
io.on('connection', (socket) => {
  console.log('A user connected');

  // Listen for group creation requests
  socket.on('create group', async (groupCode) => {
    try {
      const existingGroup = await Group.findOne({ groupCode });

      if (existingGroup) {
        socket.emit('group creation failed', { message: 'Group code already exists!' });
        return;
      }

      // Create new group if the code doesn't exist
      const newGroup = new Group({ groupCode, members: [] });
      await newGroup.save();

      socket.emit('group creation success', { message: 'Group created successfully!', groupCode });

    } catch (error) {
      socket.emit('group creation failed', { message: 'Error creating the group!' });
      console.error(error);
    }
  });

  // Listen for join group requests
  socket.on('join group', async (groupCode) => {
    try {
      const group = await Group.findOne({ groupCode });

      if (!group) {
        socket.emit('group join failed', { message: 'Group does not exist!' });
        return;
      }

      // Add user to the group (you can use username to track users)
      const username = 'User' + socket.id;  // This is just a placeholder for user name
      group.members.push(username);
      await group.save();

      socket.join(groupCode);
      socket.emit('group join success', { message: 'Joined group successfully!', groupCode });

    } catch (error) {
      socket.emit('group join failed', { message: 'Error joining the group!' });
      console.error(error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start server
server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
