require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const path = require('path');

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schemas
const userSchema = new mongoose.Schema({
  username: String,
  profilePicture: String,
});

const messageSchema = new mongoose.Schema({
  roomId: String,
  sender: String,
  message: String,
  reactions: [String],
  isEdited: Boolean,
  isDeleted: Boolean,
  readBy: [String],
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

// Routes
app.post('/upload', upload.single('file'), (req, res) => {
  const fileUrl = `http://localhost:8081/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('A user connected');

  // Join a private room
  socket.on('join private', async (data) => {
    const { roomId, username } = data;
    socket.join(roomId);
    socket.emit('private status', `Joined private room: ${roomId}`);
  });

  // Send a private message
  socket.on('private message', async (data) => {
    const message = new Message({
      roomId: data.roomId,
      sender: data.sender,
      message: data.message,
    });
    await message.save();

    io.to(data.roomId).emit('private message', message);
  });

  // Message reactions
  socket.on('react to message', async (data) => {
    const { messageId, reaction } = data;
    const message = await Message.findById(messageId);
    message.reactions.push(reaction);
    await message.save();

    io.to(data.roomId).emit('message reacted', { messageId, reaction });
  });

  // Typing indicators
  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('user typing', { username: data.username });
  });

  // Edit message
  socket.on('edit message', async (data) => {
    const { messageId, newMessage } = data;
    const message = await Message.findById(messageId);
    message.message = newMessage;
    message.isEdited = true;
    await message.save();

    io.to(data.roomId).emit('message edited', { messageId, newMessage });
  });

  // Delete message
  socket.on('delete message', async (data) => {
    const { messageId } = data;
    const message = await Message.findById(messageId);
    message.isDeleted = true;
    await message.save();

    io.to(data.roomId).emit('message deleted', { messageId });
  });

  // Read receipts
  socket.on('mark as read', async (data) => {
    const { messageId, username } = data;
    const message = await Message.findById(messageId);
    message.readBy.push(username);
    await message.save();

    io.to(data.roomId).emit('message read', { messageId, username });
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

app.get('/private', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'private.html'));
    });
  
// Start the server
const PRIVATE_PORT = process.env.PRIVATE_PORT || 8081;
http.listen(PRIVATE_PORT, () => {
  console.log(`🚀 Private chat server is running on port ${PRIVATE_PORT}`);
});
