const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.set("strictQuery", false);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Group Schema
const groupSchema = new mongoose.Schema({
  groupCode: String,
  createdAt: { type: Date, default: Date.now },
});

const Group = mongoose.model("Group", groupSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  groupCode: String,
  user: String,
  text: String,
  fileUrl: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", messageSchema);

// ✅ API: Create a Group
app.post("/create-group", async (req, res) => {
  const { groupCode } = req.body;

  if (!groupCode) return res.status(400).json({ error: "Group code required" });

  const existingGroup = await Group.findOne({ groupCode });
  if (existingGroup) return res.status(400).json({ error: "Group already exists" });

  const newGroup = new Group({ groupCode });
  await newGroup.save();
  res.json({ message: "Group created successfully", groupCode });
});

// ✅ API: Join a Group
app.post("/join-group", async (req, res) => {
  const { groupCode } = req.body;

  if (!groupCode) return res.status(400).json({ error: "Group code required" });

  const group = await Group.findOne({ groupCode });
  if (!group) return res.status(404).json({ error: "Group not found" });

  res.json({ message: "Joined group successfully", groupCode });
});

// ✅ API: Get Messages for a Group
app.get("/messages/:groupCode", async (req, res) => {
  const messages = await Message.find({ groupCode: req.params.groupCode });
  res.json(messages);
});

// ✅ SOCKET.IO HANDLING
io.on("connection", (socket) => {
  console.log("⚡ New user connected");

  socket.on("joinGroup", (groupCode) => {
    socket.join(groupCode);
    console.log(`User joined group: ${groupCode}`);
  });

  socket.on("chatMessage", async (data) => {
    const { groupCode, user, text } = data;
    if (!groupCode || !user || !text) return;

    const message = new Message({ groupCode, user, text });
    await message.save();

    io.to(groupCode).emit("chatMessage", message);
  });

  socket.on("disconnect", () => {
    console.log("⚡ User disconnected");
  });
});

// Start Server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
