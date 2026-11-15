const express=require('express'),cors=require('cors'),Database=require('better-sqlite3'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),path=require('path'),fs=require('fs');
const SECRET=process.env.JWT_SECRET||'dev-secret-change-me',FINE_PER_DAY=5,LOAN_DAYS=14,MAX_BOOKS=3,DAY=864e5;
const db=new Database(process.env.DB_FILE||path.join(__dirname,'library.db'));
db.pragma('foreign_keys=ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'student',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS books(id INTEGER PRIMARY KEY,title TEXT NOT NULL,author TEXT NOT NULL,category TEXT NOT NULL,isbn TEXT,copies INTEGER NOT NULL DEFAULT 1,available INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS issues(id INTEGER PRIMARY KEY,book_id INTEGER NOT NULL REFERENCES books(id),user_id INTEGER NOT NULL REFERENCES users(id),issued_at TEXT NOT NULL,due_at TEXT NOT NULL,returned_at TEXT,fine INTEGER DEFAULT 0);`);

if(!db.prepare('SELECT COUNT(*) c FROM users').get().c){ // ---- seed data
  const u=db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)');
  u.run('Admin','admin@library.com',bcrypt.hashSync('admin123',10),'admin');
  ['Aarav Sharma','Priya Verma','Rohan Mehta','Sneha Gupta','Karan Singh'].forEach((n,i)=>u.run(n,`student${i+1}@library.com`,bcrypt.hashSync('student123',10),'student'));
  const b=db.prepare('INSERT INTO books(title,author,category,isbn,copies,available) VALUES(?,?,?,?,?,?)');
  [['Clean Code','Robert C. Martin','Technology'],['The Pragmatic Programmer','Andrew Hunt','Technology'],['Introduction to Algorithms','Thomas Cormen','Technology'],['Sapiens','Yuval Noah Harari','History'],['Wings of Fire','A.P.J. Abdul Kalam','Biography'],['The Alchemist','Paulo Coelho','Fiction'],['1984','George Orwell','Fiction'],['To Kill a Mockingbird','Harper Lee','Fiction'],['A Brief History of Time','Stephen Hawking','Science'],['The Selfish Gene','Richard Dawkins','Science'],['Atomic Habits','James Clear','Self-Help'],['Rich Dad Poor Dad','Robert Kiyosaki','Finance'],['Discovery of India','Jawaharlal Nehru','History'],['Gitanjali','Rabindranath Tagore','Poetry'],['Database System Concepts','Silberschatz','Technology']]
   .forEach((x,i)=>b.run(...x,'978-0-00-'+(1000+i),3,3));
  const iss=db.prepare('INSERT INTO issues(book_id,user_id,issued_at,due_at,returned_at,fine) VALUES(?,?,?,?,?,?)');
  const dec=db.prepare('UPDATE books SET available=available-1 WHERE id=?');
  [[1,2,150,1],[4,3,130,1],[6,2,100,1],[1,4,95,1],[7,5,70,1],[11,3,60,1],[1,6,45,1],[11,2,40,1],[6,4,20,1],[4,5,12,1],[9,3,40,0],[2,2,10,0],[7,4,3,0],[11,6,25,0]]
   .forEach(([bk,us,ago,ret])=>{const i=new Date(Date.now()-ago*DAY),d=new Date(+i+LOAN_DAYS*DAY);
     iss.run(bk,us,i.toISOString(),d.toISOString(),ret?new Date(+i+9*DAY).toISOString():null,0); if(!ret)dec.run(bk);});
}

const app=express();app.use(cors(),express.json());
const sign=u=>jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'8h'});
const pub=u=>({id:u.id,name:u.name,email:u.email,role:u.role});
const auth=role=>(req,res,next)=>{try{req.user=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),SECRET);}catch{return res.status(401).json({error:'Please log in again'});}
  if(role&&req.user.role!==role)return res.status(403).json({error:'Not allowed'});next();};
const wrap=f=>(req,res)=>{try{f(req,res)}catch(e){res.status(400).json({error:e.message})}};

app.post('/api/register',wrap((req,res)=>{const{name,email,password}=req.body;
  if(!name||!email||!password||password.length<6)throw new Error('Name, email and a 6+ character password are required');
  if(db.prepare('SELECT 1 FROM users WHERE email=?').get(email))throw new Error('Email already registered');
  const id=db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,'student')").run(name,email.toLowerCase(),bcrypt.hashSync(password,10)).lastInsertRowid;
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(id);res.json({token:sign(u),user:pub(u)});}));
app.post('/api/login',wrap((req,res)=>{const{email,password,role}=req.body;
  const u=db.prepare('SELECT * FROM users WHERE email=?').get((email||'').toLowerCase());
  if(!u||!bcrypt.compareSync(password||'',u.password)||(role&&u.role!==role))throw new Error('Invalid credentials');
  res.json({token:sign(u),user:pub(u)});}));

app.get('/api/books',auth(),wrap((req,res)=>{const q=`%${req.query.q||''}%`;
  res.json(db.prepare('SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR category LIKE ? ORDER BY title').all(q,q,q));}));
const bookArgs=b=>{if(!b.title||!b.author||!b.category)throw new Error('Title, author and category are required');return[b.title,b.author,b.category,b.isbn||'',Math.max(1,+b.copies||1)];};
app.post('/api/books',auth('admin'),wrap((req,res)=>{const a=bookArgs(req.body);
  res.json({id:db.prepare('INSERT INTO books(title,author,category,isbn,copies,available) VALUES(?,?,?,?,?,?)').run(...a,a[4]).lastInsertRowid});}));
