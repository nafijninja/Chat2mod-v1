require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const io = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express(); // Initialize express app
const server = http.createServer(app); // Create HTTP server
const socketIO = io(server); // Initialize Socket.IO

// Ensure NAFIJ directory exists
const NAFIJ_DIR = path.join(__dirname, 'NAFIJ');
if (!fs.existsSync(NAFIJ_DIR)) {
  fs.mkdirSync(NAFIJ_DIR);
}

// Ensure nafij.json file exists
const MESSAGES_FILE = path.join(NAFIJ_DIR, 'nafij.json');
if (!fs.existsSync(MESSAGES_FILE)) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
}

// Connect to MongoDB
mongoose.set('strictQuery', false); // Suppress deprecation warning
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB Connected (Private Chat)'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Serve static files
app.use(express.static('public'));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, NAFIJ_DIR); // Save files to NAFIJ folder
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

// Route to fetch messages
app.get('/messages', (req, res) => {
  const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
  res.json(messages);
});

// Socket.IO logic
socketIO.on('connection', (socket) => {
  console.log('A user connected');

  // Join a private room
  socket.on('join private', async (data) => {
    const { roomId, username } = data;
    socket.join(roomId);

    // Add user to the room in the database (optional)
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
    const message = {
      sender: data.sender,
      message: data.message,
      timestamp: new Date().toISOString(),
    };

    // Save message to nafij.json
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    messages.push(message);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));

    // Broadcast the message to the room
    socketIO.to(data.roomId).emit('private message', message);
  });

  // Handle file uploads
  socket.on('file uploaded', (data) => {
    const fileMessage = {
      sender: data.sender,
      message: `File uploaded: <a href="${data.fileUrl}" target="_blank">${data.fileName}</a>`,
      timestamp: new Date().toISOString(),
    };

    // Save file message to nafij.json
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    messages.push(fileMessage);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));

    // Broadcast the file message to the room
    socketIO.to(data.roomId).emit('private message', fileMessage);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Route to fetch messages
app.get('/messages', (req, res) => {
  const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
  res.json(messages);
});
                                
// Start the server
const PRIVATE_PORT = process.env.PRIVATE_PORT || 8081;
server.listen(PRIVATE_PORT, () => {
  console.log(`🚀 Private chat server is running on port ${PRIVATE_PORT}`);
});
