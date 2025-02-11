<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Group Chat</title>
  <style>
    /* Use your existing CSS styles here */
  </style>
</head>
<body>
  <div id="chat-container">
    <div id="messages"></div>
    <div id="input-area">
      <input type="text" id="message" placeholder="Type a message...">
      <button onclick="sendMessage()">Send</button>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const groupCode = window.location.pathname.split('/')[2];  // Get group code from URL
    const messagesDiv = document.getElementById('messages');

    // Join the group on connection
    socket.emit('join group', groupCode);

    socket.on('chat message', function(msg) {
      const messageElement = document.createElement('div');
      messageElement.classList.add('message');
      messageElement.innerHTML = `${msg.user}: ${msg.text}`;
      messagesDiv.appendChild(messageElement);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    function sendMessage() {
      const message = document.getElementById('message').value;
      if (message) {
        socket.emit('chat message', { groupCode, text: message });
        document.getElementById('message').value = '';
      }
    }
  </script>
</body>
</html>
