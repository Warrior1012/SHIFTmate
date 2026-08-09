import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {Activity,AlertTriangle,ArrowRight,ArrowUp,BarChart3,Bell,Bot,Check,CheckCircle2,ChevronDown,Clock3,Database,FileText,History,Home,Info,ListTodo,Menu,MessageSquare,Mic,MicOff,Moon,Paperclip,Play,Plus,Search,Settings,Sparkles,Sun,TrendingUp,UserRound,Volume2,Wrench,X,Zap,LogOut,RefreshCw,Users,ShieldCheck,Upload,ExternalLink,Globe2} from 'lucide-react';
import './index.css';

const API_BASE=import.meta.env.VITE_API_BASE||'http://127.0.0.1:8000';
const GOOGLE_CLIENT_ID=import.meta.env.VITE_GOOGLE_CLIENT_ID||'';
const nav=[{id:'Dashboard',icon:Home},{id:'Handover',icon:History},{id:'Tasks',icon:ListTodo},{id:'Voice Assistant',icon:Mic},{id:'Memory',icon:Database},{id:'Machines',icon:Activity},{id:'Reports',icon:BarChart3},{id:'Notifications',icon:Bell},{id:'Settings',icon:Settings}];

const timeNow=()=>new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
const safeJson=async r=>{const t=await r.text();try{return t?JSON.parse(t):{}}catch{return {detail:t||`HTTP ${r.status}`}}};

// FIX: original had no timeout and no handling for fetch() itself throwing
// (network down / CORS / DNS) — a hung backend just spun forever with no
// feedback. Now aborts after 20s and always throws a real Error with a
// readable .message, same contract callers already expect.
async function api(path,opts={}){
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),20000);
  let r;
  try{
    r=await fetch(`${API_BASE}${path}`,{...opts,signal:controller.signal});
  }catch(err){
    if(err.name==='AbortError') throw new Error('Request timed out — SHIFTmate backend took too long to respond.');
    throw new Error('SHIFTmate backend is unavailable.');
  }finally{
    clearTimeout(timeoutId);
  }
  const data=await safeJson(r);
  if(!r.ok) throw new Error(data.detail||`Request failed (${r.status})`);
  return data;
}

function normalizeMachineName(value){
  if(value===null||value===undefined) return '';
  const s=String(value).trim();
  if(!s) return '';
  const m=s.match(/^machine\s*(\d+)$/i);
  if(m) return `Machine ${m[1]}`;
  if(/^\d+$/.test(s)) return `Machine ${s}`;
  return s;
}
function sameMachine(a,b){
  return normalizeMachineName(a).toLowerCase()===normalizeMachineName(b).toLowerCase();
}

// FIX (new): there was no error boundary anywhere, so ANY uncaught render
// error unmounted the whole tree with nothing shown — on your dark theme
// that's a literal black screen with zero clue why. This catches it and
// shows the actual error message instead, so it's diagnosable in one look
// rather than invisible.
class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  componentDidCatch(error,info){console.error('SHIFTmate crashed:',error,info)}
  render(){
    if(this.state.error){
      return <div className="min-h-screen grid place-items-center p-6 bg-[#050b14] text-slate-100">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto text-red-400" size={32}/>
          <h1 className="text-xl font-semibold mt-4">Something broke</h1>
          <p className="text-xs text-slate-500 mt-2">SHIFTmate hit an error it couldn't recover from. This is the real error — send me this text if it keeps happening:</p>
          <pre className="mt-4 p-3 rounded-lg bg-black/40 border border-white/10 text-[10px] text-red-300 text-left overflow-auto max-h-40">{String(this.state.error?.message||this.state.error)}</pre>
          <button onClick={()=>{this.setState({error:null});window.location.reload()}} className="mt-4 btn btn-primary">Reload SHIFTmate</button>
        </div>
      </div>
    }
    return this.props.children;
  }
}

