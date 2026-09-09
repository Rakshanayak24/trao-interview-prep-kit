const jwt=require('jsonwebtoken'), bcrypt=require('bcryptjs'); const secret=()=>process.env.JWT_SECRET||'development-only-change-me';
const token=user=>jwt.sign({sub:user.id,email:user.email},secret(),{expiresIn:'7d'});
function requireAuth(req,res,next){try{const raw=req.headers.authorization||'';req.user=jwt.verify(raw.replace('Bearer ',''),secret());next()}catch{return res.status(401).json({error:{code:'UNAUTHENTICATED',message:'Your session is invalid or has expired.'}})}}
module.exports={token,requireAuth,bcrypt};
