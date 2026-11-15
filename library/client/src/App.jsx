import{useState,useEffect,useCallback}from'react';
import{BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid}from'recharts';
import{api}from'./api.js';
const fmt=d=>d?new Date(d).toLocaleDateString():'-';
const Badge=({s})=><span className={'badge '+s}>{s}</span>;

function Login({onAuth}){
  const[mode,setMode]=useState('login'),[role,setRole]=useState('student'),[f,setF]=useState({name:'',email:'',password:''}),[err,setErr]=useState('');
  const set=k=>e=>setF({...f,[k]:e.target.value});
  const submit=async e=>{e.preventDefault();setErr('');try{
    const d=await api(mode==='login'?'/login':'/register','POST',{...f,role:mode==='login'?role:undefined});
    localStorage.token=d.token;onAuth(d.user);}catch(x){setErr(x.message)}};
  return<div className="auth"><form className="card authbox" onSubmit={submit}>
    <h1>📚 Smart Library</h1><p className="muted">{mode==='login'?'Sign in to continue':'Create a student account'}</p>
    {mode==='login'&&<div className="tabs">{['student','admin'].map(r=><button type="button" key={r} className={role===r?'on':''} onClick={()=>setRole(r)}>{r}</button>)}</div>}
    {mode==='register'&&<input placeholder="Full name" value={f.name} onChange={set('name')} required/>}
    <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required/>
    <input type="password" placeholder="Password (6+ chars)" value={f.password} onChange={set('password')} required/>
    {err&&<div className="err">{err}</div>}
    <button className="btn">{mode==='login'?'Login':'Register'}</button>
    <a href="#" onClick={e=>{e.preventDefault();setMode(mode==='login'?'register':'login');setErr('')}}>{mode==='login'?'New student? Register':'Have an account? Login'}</a>
    {mode==='login'&&<p className="muted small">Demo — admin@library.com / admin123 · student1@library.com / student123</p>}
  </form></div>;}

function Analytics(){
  const[s,setS]=useState(null);useEffect(()=>{api('/stats').then(setS)},[]);if(!s)return'Loading…';
  const cards=[['Total books',s.totalBooks],['Students',s.students],['Available',s.available],['Issued',s.issued],['Overdue',s.overdue],['Fines due','₹'+s.fines]];
  const chart=(t,data,k)=><div className="card"><h3>{t}</h3><ResponsiveContainer width="100%" height={260}><BarChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey={k} tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" fill="#2563eb" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>;
  return<><div className="grid">{cards.map(([l,v])=><div className="card stat" key={l}><span className="muted">{l}</span><b>{v}</b></div>)}</div>
    <div className="grid2">{chart('Monthly issues',s.monthly,'month')}{chart('Most popular books',s.popular,'name')}</div></>;}

function Books({admin}){
  const[books,setBooks]=useState([]),[q,setQ]=useState(''),[form,setForm]=useState(null);
  const load=useCallback(()=>api('/books?q='+encodeURIComponent(q)).then(setBooks),[q]);useEffect(()=>{load()},[load]);
  const run=p=>p.then(()=>{setForm(null);load()}).catch(e=>alert(e.message));
  const save=e=>{e.preventDefault();run(form.id?api('/books/'+form.id,'PUT',form):api('/books','POST',form))};
  const set=k=>e=>setForm({...form,[k]:e.target.value});
  return<>
    <div className="bar"><input className="search" placeholder="Search by title, author or category…" value={q} onChange={e=>setQ(e.target.value)}/>
      {admin&&<button className="btn" onClick={()=>setForm({title:'',author:'',category:'',isbn:'',copies:1})}>+ Add book</button>}</div>
    {form&&<form className="card formrow" onSubmit={save}>
      {['title','author','category','isbn'].map(k=><input key={k} placeholder={k} value={form[k]} onChange={set(k)} required={k!=='isbn'}/>)}
      <input type="number" min="1" placeholder="copies" value={form.copies} onChange={set('copies')}/>
      <button className="btn">{form.id?'Update':'Save'}</button><button type="button" className="btn ghost" onClick={()=>setForm(null)}>Cancel</button></form>}
    <div className="card tablewrap"><table><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Available</th><th></th></tr></thead><tbody>
      {books.map(b=><tr key={b.id}><td>{b.title}</td><td>{b.author}</td><td>{b.category}</td><td>{b.available}/{b.copies}</td><td className="acts">
        {admin?<><button className="btn sm ghost" onClick={()=>setForm(b)}>Edit</button><button className="btn sm danger" onClick={()=>confirm('Delete this book?')&&run(api('/books/'+b.id,'DELETE'))}>Delete</button></>
        :<button className="btn sm" disabled={!b.available} onClick={()=>run(api('/issues','POST',{book_id:b.id}))}>{b.available?'Issue':'Unavailable'}</button>}</td></tr>)}
      {!books.length&&<tr><td colSpan="5" className="muted">No books found</td></tr>}</tbody></table></div></>;}

