require('dotenv').config();
const express = require('express');
const http = require('http');
const io = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const socketIO = io(server);

const NAFIJ_DIR = path.join(__dirname, 'NAFIJ');
const NAFIJ_JSON = path.join(NAFIJ_DIR, 'nafij.json');

// Ensure necessary folders and files exist
if (!fs.existsSync(NAFIJ_DIR)) fs.mkdirSync(NAFIJ_DIR);
if (!fs.existsSync(NAFIJ_JSON)) fs.writeFileSync(NAFIJ_JSON, JSON.stringify([]));

// Serve static files
app.use(express.static(NAFIJ_DIR));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, NAFIJ_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

// Route for file uploads
app.post('/upload', upload.single('file'), (req, res) => {
  const fileUrl = `/NAFIJ/${req.file.filename}`; // Adjusted file path
  const messageData = {
    sender: 'System',
    message: `File uploaded: ${req.file.filename}`,
    fileUrl,
    timestamp: new Date().toISOString(),
  };

  // Save to nafij.json
  const chatHistory = JSON.parse(fs.readFileSync(NAFIJ_JSON, 'utf-8'));
  chatHistory.push(messageData);
  fs.writeFileSync(NAFIJ_JSON, JSON.stringify(chatHistory, null, 2));

  res.json({ fileUrl });
});

// Socket.IO logic
socketIO.on('connection', (socket) => {
  console.log('A user connected');

  // Send chat history on connection
  const chatHistory = JSON.parse(fs.readFileSync(NAFIJ_JSON, 'utf-8'));
  socket.emit('load messages', chatHistory);

  // Handle new messages
  socket.on('private message', (data) => {
    const newMessage = {
      sender: data.sender,
      message: data.message,
      timestamp: new Date().toISOString(),
    };

    // Save to nafij.json
    const chatHistory = JSON.parse(fs.readFileSync(NAFIJ_JSON, 'utf-8'));
    chatHistory.push(newMessage);
    fs.writeFileSync(NAFIJ_JSON, JSON.stringify(chatHistory, null, 2));

    // Broadcast message to all clients
    socketIO.emit('private message', newMessage);
  });

  // Handle file uploads
  socket.on('file uploaded', (data) => {
    const fileMessage = {
      sender: data.sender,
      message: `File uploaded: <a href="${data.fileUrl}" target="_blank">${data.fileName}</a>`,
      fileUrl: data.fileUrl,
      timestamp: new Date().toISOString(),
    };

    // Save to nafij.json
    const chatHistory = JSON.parse(fs.readFileSync(NAFIJ_JSON, 'utf-8'));
    chatHistory.push(fileMessage);
    fs.writeFileSync(NAFIJ_JSON, JSON.stringify(chatHistory, null, 2));

    // Broadcast file message
    socketIO.emit('private message', fileMessage);
  });

  socket.on('disconnect', () => console.log('User disconnected'));
});

const PRIVATE_PORT = process.env.PRIVATE_PORT || 8081;
server.listen(PRIVATE_PORT, () => console.log(`🚀 Private chat server running on port ${PRIVATE_PORT}`));
