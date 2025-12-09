const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const sessionsPath = process.env.SESSIONS_PATH || path.join(__dirname, '..', 'sessions');
const qrsPath = path.join(sessionsPath, 'qrs');

if (!fs.existsSync(sessionsPath)) fs.mkdirSync(sessionsPath);
if (!fs.existsSync(qrsPath)) fs.mkdirSync(qrsPath);

const clients = {};

function normalizeId(id) {
  return id.replace(/^session-+/g, '');
}

function restoreAllSessions() {
  const folders = fs.readdirSync(sessionsPath);
  folders.forEach(folder => {
    const cleanId = normalizeId(folder);
    console.log(`🔄 Restoring saved session: ${cleanId}`);
    createClient(cleanId, true);
  });
}

function createClient(id, silent = false) {
  const cleanId = normalizeId(id);

  if (clients[cleanId]) {
    console.log(`⚠️ Client already exists: ${cleanId}`);
    return clients[cleanId];
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `session-${cleanId}`,
      dataPath: sessionsPath
    }),
    puppeteer: {
      headless: true,
      executablePath: '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage'
      ]
    }
  });

  client.on('qr', async qr => {
    if (silent) return;
    const filePath = path.join(qrsPath, `${cleanId}.png`);
    await QRCode.toFile(filePath, qr, { width: 400 });
    console.log(`✅ QR saved for ${cleanId}: ${filePath}`);
  });

  client.on('authenticated', () => {
    console.log(`🔐 Authenticated: ${cleanId}`);
  });

  client.on('ready', () => {
    console.log(`🚀 WhatsApp READY for ID: ${cleanId}`);
  });

  client.on('auth_failure', msg => {
    console.error(`❌ Auth failure for ${cleanId}:`, msg);
  });

  client.initialize();
  clients[cleanId] = client;
  return client;
}

async function sendFromId(id, phone, message) {
  const cleanId = normalizeId(id);

  if (!clients[cleanId]) {
    throw new Error(`ID not registered: ${cleanId}`);
  }

  const chatId = phone.replace(/\D/g, '') + '@c.us';
  return clients[cleanId].sendMessage(chatId, message);
}

module.exports = {
  restoreAllSessions,
  createClient,
  sendFromId
};