const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { restoreAllSessions, createClient, sendFromId } = require('./src/whatsapp-manager');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static('public'));
app.use('/sessions', express.static('sessions'));
app.use(express.json());

// Restore sessions on startup
restoreAllSessions();

// Register device → generate QR
app.post('/register', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });

  createClient(id, false);

  res.json({
    success: true,
    qrImage: `sessions/session-${id}/qrs/${id}.png`
  });
});

// Send message
app.post('/send', async (req, res) => {
  const { id, phone, message } = req.body;
  if (!id || !phone || !message) return res.status(400).json({ error: "missing fields" });

  try {
    await sendFromId(id, phone, message);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, ()=> console.log("🚀 Server started on port 3000"));