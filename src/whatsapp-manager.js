const{Client,LocalAuth}=require('whatsapp-web.js');
const QRCode=require('qrcode');
const fs=require('fs');
const path=require('path');
const sessionsPath=process.env.SESSIONS_PATH||path.join(__dirname,'..','sessions');
const qrsPath=path.join(__dirname,'..','qrs');
if(!fs.existsSync(sessionsPath))fs.mkdirSync(sessionsPath);
if(!fs.existsSync(qrsPath))fs.mkdirSync(qrsPath);
const clients={};
const normalize=id=>id.replace(/^session-+/g,'');
function restoreAllSessions(){
  fs.readdirSync(sessionsPath).forEach(folder=>{
    createClient(normalize(folder),true);
  });
}
function createClient(id,silent=false){
  id=normalize(id);
  if(clients[id])return clients[id];
  const client=new Client({
    authStrategy:new LocalAuth({
      clientId:`session-${id}`,
      dataPath:sessionsPath
    }),
    puppeteer:{
      headless:true,
      executablePath:'/usr/bin/chromium',
      args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage']
    }
  });
  client.on('qr',qr=>{
    if(!silent)QRCode.toFile(path.join(qrsPath,`${id}.png`),qr);
  });
  client.on('ready',()=>console.log("READY:",id));
  client.initialize();
  clients[id]=client;
  return client;
}
async function sendFromId(id,phone,message){
  id=normalize(id);
  if(!clients[id])throw new Error("Unknown ID "+id);
  const chatId=phone.replace(/\D/g,'')+'@c.us';
  return clients[id].sendMessage(chatId,message);
}
module.exports={restoreAllSessions,createClient,sendFromId};