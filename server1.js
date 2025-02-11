const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static('NAFIJ'));

// Load previous messages from the file
const PRIVATE_CHAT_FILE = path.join(__dirname, 'NAFIJ', 'private_messages.json');

function loadPrivateMessages() {
    if (!fs.existsSync(PRIVATE_CHAT_FILE)) return [];
    return JSON.parse(fs.readFileSync(PRIVATE_CHAT_FILE, 'utf8'));
}

function savePrivateMessages(messages) {
    fs.writeFileSync(PRIVATE_CHAT_FILE, JSON.stringify(messages, null, 2));
}

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Private Chat User Connected:', socket.id);

    // Send previous messages to the new user
    socket.emit('previous messages', loadPrivateMessages());

    // Handle private messages
    socket.on('private message', (msg) => {
        let messages = loadPrivateMessages();
        messages.push(msg);
        savePrivateMessages(messages);
        io.emit('private message', msg);  // Broadcast to all users
    });

    socket.on('disconnect', () => {
        console.log('Private Chat User Disconnected:', socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`Private Chat Server running on http://localhost:${PORT}`);
});
