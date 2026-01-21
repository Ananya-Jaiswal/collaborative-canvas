const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

// Serve static frontend
app.use(express.static(path.join(__dirname, "../client")));

// IMPORTANT: Express-safe wildcard
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

const server = http.createServer(app);

// AUTHORITATIVE STATE
const history = [];
const redoStack = [];

// SOCKET.IO
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  // Live drawing
  socket.on("stroke:start", d => socket.broadcast.emit("stroke:start", d));
  socket.on("stroke:point", d => socket.broadcast.emit("stroke:point", d));

  // Commit stroke
  socket.on("stroke:commit", stroke => {
    history.push({ type: "stroke", data: stroke });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // Erase strokes
  socket.on("erase:strokes", ({ strokeIds }) => {
    history.push({ type: "erase-strokes", data: { strokeIds } });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // Clear
  socket.on("canvas:clear", () => {
    history.push({ type: "clear" });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // Undo / Redo
  socket.on("undo:request", () => {
    if (!history.length) return;
    redoStack.push(history.pop());
    io.emit("history:update", history);
  });

  socket.on("redo:request", () => {
    if (!redoStack.length) return;
    history.push(redoStack.pop());
    io.emit("history:update", history);
  });

  // Cursor presence
  socket.on("cursor:move", data => {
    socket.broadcast.emit("cursor:update", {
      socketId: socket.id,
      x: data.x,
      y: data.y,
      color: data.color
    });
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("cursor:leave", { socketId: socket.id });
    console.log("User disconnected:", socket.id);
  });
});

// START SERVER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
