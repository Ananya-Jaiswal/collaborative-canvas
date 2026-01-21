// =======================
// CANVAS SETUP
// =======================
const drawCanvas = document.getElementById("drawingCanvas");
const drawCtx = drawCanvas.getContext("2d");

const cursorCanvas = document.getElementById("cursorCanvas");
const cursorCtx = cursorCanvas.getContext("2d");

// =======================
// CLIENT STATE (RENDER ONLY)
// =======================
let operations = [];              // authoritative history from server
let currentStroke = null;        // local preview only
const remoteStrokes = new Map(); // remote preview only

let currentColor = "#000000";
let currentWidth = 4;

let toolMode = "draw"; // draw | erase
let erasing = false;
let eraserRadius = 10;

// 🔥 IMPORTANT: live erase set (per mouse-down gesture)
let liveErasedIds = new Set();

const remoteLiveErasedIds = new Set(); // live erase from other users

drawCanvas.style.touchAction = "none";

// =======================
// CURSOR PRESENCE STATE
// =======================
const remoteCursors = new Map(); // socketId -> { x, y, color }

const myCursorColor =
  "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");

// =======================
// DOM
// =======================
const drawToolBtn = document.getElementById("drawTool");
const eraseToolBtn = document.getElementById("eraseTool");
const eraserSizeSelect = document.getElementById("eraserSize");
const brushSizeSlider = document.getElementById("brushSize");
const colorPicker = document.getElementById("colorPicker");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const clearBtn = document.getElementById("clearBtn");

// =======================
// UI
// =======================
function updateToolbarUI() {
  drawToolBtn.classList.toggle("active", toolMode === "draw");
  eraseToolBtn.classList.toggle("active", toolMode === "erase");
  brushSizeSlider.classList.toggle("hidden", toolMode !== "draw");
  eraserSizeSelect.classList.toggle("hidden", toolMode !== "erase");
}

// =======================
// HELPERS
// =======================
function getPos(e) {
  const r = drawCanvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function getTouchPos(touchEvent) {
  const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

function drawStroke(stroke) {
  const pts = stroke.points;
  if (pts.length < 2) return;

  drawCtx.strokeStyle = stroke.color;
  drawCtx.lineWidth = stroke.width;
  drawCtx.lineCap = "round";

  drawCtx.beginPath();
  drawCtx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    drawCtx.lineTo(pts[i].x, pts[i].y);
  }
  drawCtx.stroke();
}

function drawEraser(x, y) {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  cursorCtx.beginPath();
  cursorCtx.arc(x, y, eraserRadius, 0, Math.PI * 2);
  cursorCtx.strokeStyle = "rgba(0,0,0,0.6)";
  cursorCtx.stroke();
}

function drawRemoteCursor({ x, y, color }, label) {
  cursorCtx.beginPath();
  cursorCtx.arc(x, y, 5, 0, Math.PI * 2);
  cursorCtx.fillStyle = color;
  cursorCtx.fill();

  cursorCtx.font = "12px Arial";
  cursorCtx.fillText(label, x + 8, y - 8);
}

function renderCursors() {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

  for (const [id, cursor] of remoteCursors.entries()) {
    drawRemoteCursor(cursor, id.slice(0, 4));
  }
}

// =======================
// RENDER (SINGLE SOURCE OF TRUTH)
// =======================
function render() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  const visible = new Map();

  // Apply server history
  for (const op of operations) {
    if (op.type === "stroke") {
      visible.set(op.data.id, structuredClone(op.data));
    }
    if (op.type === "erase-strokes") {
      for (const id of op.data.strokeIds) {
        visible.delete(id);
      }
    }
    if (op.type === "clear") {
      visible.clear();
    }
  }

  // 🔥 Live erase (immediate UX)
  for (const id of liveErasedIds) {
    visible.delete(id);
  }

  // 🔥 Remote live erase preview
  for (const id of remoteLiveErasedIds) {
    visible.delete(id);
  }

  // Draw committed strokes
  for (const stroke of visible.values()) {
    drawStroke(stroke);
  }

  // Draw previews last
  remoteStrokes.forEach(drawStroke);
  if (currentStroke) drawStroke(currentStroke);
}

// =======================
// RESIZE
// =======================
function resize() {
  drawCanvas.width = cursorCanvas.width = innerWidth;
  drawCanvas.height = cursorCanvas.height = innerHeight;
  render();
  renderCursors();
}
resize();
addEventListener("resize", resize);

// =======================
// MOUSE EVENTS
// =======================
drawCanvas.onmousedown = e => {
  const { x, y } = getPos(e);

  if (toolMode === "erase") {
    erasing = true;
    liveErasedIds.clear(); // 🔥 start fresh gesture
    return;
  }

  currentStroke = {
    id: crypto.randomUUID(),
    color: currentColor,
    width: currentWidth,
    points: [{ x, y }]
  };

  window.socket.emit("stroke:start", {
    id: currentStroke.id,
    color: currentColor,
    width: currentWidth,
    x,
    y
  });
};

