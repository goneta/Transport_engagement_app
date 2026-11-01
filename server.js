const express=require('express'),Database=require('better-sqlite3'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),crypto=require('crypto');
const SECRET=process.env.JWT_SECRET;if(!SECRET){console.error('JWT_SECRET manquant (voir .env.example)');process.exit(1)}
const db=new Database(process.env.DB||'data.db');
db.exec(`create table if not exists users(id integer primary key,username text unique not null,name text,role text not null,hash text not null,email text,phone text);
create table if not exists docs(id integer primary key,owner integer not null,carrier integer,data text not null,sig_owner text,at_owner text,sig_carrier text,at_carrier text,created text default current_timestamp,updated text default current_timestamp);
create table if not exists doc_versions(id integer primary key,doc integer,data text,sig_owner text,at_owner text,sig_carrier text,at_carrier text,saved text default current_timestamp);
create table if not exists requests(id integer primary key,kind text,username text,contact text,created text default current_timestamp,done integer default 0);
create table if not exists resets(token text primary key,user integer,exp integer);`);
try{db.exec('alter table users add column perms text')}catch(e){}
const DEF={admin:{create:1,edit:1,share:1,ext:1,sign:1,download:1},donneur:{create:1,edit:1,share:1,ext:1,sign:1,download:1},transporteur:{sign:1,download:1,ext:1},chauffeur:{sign:1,download:1,ext:1}};
const perm=u=>u.role==='admin'?DEF.admin:{create:0,edit:0,share:0,ext:0,sign:0,download:0,...DEF[u.role],...JSON.parse(u.perms||'{}')};
if(!db.prepare("select 1 from users where role='admin'").get()){db.prepare('insert into users(username,name,role,hash) values(?,?,?,?)').run(process.env.ADMIN_USER||'admin','Administrateur','admin',bcrypt.hashSync(process.env.ADMIN_PASSWORD||'ChangeMe!123',10));console.log('Compte admin créé')}
const mail=async(to,subject,text)=>{if(!process.env.SMTP_URL||!to)return;try{await require('nodemailer').createTransport(process.env.SMTP_URL).sendMail({from:process.env.MAIL_FROM,to,subject,text})}catch(e){console.error('mail',e.message)}};
const app=express();app.use(express.json({limit:'1mb'}));app.use(express.static(__dirname+'/public'));
const tries={};const lim=(k)=>{const n=Date.now(),a=(tries[k]||[]).filter(t=>n-t<9e5);a.push(n);tries[k]=a;return a.length>10};
const auth=(roles)=>(q,r,n)=>{try{const t=jwt.verify((q.headers.authorization||'').slice(7),SECRET);const u=db.prepare('select id,username,name,role,perms from users where id=?').get(t.id);if(!u||(roles&&!roles.includes(u.role)))return r.status(403).json({error:'forbidden'});q.u=u;q.u.p=perm(u);n()}catch(e){r.status(401).json({error:'auth'})}};
const R=['admin','donneur'];const can=p=>[auth(),(q,r,n)=>q.u.p[p]?n():r.status(403).json({error:'forbidden'})];
app.post('/api/login',(q,r)=>{const{username,password}=q.body||{};if(lim(q.ip+username))return r.status(429).json({error:'trop de tentatives'});const u=db.prepare('select * from users where username=?').get(String(username||''));
if(!u||!bcrypt.compareSync(String(password||''),u.hash))return r.status(401).json({error:'identifiants invalides'});r.json({token:jwt.sign({id:u.id},SECRET,{expiresIn:'7d'}),user:{id:u.id,username:u.username,name:u.name,role:u.role}})});
app.get('/api/me',auth(),(q,r)=>{const{id,username,name,role}=q.u;r.json({id,username,name,role,perms:q.u.p})});
// Admin : utilisateurs
app.get('/api/users',auth(['admin']),(q,r)=>r.json(db.prepare('select id,username,name,role,email,phone,perms from users order by role,name').all().map(u=>({...u,perms:perm(u)}))));
app.post('/api/users',auth(['admin']),(q,r)=>{const{username,name,role,password,email,phone}=q.body;if(!username||!password||!['donneur','transporteur','chauffeur','admin'].includes(role))return r.status(400).json({error:'champs invalides'});
try{db.prepare('insert into users(username,name,role,hash,email,phone,perms) values(?,?,?,?,?,?,?)').run(username.trim(),name,role,bcrypt.hashSync(password,10),email||null,phone||null,JSON.stringify(q.body.perms||{}));r.json({ok:1})}catch(e){r.status(409).json({error:'identifiant déjà utilisé'})}});
app.put('/api/users/:id',auth(['admin']),(q,r)=>{const{password,name,email,phone}=q.body;const o=db.prepare('select * from users where id=?').get(q.params.id);if(!o)return r.sendStatus(404);
db.prepare('update users set hash=?,name=?,email=?,phone=?,perms=? where id=?').run(password?bcrypt.hashSync(password,10):o.hash,name??o.name,email??o.email,phone??o.phone,q.body.perms?JSON.stringify(q.body.perms):o.perms,o.id);r.json({ok:1})});
app.delete('/api/users/:id',auth(['admin']),(q,r)=>{if(+q.params.id===q.u.id)return r.sendStatus(400);db.prepare('delete from users where id=?').run(q.params.id);r.json({ok:1})});
app.get('/api/carriers',...can('share'),(q,r)=>r.json(db.prepare("select id,name,role from users where role in ('transporteur','chauffeur') order by name").all()));
// Documents
const vis=(u,d)=>u.role==='admin'||d.owner===u.id||d.carrier===u.id;
const out=d=>({...d,data:JSON.parse(d.data),owner_name:db.prepare('select name from users where id=?').get(d.owner)?.name,carrier_name:d.carrier?db.prepare('select name from users where id=?').get(d.carrier)?.name:null});
app.get('/api/docs',auth(),(q,r)=>{const{don,tr,from,to}=q.query;let rows=db.prepare('select * from docs order by created desc').all().filter(d=>vis(q.u,d)).map(out);
const has=(a,b)=>!b||String(a||'').toLowerCase().includes(String(b).toLowerCase());
rows=rows.filter(d=>has(d.data.don,don)&&has(d.data.tr,tr)&&(!from||d.created.slice(0,10)>=from)&&(!to||d.created.slice(0,10)<=to));r.json(rows)});
app.get('/api/docs/:id',auth(),(q,r)=>{const d=db.prepare('select * from docs where id=?').get(q.params.id);if(!d||!vis(q.u,d))return r.sendStatus(404);r.json(out(d))});
app.post('/api/docs',...can('create'),(q,r)=>r.json({id:db.prepare('insert into docs(owner,data) values(?,?)').run(q.u.id,JSON.stringify(q.body.data||{})).lastInsertRowid}));
app.put('/api/docs/:id',...can('edit'),(q,r)=>{const d=db.prepare('select * from docs where id=?').get(q.params.id);if(!d||(q.u.role!=='admin'&&d.owner!==q.u.id))return r.sendStatus(404);
if(d.sig_owner||d.sig_carrier){if(!q.body.confirm)return r.status(409).json({error:'signed'});db.prepare('insert into doc_versions(doc,data,sig_owner,at_owner,sig_carrier,at_carrier) values(?,?,?,?,?,?)').run(d.id,d.data,d.sig_owner,d.at_owner,d.sig_carrier,d.at_carrier)}
db.prepare("update docs set data=?,sig_owner=null,at_owner=null,sig_carrier=null,at_carrier=null,updated=current_timestamp where id=?").run(JSON.stringify(q.body.data||{}),d.id);r.json({ok:1})});
app.post('/api/docs/:id/share',...can('share'),(q,r)=>{const d=db.prepare('select * from docs where id=?').get(q.params.id);const c=db.prepare("select id from users where id=? and role in ('transporteur','chauffeur')").get(q.body.carrier);
if(!d||!c||(q.u.role!=='admin'&&d.owner!==q.u.id))return r.sendStatus(400);db.prepare('update docs set carrier=? where id=?').run(c.id,d.id);r.json({ok:1})});
app.post('/api/docs/:id/sign',...can('sign'),(q,r)=>{const d=db.prepare('select * from docs where id=?').get(q.params.id),s=String(q.body.sig||'');if(!d||!vis(q.u,d)||!/^data:image\/png;base64,/.test(s)||s.length>500000)return r.sendStatus(400);
const w=d.carrier===q.u.id?'carrier':d.owner===q.u.id?'owner':null;if(!w)return r.sendStatus(403);db.prepare(`update docs set sig_${w}=?,at_${w}=? where id=?`).run(s,new Date().toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'}),d.id);r.json({ok:1})});
// Mot de passe / identifiant oublié
app.post('/api/forgot',async(q,r)=>{const{kind,username,contact}=q.body||{};if(lim('f'+q.ip))return r.sendStatus(429);
if(kind==='password'){const u=db.prepare('select * from users where username=?').get(String(username||''));if(u){const t=crypto.randomBytes(24).toString('hex');db.prepare('insert into resets values(?,?,?)').run(t,u.id,Date.now()+36e5);
const link=(process.env.BASE_URL||'')+'/#reset='+t;await mail(u.email,'Réinitialisation du mot de passe','Lien (valable 1 h) : '+link);db.prepare('insert into requests(kind,username,contact) values(?,?,?)').run('password',u.username,link)}}
else db.prepare('insert into requests(kind,username,contact) values(?,?,?)').run('username',null,String(contact||'').slice(0,200));
r.json({ok:1})});
app.post('/api/reset',(q,r)=>{const{token,password}=q.body||{};const t=db.prepare('select * from resets where token=?').get(String(token));if(!t||t.exp<Date.now()||String(password||'').length<6)return r.status(400).json({error:'lien invalide ou mot de passe trop court'});
db.prepare('update users set hash=? where id=?').run(bcrypt.hashSync(password,10),t.user);db.prepare('delete from resets where token=?').run(t.token);r.json({ok:1})});
app.get('/api/requests',auth(R),(q,r)=>r.json(db.prepare('select * from requests where done=0 order by created desc').all().filter(x=>x.kind==='username'||q.u.role==='admin').map(x=>({...x,match:x.kind==='username'?db.prepare("select username,name,email,phone from users where email=? or replace(phone,' ','')=replace(?,' ','')").get(x.contact,x.contact):null}))));
app.post('/api/requests/:id/done',auth(R),(q,r)=>{db.prepare('update requests set done=1 where id=?').run(q.params.id);r.json({ok:1})});
app.listen(process.env.PORT||3000,()=>console.log('http://localhost:'+(process.env.PORT||3000)));
