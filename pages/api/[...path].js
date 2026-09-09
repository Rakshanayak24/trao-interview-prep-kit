require('dotenv').config();
const app=require('../../server/index');

// Next's native API route is reliable on Vercel. Disable its body parser because
// the shared Express application owns JSON parsing for both local and deployed use.
module.exports=(req,res)=>{
  if(!req.url.startsWith('/api/')) req.url=`/api${req.url.startsWith('/')?'':'/'}${req.url}`;
  return app(req,res);
};
module.exports.config={api:{bodyParser:false}};
