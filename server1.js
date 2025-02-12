require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const NAFIJ_DIR = path.join(__dirname, 'NAFIJ');
if (!fs.existsSync(NAFIJ_DIR)) fs.mkdirSync(NAFIJ_DIR);

app.use(express.static('public'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, NAFIJ_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `/NAFIJ/${req.file.filename}`;
  res.json({ fileUrl, fileName: req.file.filename });
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join private', (data) => {
    const { roomId, username } = data;
    socket.join(roomId);

    const roomFile = path.join(NAFIJ_DIR, `nafij_${roomId}.json`);
    if (!fs.existsSync(roomFile)) fs.writeFileSync(roomFile, JSON.stringify([]));

    socket.emit('room joined', { roomId });

    const messages = JSON.parse(fs.readFileSync(roomFile, 'utf-8'));
    socket.emit('load messages', messages);
  });

  socket.on('private message', (data) => {
    const { roomId, sender, message } = data;
    if (!roomId || !message) return;

    const roomFile = path.join(NAFIJ_DIR, `nafij_${roomId}.json`);
    const newMessage = { sender, message, timestamp: new Date().toISOString() };

    const messages = JSON.parse(fs.readFileSync(roomFile, 'utf-8'));
    messages.push(newMessage);
    fs.writeFileSync(roomFile, JSON.stringify(messages, null, 2));

    io.to(roomId).emit('private message', newMessage);
  });

  socket.on('file uploaded', (data) => {
    const { roomId, sender, fileUrl, fileName } = data;
    if (!roomId || !fileUrl) return;

    const roomFile = path.join(NAFIJ_DIR, `nafij_${roomId}.json`);
    const fileMessage = {
      sender,
      message: `File: <a href="${fileUrl}" target="_blank">${fileName}</a>`,
      timestamp: new Date().toISOString(),
    };

    const messages = JSON.parse(fs.readFileSync(roomFile, 'utf-8'));
    messages.push(fileMessage);
    fs.writeFileSync(roomFile, JSON.stringify(messages, null, 2));

    io.to(roomId).emit('private message', fileMessage);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PRIVATE_PORT || 8081;
server.listen(PORT, () => console.log(`🚀 Private chat server running on port ${PORT}`));

