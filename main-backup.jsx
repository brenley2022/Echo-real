import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{supabase}from'./supabase.js';
import'./styles.css';

const KEY='echo_memories_v2';

function pickVoice(){
  const voices=speechSynthesis.getVoices();
  return voices.find(v=>/karen|samantha|victoria|zira|female|australia|english/i.test(v.name))||voices[0];
}

function App(){
  const[locked,setLocked]=useState(true);
  const[pass,setPass]=useState('');
  const[text,setText]=useState('');
  const[memories,setMemories]=useState([]);
  const[selected,setSelected]=useState(null);
  const[listening,setListening]=useState(false);
  const[busy,setBusy]=useState(false);
  const[query,setQuery]=useState('');
  const recRef=useRef(null);
  const keepListening=useRef(false);

  useEffect(()=>{
    const saved=JSON.parse(localStorage.getItem(KEY)||'[]');
    setMemories(saved);
    speechSynthesis.getVoices();
  },[]);

  function saveLocal(items){
    setMemories(items);
    localStorage.setItem(KEY,JSON.stringify(items));
  }

  function startTalk(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert('Voice dictation is not supported in this browser. Try Chrome.');return;}
    keepListening.current=true;
    const rec=new SR();
    rec.lang='en-AU';
    rec.continuous=false;
    rec.interimResults=false;
    rec.onstart=()=>setListening(true);
    rec.onresult=e=>{
      const said=e.results[0][0].transcript;
      setText(t=>(t+' '+said).trim());
    };
    rec.onend=()=>{
      if(keepListening.current){
        setTimeout(()=>{try{rec.start()}catch{}},250);
      }else{
        setListening(false);
      }
    };
    recRef.current=rec;
    rec.start();
  }

  function stopTalk(){
    keepListening.current=false;
    recRef.current?.stop();
    setListening(false);
  }

  async function createMemory(){
    if(!text.trim()){alert('Write or say something first.');return;}
    setBusy(true);

    let ai=null;
    try{
      const res=await supabase.functions.invoke('generate-entry',{body:{rawText:text}});
      if(res.error)throw res.error;
      if(res.data?.error)throw new Error(res.data.error);
      ai=res.data;
    }catch(err){
      console.error(err);
      alert('AI failed for now, so Echo saved a basic memory.');
    }

    const memory={
      id:crypto.randomUUID(),
      title:ai?.title||text.trim().split(' ').slice(0,7).join(' '),
      entry:ai?.journal_text||text,
      raw:text,
      mood:ai?.mood||'Reflective',
      topic:ai?.topic||'Memory',
      dateISO:new Date().toISOString(),
      date:new Date().toLocaleString('en-AU'),
      x:6+Math.random()*86,
      y:12+Math.random()*72,
      favourite:false
    };

    const next=[memory,...memories];
    saveLocal(next);
    setSelected(memory);
    setText('');
    setBusy(false);
  }

  function readMemory(m){
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(m.entry);
    const voice=pickVoice();
    if(voice)u.voice=voice;
    u.pitch=1.2;
    u.rate=.9;
    speechSynthesis.speak(u);
  }

  function deleteMemory(id){
    const next=memories.filter(m=>m.id!==id);
    saveLocal(next);
    setSelected(null);
  }

  function toggleFavourite(id){
    const next=memories.map(m=>m.id===id?{...m,favourite:!m.favourite}:m);
    saveLocal(next);
    setSelected(next.find(m=>m.id===id));
  }

  const filtered=useMemo(()=>{
    const q=query.toLowerCase().trim();
    if(!q)return memories;
    return memories.filter(m=>
      [m.title,m.entry,m.raw,m.mood,m.topic,m.date].join(' ').toLowerCase().includes(q)
    );
  },[query,memories]);

  if(locked)return <div className="sky">
    <div className="moon"></div>
    <div className="loginCard">
      <h1>🦋 Echo</h1>
      <p>Every memory becomes a little light.</p>
      <input value={pass} onChange={e=>setPass(e.target.value)} placeholder="Passcode"/>
      <button onClick={()=>pass==='1234'&&setLocked(false)}>Unlock ✨</button>
      <small>Demo passcode: 1234</small>
    </div>
  </div>;

  return <div className="sky">
    <div className="moon"></div>
    <div className="cloud c1"></div>
    <div className="cloud c2"></div>
    <div className="shootingStar"></div>

    {filtered.map(m=>
      <button
        key={m.id}
        className={m.favourite?'star favourite':'star'}
        style={{left:m.x+'%',top:m.y+'%'}}
        title={`${m.title} — ${m.date}`}
        onClick={()=>setSelected(m)}
      >
        ⭐
      </button>
    )}

    <main className="panel">
      <h1>🌌 Echo</h1>
      <p className="sub">Talk naturally. Echo turns the mess into a memory.</p>

      <div className="actions">
        {!listening
          ? <button onClick={startTalk}>🎙️ Start talking</button>
          : <button onClick={stopTalk} className="stop">🛑 Stop listening</button>}
        <button onClick={createMemory} disabled={busy}>{busy?'✨ AI is writing...':'Save as star ✨'}</button>
      </div>

      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Write or speak your thoughts..."/>

      <input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your memory sky..."/>
      <p className="count">{memories.length} memories saved</p>
    </main>

    {selected&&<aside className="memoryCard">
      <button className="close" onClick={()=>setSelected(null)}>×</button>
      <p className="label">Selected Memory</p>
      <h2>✨ {selected.title}</h2>
      <small>{selected.date} · {selected.mood} · {selected.topic}</small>
      <p>{selected.entry}</p>

      <details>
        <summary>Original words</summary>
        <p>{selected.raw}</p>
      </details>

      <div className="memoryActions">
        <button onClick={()=>readMemory(selected)}>🔊 Read it</button>
        <button onClick={()=>toggleFavourite(selected.id)}>❤️ {selected.favourite?'Unfavourite':'Favourite'}</button>
        <button className="delete" onClick={()=>deleteMemory(selected.id)}>Delete</button>
      </div>
    </aside>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