app.put('/api/books/:id',auth('admin'),wrap((req,res)=>{const a=bookArgs(req.body),b=db.prepare('SELECT * FROM books WHERE id=?').get(req.params.id);
  const out=b.copies-b.available;if(a[4]<out)throw new Error(`${out} copies are currently issued`);
  db.prepare('UPDATE books SET title=?,author=?,category=?,isbn=?,copies=?,available=? WHERE id=?').run(...a,a[4]-out,b.id);res.json({ok:1});}));
app.delete('/api/books/:id',auth('admin'),wrap((req,res)=>{
  if(db.prepare('SELECT 1 FROM issues WHERE book_id=? AND returned_at IS NULL').get(req.params.id))throw new Error('Book is currently issued');
  db.prepare('DELETE FROM issues WHERE book_id=?').run(req.params.id);db.prepare('DELETE FROM books WHERE id=?').run(req.params.id);res.json({ok:1});}));

app.get('/api/students',auth('admin'),wrap((req,res)=>res.json(db.prepare(`SELECT id,name,email,created_at,(SELECT COUNT(*) FROM issues WHERE user_id=users.id AND returned_at IS NULL) issued FROM users WHERE role='student' ORDER BY name`).all())));

const withFine=i=>{const now=Date.now(),late=!i.returned_at&&now>Date.parse(i.due_at),days=late?Math.ceil((now-Date.parse(i.due_at))/DAY):0;
  return{...i,status:i.returned_at?'returned':late?'overdue':'issued',fine:i.returned_at?i.fine:days*FINE_PER_DAY};};
app.get('/api/issues',auth(),wrap((req,res)=>{const adm=req.user.role==='admin';
  res.json(db.prepare(`SELECT i.*,b.title,b.author,u.name student FROM issues i JOIN books b ON b.id=i.book_id JOIN users u ON u.id=i.user_id ${adm?'':'WHERE i.user_id='+req.user.id} ORDER BY i.id DESC`).all().map(withFine));}));
app.post('/api/issues',auth(),wrap((req,res)=>{const uid=req.user.role==='admin'?+req.body.user_id:req.user.id,bid=+req.body.book_id;
  if(!uid||!bid)throw new Error('Select a student and a book');
  const b=db.prepare('SELECT * FROM books WHERE id=?').get(bid);if(!b||b.available<1)throw new Error('No copies available');
  if(db.prepare('SELECT 1 FROM issues WHERE book_id=? AND user_id=? AND returned_at IS NULL').get(bid,uid))throw new Error('Already issued to this student');
  if(db.prepare('SELECT COUNT(*) c FROM issues WHERE user_id=? AND returned_at IS NULL').get(uid).c>=MAX_BOOKS)throw new Error(`Limit of ${MAX_BOOKS} books reached`);
  const now=new Date();db.transaction(()=>{db.prepare('INSERT INTO issues(book_id,user_id,issued_at,due_at) VALUES(?,?,?,?)').run(bid,uid,now.toISOString(),new Date(+now+LOAN_DAYS*DAY).toISOString());
    db.prepare('UPDATE books SET available=available-1 WHERE id=?').run(bid);})();res.json({ok:1});}));
app.post('/api/issues/:id/return',auth(),wrap((req,res)=>{const i=db.prepare('SELECT * FROM issues WHERE id=? AND returned_at IS NULL').get(req.params.id);
  if(!i||(req.user.role!=='admin'&&i.user_id!==req.user.id))throw new Error('Issue record not found');
  const f=withFine(i).fine;db.transaction(()=>{db.prepare('UPDATE issues SET returned_at=?,fine=? WHERE id=?').run(new Date().toISOString(),f,i.id);
    db.prepare('UPDATE books SET available=available+1 WHERE id=?').run(i.book_id);})();res.json({fine:f});}));

app.get('/api/stats',auth('admin'),wrap((req,res)=>{const one=s=>db.prepare(s).get().c,all=db.prepare('SELECT * FROM issues').all().map(withFine);
  res.json({totalBooks:one('SELECT COALESCE(SUM(copies),0) c FROM books'),students:one("SELECT COUNT(*) c FROM users WHERE role='student'"),available:one('SELECT COALESCE(SUM(available),0) c FROM books'),
    issued:all.filter(i=>!i.returned_at).length,overdue:all.filter(i=>i.status==='overdue').length,fines:all.reduce((s,i)=>s+i.fine,0),
    popular:db.prepare('SELECT b.title name,COUNT(*) count FROM issues i JOIN books b ON b.id=i.book_id GROUP BY b.id ORDER BY count DESC LIMIT 5').all(),
    monthly:db.prepare("SELECT strftime('%Y-%m',issued_at) month,COUNT(*) count FROM issues GROUP BY month ORDER BY month DESC LIMIT 6").all().reverse()});}));

const dist=path.join(__dirname,'../client/dist');
if(fs.existsSync(dist)){app.use(express.static(dist));app.get('*',(q,r)=>r.sendFile(path.join(dist,'index.html')));}
app.listen(process.env.PORT||4000,()=>console.log('API on http://localhost:'+(process.env.PORT||4000)));
