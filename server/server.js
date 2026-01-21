const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const path = require("path");

// Serve static frontend
app.use(express.static(path.join(__dirname, "../client")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// =======================
// AUTHORITATIVE STATE
// =======================
const history = [];
const redoStack = [];

// =======================
// SOCKET.IO
// =======================
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  // ----- LIVE DRAW STREAM -----
  socket.on("stroke:start", d => socket.broadcast.emit("stroke:start", d));
  socket.on("stroke:point", d => socket.broadcast.emit("stroke:point", d));

  // ----- COMMIT STROKE -----
  socket.on("stroke:commit", stroke => {
    history.push({ type: "stroke", data: stroke });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // ----- ERASE (BY STROKE ID) -----
  socket.on("erase:stroke", ({ strokeId }) => {
    history.push({ type: "erase-stroke", data: { strokeId } });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // ----- CLEAR -----
  socket.on("canvas:clear", () => {
    history.push({ type: "clear" });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  // ----- UNDO -----
  socket.on("undo:request", () => {
    if (!history.length) return;
    redoStack.push(history.pop());
    io.emit("history:update", history);
  });

  // ----- REDO -----
  socket.on("redo:request", () => {
    if (!redoStack.length) return;
    history.push(redoStack.pop());
    io.emit("history:update", history);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

  socket.on("erase:strokes", ({ strokeIds }) => {
    history.push({
      type: "erase-strokes",
      data: { strokeIds }
    });
    redoStack.length = 0;
    io.emit("history:update", history);
  });

  socket.on("erase:preview", data => {
    socket.broadcast.emit("erase:preview", data);
  });

  socket.on("erase:preview:end", () => {
    socket.broadcast.emit("erase:preview:end");
  });

  // =======================
  // CURSOR PRESENCE
  // =======================
  socket.on("cursor:move", data => {
    socket.broadcast.emit("cursor:update", {
      socketId: socket.id,
    x: data.x,
      y: data.y,
      color: data.color
    });
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("cursor:leave", {
      socketId: socket.id
    });
  });
});

server.listen(3000, () =>
  console.log("Server running at http://localhost:3000")
);
