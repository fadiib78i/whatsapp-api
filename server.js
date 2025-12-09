const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { restoreAllSessions, createClient, sendFromId } = require('./src/whatsapp-manager');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Static files
app.use(express.static('public'));
app.use('/sessions', express.static('sessions'));
app.use(express.json());

// ===== SAFE LIMITS =====
const MAX_PER_HOUR = 70;
const MAX_PER_DAY = 180;

let sentThisHour = 0;
let sentToday = 0;

// Reset counters
setInterval(() => {
  sentThisHour = 0;
  console.log('🔄 Hourly counter reset');
}, 60 * 60 * 1000);

setInterval(() => {
  sentToday = 0;
  console.log('🔄 Daily counter reset');
}, 24 * 60 * 60 * 1000);

// Restore saved sessions on startup
restoreAllSessions();

// Health check (optional)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== REGISTER & QR GENERATION =====
app.post('/register', (req, res) => {
  const { id, phone } = req.body;

  if (!id || !phone) {
    return res.status(400).json({ error: 'id and phone are required' });
  }

  // Create client → QR event will trigger
  createClient(id, false);

  // You can later store phone in DB or file if needed
  console.log(`📲 Register requested for ID=${id} phone=${phone}`);

  res.json({
    success: true,
    qrImage: `sessions/session-${id}/qrs/${id}.png`
  });
});


// ===== SINGLE SEND =====
app.post('/send', async (req, res) => {
  const { id, phone, message } = req.body;

  if (!id || !phone || !message) {
    return res.status(400).json({
      error: 'id, phone, message are required'
    });
  }

  try {
    await sendFromId(id, phone, message);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ===== BULK SEND FROM EXCEL =====
app.post('/send-bulk', upload.single('file'), async (req, res) => {
  const { id, message } = req.body;

  if (!id || !message || !req.file) {
    return res.status(400).json({
      error: 'id, message, and Excel file are required'
    });
  }

  if (sentToday >= MAX_PER_DAY) {
    return res.status(429).json({
      error: 'Daily WhatsApp limit reached. Try again tomorrow.'
    });
  }

  try {
    const workbook = XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    let results = [];

    for (const row of data) {
      if (sentThisHour >= MAX_PER_HOUR) {
        console.log('⏸️ Hourly limit reached - stopping campaign');
        break;
      }

      if (sentToday >= MAX_PER_DAY) {
        console.log('⛔ Daily limit reached - stopping campaign');
        break;
      }

      const mother = row.mother || row.Mother || '';
      const name = row.name || row.Name || '';
      const gan = row.gan || row.Gan || '';
      const phone = String(row.number || row.Number || '').trim();

      if (!phone) continue;

      let personalizedMessage = message;
      personalizedMessage = personalizedMessage.replaceAll('<mother>', mother);
      personalizedMessage = personalizedMessage.replaceAll('<name>', name);
      personalizedMessage = personalizedMessage.replaceAll('<gan>', gan);

      try {
        await sendFromId(id, phone, personalizedMessage);

        sentThisHour++;
        sentToday++;

        results.push({
          mother,
          name,
          gan,
          phone,
          status: 'sent'
        });

        const delay = Math.floor(Math.random() * (8000 - 4000 + 1)) + 4000;
        console.log(`⏳ Waiting ${delay / 1000}s before next send...`);
        await new Promise(r => setTimeout(r, delay));

      } catch (err) {
        results.push({
          mother,
          name,
          gan,
          phone,
          status: 'failed',
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      sentThisHour,
      sentToday,
      totalProcessed: results.length,
      results
    });

  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// Start server
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
