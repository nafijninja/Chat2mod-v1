require('dotenv').config(); // Load environment variables
const express = require('express');
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

// Socket.IO logic
socketIO.on('connection', (socket) => {
  console.log('A user connected');

  // Join a private room
  socket.on('join private', (data) => {
    const { roomId, username } = data;
    socket.join(roomId);

    // Create a JSON file for the room if it doesn't exist
    const roomFile = path.join(NAFIJ_DIR, `nafij_${roomId}.json`);
    if (!fs.existsSync(roomFile)) {
      fs.writeFileSync(roomFile, JSON.stringify([]));
    }

    // Emit room ID to the user
    socket.emit('room joined', { roomId });

    // Send existing messages to the user
    const messages = JSON.parse(fs.readFileSync(roomFile, 'utf-8'));
    socket.emit('load messages', messages);
  });

  // Send a private message
  socket.on('private message', (data) => {
    const { roomId, sender, message } = data;
    const roomFile = path.join(NAFIJ_DIR, `nafij_${roomId}.json`);

    const newMessage = {
      sender,
      message,
      timestamp: new Date().toISOString(),
    };

    // Save message to the room's JSON file
    const messages = JSON.parse(fs.readFileSync(roomFile, 'utf-8'));
    messages.push(newMessage);
    fs.writeFileSync(roomFile, JSON.stringify(messages, null, 2));

    // Broadcast the message to the room
    socketIO.to(roomId).emit('private message', newMessage);
  });

  // Handle file uploads
  socket.on('file uploaded', (data) => {
    const { roomId, sender, fileUrl, fileName } = data;
    const roomFile = path.join(NAFIJ_DIR, `nafij_${roomId}.json`);

    const fileMessage = {
      sender,
      message: `File uploaded: <a href="${fileUrl}" target="_blank">${fileName}</a>`,
      timestamp: new Date().toISOString(),
    };

    // Save file message to the room's JSON file
    const messages = JSON.parse(fs.readFileSync(roomFile, 'utf-8'));
    messages.push(fileMessage);
    fs.writeFileSync(roomFile, JSON.stringify(messages, null, 2));

    // Broadcast the file message to the room
    socketIO.to(roomId).emit('private message', fileMessage);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
const PRIVATE_PORT = process.env.PRIVATE_PORT || 8081;
server.listen(PRIVATE_PORT, () => {
  console.log(`🚀 Private chat server is running on port ${PRIVATE_PORT}`);
});
