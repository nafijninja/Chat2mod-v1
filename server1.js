const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const CHAT_FOLDER = 'NAFIJ';

// Ensure the NAFIJ folder exists
if (!fs.existsSync(CHAT_FOLDER)) {
    fs.mkdirSync(CHAT_FOLDER);
}

// Set up file storage for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, CHAT_FOLDER);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ storage });

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// API to upload files
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/NAFIJ/${req.file.filename}`;
    res.json({ fileUrl });
});

// Helper function to format timestamp
function format12Hour(timestamp) {
    let date = new Date(timestamp);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}

// Function to get file path for a room
function getRoomFilePath(roomId) {
    return path.join(__dirname, CHAT_FOLDER, `nafij_${roomId}.json`);
}

// Function to read messages from JSON file
function getMessages(roomId) {
    const filePath = getRoomFilePath(roomId);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
        console.error('Error reading messages:', err);
        return [];
    }
}

// Function to save messages to JSON file
function saveMessage(roomId, messageData) {
    const filePath = getRoomFilePath(roomId);
    let messages = getMessages(roomId);
    messages.push(messageData);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
}

io.on('connection', (socket) => {
    console.log('A user connected to private chat.');

    socket.on('join private', (data) => {
        const { roomId, username } = data;
        socket.join(roomId);

        // Load previous messages (only from this room's specific JSON file)
        const messages = getMessages(roomId);
        socket.emit('load messages', messages);

        console.log(`${username} joined room ${roomId}`);
        io.to(roomId).emit('room joined', { roomId });
    });

    socket.on('private message', (data) => {
        const { roomId, sender, message } = data;
        const timestamp = format12Hour(Date.now());

        const messageData = { sender, message, timestamp };
        saveMessage(roomId, messageData);

        io.to(roomId).emit('private message', messageData);
    });

    socket.on('file uploaded', (data) => {
        const { roomId, sender, fileUrl, fileName } = data;
        const timestamp = format12Hour(Date.now());

        const fileData = { sender, files: fileUrl, fileName, timestamp };
        saveMessage(roomId, fileData);

        io.to(roomId).emit('private message', fileData);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected from private chat.');
    });
});

// Start the server
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Private chat server running on http://localhost:${PORT}`);
});
