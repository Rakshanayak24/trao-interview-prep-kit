require('dotenv').config();
const app=require('../server/index');

// Vercel may invoke a catch-all function with the matched `/api` prefix removed.
// Express routes are intentionally shared with the local server and keep `/api`.
module.exports=(req,res)=>{
  if(!req.url.startsWith('/api/')) req.url=`/api${req.url.startsWith('/')?'':'/'}${req.url}`;
  return app(req,res);
};
