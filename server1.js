const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PRO_FOLDER = 'PRO';

// Ensure the PRO folder exists
if (!fs.existsSync(PRO_FOLDER)) {
    fs.mkdirSync(PRO_FOLDER);
}

// Set up file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, PRO_FOLDER);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ storage });

app.use(express.static(__dirname));
app.use(express.json());

// Handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const roomId = req.body.roomId;
    if (!roomId) return res.status(400).json({ error: 'Missing room ID' });

    const fileUrl = `/PRO/${req.file.filename}`;
    
    const fileData = {
        sender: "Anonymous",
        files: fileUrl,
        fileName: req.file.originalname,
        timestamp: format12Hour(Date.now())
    };

    saveMessage(roomId, fileData);
    io.to(roomId).emit('private message', fileData);

    res.json({ fileUrl });
});

// Helper function to format timestamps in 12-hour format
function format12Hour(timestamp) {
    let date = new Date(timestamp);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}

// Get the file path for a room
function getRoomFilePath(roomId) {
    return path.join(__dirname, PRO_FOLDER, `pro${roomId}.json`);
}

// Get messages from a room
function getMessages(roomId) {
    const filePath = getRoomFilePath(roomId);
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
        console.error('Error reading messages:', err);
        return [];
    }
}

// Save message to a room
function saveMessage(roomId, messageData) {
    const filePath = getRoomFilePath(roomId);
    let messages = getMessages(roomId);
    messages.push(messageData);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
}

io.on('connection', (socket) => {
    console.log('A user connected.');

    socket.on('create private', (data) => {
        const { roomId } = data;
        const filePath = getRoomFilePath(roomId);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify([], null, 2));
            console.log(`Room ${roomId} created.`);
        }
    });

    socket.on('join private', (data) => {
        const { roomId, username } = data;
        socket.join(roomId);

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

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});