function App(){
 const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('shiftmate_user')||'null')}catch{return null}});
 const [shift,setShift]=useState(()=>{try{return JSON.parse(localStorage.getItem('shiftmate_shift')||'null')}catch{return null}});
 const [active,setActive]=useState('Dashboard'); const [profileOpen,setProfileOpen]=useState(false); const [profilePos,setProfilePos]=useState(null); const [mobileNavOpen,setMobileNavOpen]=useState(false); const [language,setLanguage]=useState('en-IN'); const [tasks,setTasks]=useState([]); const [machines,setMachines]=useState([]); const [notifications,setNotifications]=useState([]); const [messages,setMessages]=useState([]); const [memories,setMemories]=useState([]); const [selectedIssue,setSelectedIssue]=useState(null); const [handover,setHandover]=useState(null); const [dark,setDark]=useState(true); const [notice,setNotice]=useState(''); const [loading,setLoading]=useState(false); const [voiceStatus,setVoiceStatus]=useState('Ready to listen'); const [listening,setListening]=useState(false); const [input,setInput]=useState('');
 const recognitionRef=useRef(null), audioRef=useRef(null), shouldListenRef=useRef(false), processingRef=useRef(false), transcriptRef=useRef(''), silenceTimerRef=useRef(null), restartTimerRef=useRef(null), profileBtnRef=useRef(null), profileMenuRef=useRef(null);
 const flash=useCallback(t=>{setNotice(t);window.clearTimeout(flash.timer);flash.timer=window.setTimeout(()=>setNotice(''),2600)},[]);
 const logout=()=>{stopVoice();localStorage.removeItem('shiftmate_user');localStorage.removeItem('shiftmate_shift');setUser(null);setShift(null);setTasks([]);setMessages([])};

 // FIX (the big one): Promise.all rejects completely the instant ANY ONE of
 // the 5 calls fails. A brand new shift with no handover generated yet
 // (completely normal right after login) is exactly the kind of thing that
 // can make one of these 404 — and when it does, NONE of tasks/machines/
 // notifications/shift/handover ever get set, every render after that shows
 // an empty shell, and the only sign anything went wrong is a toast that
 // vanishes in 2.6s. This is almost certainly your "black screen, nothing
 // loads" bug. Promise.allSettled lets each source succeed or fail on its
 // own — one bad endpoint no longer takes the other four down with it.
 const loadAll=useCallback(async()=>{
   if(!user)return;
   setLoading(true);
   const [isR,msR,nsR,shR,hoR]=await Promise.allSettled([
     api('/issues'),
     api('/machines'),
     api('/notifications'),
     api(`/shifts/current/${user.id}`),
     api('/handover/latest')
   ]);
   const failed=[];
   if(isR.status==='fulfilled') setTasks((isR.value.issues||[]).filter(Boolean)); else failed.push('issues');
   if(msR.status==='fulfilled') setMachines((msR.value.machines||[]).filter(Boolean)); else failed.push('machines');
   if(nsR.status==='fulfilled') setNotifications((nsR.value.notifications||[]).filter(Boolean)); else failed.push('notifications');
   if(shR.status==='fulfilled') setShift(shR.value.shift||null); else failed.push('shift');
   if(hoR.status==='fulfilled') setHandover(hoR.value.handover||null); else failed.push('handover');
   if(failed.length) flash(`Couldn't sync: ${failed.join(', ')}`);
   setLoading(false);
 },[user,flash]);
 useEffect(()=>{if(user)loadAll()},[user,loadAll]);
 const onLogin=useCallback(async(name,email,googleId=null,avatar=null)=>{try{const data=googleId?await api('/auth/google',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:googleId})}):await api('/auth/dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,role:'Operator'})});localStorage.setItem('shiftmate_user',JSON.stringify(data.user));localStorage.setItem('shiftmate_shift',JSON.stringify(data.shift));setUser(data.user);setShift(data.shift);flash('Signed in — current shift loaded.')}catch(e){flash(`Login failed: ${e.message}`)}},[flash]);
 const unresolved=tasks.filter(t=>!['RESOLVED','VERIFIED'].includes(t.status)).length; const resolved=tasks.filter(t=>['RESOLVED','VERIFIED'].includes(t.status)).length; const high=tasks.filter(t=>['HIGH','CRITICAL'].includes(t.priority)&&!['RESOLVED','VERIFIED'].includes(t.status)).length;

 // FIX: had zero error handling. If /issues/:id failed (deleted issue,
 // network blip), this threw an unhandled rejection AND silently ate the
 // setActive('Tasks') that was meant to run after — so "View Context"
 // looked like a dead button, exactly your "laga hua but kaam nahi karta" pattern.
 const refreshIssue=async(id)=>{
   try{
     const d=await api(`/issues/${id}`);
     setSelectedIssue({...d.issue,timeline:d.timeline});
   }catch(e){flash(e.message)}
 };

 const updateIssue=async(id,fields)=>{
   try{
     const d=await api(`/issues/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
     if(!d.issue){flash("Backend didn't return the updated issue.");return}
     setTasks(prev=>prev.map(x=>x.id===id?d.issue:x));
     setSelectedIssue(s=>s?.id===id?{...d.issue,timeline:d.timeline}:s);
     await loadAll();
     refreshHandover({silent:true});
     flash('Issue updated.')
   }catch(e){flash(e.message)}
 };
 const createIssue=async(fields)=>{
    try{
      const payload={
        ...fields,
        machine:normalizeMachineName(fields.machine),
        reporter_id:user.id,
        shift_id:shift?.id||null
      };
      const d=await api('/issues',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      if(!d.issue){flash("Backend didn't return the created issue.");return null}
      setTasks(prev=>[d.issue,...prev.filter(x=>x?.id!==d.issue.id)]);
      await loadAll();
      flash('Issue reported and stored.');
      return d.issue;
    }catch(e){
      flash(e.message);
      return null;
    }
  };
 // FIX: never touched handover after resolving, so Handover could keep
 // showing an issue as open right after you'd just resolved it — this is
 // your "dashboard doesn't update properly" complaint. Note: refreshHandover
 // calls the same /handover/generate endpoint as the explicit "Generate"
 // button — if that endpoint runs an LLM pass server-side, firing it after
 // every single resolve/update adds real latency and cost. Said as a
 // silent(=true) background call so it doesn't block the button, but if
 // it's too chatty for your backend, tell me and I'll gate it differently
 // (e.g. only refresh when the modal closes, not on every field change).
 const resolveIssue=async(id)=>{
   const fd=new FormData();fd.append('resolution','Resolved by operator after review.');
   try{
     const d=await api(`/issues/${id}/resolve`,{method:'POST',body:fd});
     if(!d.issue){flash("Backend didn't return the resolved issue.");return}
     setTasks(prev=>prev.map(x=>x.id===id?d.issue:x));
     await refreshIssue(id);
     await loadAll();
     refreshHandover({silent:true});
     flash('Issue marked resolved.')
   }catch(e){flash(e.message)}
 };
 const submitQuestion=async(q,{voice=false}={})=>{if(!q.trim()||processingRef.current)return;processingRef.current=true;const now=timeNow();setMessages(prev=>[...prev,{who:'You',text:q,time:now,user:true},{who:'SHIFTmate',text:'Searching operational memory…',time:now}]);setInput('');setVoiceStatus(voice?'SHIFTmate is thinking…':'Thinking…');try{const data=await api(voice?'/ask/voice':'/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q,language:language==='hi-IN'?'hi':language==='hinglish'?'hinglish':'en'})});setMemories(data.memories||[]);setMessages(prev=>{const u=[...prev];u[u.length-1]={who:'SHIFTmate',text:data.answer||'No grounded answer was available.',time:timeNow()};return u});if(voice&&data.audio_url)await playAudio(data.audio_url);if(looksLikeIncident(q)){try{const x=await api('/issues/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});if(x.issue){
          // Extraction only identifies the incident. Persist it through the real
          // issue API so Dashboard, Machines, Notifications and Handover all
          // read the same operational state from the backend.
          const extracted=x.issue;
          const persisted=await createIssue({
            machine: extracted.machine||'Equipment',
            issue: extracted.issue||'Operational issue',
            description: extracted.description||q,
            status: extracted.status||'REPORTED',
            priority: extracted.priority||'MEDIUM',
            maintenance: extracted.maintenance||'Pending',
            affected_order: extracted.affected_order??extracted.order??null,
            recommended_action: extracted.recommended_action||extracted.recommendedAction||null,
            assigned_to: extracted.assigned_to??extracted.assignedTo??null
          });
          if(persisted){
            await loadAll();
            await refreshHandover({silent:true});
            flash(`Issue recorded: ${persisted.machine||'Equipment'} — ${persisted.issue}`);
          }
        }
      }catch(e){console.warn('incident extraction',e);flash(`Could not save detected issue: ${e.message}`)}}}catch(e){setMessages(prev=>{const u=[...prev];u[u.length-1]={who:'SHIFTmate',text:`I couldn't complete that request: ${e.message}`,time:timeNow()};return u});flash(e.message);setVoiceStatus('Service unavailable')}finally{processingRef.current=false;if(!voice)setVoiceStatus('Ready to listen')}};
 const sendMessage=()=>submitQuestion(input);
 const playAudio=async(url)=>{let u=url.startsWith('/')?`${API_BASE}${url}`:url;u+=(u.includes('?')?'&':'?')+`t=${Date.now()}`;try{if(audioRef.current){audioRef.current.pause();audioRef.current.currentTime=0}const a=new Audio(u);audioRef.current=a;a.onended=()=>setVoiceStatus('Ready to listen');a.onerror=()=>setVoiceStatus('Response generated — audio unavailable');await a.play();setVoiceStatus('Speaking…')}catch{setVoiceStatus('Response generated — click Play response');flash('Browser blocked automatic audio. Use Play response in the voice panel.')}};
 const stopVoice=useCallback(()=>{shouldListenRef.current=false;setListening(false);setVoiceStatus('Ready to listen');if(silenceTimerRef.current)clearTimeout(silenceTimerRef.current);if(restartTimerRef.current)clearTimeout(restartTimerRef.current);if(recognitionRef.current){try{recognitionRef.current.onend=null;recognitionRef.current.stop()}catch{}recognitionRef.current=null}if(audioRef.current){audioRef.current.pause();audioRef.current.currentTime=0}},[]);
 const startVoice=useCallback(()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){flash('Use Google Chrome or Microsoft Edge for voice input.');return}if(processingRef.current){flash('SHIFTmate is still processing the last request.');return}stopVoice();shouldListenRef.current=true;transcriptRef.current='';let attempts=0;const launch=()=>{if(!shouldListenRef.current)return;const r=new SR();recognitionRef.current=r;r.lang=language==='hinglish'?'hi-IN':language;r.continuous=true;r.interimResults=true;r.maxAlternatives=1;r.onstart=()=>{attempts=0;setListening(true);setVoiceStatus('Listening…')};r.onresult=e=>{let finalText='';for(let i=e.resultIndex;i<e.results.length;i++){const txt=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)finalText+=txt+' '}if(finalText.trim()){transcriptRef.current=(transcriptRef.current+' '+finalText).trim();if(silenceTimerRef.current)clearTimeout(silenceTimerRef.current);silenceTimerRef.current=setTimeout(()=>{const q=transcriptRef.current.trim();transcriptRef.current='';shouldListenRef.current=false;try{r.stop()}catch{}setListening(false);if(q)submitQuestion(q,{voice:true})},1300)}};r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){shouldListenRef.current=false;setListening(false);setVoiceStatus('Microphone permission denied')}else if(e.error==='no-speech'){setVoiceStatus('Still listening…')}else if(e.error!=='aborted'){setVoiceStatus(`Voice input error: ${e.error}`)}};r.onend=()=>{if(!shouldListenRef.current||processingRef.current)return;attempts++;if(attempts>12){shouldListenRef.current=false;setListening(false);setVoiceStatus('Voice session ended — tap mic to restart');return}restartTimerRef.current=setTimeout(launch,180)};try{r.start()}catch(e){if(!String(e.message).includes('already started')){shouldListenRef.current=false;setListening(false);setVoiceStatus('Could not start microphone')}}};launch()},[flash,stopVoice,language]);
 useEffect(()=>()=>stopVoice(),[stopVoice]);
 useEffect(()=>{if(listening) stopVoice()},[language]);

 const generateHandover=async()=>{try{const d=await api('/handover/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shift_id:shift?.id||null})});setHandover(d.handover);setActive('Handover');flash(`Handover generated — quality ${d.handover.quality_score}%`)}catch(e){flash(e.message)}};
  const refreshHandover=async({silent=false}={})=>{
    if(!shift?.id)return null;
    try{
      const d=await api('/handover/generate',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({shift_id:shift.id})
      });
      setHandover(d.handover||null);
      if(!silent&&d.handover)flash(`Handover updated — quality ${d.handover.quality_score}%`);
      return d.handover||null;
    }catch(e){
      if(!silent)flash(`Handover update failed: ${e.message}`);
      console.warn('handover refresh',e);
      return null;
    }
  };

 const endShift=async()=>{if(!shift)return;try{const d=await api(`/shifts/${shift.id}/end`,{method:'POST'});setShift(d.shift);await generateHandover();flash('Shift ended and handover generated.')}catch(e){flash(e.message)}};
 const startNewShift=async()=>{try{const d=await api('/shifts/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:user.id})});setShift(d.shift);flash('New shift started.')}catch(e){flash(e.message)}};

 // FIX: the profile popover rendered inline inside a `relative` box in the
 // sidebar with NO way to dismiss it except navigating to Settings — no
 // outside-click, no Escape. If that box (or any ancestor — "glass",
 // "desktop-sidebar", whatever your CSS defines) clips overflow, the state
 // WAS toggling correctly, it just had nowhere visible to render — which
 // looks identical to "button does nothing". Portal it straight to <body>
 // at a position computed from the trigger button so no ancestor's overflow
 // or z-index can hide it, and give it real dismiss behavior.
 const openProfileMenu=()=>{
   const r=profileBtnRef.current?.getBoundingClientRect();
   if(r) setProfilePos({left:r.left,bottom:window.innerHeight-r.top+8,width:Math.max(r.width,220)});
   setProfileOpen(true);
 };
 useEffect(()=>{
   if(!profileOpen)return;
   const onKey=e=>{if(e.key==='Escape')setProfileOpen(false)};
   const onClick=e=>{
     if(profileBtnRef.current?.contains(e.target))return;
     if(profileMenuRef.current?.contains(e.target))return;
     setProfileOpen(false);
   };
   const onScroll=()=>setProfileOpen(false);
   document.addEventListener('keydown',onKey);
   document.addEventListener('mousedown',onClick);
   window.addEventListener('scroll',onScroll,true);
   return ()=>{document.removeEventListener('keydown',onKey);document.removeEventListener('mousedown',onClick);window.removeEventListener('scroll',onScroll,true)};
 },[profileOpen]);

 if(!user) {
   return (
     <Login
       onLogin={onLogin}
       googleConfigured={!!GOOGLE_CLIENT_ID}
     />
   );
 }

 // FIX: this used to be a single object literal building ALL NINE page
 // elements every render, even though only one is ever shown — wasteful,
 // and it's exactly how the bug below hid: TasksPage's inline prop closure
 // referenced `refreshHandover` from what it assumed was outer scope, but
 // TasksPage is its own component and never received it as a prop. That's
 // a plain ReferenceError the instant someone created an issue from the
 // Tasks page — createIssue would succeed (data got saved), then this line
 // threw before setShowCreate(false) ran, so the modal just sat there stuck
 // open looking broken even though the backend write worked. Switched to a
 // plain switch so only the active page gets built, and passed
 // refreshHandover (and flash, for the evidence-upload button) down properly.
 function renderPage(){
   switch(active){
     case 'Dashboard': return <Dashboard tasks={tasks} unresolved={unresolved} resolved={resolved} high={high} listening={listening} voiceStatus={voiceStatus} startVoice={startVoice} stopVoice={stopVoice} updateIssue={updateIssue} resolveIssue={resolveIssue} openIssue={async id=>{if(!id){setActive('Tasks');return}await refreshIssue(id);setActive('Tasks')}} messages={messages} input={input} setInput={setInput} sendMessage={sendMessage} generateHandover={generateHandover} memories={memories} refresh={loadAll}/>;
     case 'Handover': return <HandoverPage tasks={tasks} handover={handover} generate={generateHandover}/>;
     case 'Tasks': return <TasksPage tasks={tasks} updateIssue={updateIssue} resolveIssue={resolveIssue} openIssue={async id=>{await refreshIssue(id);}} selectedIssue={selectedIssue} closeIssue={()=>setSelectedIssue(null)} refresh={loadAll} createIssue={createIssue} refreshHandover={refreshHandover} flash={flash}/>;
     case 'Voice Assistant': return <VoicePage listening={listening} voiceStatus={voiceStatus} startVoice={startVoice} stopVoice={stopVoice} messages={messages} input={input} setInput={setInput} sendMessage={sendMessage} playLast={()=>{const last=audioRef.current;if(last)last.play().catch(()=>{})}} memories={memories}/>;
     case 'Memory': return <MemoryPage memories={memories} onSearch={async q=>{if(!q)return;try{const d=await api('/memory/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});setMemories(d.memories||[])}catch(e){flash(e.message)}}}/>;
     case 'Machines': return <MachinesPage machines={machines} tasks={tasks}/>;
     case 'Reports': return <ReportsPage tasks={tasks} shift={shift}/>;
     case 'Notifications': return <NotificationsPage notifications={notifications}/>;
     case 'Settings': return <SettingsPage dark={dark} setDark={setDark} refresh={loadAll}/>;
     default: return null;
   }
 }

 return <div className={`min-h-screen ${dark?'text-slate-100':'text-slate-900 bg-slate-100'}`}>
   <div className="mobile-header hidden items-center justify-between px-4 py-3 border-b border-white/10 bg-[#07101d] sticky top-0 z-30">
     <div className="font-bold text-xl">SHIFT<span className="text-violet-400">mate</span></div>
     {/* FIX: this icon had no onClick at all — on mobile there was literally
         no way to navigate between pages once the sidebar is hidden below
         the breakpoint. Wired it to a real drawer below. */}
     <button onClick={()=>setMobileNavOpen(true)} aria-label="Open menu" className="p-1 -m-1"><Menu size={20}/></button>
   </div>

   {/* FIX (new): working mobile nav drawer — portaled to <body> so it can't
       be clipped by any ancestor, closes on backdrop click, item select, or
       Sign out. */}
   {mobileNavOpen && createPortal(
     <div className="fixed inset-0 z-[100]">
       <div className="absolute inset-0 bg-black/60" onClick={()=>setMobileNavOpen(false)}/>
       <nav className="absolute left-0 top-0 h-full w-72 max-w-[80vw] bg-[#06101c] border-r border-white/10 p-4 overflow-y-auto">
         <div className="flex items-center justify-between mb-6 px-1">
           <div className="text-xl font-black">SHIFT<span className="text-violet-400">mate</span></div>
           <button onClick={()=>setMobileNavOpen(false)} aria-label="Close menu"><X size={18}/></button>
         </div>
         <div className="space-y-1">
           {nav.map(({id,icon:Icon})=><button key={id} onClick={()=>{setActive(id);setMobileNavOpen(false)}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active===id?'bg-gradient-to-r from-violet-700/80 to-indigo-700/70 text-white shadow-lg':'text-slate-300 hover:bg-white/5'}`}><Icon size={17}/><span>{id}</span></button>)}
         </div>
         <div className="mt-6 pt-4 border-t border-white/10 px-1">
           <div className="text-xs font-semibold truncate">{user.name}</div>
           <div className="text-[10px] text-slate-500">{user.role||'Operator'}</div>
           <button onClick={()=>{logout();setMobileNavOpen(false)}} className="w-full mt-3 py-2 rounded-md text-xs text-slate-500 hover:text-slate-200 text-left"><LogOut size={13} className="inline mr-1"/>Sign out</button>
         </div>
       </nav>
     </div>,
     document.body
   )}

   <aside className="desktop-sidebar fixed left-0 top-0 h-screen w-[248px] px-4 py-5 border-r border-white/10 bg-[#06101c]/95 z-20 flex flex-col">
     <div className="px-2 mb-7"><div className="text-[29px] font-black tracking-tight">SHIFT<span className="text-violet-400">mate</span></div><div className="text-[11px] text-slate-400 mt-1">Voice-first operational continuity</div></div>
     <nav className="space-y-1">{nav.map(({id,icon:Icon})=><button key={id} onClick={()=>setActive(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active===id?'bg-gradient-to-r from-violet-700/80 to-indigo-700/70 text-white shadow-lg':'text-slate-300 hover:bg-white/5'}`}><Icon size={17}/><span>{id}</span></button>)}</nav>
     <div className="mt-auto glass rounded-xl p-3 relative">
       <button ref={profileBtnRef} onClick={()=>profileOpen?setProfileOpen(false):openProfileMenu()} aria-haspopup="true" aria-expanded={profileOpen} className="w-full flex items-center gap-2 text-left">
         <div className="w-8 h-8 rounded-full bg-emerald-500/15 grid place-items-center"><UserRound size={14} className="text-emerald-300"/></div>
         <div className="flex-1 min-w-0"><div className="text-xs font-semibold truncate">{user.name}</div><div className="text-[10px] text-slate-500">{user.role||'Operator'}</div></div>
         <ChevronDown size={15} className={`transition-transform ${profileOpen?'rotate-180':''}`}/>
       </button>
       <div className="mt-4 text-[10px] text-slate-500">Current Shift</div>
       <div className="text-xs mt-1">{shift?new Date(shift.started_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'No active shift'}</div>
       {shift?<button onClick={endShift} className="w-full mt-3 py-2 rounded-md border border-red-500/40 text-red-300 text-xs hover:bg-red-500/10">End Shift</button>:<button onClick={startNewShift} className="w-full mt-3 py-2 rounded-md border border-emerald-500/40 text-emerald-300 text-xs">Start Shift</button>}
       <button onClick={logout} className="w-full mt-2 py-2 rounded-md text-xs text-slate-500 hover:text-slate-200"><LogOut size={13} className="inline mr-1"/>Sign out</button>
     </div>
   </aside>

   {profileOpen && profilePos && createPortal(
     <div ref={profileMenuRef} style={{position:'fixed',left:profilePos.left,bottom:profilePos.bottom,width:profilePos.width}} className="z-[200] rounded-xl border border-slate-700 bg-[#07101d] p-3 shadow-2xl">
       <div className="text-xs font-semibold">{user.name}</div>
       <div className="text-[10px] text-slate-500 mt-1">{user.email||'No email provided'}</div>
       <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-[10px]">
         <div className="flex justify-between"><span className="text-slate-500">Role</span><span>{user.role||'Operator'}</span></div>
         <div className="flex justify-between"><span className="text-slate-500">Voice language</span><span>{language==='hi-IN'?'Hindi':language==='hinglish'?'Hinglish':'English'}</span></div>
       </div>
       <button onClick={()=>{setActive('Settings');setProfileOpen(false)}} className="w-full mt-3 py-2 rounded-md bg-white/5 text-xs hover:bg-white/10">Account & Settings</button>
     </div>,
     document.body
   )}

   <main className="ml-0 md:ml-[248px] min-h-screen p-4 md:p-6 lg:p-7 grid-bg">
     <header className="flex items-center justify-between mb-5">
       <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 text-emerald-300 text-xs font-semibold"><span className={`w-2 h-2 rounded-full ${shift?'bg-emerald-400 pulse-dot':'bg-slate-500'}`}/>{shift?'SHIFT ACTIVE':'NO ACTIVE SHIFT'}</div>
       <div className="flex items-center gap-3 text-xs text-slate-400">
         <span>{new Date().toLocaleDateString()}</span>
         <span className="hidden sm:inline">|</span>
         <span className="hidden sm:inline">{new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
         <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1"><Globe2 size={14} className="ml-1 text-violet-300"/><button onClick={()=>setLanguage('en-IN')} className={`px-2 py-1 rounded-md text-[10px] ${language==='en-IN'?'bg-violet-600 text-white':'text-slate-400 hover:bg-white/5'}`}>English</button><button onClick={()=>setLanguage('hi-IN')} className={`px-2 py-1 rounded-md text-[10px] ${language==='hi-IN'?'bg-violet-600 text-white':'text-slate-400 hover:bg-white/5'}`}>हिन्दी</button><button onClick={()=>setLanguage('hinglish')} className={`px-2 py-1 rounded-md text-[10px] ${language==='hinglish'?'bg-violet-600 text-white':'text-slate-400 hover:bg-white/5'}`}>Hinglish</button></div>
         <button onClick={()=>setDark(v=>!v)} className="p-2 rounded-lg hover:bg-white/5">{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
         <button onClick={loadAll} className="p-2 rounded-lg hover:bg-white/5" title="Refresh"><RefreshCw size={16} className={loading?'animate-spin':''}/></button>
       </div>
     </header>
     {renderPage()}
   </main>
   {notice&&<div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl glass border-violet-400/30 shadow-lg text-sm flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400"/>{notice}</div>}
 </div>;
}

function looksLikeIncident(q){
  const s=q.toLowerCase().trim();
  const signal=/(machine\s*\d|equipment|issue|problem|vibration|overheat|temperature|leak|failure|broken|noise|maintenance|warning|urgent|abnormal|oil|pressure|stopped|मशीन\s*\d|समस्या|दिक्कत|वाइब्रेशन|कंपन|गर्मी|तापमान|लीक|खराब|मेंटेनेंस|चेतावनी|जरूरी|तेल|दबाव|बंद)/.test(s);
  const question=/^(what|why|when|where|how|did|is|was|has|can|could|tell me|show me|क्या|क्यों|कब|कहाँ|कैसे|है|था|बताओ|दिखाओ)\b/.test(s);
  return signal&&!question;
}
function Login({onLogin,googleConfigured}){const [name,setName]=useState('Tanishq');const [email,setEmail]=useState('');const [busy,setBusy]=useState(false);const google=()=>{if(!window.google||!googleConfigured){return}setBusy(true);window.google.accounts.id.initialize({client_id:import.meta.env.VITE_GOOGLE_CLIENT_ID,callback:res=>onLogin('Google Operator','',res.credential).finally?.(()=>setBusy(false))});window.google.accounts.id.prompt()};return <div className="min-h-screen grid place-items-center p-6 bg-[#050b14] grid-bg"><div className="w-full max-w-md"><div className="text-center mb-8"><div className="text-4xl font-black">SHIFT<span className="text-violet-400">mate</span></div><p className="text-sm text-slate-500 mt-2">Voice-first operational continuity</p></div><div className="glass rounded-2xl p-6"><div className="flex items-center gap-2 mb-6"><ShieldCheck size={18} className="text-emerald-300"/><div><div className="font-semibold">Operator sign in</div><div className="text-xs text-slate-500">Your shift context stays with your account.</div></div></div>{googleConfigured&&<button onClick={google} disabled={busy} className="w-full btn bg-white text-slate-900 border-white hover:bg-slate-100 flex items-center justify-center gap-2"><span className="font-bold">G</span>{busy?'Opening Google…':'Continue with Google'}</button>}{googleConfigured&&<div className="flex items-center gap-3 my-5 text-[10px] text-slate-600"><span className="h-px bg-white/10 flex-1"/>OR<span className="h-px bg-white/10 flex-1"/></div>}<label className="text-xs text-slate-400">Demo/local operator name</label><input className="field mt-2" value={name} onChange={e=>setName(e.target.value)} placeholder="Operator name"/><input className="field mt-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email (optional)"/><button onClick={()=>onLogin(name,email)} className="w-full btn btn-primary mt-4">Continue to SHIFTmate</button><p className="text-[10px] text-slate-600 mt-4 text-center">Google auth is optional. API keys never belong in the browser.</p></div></div></div>}

function Dashboard({tasks,unresolved,resolved,high,listening,voiceStatus,startVoice,stopVoice,updateIssue,resolveIssue,openIssue,messages,input,setInput,sendMessage,generateHandover,memories,refresh}){return <><section className="glass rounded-xl p-4 mb-2"><div className="text-xs font-semibold tracking-wide mb-4">CURRENT SHIFT OVERVIEW</div><div className="top-cards grid grid-cols-4 gap-3"><Stat icon={AlertTriangle} number={tasks.length} label="Total Issues" tone="red"/><Stat icon={Clock3} number={unresolved} label="Pending" tone="amber"/><Stat icon={CheckCircle2} number={resolved} label="Resolved" tone="green"/><Stat icon={ArrowUp} number={high} label="High Priority" tone="violet"/></div></section><div className="main-grid grid grid-cols-[1.15fr_1fr_330px] gap-2 mt-2"><section className="glass rounded-xl p-3 min-w-0"><SectionTitle title="ACTIVE ISSUES" right={<button onClick={refresh} className="text-[10px] text-slate-500 hover:text-white">Refresh</button>}/><div className="space-y-2">{tasks.length?tasks.slice(0,6).map(t=><TaskCard key={t.id} task={t} onUpdate={()=>resolveIssue(t.id)} onContext={()=>openIssue(t.id)}/>):<Empty text="No issues have been reported yet."/>}</div></section><VoicePanel listening={listening} voiceStatus={voiceStatus} startVoice={startVoice} stopVoice={stopVoice}/><div className="right-stack space-y-2 min-w-0"><MemoryCard memories={memories}/><Conversation messages={messages} input={input} setInput={setInput} sendMessage={sendMessage}/></div></div><section className="bottom-grid grid grid-cols-[1fr_2.2fr] gap-2 mt-2"><div className="glass rounded-xl p-4"><SectionTitle title="QUICK ACTIONS"/><div className="flex flex-wrap gap-2"><button onClick={generateHandover} className="btn btn-primary">Generate Handover</button><button onClick={()=>openIssue(null)} className="btn btn-ghost">Report Issue</button></div></div><div className="glass rounded-xl p-4"><SectionTitle title="CONTINUITY SIGNAL"/><div className="grid grid-cols-3 gap-3 text-xs"><MiniStat icon={History} title="Unresolved" value={unresolved}/><MiniStat icon={Zap} title="High priority" value={high}/><MiniStat icon={Database} title="Memory hits" value={memories.length}/></div></div></section></>}
function Stat({icon:Icon,number,label,tone}){const c={red:'border-red-500/20 bg-red-500/5 text-red-300',amber:'border-amber-500/20 bg-amber-500/5 text-amber-300',green:'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',violet:'border-violet-500/20 bg-violet-500/5 text-violet-300'};return <div className={`rounded-lg border p-3 ${c[tone]}`}><div className="flex items-center justify-between"><div className="text-2xl font-semibold">{number}</div><Icon size={17}/></div><div className="text-[11px] text-slate-400 mt-1">{label}</div></div>}
function SectionTitle({title,right}){return <div className="flex justify-between items-center text-xs font-semibold mb-3"><span>{title}</span>{right}</div>}
function TaskCard({task,onUpdate,onContext}){const critical=task.priority==='CRITICAL'||task.priority==='HIGH';const cfg=critical?{border:'border-red-500/70',text:'text-red-300',badge:'bg-red-500/15 text-red-300'}:task.priority==='MEDIUM'?{border:'border-amber-500/50',text:'text-amber-300',badge:'bg-amber-500/15 text-amber-300'}:{border:'border-emerald-500/40',text:'text-emerald-300',badge:'bg-emerald-500/15 text-emerald-300'};return <div className={`rounded-xl border ${cfg.border} p-3 bg-[#0a1220]/70`}><div className="flex gap-3"><div className="w-9 h-9 shrink-0 rounded-full bg-white/5 grid place-items-center"><Activity size={18}/></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><div><div className={`text-[10px] font-semibold ${cfg.text}`}>{task.priority} PRIORITY</div><div className="font-semibold text-sm mt-1">{normalizeMachineName(task.machine)||'Equipment'}</div></div><span className={`status-pill ${cfg.badge}`}>{task.status}</span></div><div className="text-[11px] text-slate-300 mt-1">{task.issue}</div>{task.description&&<div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{task.description}</div>}<div className="text-[10px] mt-2">Maintenance: <span className={cfg.text}>{task.maintenance}</span>{task.affected_order&&<> · Order <b>{task.affected_order}</b></>}</div>{task.assigned_to&&<div className="text-[10px] text-slate-500 mt-1">Assigned: {task.assigned_to}</div>}<div className="flex justify-end gap-1.5 mt-2"><button onClick={onContext} className="btn text-[10px] py-1.5 px-2.5 text-blue-300">View Context</button>{!['RESOLVED','VERIFIED'].includes(task.status)&&<button onClick={onUpdate} className="btn text-[10px] py-1.5 px-2.5 text-orange-300">Resolve</button>}</div></div></div></div>}
function VoicePanel({listening,voiceStatus,startVoice,stopVoice}){return <section className="glass rounded-xl p-4 flex flex-col min-h-[555px]"><SectionTitle title="VOICE ASSISTANT" right={<span className="text-[10px] text-emerald-300">{voiceStatus}</span>}/><div className="flex-1 flex flex-col items-center justify-center"><button onClick={listening?stopVoice:startVoice} className={`voice-ring ${listening?'shadow-glow':''}`}><Mic size={42} className="text-violet-300"/></button><div className="text-xl font-medium mt-7">{listening?'Listening…':'Tap to speak'}</div><div className="text-xs text-slate-500 mt-1">Chrome/Edge recommended · voice is the main workflow</div>{listening&&<div className="w-full max-w-[320px] mt-7 p-4 rounded-lg border border-violet-500/30"><div className="text-xs text-violet-300">Listening for your operational report…</div><div className="wave mt-3">{Array.from({length:32},(_,i)=><span key={i}/>)}</div></div>}<button onClick={stopVoice} className="mt-5 btn btn-ghost"><MicOff size={13} className="inline mr-1"/> Stop</button></div><div className="border-t border-white/10 pt-3 text-center text-[10px] text-slate-500"><Sparkles size={13} className="inline text-violet-400 mr-1"/>Powered by <b className="text-slate-300">Rime</b> + Qdrant</div></section>}
function MemoryCard({memories}){const m=memories[0];return <section className="glass rounded-xl p-3"><SectionTitle title="RELEVANT MEMORY" right={<Database size={14}/>}/>{m?<div className="rounded-lg border border-white/10 p-3"><div className="flex justify-between"><b className="text-sm">{m.metadata?.machine||'Operational memory'}</b><span className="text-[10px] text-emerald-300">{Math.round((m.score||0)*100)}% match</span></div><div className="text-[10px] text-slate-300 mt-2">{m.text}</div><div className="text-[9px] text-slate-600 mt-2">Source: {m.metadata?.source||'memory'}</div></div>:<Empty text="Ask SHIFTmate a question to retrieve relevant memory."/>}</section>}
function Conversation({messages,input,setInput,sendMessage}){return <section className="glass rounded-xl p-3 flex flex-col min-h-[290px]"><SectionTitle title="CONVERSATION" right={<MessageSquare size={14}/>}/><div className="flex-1 space-y-2 overflow-auto max-h-[260px] pr-1">{messages.length?messages.slice(-6).map((m,i)=><div key={i} className="flex gap-2"><div className="w-7 h-7 shrink-0 rounded-full grid place-items-center bg-white/5">{m.user?<UserRound size={13}/>:<Bot size={13}/>}</div><div><div className="flex gap-2"><span className="text-[9px] text-violet-300">{m.who}</span><span className="text-[8px] text-slate-600">{m.time}</span></div><div className="text-[10px] text-slate-300 leading-4">{m.text}</div></div></div>):<Empty text="No conversation yet."/>}</div><div className="mt-2 flex gap-2 rounded-lg border border-white/10 p-1"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Ask about a machine, previous shift or incident…" className="flex-1 bg-transparent outline-none px-2 text-[10px]"/><button onClick={sendMessage} className="w-8 h-8 rounded-md bg-violet-600 grid place-items-center"><ArrowUp size={15}/></button></div></section>}
function HandoverPage({tasks,handover,generate}){return <Page title="Shift Handover" subtitle="Generate a grounded continuity package for the next operator."><div className="grid lg:grid-cols-[1.5fr_1fr] gap-3"><div className="glass rounded-xl p-5"><div className="flex justify-between"><h3 className="font-semibold">Latest handover</h3>{handover&&<span className="status-pill bg-emerald-500/10 text-emerald-300">QUALITY {handover.quality_score}%</span>}</div>{handover?<><pre className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-300 p-4 rounded-lg border border-white/10 bg-black/10 font-sans">{handover.summary}</pre>{handover.missing_fields?.length>0&&<div className="mt-3 text-xs text-amber-300">Missing: {handover.missing_fields.join(', ')}</div>}</>:<Empty text="No handover generated yet."/>}<button onClick={generate} className="mt-4 btn btn-primary"><FileText size={14} className="inline mr-1"/>Generate grounded handover</button></div><div className="glass rounded-xl p-5"><h3 className="font-semibold">Continuity checklist</h3><div className="mt-4 space-y-3 text-xs">{['Unresolved issues carried forward','High-priority issues identified','Affected orders linked','Recommended actions included','Historical memory available'].map((x,i)=><div key={x} className="flex items-center gap-3"><div className="w-6 h-6 rounded-full bg-emerald-500/10 grid place-items-center text-emerald-300"><Check size={13}/></div>{x}</div>)}</div></div></div></Page>}
function TasksPage({tasks,updateIssue,resolveIssue,openIssue,selectedIssue,closeIssue,refresh,createIssue,refreshHandover,flash}){const [showCreate,setShowCreate]=useState(false);return <Page title="Issues" subtitle="Structured operational issue lifecycle: reported → acknowledged → in progress → resolved."><div className="flex justify-end gap-2 mb-3"><button onClick={()=>setShowCreate(true)} className="btn btn-primary"><Plus size={13} className="inline mr-1"/>Report Issue</button><button onClick={refresh} className="btn btn-ghost"><RefreshCw size={13} className="inline mr-1"/>Refresh</button></div>{tasks.length?<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{tasks.map(t=><TaskCard key={t.id} task={t} onContext={()=>openIssue(t.id)} onUpdate={()=>resolveIssue(t.id)}/>)}</div>:<div className="glass rounded-xl p-10 text-center"><AlertTriangle className="mx-auto text-slate-600"/><div className="mt-3 text-sm">No operational issues yet.</div></div>}{showCreate&&<CreateIssueModal close={()=>setShowCreate(false)} create={async f=>{const created=await createIssue(f);if(created)await refreshHandover({silent:true});setShowCreate(false)}}/>}{selectedIssue&&<IssueModal issue={selectedIssue} close={closeIssue} update={updateIssue} resolve={resolveIssue} flash={flash}/>}</Page>}
function CreateIssueModal({close,create}){const [form,setForm]=useState({machine:'',issue:'',priority:'MEDIUM',affected_order:'',description:'',recommended_action:''});const set=(k,v)=>setForm(x=>({...x,[k]:v}));return <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4"><div className="glass rounded-2xl w-full max-w-xl p-5"><div className="flex justify-between"><h2 className="text-xl font-semibold">Report operational issue</h2><button onClick={close}><X/></button></div><div className="grid sm:grid-cols-2 gap-3 mt-5"><input className="field" placeholder="Machine (e.g. Machine 3)" value={form.machine} onChange={e=>set('machine',e.target.value)}/><select className="field" value={form.priority} onChange={e=>set('priority',e.target.value)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select><input className="field sm:col-span-2" placeholder="Issue title" value={form.issue} onChange={e=>set('issue',e.target.value)}/><input className="field" placeholder="Affected order (optional)" value={form.affected_order} onChange={e=>set('affected_order',e.target.value)}/><input className="field" placeholder="Recommended action" value={form.recommended_action} onChange={e=>set('recommended_action',e.target.value)}/><textarea className="field sm:col-span-2 min-h-28" placeholder="Describe what happened…" value={form.description} onChange={e=>set('description',e.target.value)}/></div><div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" disabled={!form.issue.trim()} onClick={()=>create(form)}>Create issue</button></div></div></div>}
function IssueModal({issue,close,update,resolve,flash}){const [assign,setAssign]=useState(issue.assigned_to||'');const [status,setStatus]=useState(issue.status);const [file,setFile]=useState(null);const [uploading,setUploading]=useState(false);const upload=async()=>{if(!file)return;setUploading(true);try{const fd=new FormData();fd.append('file',file);fd.append('issue_id',String(issue.id));await api('/attachments',{method:'POST',body:fd});flash?.('Evidence uploaded.');setFile(null)}catch(e){flash?.(`Upload failed: ${e.message}`)}finally{setUploading(false)}};return <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4"><div className="glass rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto p-5"><div className="flex justify-between"><div><div className="text-xs text-violet-300">ISSUE #{issue.id}</div><h2 className="text-xl font-semibold mt-1">{normalizeMachineName(issue.machine)||'Equipment'} — {issue.issue}</h2></div><button onClick={close}><X/></button></div><div className="grid sm:grid-cols-2 gap-3 mt-5"><div><label className="text-[10px] text-slate-500">Status</label><select className="field mt-1" value={status} onChange={e=>setStatus(e.target.value)}><option>REPORTED</option><option>ACKNOWLEDGED</option><option>IN_PROGRESS</option><option>RESOLVED</option><option>VERIFIED</option></select></div><div><label className="text-[10px] text-slate-500">Assign to</label><input className="field mt-1" value={assign} onChange={e=>setAssign(e.target.value)} placeholder="Maintenance / operator"/></div></div><div className="mt-4 p-4 rounded-lg border border-white/10"><div className="text-xs text-slate-500">Recommended action</div><div className="text-sm mt-1">{issue.recommended_action||'No specific action recorded.'}</div></div><div className="mt-4"><div className="text-xs font-semibold mb-2">Timeline</div>{issue.timeline?.map(e=><div key={e.id} className="flex gap-3 text-xs py-2 border-b border-white/5"><div className="w-2 h-2 rounded-full bg-violet-400 mt-1.5"/><div><b>{e.event_type}</b> — {e.message}<div className="text-[9px] text-slate-600">{new Date(e.created_at).toLocaleString()}</div></div></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><button className="btn btn-primary" onClick={()=>{update(issue.id,{status,assigned_to:assign});close()}}>Save</button><button className="btn btn-ghost" onClick={()=>resolve(issue.id)}>Mark resolved</button><label className="btn btn-ghost cursor-pointer"><Paperclip size={13} className="inline mr-1"/>Evidence<input type="file" className="hidden" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>{file&&<button className="btn btn-ghost" onClick={upload} disabled={uploading}><Upload size={13} className="inline mr-1"/>{uploading?'Uploading…':`Upload ${file.name}`}</button>}</div></div></div>}
function VoicePage({listening,voiceStatus,startVoice,stopVoice,messages,input,setInput,sendMessage,playLast,memories}){return <Page title="Voice Assistant" subtitle="Hands-free operational guidance. Speak an incident and SHIFTmate can retain it as a structured issue."><div className="grid lg:grid-cols-[1fr_1fr] gap-3"><div className="glass rounded-xl p-8 min-h-[520px] flex flex-col items-center justify-center"><button onClick={listening?stopVoice:startVoice} className={`voice-ring ${listening?'shadow-glow':''}`}><Mic size={50} className="text-violet-300"/></button><h2 className="text-2xl font-semibold mt-8">{listening?'Listening…':'Ready to listen'}</h2><p className="text-xs text-slate-500 mt-2">{voiceStatus}</p><div className="wave mt-6">{Array.from({length:38},(_,i)=><span key={i}/>)}</div><div className="text-[10px] text-slate-600 mt-5 max-w-sm text-center">Try: “Machine 3 is vibrating badly, maintenance hasn't inspected it, and Order 178 is affected.” / “मशीन 3 में vibration आ रही है और maintenance ने अभी inspect नहीं किया है।”</div><button onClick={playLast} className="mt-5 btn btn-ghost"><Play size={13} className="inline mr-1"/>Play last response</button></div><div><Conversation messages={messages} input={input} setInput={setInput} sendMessage={sendMessage}/><div className="glass rounded-xl p-4 mt-3"><SectionTitle title="SOURCES USED"/><Sources memories={memories}/></div></div></div></Page>}
function MemoryPage({memories,onSearch}){const [q,setQ]=useState('');return <Page title="Operational Memory" subtitle="Semantic memory from Qdrant — previous shifts, incidents and similar cases."><div className="glass rounded-xl p-4"><div className="flex gap-2 mb-4"><Search size={16} className="text-slate-500 mt-2"/><input className="field" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onSearch(q)} placeholder="Search operational memory…"/><button onClick={()=>onSearch(q)} className="btn btn-primary">Search</button></div><Sources memories={memories} empty="Search for a machine, incident or previous shift."/></div></Page>}
function Sources({memories,empty='No memory sources yet.'}){return memories.length?memories.map((m,i)=><div key={m.id||i} className="border-t border-white/10 py-4 flex gap-3"><div className="w-8 h-8 rounded-lg bg-violet-500/10 grid place-items-center text-violet-300"><Database size={14}/></div><div className="flex-1"><div className="flex justify-between gap-2"><b className="text-xs">{m.metadata?.machine||m.metadata?.source||'Memory'}</b><span className="text-[10px] text-emerald-300">{Math.round((m.score||0)*100)}%</span></div><div className="text-xs text-slate-300 mt-1">{m.text}</div><div className="text-[9px] text-slate-600 mt-1">{Object.entries(m.metadata||{}).filter(([k])=>k!=='text').slice(0,5).map(([k,v])=>`${k}: ${v}`).join(' · ')}</div></div></div>):<Empty text={empty}/>} 
function MachinesPage({machines,tasks}){return <Page title="Machines" subtitle="Current operational state and recurring incident signals."><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{machines.map(m=>{const issues=tasks.filter(i=>sameMachine(i.machine,m.name));const open=issues.filter(i=>!['RESOLVED','VERIFIED'].includes(i.status));return <div key={m.id} className="glass rounded-xl p-5"><div className="flex justify-between"><div><div className="text-lg font-semibold">{m.name}</div><div className="text-[10px] text-slate-500">{issues.length} recorded incident{issues.length!==1?'s':''}</div></div><span className={`status-pill ${open.length?'bg-amber-500/10 text-amber-300':'bg-emerald-500/10 text-emerald-300'}`}>{open.length?'ATTENTION':'NORMAL'}</span></div>{open.length>0&&<div className="mt-4 p-3 rounded-lg border border-amber-500/20"><div className="text-xs text-amber-300">Open issue</div><div className="text-xs mt-1">{open[0].issue}</div></div>}<div className="mt-4 text-[10px] text-slate-500">Last maintenance: {m.last_maintenance||'Not recorded'}</div><div className="text-[10px] text-slate-500 mt-1">Next maintenance: {m.next_maintenance||'Not recorded'}</div></div>})}</div></Page>}
function ReportsPage({tasks,shift}){const total=tasks.length;const resolved=tasks.filter(i=>['RESOLVED','VERIFIED'].includes(i.status)).length;const high=tasks.filter(i=>['HIGH','CRITICAL'].includes(i.priority)).length;const rate=total?Math.round(resolved/total*100):0;return <Page title="Reports" subtitle="Shift continuity and operational health without fabricated metrics."><div className="grid md:grid-cols-3 gap-3"><ReportCard title="Issues reported" value={total} icon={AlertTriangle}/><ReportCard title="Resolution rate" value={`${rate}%`} icon={TrendingUp}/><ReportCard title="High priority" value={high} icon={Zap}/></div><div className="glass rounded-xl p-5 mt-3"><h3 className="font-semibold">Continuity timeline</h3><div className="mt-5 space-y-3 text-xs">{shift&&<div>• Shift started {new Date(shift.started_at).toLocaleString()}</div>}{tasks.slice(0,8).map(i=><div key={i.id}>• {new Date(i.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} — {i.machine||'Equipment'}: {i.issue}</div>)}{!shift&&!tasks.length&&<Empty text="No report data yet."/>}</div></div></Page>}
function NotificationsPage({notifications}){return <Page title="Notifications" subtitle="Operational alerts and high-priority continuity signals."><div className="glass rounded-xl p-4">{notifications.length?notifications.map(n=><div key={n.id} className="border-b border-white/10 py-4 flex gap-3"><Bell size={16} className={n.severity==='CRITICAL'||n.severity==='HIGH'?'text-red-300':'text-violet-300'}/><div><div className="text-sm font-medium">{n.title}</div><div className="text-xs text-slate-400 mt-1">{n.message}</div><div className="text-[9px] text-slate-600 mt-1">{new Date(n.created_at).toLocaleString()}</div></div></div>):<Empty text="No notifications."/>}</div></Page>}
function SettingsPage({dark,setDark,refresh}){const [health,setHealth]=useState(null);const check=async()=>{try{const d=await api('/health');setHealth(d)}catch(e){setHealth({status:'offline',services:{api:'offline'}})}};useEffect(()=>{check()},[]);return <Page title="Settings" subtitle="Operator experience, authentication and service health."><div className="glass rounded-xl p-5 max-w-3xl space-y-5"><SettingRow icon={Sun} title="Appearance" desc="Switch between dark and light presentation."><button onClick={()=>setDark(v=>!v)} className="btn btn-ghost">{dark?'Dark':'Light'}</button></SettingRow><SettingRow icon={Mic} title="Voice input" desc="Browser Web Speech API. Chrome/Edge recommended."><span className="text-xs text-emerald-300">Ready</span></SettingRow><SettingRow icon={Volume2} title="Rime voice output" desc="Server-side generated speech. API key remains on backend."><span className="text-xs text-slate-400">Server checked</span></SettingRow><SettingRow icon={Database} title="Qdrant memory" desc="Semantic retrieval for continuity and similar cases."><span className="text-xs text-slate-400">Server checked</span></SettingRow><SettingRow icon={ShieldCheck} title="Google Sign-In" desc="Optional OAuth login; configure VITE_GOOGLE_CLIENT_ID and backend GOOGLE_CLIENT_ID."><span className="text-xs text-slate-400">Optional</span></SettingRow><div className="pt-2"><div className="flex justify-between items-center mb-3"><div className="text-sm font-medium">Service health</div><button onClick={check} className="btn btn-ghost">Check</button></div>{health&&<div className="grid grid-cols-2 md:grid-cols-4 gap-2">{Object.entries(health.services||{}).map(([k,v])=><div key={k} className="p-3 rounded-lg border border-white/10"><div className="text-[10px] text-slate-500 uppercase">{k}</div><div className={`text-xs mt-1 ${v==='ready'||v==='configured'?'text-emerald-300':'text-amber-300'}`}>{v}</div></div>)}</div>}</div><button onClick={refresh} className="btn btn-ghost"><RefreshCw size={13} className="inline mr-1"/>Refresh application data</button></div></Page>}
function SettingRow({icon:Icon,title,desc,children}){return <div className="flex items-center gap-4 border-b border-white/10 pb-4"><div className="w-9 h-9 rounded-lg bg-white/5 grid place-items-center text-violet-300"><Icon size={17}/></div><div className="flex-1"><div className="text-sm font-medium">{title}</div><div className="text-xs text-slate-500 mt-1">{desc}</div></div>{children}</div>}
function ReportCard({title,value,icon:Icon}){return <div className="glass rounded-xl p-5"><Icon size={18} className="text-violet-300"/><div className="text-3xl font-semibold mt-4">{value}</div><div className="text-xs text-slate-500 mt-1">{title}</div></div>}
function MiniStat({icon:Icon,title,value}){return <div className="flex gap-2"><div className="w-7 h-7 rounded-full bg-white/5 grid place-items-center text-violet-300"><Icon size={13}/></div><div><div className="text-slate-500">{title}</div><div className="text-slate-200">{value}</div></div></div>}
function Empty({text}){return <div className="text-xs text-slate-600 py-5 text-center">{text}</div>}
function Page({title,subtitle,children}){return <div><div className="mb-5"><h1 className="text-2xl md:text-3xl font-semibold">{title}</h1><p className="text-xs text-slate-500 mt-1">{subtitle}</p></div>{children}</div>}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);