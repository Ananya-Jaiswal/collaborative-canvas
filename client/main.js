console.log("main.js loaded");

window.socket = io();

window.socket.on("connect", () => {
  console.log("Connected to server:", window.socket.id);
});

window.socket.on("disconnect", () => {
  console.log("Disconnected from server");
});