function Students(){
  const[l,setL]=useState([]);useEffect(()=>{api('/students').then(setL)},[]);
  return<div className="card tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Books issued</th></tr></thead><tbody>
    {l.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.email}</td><td>{fmt(s.created_at)}</td><td>{s.issued}</td></tr>)}</tbody></table></div>;}

function Issues({admin,filter}){
  const[rows,setRows]=useState([]),[st,setSt]=useState([]),[bk,setBk]=useState([]),[sel,setSel]=useState({user_id:'',book_id:''});
  const load=useCallback(()=>{api('/issues').then(setRows);if(admin){api('/students').then(setSt);api('/books').then(setBk)}},[admin]);useEffect(()=>{load()},[load]);
  const act=p=>p.then(load).catch(e=>alert(e.message));
  const list=rows.filter(r=>filter==='overdue'?r.status==='overdue':filter==='active'?!r.returned_at:true);
  return<>
    {admin&&filter!=='overdue'&&<form className="card formrow" onSubmit={e=>{e.preventDefault();act(api('/issues','POST',sel))}}>
      <select value={sel.user_id} onChange={e=>setSel({...sel,user_id:e.target.value})}><option value="">Select student</option>{st.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select value={sel.book_id} onChange={e=>setSel({...sel,book_id:e.target.value})}><option value="">Select book</option>{bk.filter(b=>b.available>0).map(b=><option key={b.id} value={b.id}>{b.title} ({b.available})</option>)}</select>
      <button className="btn">Issue book</button></form>}
    <div className="card tablewrap"><table><thead><tr><th>Book</th>{admin&&<th>Student</th>}<th>Issued</th><th>Due</th><th>Status</th><th>Fine</th><th></th></tr></thead><tbody>
      {list.map(r=><tr key={r.id}><td>{r.title}</td>{admin&&<td>{r.student}</td>}<td>{fmt(r.issued_at)}</td><td>{fmt(r.due_at)}</td><td><Badge s={r.status}/></td><td>₹{r.fine}</td>
        <td>{!r.returned_at&&<button className="btn sm" onClick={()=>act(api(`/issues/${r.id}/return`,'POST'))}>Return</button>}</td></tr>)}
      {!list.length&&<tr><td colSpan="7" className="muted">Nothing here</td></tr>}</tbody></table></div></>;}

export default function App(){
  const[user,setUser]=useState(null),[ready,setReady]=useState(false),[page,setPage]=useState(''),[open,setOpen]=useState(false);
  useEffect(()=>{const t=localStorage.token;if(!t)return setReady(true);
    try{const p=JSON.parse(atob(t.split('.')[1]));api(p.role==='admin'?'/stats':'/books').then(()=>setUser({role:p.role,name:localStorage.name||'User'})).catch(()=>delete localStorage.token).finally(()=>setReady(true))}catch{setReady(true)}},[]);
  if(!ready)return null;
  if(!user)return<Login onAuth={u=>{localStorage.name=u.name;setUser(u);setPage('')}}/>;
  const admin=user.role==='admin';
  const nav=admin?[['analytics','📊 Analytics'],['books','📖 Books'],['students','🎓 Students'],['issues','🔄 Issue / Return'],['overdue','⏰ Overdue & Fines']]:[['books','📖 Browse Books'],['mine','🎒 My Books & Fines']];
  const cur=page||nav[0][0];
  const view={analytics:<Analytics/>,books:<Books admin={admin}/>,students:<Students/>,issues:<Issues admin filter="all"/>,overdue:<Issues admin filter="overdue"/>,mine:<Issues filter="all"/>}[cur];
  return<div className="shell"><aside className={open?'open':''}><h2>📚 Smart Library</h2>
    {nav.map(([k,l])=><button key={k} className={cur===k?'on':''} onClick={()=>{setPage(k);setOpen(false)}}>{l}</button>)}
    <button className="logout" onClick={()=>{localStorage.clear();setUser(null)}}>⎋ Logout</button></aside>
    <main><header><button className="burger" onClick={()=>setOpen(!open)}>☰</button><h2>{nav.find(n=>n[0]===cur)[1].slice(2)}</h2><span className="muted">{user.name} · {user.role}</span></header>{view}</main></div>;}