drawCanvas.onmousemove = e => {
  const { x, y } = getPos(e);
  window.socket.emit("cursor:move", {
    x,
    y,
    color: myCursorColor
  });
  if (toolMode === "erase") {
    drawEraser(x, y);
    if (!erasing) return;

    // 🔥 LIVE ERASE: hide strokes immediately
    for (const op of operations) {
      if (op.type !== "stroke") continue;

      for (const p of op.data.points) {
        if (Math.hypot(p.x - x, p.y - y) <= eraserRadius) {
          liveErasedIds.add(op.data.id);
          window.socket.emit("erase:preview", {
            strokeId: op.data.id
          });

          break;
        }
      }
    }

    render();
    return;
  }

  if (!currentStroke) return;

  currentStroke.points.push({ x, y });
  window.socket.emit("stroke:point", { id: currentStroke.id, x, y });
  render();
};

drawCanvas.onmouseup = () => {
  if (toolMode === "erase") {
    erasing = false;
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

    if (liveErasedIds.size > 0) {
      window.socket.emit("erase:strokes", {
        strokeIds: Array.from(liveErasedIds)
      });
    }

    liveErasedIds.clear();
    window.socket.emit("erase:preview:end");
    return;
  }

  if (!currentStroke) return;

  window.socket.emit("stroke:commit", currentStroke);
  currentStroke = null;
};


//Touch Events
drawCanvas.addEventListener("touchstart", e => {
  e.preventDefault();

  const { x, y } = getTouchPos(e);

  if (toolMode === "erase") {
    erasing = true;
    liveErasedIds.clear();
    return;
  }

  currentStroke = {
    id: crypto.randomUUID(),
    color: currentColor,
    width: currentWidth,
    points: [{ x, y }]
  };

  window.socket.emit("stroke:start", {
    id: currentStroke.id,
    color: currentColor,
    width: currentWidth,
    x,
    y
  });
}, { passive: false });

drawCanvas.addEventListener("touchmove", e => {
  e.preventDefault();

  const { x, y } = getTouchPos(e);

  if (toolMode === "erase") {
    drawEraser(x, y);
    if (!erasing) return;

    for (const op of operations) {
      if (op.type !== "stroke") continue;

      for (const p of op.data.points) {
        if (Math.hypot(p.x - x, p.y - y) <= eraserRadius) {
          liveErasedIds.add(op.data.id);
          break;
        }
      }
    }

    render();
    return;
  }

  if (!currentStroke) return;

  currentStroke.points.push({ x, y });
  window.socket.emit("stroke:point", { id: currentStroke.id, x, y });
  render();
}, { passive: false });

drawCanvas.addEventListener("touchend", e => {
  e.preventDefault();

  if (toolMode === "erase") {
    erasing = false;
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

    if (liveErasedIds.size > 0) {
      window.socket.emit("erase:strokes", {
        strokeIds: Array.from(liveErasedIds)
      });
    }

    liveErasedIds.clear();
    return;
  }

  if (!currentStroke) return;

  window.socket.emit("stroke:commit", currentStroke);
  currentStroke = null;
}, { passive: false });


// =======================
// SOCKET — APPLY SERVER HISTORY
// =======================
window.socket.on("history:update", serverHistory => {
  operations = serverHistory;

  // Reset all previews
  currentStroke = null;
  remoteStrokes.clear();
  liveErasedIds.clear();

  render();
  renderCursors();
});

// =======================
// SOCKET — LIVE REMOTE PREVIEW
// =======================
window.socket.on("stroke:start", d => {
  remoteStrokes.set(d.id, {
    id: d.id,
    color: d.color,
    width: d.width,
    points: [{ x: d.x, y: d.y }]
  });
});

window.socket.on("stroke:point", d => {
  const s = remoteStrokes.get(d.id);
  if (!s) return;
  s.points.push({ x: d.x, y: d.y });
  render();
});

window.socket.on("erase:preview", ({ strokeId }) => {
  remoteLiveErasedIds.add(strokeId);
  render();
});

window.socket.on("erase:preview:end", () => {
  remoteLiveErasedIds.clear();
  render();
});

window.socket.on("cursor:update", data => {
  remoteCursors.set(data.socketId, data);
  renderCursors();
});

window.socket.on("cursor:leave", data => {
  remoteCursors.delete(data.socketId);
  renderCursors();
});

// =======================
// UI EVENTS
// =======================
drawToolBtn.onclick = () => {
  toolMode = "draw";
  updateToolbarUI();
};

eraseToolBtn.onclick = () => {
  toolMode = "erase";
  updateToolbarUI();
};

brushSizeSlider.oninput = e => currentWidth = +e.target.value;
eraserSizeSelect.onchange = e => eraserRadius = +e.target.value;
colorPicker.onchange = e => currentColor = e.target.value;

undoBtn.onclick = () => window.socket.emit("undo:request");
redoBtn.onclick = () => window.socket.emit("redo:request");
clearBtn.onclick = () => window.socket.emit("canvas:clear");

document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    window.socket.emit("undo:request");
  }
  if (e.ctrlKey && e.key === "y") {
    e.preventDefault();
    window.socket.emit("redo:request");
  }
});

updateToolbarUI();
