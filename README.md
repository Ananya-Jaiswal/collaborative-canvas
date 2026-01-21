# Real-Time Collaborative Canvas

A real-time, multi-user collaborative drawing canvas built using **HTML5 Canvas**, **Node.js**, and **Socket.IO**.  
Multiple users can draw, erase, undo, redo, and view each other’s cursors live across different browsers and devices.

**Live Demo:**  
https://collaborative-canvas-9e2d.onrender.com/

> Note: The project is deployed on Render (Free Tier).  
> If the app has been inactive, the first load may take a few seconds while the server wakes up.

---

## Features

- 🖌️ **Real-time collaborative drawing**
- 👥 **Multi-user sync across tabs and devices**
- 🧽 **Live stroke-based erasing (globally synced)**
- ↩️ **Global Undo / Redo (server-authoritative)**
- 🧹 **Global canvas clear**
- 🖱️ **Live cursor presence for each user**
- 📱 **Mobile touch support**
- 🔄 **State consistency across reconnects**
- ⚙️ **Server-authoritative history model**

---

## Architecture Overview

- **Client**:  
  - HTML5 Canvas for rendering  
  - JavaScript event handling (mouse + touch)  
  - Socket.IO client for real-time communication  

- **Server**:  
  - Node.js + Express  
  - Socket.IO WebSocket server  
  - Maintains authoritative drawing history  
  - Handles undo/redo, erase, and clear actions globally  

A detailed architecture explanation is available in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Tech Stack

**Frontend**
- HTML5 Canvas
- Vanilla JavaScript
- CSS

**Backend**
- Node.js
- Express.js
- Socket.IO

**Deployment**
- Render (Free Tier)

---

## How to Run Locally

### 1. Clone the repository
```bash
git clone https://github.com/Ananya-Jaiswal/collaborative-canvas.git
cd collaborative-canvas
2. Install dependencies
npm install
3. Start the server
npm start
4. Open in browser
http://localhost:3000
Open the URL in multiple tabs or devices to test collaboration.

 Project Structure
collaborative-canvas/
│
├── client/
│   ├── index.html
│   ├── canvas.js
│   ├── main.js
│   └── style.css
│
├── server/
│   └── server.js
│
├── package.json
├── package-lock.json
└── README.md
 Known Limitations
Deployed using Render Free Tier, so the server may sleep after inactivity.

No user authentication (all users are anonymous).

In-memory state (resets on server restart).

These trade-offs were made intentionally for simplicity and clarity.

 Future Enhancements
Persistent storage (database-backed history)

User authentication and usernames

Rooms / multiple canvases

Export canvas as image

Permissions and role-based access

 Author
Ananya Jaiswal
GitHub: https://github.com/Ananya-Jaiswal

 License
This project is for educational and evaluation purposes.


---

## What you should do now

1️⃣ Create `README.md` in your repo root  
2️⃣ Paste the above content  
3️⃣ Commit and push:

```bash
git add README.md
git commit -m "Add README with live demo and project details"
git push
