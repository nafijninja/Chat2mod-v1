require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const path = require('path');

const app = express();

// Connect to MongoDB
mongoose.set('strictQuery', false); // Suppress deprecation warning
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Room Schema
const roomSchema = new mongoose.Schema({
  roomId: String,
  users: [String], // List of usernames in the room
});

const Room = mongoose.model('Room', roomSchema);

// Serve static files
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

// Route for file uploads
app.post('/upload', upload.single('file'), (req, res) => {
  const fileUrl = `https://chatv1.up.railway.app/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('A user connected');

  // Join a private room
  socket.on('join private', async (data) => {
    const { roomId, username } = data;
    socket.join(roomId);

    // Add user to the room in the database
    let room = await Room.findOne({ roomId });
    if (!room) {
      room = new Room({ roomId, users: [username] });
    } else {
      room.users.push(username);
    }
    await room.save();

    socket.emit('private status', `Joined private room: ${roomId}`);
  });

  // Send a private message
  socket.on('private message', (data) => {
    io.to(data.roomId).emit('private message', {
      sender: data.sender,
      message: data.message,
    });
  });

  // Handle file uploads
  socket.on('file uploaded', (data) => {
    io.to(data.roomId).emit('private message', {
      sender: data.sender,
      message: `File uploaded: <a href="${data.fileUrl}" target="_blank">${data.fileName}</a>`,
    });
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
const PRIVATE_PORT = process.env.PRIVATE_PORT || 8081;
http.listen(PRIVATE_PORT, () => {
  console.log(`🚀 Private chat server is running on port ${PRIVATE_PORT}`);
});
