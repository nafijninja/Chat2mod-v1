const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Serve static files (for example, uploaded files)
app.use('/NAFIJ', express.static(path.join(__dirname, 'NAFIJ')));

// To allow all methods (GET, POST, PUT, DELETE, etc.)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle chat room messages
app.get('/getMessages/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const filePath = path.join(__dirname, 'NAFIJ', `nafij${roomId}.json`);

  // Check if the room file exists
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    const messages = JSON.parse(data);
    res.json(messages);
  } else {
    // If the file doesn't exist, return an empty array
    res.json([]);
  }
});

// Handle sending messages
app.post('/sendMessage/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const { message, files, timestamp } = req.body;
  const filePath = path.join(__dirname, 'NAFIJ', `nafij${roomId}.json`);

  // Prepare message data
  const newMessage = {
    message: message || "",
    files: files || "",
    timestamp: timestamp || new Date().toLocaleString()
  };

  let messages = [];
  
  // Check if room file exists and read it
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    messages = JSON.parse(data);
  }

  // Add the new message
  messages.push(newMessage);

  // Save the messages back to the file
  fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));

  res.status(200).json({ status: 'Message sent successfully' });
});

// Server listening
const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
