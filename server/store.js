const fs=require('fs'),path=require('path');
const file=path.join(process.cwd(),'data','store.json');
let collectionPromise;
async function collection(){if(!process.env.MONGODB_URI)return null;if(!collectionPromise){const {MongoClient}=require('mongodb');const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});collectionPromise=client.connect().then(()=>client.db(process.env.MONGODB_DB||'trao_prep').collection('application_state')).catch(error=>{collectionPromise=null;throw error});}return collectionPromise;}
function localRead(){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return {users:[],kits:[]}}}
function localWrite(data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2));}
async function read(){const db=await collection();if(!db)return localRead();const doc=await db.findOne({_id:'singleton'});return doc?.data||{users:[],kits:[]};}
async function write(data){const db=await collection();if(!db)return localWrite(data);await db.replaceOne({_id:'singleton'},{_id:'singleton',data,updated_at:new Date().toISOString()},{upsert:true});}
module.exports={read,write};
