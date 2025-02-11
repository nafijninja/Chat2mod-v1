require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Group = require('./models/Group');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Handle message sending
io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('join group', (groupId) => {
    socket.join(groupId);
  });

  socket.on('send message', (data) => {
    const { groupId, text } = data;
    io.to(groupId).emit('chat message', { text });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Group creation and joining routes
app.post('/create-group', async (req, res) => {
  const { groupName, groupCode } = req.body;
  const group = new Group({ groupName, groupCode, users: [] });
  await group.save();
  res.json({ groupId: group._id });
});

app.post('/join-group', async (req, res) => {
  const { groupCode } = req.body;
  const group = await Group.findOne({ groupCode });

  if (!group) return res.status(404).json({ message: 'Group not found' });

  group.users.push('someUser');  // Modify to add real user
  await group.save();

  res.json({ groupId: group._id });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});

