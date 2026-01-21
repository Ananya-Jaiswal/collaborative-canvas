const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

// =======================
// SERVE FRONTEND
// =======================
const CLIENT_PATH = path.join(__dirname, "../client");
app.use(express.static(CLIENT_PATH));

app.get("*", (_, res) => {
  res.sendFile(path.join(CLIENT_PATH, "index.html"));
});


// =======================
// SERVER + SOCKET.IO
// =======================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// =======================
// AUTHORITATIVE STATE
// =======================
const history = [];
const redoStack = [];

// =======================
// SOCKET LOGIC
// =======================
io.on("connection", socket => {
  console.log("User connected:", socket.id);

  // ----- LIVE DRAW PREVIEW -----
  socket.on("stroke:start", data => {
    socket.broadcast.emit("stroke:start", data);
  });

  socket.on("stroke:point", data => {
    socket.broadcast.emit("stroke:point", data);
  });

  // ----- COMMIT STROKE -----
  socket.on("stroke:commit", stroke => {
    history.push({ type: "stroke", data: stroke });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // ----- ERASE (SINGLE STROKE) -----
  socket.on("erase:stroke", ({ strokeId }) => {
    history.push({ type: "erase-stroke", data: { strokeId } });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // ----- ERASE (MULTIPLE STROKES) -----
  socket.on("erase:strokes", ({ strokeIds }) => {
    history.push({
      type: "erase-strokes",
      data: { strokeIds }
    });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // ----- LIVE ERASE PREVIEW -----
  socket.on("erase:preview", data => {
    socket.broadcast.emit("erase:preview", data);
  });

  socket.on("erase:preview:end", () => {
    socket.broadcast.emit("erase:preview:end");
  });

  // ----- CLEAR CANVAS -----
  socket.on("canvas:clear", () => {
    history.push({ type: "clear" });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // ----- GLOBAL UNDO -----
  socket.on("undo:request", () => {
    if (!history.length) return;
    redoStack.push(history.pop());
    io.emit("history:update", history);
  });

  // ----- GLOBAL REDO -----
  socket.on("redo:request", () => {
    if (!redoStack.length) return;
    history.push(redoStack.pop());
    io.emit("history:update", history);
  });

  // ----- CURSOR PRESENCE -----
  socket.on("cursor:move", data => {
    socket.broadcast.emit("cursor:update", {
      socketId: socket.id,
      x: data.x,
      y: data.y,
      color: data.color
    });
  });

  // ----- DISCONNECT (SINGLE SOURCE) -----
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    socket.broadcast.emit("cursor:leave", {
      socketId: socket.id
    });
  });
});

// =======================
// START SERVER (RENDER SAFE)
// =======================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
