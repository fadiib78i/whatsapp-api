const express=require('express');
const multer=require('multer');
const XLSX=require('xlsx');
const {restoreAllSessions,createClient,sendFromId}=require('./src/whatsapp-manager');
const app=express();
const upload=multer({storage:multer.memoryStorage()});
app.use(express.static('public'));
app.use(express.json());
const MAX_PER_HOUR=70,MAX_PER_DAY=180;
let sentThisHour=0,sentToday=0;
setInterval(()=>sentThisHour=0,3600000);
setInterval(()=>sentToday=0,86400000);
restoreAllSessions();
app.post('/register',(req,res)=>{
  const{id,phone}=req.body;
  if(!id||!phone)return res.status(400).json({error:"id and phone required"});
  createClient(id,false);
  res.json({success:true,qrImage:`qrs/${id}.png`});
});
app.post('/send',async(req,res)=>{
  const{id,phone,message}=req.body;
  if(!id||!phone||!message)return res.status(400).json({error:"Missing fields"});
  try{await sendFromId(id,phone,message);res.json({success:true});}
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/send-bulk',upload.single('file'),async(req,res)=>{
  const{id,message}=req.body;
  if(!id||!message||!req.file)return res.status(400).json({error:"Invalid input"});
  if(sentToday>=MAX_PER_DAY)return res.status(429).json({error:"Daily limit reached"});
  try{
    const wb=XLSX.read(req.file.buffer);
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    let results=[];
    for(const row of rows){
      if(sentThisHour>=MAX_PER_HOUR||sentToday>=MAX_PER_DAY)break;
      const mother=row.mother||"",name=row.name||"",gan=row.gan||"",phone=(row.number||"").toString();
      let msg=message.replaceAll('<mother>',mother).replaceAll('<name>',name).replaceAll('<gan>',gan);
      try{
        await sendFromId(id,phone,msg);
        sentThisHour++;sentToday++;
        results.push({mother,name,gan,phone,status:"sent"});
        const delay=Math.floor(Math.random()*4000)+4000;
        await new Promise(r=>setTimeout(r,delay));
      }catch(e){
        results.push({mother,name,gan,phone,status:"failed"});
      }
    }
    res.json({success:true,results});
  }catch(e){res.status(500).json({error:e.message});}
});
app.listen(3000,()=>console.log("Server running on 3000"));