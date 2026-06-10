import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { fetchAllGames, createGame, deleteGame as apiDeleteGame } from "./api.js";
import { exportGamePdf } from "./exportPdf.js";
import { ZONES, LEGACY_ZONES, THREE_PT, Q_LABELS, mapZone, genId, makeEvent, toEventLog, computeGameStats, lastActiveTally, lastActiveEventOfType, tallyEntries, ftEntries, describeEvent, getPoints, getLineupNames } from "./gameEngine.js";
import { dbPutGame, dbGetAllGames, dbDeleteGame, dbAvailable } from "./db.js";
import { enqueue, onSyncStatus, startSyncLoop } from "./sync.js";

const DEFAULT_ROSTER = [
  {number:"3",name:"Bella"},{number:"4",name:"Maliah"},{number:"5",name:"Hayden"},
  {number:"12",name:"Nikki"},{number:"21",name:"Adyson"},{number:"23",name:"Journey"},{number:"24",name:"Caroline"},
];

const SHELL={minHeight:"100vh",background:"#0a0a0a",fontFamily:"'SF Pro Display','Helvetica Neue',sans-serif",color:"#fff",userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",maxWidth:960,margin:"0 auto"};
const INP={background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",fontSize:14,padding:"10px 12px",borderRadius:8,outline:"none",width:"100%",boxSizing:"border-box"};
const ACCENT={background:"#facc15",border:"none",color:"#000",fontSize:13,fontWeight:700,padding:"10px 20px",borderRadius:8,cursor:"pointer"};
const LINK={background:"none",border:"none",color:"#facc15",fontSize:13,cursor:"pointer",padding:0,fontWeight:600};
const LABEL={fontSize:11,color:"#666",letterSpacing:1,textTransform:"uppercase",display:"block",marginBottom:6};
const SUBHEAD={fontSize:11,color:"#555",letterSpacing:2,textTransform:"uppercase",marginTop:2};
const SECHEAD={fontSize:10,color:"#555",letterSpacing:2,marginBottom:8,textTransform:"uppercase"};
const JERSEY={borderRadius:8,background:"rgba(250,204,21,0.15)",border:"1px solid rgba(250,204,21,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#facc15"};
const CC={rebound_off:{t:"#22c55e",bg:"rgba(34,197,94,0.08)",bd:"rgba(34,197,94,0.3)"},rebound_def:{t:"#22c55e",bg:"rgba(34,197,94,0.08)",bd:"rgba(34,197,94,0.3)"},assist:{t:"#22c55e",bg:"rgba(34,197,94,0.08)",bd:"rgba(34,197,94,0.3)"},foul:{t:"#f97316",bg:"rgba(249,115,22,0.08)",bd:"rgba(249,115,22,0.3)"},turnover:{t:"#a855f7",bg:"rgba(168,85,247,0.08)",bd:"rgba(168,85,247,0.3)"},steal:{t:"#3b82f6",bg:"rgba(59,130,246,0.08)",bd:"rgba(59,130,246,0.3)"},block:{t:"#ec4899",bg:"rgba(236,72,153,0.08)",bd:"rgba(236,72,153,0.3)"},opp_foul:{t:"#ef4444",bg:"rgba(239,68,68,0.06)",bd:"rgba(239,68,68,0.25)"},ft:{t:"#818cf8",bg:"rgba(129,140,248,0.08)",bd:"rgba(129,140,248,0.3)"}};

function StatBox({label,value,color}){return <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color,lineHeight:1}}>{value}</div><div style={{fontSize:8,color:"#555",letterSpacing:1.2,marginTop:3,textTransform:"uppercase"}}>{label}</div></div>;}

function TapBtn({onTap,children,color="#555",size=44,fontSize=20}){
  const[pressed,setPressed]=useState(false);
  return <span onClick={onTap} onPointerDown={()=>setPressed(true)} onPointerUp={()=>setPressed(false)} onPointerLeave={()=>setPressed(false)} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:size,minHeight:size,color,fontSize,cursor:"pointer",borderRadius:8,background:pressed?"rgba(255,255,255,0.12)":"transparent",transform:pressed?"scale(0.92)":"none",transition:"transform 0.05s",touchAction:"manipulation"}}>{children}</span>;
}

function TallyCard({title,type,entries,onAdd,onInc,onDec,compact,warnAt}){
  const c=CC[type]||CC.rebound_def;const total=entries.reduce((s,e)=>s+e.count,0);
  const fs=compact?{t:12,c:11,n:11,v:14}:{t:14,c:13,n:12,v:15};
  return(<div style={{background:c.bg,border:"1.5px solid "+c.bd,borderRadius:compact?10:12,padding:compact?"8px 10px":"10px 12px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:entries.length>0?4:0}}>
      <span style={{fontSize:fs.t,fontWeight:800,color:c.t}}>{title}</span><span style={{fontSize:fs.c,color:c.t,fontWeight:700}}>{total}</span></div>
    {entries.map(e=>{const w=warnAt&&e.count>=warnAt;return(
      <div key={e.num} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1px 0"}}>
        <span style={{fontSize:fs.n,color:"#ccc"}}>{w?"⚠ ":""}#{e.num} {e.name}</span>
        <div style={{display:"flex",alignItems:"center"}}><TapBtn onTap={()=>onDec(e.num)} size={compact?40:44} fontSize={compact?16:18}>-</TapBtn><span style={{fontSize:fs.v,fontWeight:800,color:w?"#ef4444":c.t,minWidth:18,textAlign:"center"}}>{e.count}</span><TapBtn onTap={()=>onInc(e.num)} size={compact?40:44} fontSize={compact?16:18}>+</TapBtn></div>
      </div>);})}
    <div onClick={onAdd} style={{textAlign:"center",color:c.t,fontSize:compact?18:20,cursor:"pointer",marginTop:entries.length>0?2:0,minHeight:40,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>+</div>
  </div>);
}

export default function App(){
  const[sessions,setSessions]=useState([]);
  const[curId,setCurId]=useState(null);
  const[eventLog,setEventLog]=useState([]);
  const[players,setPlayers]=useState([]);
  const[quarter,setQuarter]=useState(0);
  const[activeZone,setActiveZone]=useState(null);
  const[ftMode,setFtMode]=useState(false);
  const[teamName,setTeamName]=useState("");
  const[editName,setEditName]=useState(false);
  const[flash,setFlash]=useState(null);
  const[view,setView]=useState("loading"); // loading|history|roster|startingFive|tracker
  const[pending,setPending]=useState(null);
  const[pendingAssist,setPendingAssist]=useState(null);
  const[pendingTally,setPendingTally]=useState(null);
  const[showTOPicker,setShowTOPicker]=useState(false);
  const[showOppFoulInput,setShowOppFoulInput]=useState(false);
  const[oppFoulNum,setOppFoulNum]=useState("");
  const[showStats,setShowStats]=useState(false);
  const[showYearStats,setShowYearStats]=useState(false);
  const[showRecent,setShowRecent]=useState(false);
  const[foulWarning,setFoulWarning]=useState(null);
  const[rName,setRName]=useState("");
  const[rNum,setRNum]=useState("");
  const[syncState,setSyncState]=useState("synced");
  const[shareMsg,setShareMsg]=useState(null);
  // New: lineup selection + sub flow
  const[selectedStarters,setSelectedStarters]=useState(new Set());
  const[subOut,setSubOut]=useState(null);
  const[subIn,setSubIn]=useState(null);
  const[showSubFlow,setShowSubFlow]=useState(false);
  const[showQtrTransition,setShowQtrTransition]=useState(false);
  const idRef=useRef(null); idRef.current=curId;
  const logRef=useRef(eventLog); logRef.current=eventLog;

  useEffect(()=>{
    let cancelled=false;
    onSyncStatus(s=>{if(!cancelled)setSyncState(s);});
    (async()=>{
      let localGames=[];
      if(dbAvailable()){try{localGames=await dbGetAllGames();}catch(e){}}
      if(!cancelled&&localGames.length>0){setSessions(sortG(localGames));setView("history");}
      const serverGames=await fetchAllGames();
      if(cancelled)return;
      if(serverGames!==null){
        let dirtyIds=[];try{const{dbGetDirtyIds}=await import("./db.js");dirtyIds=await dbGetDirtyIds();}catch(e){}
        const dirty=new Set(dirtyIds),localById={};localGames.forEach(g=>{localById[g.id]=g;});
        const merged=serverGames.map(sg=>dirty.has(sg.id)&&localById[sg.id]?localById[sg.id]:normG(sg));
        const sIds=new Set(serverGames.map(g=>g.id));
        localGames.forEach(lg=>{if(!sIds.has(lg.id))merged.push(lg);});
        if(!cancelled){setSessions(sortG(merged));for(const g of merged){try{await dbPutGame(g);}catch(e){}}}
        startSyncLoop();
      }else if(localGames.length===0&&!cancelled){setSyncState("error");}
      if(!cancelled)setView(v=>v==="loading"?"history":v);
    })();
    return()=>{cancelled=true;};
  },[]);

  function normG(g){return{id:g.id,teamName:g.team_name||g.teamName||"",team_name:g.team_name||g.teamName||"",players:g.players||[],shots:g.shots||[],events:g.events||[],quarter:g.quarter||0,created_at:g.created_at||g.createdAt||new Date().toISOString()};}
  function sortG(arr){return[...arr].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));}

  const persist=useCallback((newLog,newQuarter)=>{
    const sid=idRef.current;if(!sid)return;
    setSessions(prev=>prev.map(s=>{
      if(s.id!==sid)return s;
      const u={...s,events:newLog!==undefined?newLog:s.events,shots:[],quarter:newQuarter!==undefined?newQuarter:s.quarter};
      try{dbPutGame(u);}catch(e){}try{enqueue(u.id);}catch(e){}return u;
    }));
  },[]);

  const append=useCallback((type,payload)=>{
    const e=makeEvent(logRef.current,type,quarter,payload);
    const nl=[...logRef.current,e];setEventLog(nl);persist(nl,undefined);return e;
  },[quarter,persist]);

  const doFlash=r=>{setFlash(r);setTimeout(()=>setFlash(null),350);};
  const addPlayer=()=>{if(!rNum.trim())return;const n=rNum.trim();if(players.find(p=>p.number===n))return;setPlayers(prev=>[...prev,{number:n,name:rName.trim()||("#"+n)}]);setRName("");setRNum("");};

  const startSession=()=>{
    const id=genId();
    const game={id,teamName:teamName||"Game",team_name:teamName||"Game",players:[...players],shots:[],events:[],quarter:0,created_at:new Date().toISOString()};
    (async()=>{
      const saved=await createGame({team_name:game.team_name,players:game.players,shots:[],events:[],quarter:0,created_at:game.created_at});
      if(saved&&saved.id&&saved.id!==id){setSessions(prev=>prev.map(s=>s.id===id?{...s,id:saved.id}:s));if(idRef.current===id)setCurId(saved.id);try{await dbDeleteGame(id);}catch(e){}const rk={...game,id:saved.id};try{await dbPutGame(rk);}catch(e){}}
      else{try{enqueue(id);}catch(e){}}
    })();
    try{dbPutGame(game);}catch(e){}
    setSessions(prev=>[game,...prev]);setCurId(id);setEventLog([]);setQuarter(0);setActiveZone(null);setFtMode(false);setPending(null);setPendingAssist(null);setPendingTally(null);
    setSelectedStarters(new Set());setView("startingFive");
  };

  const openSession=s=>{
    setCurId(s.id);setEventLog(toEventLog(s));setPlayers([...(s.players||[])]);setTeamName(s.teamName||s.team_name||"");setQuarter(s.quarter||0);
    setActiveZone(null);setFtMode(false);setPending(null);setPendingAssist(null);setPendingTally(null);setShowRecent(false);setView("tracker");
  };

  const deleteSession=async(id,e)=>{e.stopPropagation();setSessions(prev=>prev.filter(s=>s.id!==id));if(curId===id){setCurId(null);setEventLog([]);setPlayers([]);}try{await dbDeleteGame(id);}catch(er){}if(navigator.onLine!==false)await apiDeleteGame(id);};
  const shareGame=id=>{const url=window.location.origin+"/game/"+id;if(navigator.clipboard){navigator.clipboard.writeText(url);setShareMsg(id);setTimeout(()=>setShareMsg(null),2000);}else{prompt("Share this link:",url);}};

  const stats=useMemo(()=>computeGameStats(eventLog,players),[eventLog,players]);
  const sortedPlayers=useMemo(()=>[...players].sort((a,b)=>parseInt(a.number)-parseInt(b.number)),[players]);
  const recentActions=useMemo(()=>[...stats.activeEvents].sort((a,b)=>b.seq-a.seq).slice(0,15),[stats]);
  const onCourtNames=useMemo(()=>getLineupNames(stats.lineup,players),[stats.lineup,players]);
  const benchPlayers=useMemo(()=>sortedPlayers.filter(p=>!stats.lineup.includes(p.number)),[sortedPlayers,stats.lineup]);
  const hasLineup=stats.lineup.length===5;

  const qFoulsNow=stats.qtrFouls[quarter]||0;
  const inBonus=qFoulsNow>=5;
  const oppQFoulsNow=stats.oppQtrFouls[quarter]||0;
  const oppInBonus=oppQFoulsNow>=5;
  const anyPending=!!pending||!!pendingAssist||!!pendingTally||showTOPicker||showOppFoulInput||showSubFlow||showQtrTransition;

  const orbEntries=tallyEntries(stats,"rebound_off",players);
  const drbEntries=tallyEntries(stats,"rebound_def",players);
  const astEntries=tallyEntries(stats,"assist",players);
  const foulEntries=tallyEntries(stats,"foul",players);
  const toEntries=tallyEntries(stats,"turnover",players);
  const stlEntries=tallyEntries(stats,"steal",players);
  const blkEntries=tallyEntries(stats,"block",players);
  const oppFoulEntries=Object.entries(stats.oppFoulsByPlayer).map(([n,c])=>({num:n,count:c})).sort((a,b)=>b.count-a.count);
  const ftData=ftEntries(stats,players);

  /* ─── HANDLERS ─── */
  const handleZoneTap=useCallback(id=>{if(!ftMode&&!anyPending)setActiveZone(id);},[ftMode,anyPending]);
  const handleMakeMiss=result=>{
    if(anyPending)return;
    if(ftMode){
      if(players.length===0){append("free_throw_attempt",{result,points:result==="make"?1:0});doFlash(result);}
      else setPending({kind:"ft",result});
      return;
    }
    if(!activeZone)return;
    if(players.length===0){append("shot_attempt",{zone:activeZone,result,points:getPoints(activeZone,result,false)});doFlash(result);setActiveZone(null);}
    else setPending({kind:"fg",result,zone:activeZone});
  };
  const pickPlayer=num=>{
    if(!pending)return;
    if(pending.kind==="ft"){append("free_throw_attempt",{playerNum:num,result:pending.result,points:pending.result==="make"?1:0});doFlash(pending.result);setPending(null);return;}
    append("shot_attempt",{playerNum:num,zone:pending.zone,result:pending.result,points:getPoints(pending.zone,pending.result,false)});
    doFlash(pending.result);setActiveZone(null);
    if(pending.result==="make"&&players.length>1){setPending(null);setPendingAssist({scorerNum:num});return;}
    setPending(null);
  };
  const pickAssist=num=>{append("stat_tally",{stat:"assist",playerNum:num});setPendingAssist(null);};

  const incrementStat=(stat,playerNum)=>{
    append("stat_tally",{stat,playerNum});
    if(stat==="foul"){const nc=(stats.players[playerNum]?.fouls||0)+1;if(nc>=4){const p=players.find(x=>x.number===playerNum);setFoulWarning((p?p.name:"#"+playerNum)+" has "+nc+" fouls!");setTimeout(()=>setFoulWarning(null),3500);}}
  };
  const decrementStat=(stat,playerNum)=>{const t=lastActiveTally(logRef.current,stat,playerNum);if(!t)return;append("reversal",{targetId:t.id});};
  const tallyPickPlayer=num=>{if(!pendingTally)return;incrementStat(pendingTally.type,num);setPendingTally(null);};
  const handleOppFoulAdd=num=>{if(!num)return;incrementStat("opp_foul",String(num));setOppFoulNum("");};
  const handleTimeout=dur=>{const left=dur===60?stats.to60left:stats.to30left;if(left<=0)return;append("timeout",{duration:dur});setShowTOPicker(false);};
  const handleOppScore=pts=>{append("opp_score",{points:pts});};
  const handleOppScoreUndo=()=>{const t=lastActiveEventOfType(logRef.current,"opp_score");if(t)append("reversal",{targetId:t.id});};

  /* Lineup: confirm starting 5 */
  const confirmStarters=()=>{
    if(selectedStarters.size!==5)return;
    append("lineup_set",{players:[...selectedStarters]});
    setView("tracker");
  };
  /* Sub flow */
  const confirmSub=()=>{
    if(!subOut||!subIn)return;
    append("lineup_change",{playerOut:subOut,playerIn:subIn});
    setSubOut(null);setSubIn(null);setShowSubFlow(false);
  };
  /* Quarter transition */
  const advanceQuarter=()=>{setShowQtrTransition(true);};
  const carryLineup=()=>{
    const nq=(quarter+1)%Q_LABELS.length;setQuarter(nq);
    if(hasLineup) append("lineup_set",{players:[...stats.lineup]});
    const e=makeEvent(logRef.current,"quarter_set",nq,{toQuarter:nq});const nl=[...logRef.current,e];setEventLog(nl);persist(nl,nq);
    setShowQtrTransition(false);
  };
  const newLineup=()=>{
    const nq=(quarter+1)%Q_LABELS.length;setQuarter(nq);
    const e=makeEvent(logRef.current,"quarter_set",nq,{toQuarter:nq});const nl=[...logRef.current,e];setEventLog(nl);persist(nl,nq);
    setSelectedStarters(new Set());setShowQtrTransition(false);setView("startingFive");
  };
  const backQuarter=()=>{const nq=(quarter-1+Q_LABELS.length)%Q_LABELS.length;setQuarter(nq);const e=makeEvent(logRef.current,"quarter_set",nq,{toQuarter:nq});const nl=[...logRef.current,e];setEventLog(nl);persist(nl,nq);};
  const deleteAction=item=>{append("reversal",{targetId:item.id});};

  /* Visual helpers */
  const zoneStats=stats.zoneStats;
  const getZC=id=>{const s=zoneStats[id];if(!s||!s.total)return"rgba(255,255,255,0.04)";const p=s.makes/s.total;return p>=0.5?"rgba(34,197,94,0.25)":p>=0.35?"rgba(250,204,21,0.15)":"rgba(239,68,68,0.2)";};
  const getZB=id=>{if(activeZone===id)return"rgba(255,255,255,0.9)";const s=zoneStats[id];if(!s||!s.total)return"rgba(255,255,255,0.12)";const p=s.makes/s.total;return p>=0.5?"rgba(34,197,94,0.5)":p>=0.35?"rgba(250,204,21,0.4)":"rgba(239,68,68,0.45)";};
  const getZT=id=>{const s=zoneStats[id];if(!s||!s.total)return"rgba(255,255,255,0.12)";const p=s.makes/s.total;return p>=0.5?"#22c55e":p>=0.35?"#facc15":"#ef4444";};
  const flashBorder=flash==="make"?"2px solid #22c55e":flash==="miss"?"2px solid #ef4444":"2px solid transparent";
  const fmtDate=iso=>{try{return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}catch(e){return"";}};
  const StatusBadge=()=>{
    if(syncState==="synced")return<span style={{color:"#22c55e",fontSize:10,marginLeft:8}}>✓ Synced</span>;
    if(syncState==="syncing")return<span style={{color:"#facc15",fontSize:10,marginLeft:8}}>↻ Syncing…</span>;
    if(syncState==="local"||syncState==="offline")return<span style={{color:"#f97316",fontSize:10,marginLeft:8}}>● Saved locally</span>;
    if(syncState==="error")return<span style={{color:"#f97316",fontSize:10,marginLeft:8}}>● Saved — will retry</span>;
    return null;
  };
  const canRecord=ftMode||activeZone;

  if(view==="loading")return<div style={{...SHELL,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#555",fontSize:14}}>Loading...</div></div>;

  // ═══ ROSTER ═══
  if(view==="roster")return(
    <div style={SHELL}>
      <div style={{padding:"20px 16px 8px"}}><button onClick={()=>setView("history")} style={LINK}>← Back</button><div style={{fontSize:20,fontWeight:800,marginTop:8}}>New Session</div><div style={SUBHEAD}>Add your roster</div></div>
      <div style={{padding:"0 16px",marginBottom:16}}><label style={LABEL}>Team / Game Name</label><input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="e.g. Varsity vs Lincoln" style={INP}/></div>
      <div style={{padding:"0 16px",marginBottom:16}}><label style={LABEL}>Add Player</label>
        <div style={{display:"flex",gap:8}}><input value={rNum} onChange={e=>setRNum(e.target.value.replace(/\D/g,"").slice(0,3))} placeholder="#" style={{...INP,width:56,textAlign:"center",fontSize:18,fontWeight:800}} inputMode="numeric"/><input value={rName} onChange={e=>setRName(e.target.value)} placeholder="Name (optional)" style={{...INP,flex:1}} onKeyDown={e=>e.key==="Enter"&&addPlayer()}/><button onClick={addPlayer} style={{...ACCENT,padding:"0 16px",fontSize:20,fontWeight:800,borderRadius:10}}>+</button></div>
      </div>
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
        {players.length===0&&<div style={{color:"#444",fontSize:13,padding:"16px 0",textAlign:"center"}}>No players yet — add jersey numbers above</div>}
        {players.map(p=><div key={p.number} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 14px"}}><div style={{...JERSEY,width:40,height:40,fontSize:18}}>{p.number}</div><div style={{flex:1,fontSize:15,fontWeight:600}}>{p.name}</div><button onClick={()=>setPlayers(x=>x.filter(q=>q.number!==p.number))} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>×</button></div>)}
      </div>
      <div style={{padding:"0 16px"}}><button onClick={startSession} disabled={players.length<5} style={{width:"100%",padding:"16px 0",borderRadius:14,border:"none",fontSize:16,fontWeight:800,cursor:players.length>=5?"pointer":"default",background:players.length>=5?"#facc15":"rgba(250,204,21,0.2)",color:players.length>=5?"#000":"rgba(250,204,21,0.4)"}}>Continue → Select Starting 5</button><div style={{textAlign:"center",fontSize:11,color:"#555",marginTop:8}}>{players.length<5?"Need at least 5 players":players.length+" players on roster"}</div></div>
    </div>
  );

  // ═══ STARTING FIVE SELECTION ═══
  if(view==="startingFive")return(
    <div style={SHELL}>
      <div style={{padding:"20px 16px 12px"}}><div style={{fontSize:20,fontWeight:800}}>Select Starting 5</div><div style={SUBHEAD}>{teamName} — {Q_LABELS[quarter]}</div></div>
      <div style={{padding:"0 16px",marginBottom:8}}><div style={{fontSize:14,fontWeight:700,color:selectedStarters.size===5?"#22c55e":"#facc15"}}>{selectedStarters.size} / 5 selected</div></div>
      <div style={{padding:"0 16px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:24}}>
        {sortedPlayers.map(p=>{const sel=selectedStarters.has(p.number);const dis=!sel&&selectedStarters.size>=5;return(
          <button key={p.number} onClick={()=>{if(dis)return;setSelectedStarters(prev=>{const n=new Set(prev);if(n.has(p.number))n.delete(p.number);else n.add(p.number);return n;});}} style={{background:sel?"rgba(34,197,94,0.15)":dis?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.06)",border:sel?"2px solid #22c55e":"2px solid rgba(255,255,255,0.1)",borderRadius:14,padding:"16px 12px",cursor:dis?"default":"pointer",opacity:dis?0.3:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minHeight:80,touchAction:"manipulation"}}>
            <div style={{fontSize:32,fontWeight:900,color:sel?"#22c55e":"#facc15",lineHeight:1}}>{p.number}</div>
            <div style={{fontSize:12,color:sel?"#22c55e":"#aaa",fontWeight:600}}>{p.name}</div>
            {sel&&<div style={{fontSize:10,color:"#22c55e",fontWeight:700}}>✓ STARTING</div>}
          </button>);})}
      </div>
      <div style={{padding:"0 16px"}}><button onClick={confirmStarters} disabled={selectedStarters.size!==5} style={{width:"100%",padding:"16px 0",borderRadius:14,border:"none",fontSize:16,fontWeight:800,cursor:selectedStarters.size===5?"pointer":"default",background:selectedStarters.size===5?"#22c55e":"rgba(34,197,94,0.15)",color:selectedStarters.size===5?"#000":"rgba(34,197,94,0.4)"}}>Lock In Starting 5 →</button></div>
    </div>
  );

  // ═══ HISTORY ═══
  if(view==="history")return(
    <div style={SHELL}>
      <div style={{padding:"20px 16px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:20,fontWeight:800}}>Shot Chart<StatusBadge/></div><div style={SUBHEAD}>Saved Sessions</div></div><button onClick={()=>{setPlayers([...DEFAULT_ROSTER]);setTeamName("");setRName("");setRNum("");setView("roster");}} style={ACCENT}>+ New Game</button></div>
      {sessions.length===0?<div style={{textAlign:"center",padding:"60px 20px",color:"#444"}}><div style={{fontSize:40,marginBottom:12}}>🏀</div><div style={{fontSize:15,fontWeight:600}}>No sessions yet</div></div>:(
        <div style={{padding:"4px 16px 20px",display:"flex",flexDirection:"column",gap:8}}>
          {(()=>{
            let yP=0,yFGm=0,yFGa=0,yFTm=0,yFTa=0,yA=0,yR=0,yS=0,yB=0,yF=0,yT=0,any=false;
            for(const s of sessions){const st=computeGameStats(toEventLog(s),s.players||[]);if(st.activeEvents.length>0)any=true;yP+=st.totalPts;yFGm+=st.fgMakes;yFGa+=st.fgTotal;yFTm+=st.ftMakes;yFTa+=st.ftTotal;yA+=st.teamAst;yR+=st.teamReb;yS+=st.teamStl;yB+=st.teamBlk;yF+=st.teamFouls;yT+=st.teamTOs;}
            if(!any)return null;
            const n=sessions.length;
            return(<><button onClick={()=>setShowYearStats(p=>!p)} style={{background:showYearStats?"rgba(250,204,21,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(showYearStats?"rgba(250,204,21,0.25)":"rgba(255,255,255,0.08)"),color:showYearStats?"#facc15":"#888",fontSize:12,fontWeight:700,padding:"10px 16px",borderRadius:10,cursor:"pointer",textAlign:"center"}}>{showYearStats?"▾ Hide Season Stats":"▸ Season Stats — "+n+" Game"+(n!==1?"s":"")+" · "+yP+" Total Pts"}</button>
            {showYearStats&&<div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:14}}>
              <div style={SECHEAD}>Season Totals</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:900,color:"#facc15"}}>{yP}</div><div style={{fontSize:8,color:"#666"}}>PTS</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#facc15"}}>{n>0?(yP/n).toFixed(1):"—"}</div><div style={{fontSize:8,color:"#666"}}>PPG</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{yFGa?Math.round(yFGm/yFGa*100)+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FG</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#818cf8"}}>{yFTa?Math.round(yFTm/yFTa*100)+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FT</div></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{yA}</div><div style={{fontSize:8,color:"#666"}}>AST</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{yR}</div><div style={{fontSize:8,color:"#666"}}>REB</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#f97316"}}>{yF}</div><div style={{fontSize:8,color:"#666"}}>FOULS</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#a855f7"}}>{yT}</div><div style={{fontSize:8,color:"#666"}}>TO</div></div>
              </div>
            </div>}</>);
          })()}
          {sessions.map(s=>{
            const st=computeGameStats(toEventLog(s),s.players||[]);const fp=st.fgTotal?Math.round(st.fgMakes/st.fgTotal*100):0;
            return(<div key={s.id} onClick={()=>openSession(s)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"14px 16px",cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:15,fontWeight:700}}>{s.teamName||s.team_name||"Unnamed"}</div><div style={{fontSize:11,color:"#666",marginTop:2}}>{fmtDate(s.created_at)}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  {st.oppScore>0&&<div style={{textAlign:"center"}}><div style={{fontSize:14,fontWeight:700,color:st.totalPts>st.oppScore?"#22c55e":st.totalPts<st.oppScore?"#ef4444":"#888"}}>{st.totalPts}-{st.oppScore}</div><div style={{fontSize:8,color:"#666"}}>SCORE</div></div>}
                  {st.oppScore===0&&<div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#facc15"}}>{st.totalPts}</div><div style={{fontSize:8,color:"#666"}}>PTS</div></div>}
                  <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:800,color:fp>=50?"#22c55e":fp>=35?"#facc15":st.fgTotal?"#ef4444":"#555"}}>{st.fgTotal?fp+"%":"—"}</div><div style={{fontSize:9,color:"#666"}}>FG {st.fgMakes}/{st.fgTotal}</div></div>
                  <button onClick={e=>{e.stopPropagation();shareGame(s.id);}} style={{background:"none",border:"none",color:shareMsg===s.id?"#22c55e":"#facc15",fontSize:13,cursor:"pointer",padding:"4px"}}>{shareMsg===s.id?"✓":"🔗"}</button>
                  <button onClick={e=>deleteSession(s.id,e)} style={{background:"none",border:"none",color:"#555",fontSize:18,cursor:"pointer",padding:"4px 2px"}}>×</button>
                </div>
              </div>
            </div>);
          })}
        </div>
      )}
    </div>
  );

  // ═══ TRACKER ═══
  const Picker=({title,sub,subColor,list,onPick,onCancel,cancelLabel})=>(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      {sub&&<div style={{fontSize:12,color:"#888",marginBottom:4,letterSpacing:1,textTransform:"uppercase"}}>{sub}</div>}
      <div style={{fontSize:18,fontWeight:800,marginBottom:20,color:subColor||"#fff"}}>{title}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,width:"100%",maxWidth:480,marginBottom:20}}>
        {list.map(p=><button key={p.number} onClick={()=>onPick(p.number)} style={{background:"rgba(255,255,255,0.08)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:14,padding:"14px 8px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,minHeight:64}}>
          <div style={{fontSize:28,fontWeight:900,color:"#facc15",lineHeight:1}}>{p.number}</div><div style={{fontSize:10,color:"#aaa",fontWeight:600}}>{p.name}</div>
        </button>)}
      </div>
      <button onClick={onCancel} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"12px 28px",borderRadius:8,cursor:"pointer",fontSize:13,minHeight:44}}>{cancelLabel||"Cancel"}</button>
    </div>
  );

  return(
    <div style={SHELL}>
      {pending&&<Picker title="Who took the shot?" sub={(pending.result==="make"?"Make":"Miss")+(pending.kind==="ft"?" (FT)":pending.zone?" — "+(ZONES.find(z=>z.id===pending.zone)?.label||""):"")} subColor={pending.result==="make"?"#22c55e":"#ef4444"} list={sortedPlayers} onPick={pickPlayer} onCancel={()=>setPending(null)}/>}
      {pendingAssist&&<Picker title="Assisted by?" sub="Make recorded" subColor="#22c55e" list={sortedPlayers.filter(p=>p.number!==pendingAssist.scorerNum)} onPick={pickAssist} onCancel={()=>setPendingAssist(null)} cancelLabel="Skip"/>}
      {pendingTally&&<Picker title={pendingTally.label} subColor={CC[pendingTally.type]?.t} list={sortedPlayers} onPick={tallyPickPlayer} onCancel={()=>setPendingTally(null)}/>}

      {/* SUB FLOW */}
      {showSubFlow&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.92)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4,color:"#fff"}}>Substitution</div>
          <div style={{fontSize:12,color:"#888",marginBottom:16}}>Select one OUT and one IN</div>
          <div style={{display:"flex",gap:24,width:"100%",maxWidth:560,marginBottom:20}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:"#ef4444",letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>On court — tap to sub OUT</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {onCourtNames.map(p=><button key={p.number} onClick={()=>setSubOut(subOut===p.number?null:p.number)} style={{background:subOut===p.number?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.06)",border:subOut===p.number?"2px solid #ef4444":"2px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,minHeight:52}}>
                  <div style={{fontSize:22,fontWeight:900,color:subOut===p.number?"#ef4444":"#facc15"}}>{p.number}</div>
                  <div style={{fontSize:13,color:"#ccc",fontWeight:600}}>{p.name}</div>
                  {subOut===p.number&&<div style={{marginLeft:"auto",color:"#ef4444",fontSize:12,fontWeight:700}}>OUT</div>}
                </button>)}
              </div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:"#22c55e",letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>Bench — tap to sub IN</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {benchPlayers.map(p=><button key={p.number} onClick={()=>setSubIn(subIn===p.number?null:p.number)} style={{background:subIn===p.number?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.06)",border:subIn===p.number?"2px solid #22c55e":"2px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,minHeight:52}}>
                  <div style={{fontSize:22,fontWeight:900,color:subIn===p.number?"#22c55e":"#facc15"}}>{p.number}</div>
                  <div style={{fontSize:13,color:"#ccc",fontWeight:600}}>{p.name}</div>
                  {subIn===p.number&&<div style={{marginLeft:"auto",color:"#22c55e",fontSize:12,fontWeight:700}}>IN</div>}
                </button>)}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:12}}>
            <button onClick={confirmSub} disabled={!subOut||!subIn} style={{padding:"14px 32px",borderRadius:12,border:"none",fontSize:14,fontWeight:800,cursor:subOut&&subIn?"pointer":"default",background:subOut&&subIn?"#22c55e":"rgba(34,197,94,0.15)",color:subOut&&subIn?"#000":"rgba(34,197,94,0.4)",minHeight:48}}>Confirm Sub</button>
            <button onClick={()=>{setShowSubFlow(false);setSubOut(null);setSubIn(null);}} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"14px 28px",borderRadius:12,cursor:"pointer",fontSize:13,minHeight:48}}>Cancel</button>
          </div>
        </div>
      )}

      {/* QUARTER TRANSITION */}
      {showQtrTransition&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.92)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4,color:"#fff"}}>{Q_LABELS[quarter]} → {Q_LABELS[(quarter+1)%Q_LABELS.length]}</div>
          <div style={{fontSize:14,color:"#facc15",marginBottom:8}}>US {stats.totalPts} — THEM {stats.oppScore}</div>
          {hasLineup&&<div style={{fontSize:12,color:"#888",marginBottom:20}}>Current: {onCourtNames.map(p=>"#"+p.number).join(", ")}</div>}
          <div style={{display:"flex",gap:12}}>
            <button onClick={carryLineup} style={{padding:"16px 28px",borderRadius:14,border:"none",fontSize:14,fontWeight:800,background:"#22c55e",color:"#000",cursor:"pointer",minHeight:52}}>Carry lineup →</button>
            <button onClick={newLineup} style={{padding:"16px 28px",borderRadius:14,border:"none",fontSize:14,fontWeight:800,background:"#facc15",color:"#000",cursor:"pointer",minHeight:52}}>Set new 5 →</button>
          </div>
          <button onClick={()=>setShowQtrTransition(false)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"12px 28px",borderRadius:8,cursor:"pointer",fontSize:13,marginTop:16,minHeight:44}}>Cancel</button>
        </div>
      )}

      {showTOPicker&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:24,color:"#fff"}}>Call Timeout</div>
          <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:280}}>
            <button onClick={()=>handleTimeout(60)} disabled={stats.to60left<=0} style={{padding:"18px 0",borderRadius:14,border:stats.to60left>0?"2px solid rgba(255,255,255,0.2)":"2px solid rgba(255,255,255,0.06)",background:stats.to60left>0?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.02)",cursor:stats.to60left>0?"pointer":"default",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:stats.to60left>0?"#fff":"#333"}}>60 sec</div><div style={{fontSize:12,color:stats.to60left>0?"#888":"#333",marginTop:4}}>{stats.to60left} remaining</div></button>
            <button onClick={()=>handleTimeout(30)} disabled={stats.to30left<=0} style={{padding:"18px 0",borderRadius:14,border:stats.to30left>0?"2px solid rgba(255,255,255,0.2)":"2px solid rgba(255,255,255,0.06)",background:stats.to30left>0?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.02)",cursor:stats.to30left>0?"pointer":"default",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:stats.to30left>0?"#fff":"#333"}}>30 sec</div><div style={{fontSize:12,color:stats.to30left>0?"#888":"#333",marginTop:4}}>{stats.to30left} remaining</div></button>
          </div>
          <button onClick={()=>setShowTOPicker(false)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"12px 28px",borderRadius:8,cursor:"pointer",fontSize:13,marginTop:20,minHeight:44}}>Cancel</button>
        </div>
      )}

      {showOppFoulInput&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:20,color:"#ef4444"}}>Opponent Foul</div>
          <div style={{display:"flex",gap:8,marginBottom:20,width:"100%",maxWidth:280}}>
            <input value={oppFoulNum} onChange={e=>setOppFoulNum(e.target.value.replace(/\D/g,"").slice(0,3))} placeholder="Opp #" style={{...INP,width:80,textAlign:"center",fontSize:20,fontWeight:800}} inputMode="numeric" autoFocus/>
            <button onClick={()=>{if(oppFoulNum.trim()){handleOppFoulAdd(oppFoulNum.trim());setShowOppFoulInput(false);}}} disabled={!oppFoulNum.trim()} style={{flex:1,padding:"12px 0",borderRadius:10,border:"none",fontSize:14,fontWeight:700,cursor:oppFoulNum.trim()?"pointer":"default",background:oppFoulNum.trim()?"#ef4444":"rgba(239,68,68,0.15)",color:oppFoulNum.trim()?"#fff":"rgba(239,68,68,0.4)"}}>Add Foul</button>
          </div>
          <button onClick={()=>{setShowOppFoulInput(false);setOppFoulNum("");}} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"12px 28px",borderRadius:8,cursor:"pointer",fontSize:13,minHeight:44}}>Cancel</button>
        </div>
      )}

      {/* HEADER */}
      <div style={{padding:"12px 16px 4px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center"}}><button onClick={()=>setView("history")} style={LINK}>← All Sessions</button><StatusBadge/></div>
          {editName?<input autoFocus value={teamName} onChange={e=>{setTeamName(e.target.value);setSessions(p=>p.map(s=>s.id===curId?{...s,teamName:e.target.value,team_name:e.target.value}:s));}} onBlur={()=>{setEditName(false);const g=sessions.find(s=>s.id===curId);if(g){try{dbPutGame({...g,teamName,team_name:teamName});}catch(e){}try{enqueue(g.id);}catch(e){}}}} onKeyDown={e=>e.key==="Enter"&&setEditName(false)} placeholder="Team name" style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",fontSize:16,fontWeight:700,padding:"4px 10px",borderRadius:6,outline:"none",width:200,marginTop:4,display:"block"}}/>
          :<div onClick={()=>setEditName(true)} style={{fontSize:16,fontWeight:700,color:teamName?"#fff":"#555",cursor:"pointer",marginTop:2}}>{teamName||"Tap to set name"}<span style={{fontSize:11,color:"#444",marginLeft:6}}>✎</span></div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={backQuarter} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#888",fontSize:12,fontWeight:700,padding:"10px 12px",borderRadius:6,cursor:"pointer",minHeight:44}}>◂</button>
          <button onClick={advanceQuarter} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#facc15",fontSize:14,fontWeight:800,padding:"10px 16px",borderRadius:8,cursor:"pointer",minWidth:52,minHeight:44,textAlign:"center"}}>{Q_LABELS[quarter]}</button>
          <button onClick={()=>setShowTOPicker(true)} disabled={anyPending||(stats.to60left<=0&&stats.to30left<=0)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:anyPending?"rgba(255,255,255,0.2)":"#ccc",fontSize:12,fontWeight:700,padding:"10px 12px",borderRadius:6,cursor:anyPending?"default":"pointer",minHeight:44}}>⏱{stats.to60left+stats.to30left}</button>
          <button onClick={()=>setShowRecent(p=>!p)} style={{background:showRecent?"rgba(250,204,21,0.12)":"rgba(255,255,255,0.08)",border:"1px solid "+(showRecent?"rgba(250,204,21,0.25)":"rgba(255,255,255,0.1)"),color:showRecent?"#facc15":"#999",fontSize:11,padding:"10px 12px",borderRadius:6,cursor:"pointer",minHeight:44,letterSpacing:1,textTransform:"uppercase"}}>Recent</button>
        </div>
      </div>

      {/* ON COURT STRIP + SUB BUTTON */}
      {hasLineup&&<div style={{padding:"2px 16px 4px",display:"flex",alignItems:"center",gap:8}}>
        <div style={{fontSize:10,color:"#555",letterSpacing:1,textTransform:"uppercase",flexShrink:0}}>ON COURT</div>
        <div style={{display:"flex",gap:4,flex:1,flexWrap:"wrap"}}>
          {onCourtNames.map(p=><div key={p.number} style={{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:6,padding:"3px 8px",fontSize:11,color:"#22c55e",fontWeight:700}}>#{p.number} {p.name}</div>)}
        </div>
        <button onClick={()=>{setSubOut(null);setSubIn(null);setShowSubFlow(true);}} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#facc15",fontSize:12,fontWeight:800,padding:"8px 16px",borderRadius:8,cursor:"pointer",minHeight:44,letterSpacing:1}}>SUB</button>
      </div>}

      {/* US / THEM SCORE BAR */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:"4px 16px 2px",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:"#888",letterSpacing:1}}>US</span>
          <span style={{fontSize:28,fontWeight:900,color:"#facc15"}}>{stats.totalPts}</span>
        </div>
        <div style={{width:1,height:24,background:"rgba(255,255,255,0.1)"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:"#888",letterSpacing:1}}>THEM</span>
          <span style={{fontSize:28,fontWeight:900,color:"#ef4444"}}>{stats.oppScore}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,marginLeft:8}}>
          <TapBtn onTap={()=>handleOppScore(1)} size={44} fontSize={14} color="#ef4444">+1</TapBtn>
          <TapBtn onTap={()=>handleOppScore(2)} size={44} fontSize={14} color="#ef4444">+2</TapBtn>
          <TapBtn onTap={()=>handleOppScore(3)} size={44} fontSize={14} color="#ef4444">+3</TapBtn>
          <TapBtn onTap={handleOppScoreUndo} size={40} fontSize={12} color="#555">undo</TapBtn>
        </div>
        {stats.oppOrbTotal>0&&<div style={{fontSize:11,color:"#ef4444",fontWeight:700,marginLeft:8}}>OPP ORB: {stats.oppOrbTotal}</div>}
      </div>

      {/* BANNERS */}
      {foulWarning&&<div style={{margin:"0 16px 4px",padding:"8px 12px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:8,fontSize:13,fontWeight:700,color:"#ef4444",textAlign:"center"}}>⚠ {foulWarning}</div>}
      {inBonus&&<div style={{margin:"0 16px 4px",padding:"6px 12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,fontSize:11,fontWeight:700,color:"#ef4444",textAlign:"center"}}>BONUS — {qFoulsNow} team fouls in {Q_LABELS[quarter]}</div>}
      {oppInBonus&&<div style={{margin:"0 16px 4px",padding:"6px 12px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:8,fontSize:11,fontWeight:700,color:"#22c55e",textAlign:"center"}}>OPP BONUS — {oppQFoulsNow} opponent fouls in {Q_LABELS[quarter]}</div>}

      {/* RECENT PANEL */}
      {showRecent&&<div style={{margin:"0 16px 8px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,overflow:"hidden"}}>
        <div style={{padding:"8px 12px 6px",fontSize:10,color:"#555",letterSpacing:1,textTransform:"uppercase"}}>Last {Math.min(recentActions.length,15)} actions</div>
        {recentActions.length===0?<div style={{padding:"12px",fontSize:12,color:"#444",textAlign:"center"}}>No actions yet</div>:
        <div style={{maxHeight:220,overflowY:"auto"}}>{recentActions.map((item,i)=>{
          const desc=describeEvent(item,players);
          const dot=item.type==="shot_attempt"?(item.result==="make"?"#22c55e":"#ef4444"):item.type==="free_throw_attempt"?(item.result==="make"?"#818cf8":"#ef4444"):item.type==="opp_score"?"#ef4444":item.type==="lineup_change"?"#facc15":item.type==="stat_tally"?(CC[item.stat]?.t||"#888"):"#888";
          return<div key={item.id} style={{display:"flex",alignItems:"center",padding:"6px 12px",borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none"}}><div style={{width:6,height:6,borderRadius:3,background:dot,flexShrink:0,marginRight:8}}/><div style={{flex:1,fontSize:11,color:"#aaa",lineHeight:1.3}}>{desc}</div><TapBtn onTap={()=>deleteAction(item)} size={40} fontSize={14} color="#555">✕</TapBtn></div>;
        })}</div>}
      </div>}

      {/* FG STATS BAR */}
      <div style={{display:"flex",justifyContent:"center",gap:14,padding:"2px 16px",flexWrap:"wrap",alignItems:"center"}}>
        <StatBox label="FG" value={stats.fgMakes+"/"+stats.fgTotal} color="#22c55e"/>
        <StatBox label="FG%" value={stats.fgTotal?stats.fgPct+"":"0"} color={stats.fgPct>=50?"#22c55e":stats.fgPct>=35?"#facc15":"#ef4444"}/>
        <StatBox label="FT" value={stats.ftMakes+"/"+stats.ftTotal} color="#818cf8"/>
        <StatBox label="ORB" value={stats.teamOrb} color="#22c55e"/>
        <StatBox label="DRB" value={stats.teamDrb} color="#22c55e"/>
      </div>

      {/* ═══ TWO-COLUMN LAYOUT ═══ */}
      <div style={{display:"flex",gap:12,padding:"4px 16px",alignItems:"flex-start"}}>

        {/* LEFT: 9-zone court + Make/Miss + compact cards */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{transition:"border-color 0.2s",border:ftMode?"2px solid rgba(129,140,248,0.3)":flashBorder,borderRadius:12,opacity:ftMode?0.4:1,pointerEvents:ftMode?"none":"auto"}}>
            <svg viewBox="0 0 400 370" style={{width:"100%",height:"auto",display:"block"}}>
              <rect x="0" y="0" width="400" height="370" rx="10" fill="#1a1206" stroke="rgba(255,180,50,0.15)" strokeWidth="1"/>
              <circle cx="200" cy="18" r="8" fill="none" stroke="rgba(255,180,50,0.5)" strokeWidth="1.5"/>
              <line x1="185" y1="4" x2="215" y2="4" stroke="rgba(255,180,50,0.35)" strokeWidth="1.5"/>
              <rect x="130" y="0" width="140" height="110" fill="none" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5"/>
              <circle cx="200" cy="110" r="60" fill="none" stroke="rgba(255,180,50,0.2)" strokeWidth="1" strokeDasharray="4,4"/>
              <path d="M 40,0 L 40,80 Q 40,280 200,300 Q 360,280 360,80 L 360,0" fill="none" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5"/>
              {ZONES.map(z=>{const s=zoneStats[z.id];const isA=activeZone===z.id;return(
                <g key={z.id} onClick={()=>handleZoneTap(z.id)} style={{cursor:"pointer"}}>
                  <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="6" fill={isA?"rgba(255,255,255,0.15)":getZC(z.id)} stroke={getZB(z.id)} strokeWidth={isA?2.5:1.5} style={{transition:"fill 0.2s"}}/>
                  {s&&s.total>0?<><text x={z.cx} y={z.cy-4} textAnchor="middle" fill={getZT(z.id)} fontSize="11" fontWeight="800" style={{pointerEvents:"none"}}>{z.label}</text><text x={z.cx} y={z.cy+10} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600" style={{pointerEvents:"none"}}>{s.makes}/{s.total}</text></>
                  :<text x={z.cx} y={z.cy+4} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="10" style={{pointerEvents:"none"}}>{z.label}</text>}
                </g>);})}
            </svg>
          </div>
          {ftMode&&<div style={{textAlign:"center",padding:"4px 0"}}><span style={{color:"#818cf8",fontSize:12,fontWeight:600}}>Free throw mode — tap Make or Miss</span></div>}
          {!ftMode&&activeZone&&<div style={{textAlign:"center",padding:"2px 0"}}><span style={{color:"#facc15",fontSize:12,fontWeight:600}}>{ZONES.find(z=>z.id===activeZone)?.label}</span><span style={{color:"#444",fontSize:12}}> — tap Make or Miss</span></div>}

          <div style={{display:"flex",gap:8,marginTop:6}}>
            <button onClick={()=>handleMakeMiss("make")} disabled={!canRecord||anyPending} style={{flex:1,padding:"14px 0",borderRadius:12,border:"none",fontSize:18,fontWeight:800,letterSpacing:2,cursor:canRecord&&!anyPending?"pointer":"default",background:canRecord&&!anyPending?(ftMode?"#818cf8":"#22c55e"):(ftMode?"rgba(129,140,248,0.15)":"rgba(34,197,94,0.15)"),color:canRecord&&!anyPending?"#000":(ftMode?"rgba(129,140,248,0.4)":"rgba(34,197,94,0.4)"),transition:"all 0.2s",minHeight:52}}>MAKE</button>
            <button onClick={()=>handleMakeMiss("miss")} disabled={!canRecord||anyPending} style={{flex:1,padding:"14px 0",borderRadius:12,border:"none",fontSize:18,fontWeight:800,letterSpacing:2,cursor:canRecord&&!anyPending?"pointer":"default",background:canRecord&&!anyPending?"#ef4444":"rgba(239,68,68,0.15)",color:canRecord&&!anyPending?"#fff":"rgba(239,68,68,0.4)",transition:"all 0.2s",minHeight:52}}>MISS</button>
          </div>
          {!ftMode&&!activeZone&&!anyPending&&<div style={{textAlign:"center",padding:"4px 0",color:"#444",fontSize:11}}>Tap a zone, then Make or Miss</div>}

          {/* Compact cards: FT, OPP ORB, Opp Fouls, Steals, Blocks */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:8}}>
            <div onClick={()=>{setFtMode(p=>!p);setActiveZone(null);setPending(null);}} style={{background:ftMode?CC.ft.bg:"rgba(129,140,248,0.05)",border:ftMode?"2px solid #818cf8":"1.5px solid "+CC.ft.bd,borderRadius:10,padding:"8px 10px",cursor:"pointer",touchAction:"manipulation"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ftData.length>0?4:0}}>
                <span style={{fontSize:12,fontWeight:800,color:"#818cf8"}}>Free throws</span><span style={{fontSize:11,color:"#818cf8",fontWeight:700}}>{stats.ftMakes}/{stats.ftTotal}</span></div>
              {ftData.map(e=><div key={e.num} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:11,color:"#ccc"}}>#{e.num} {e.name}</span><span style={{fontSize:11,color:"#888"}}>{e.made}/{e.att}</span></div>)}
              {ftMode&&<div style={{textAlign:"center",fontSize:10,color:"#818cf8",fontWeight:700,marginTop:4}}>TAP TO EXIT FT MODE</div>}
            </div>

            {/* OPP ORB */}
            <div style={{background:"rgba(239,68,68,0.06)",border:"1.5px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:12,fontWeight:800,color:"#ef4444"}}>Opp ORB</span>
              <div style={{display:"flex",alignItems:"center"}}><TapBtn onTap={()=>{const t=lastActiveTally(logRef.current,"opp_rebound_off",undefined);if(t)append("reversal",{targetId:t.id});}} size={40} fontSize={16} color="#555">-</TapBtn><span style={{fontSize:18,fontWeight:800,color:stats.oppOrbTotal>0?"#ef4444":"#444",minWidth:20,textAlign:"center"}}>{stats.oppOrbTotal}</span><TapBtn onTap={()=>append("stat_tally",{stat:"opp_rebound_off"})} size={40} fontSize={16} color="#555">+</TapBtn></div>
            </div>

            <TallyCard title="Steals" type="steal" entries={stlEntries} compact onAdd={()=>setPendingTally({type:"steal",label:"Who got the steal?"})} onInc={n=>incrementStat("steal",n)} onDec={n=>decrementStat("steal",n)}/>
            <TallyCard title="Blocks" type="block" entries={blkEntries} compact onAdd={()=>setPendingTally({type:"block",label:"Who blocked it?"})} onInc={n=>incrementStat("block",n)} onDec={n=>decrementStat("block",n)}/>

            <div style={{background:CC.opp_foul.bg,border:"1.5px solid "+CC.opp_foul.bd,borderRadius:10,padding:"8px 10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:oppFoulEntries.length>0?4:0}}>
                <span style={{fontSize:12,fontWeight:800,color:"#ef4444"}}>Opp fouls</span><span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>{stats.oppTotalFouls}</span></div>
              {oppFoulEntries.map(e=><div key={e.num} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1px 0"}}>
                <span style={{fontSize:11,color:"#ccc"}}>#{e.num}</span>
                <div style={{display:"flex",alignItems:"center"}}><TapBtn onTap={()=>decrementStat("opp_foul",e.num)} size={40} fontSize={16}>-</TapBtn><span style={{fontSize:14,fontWeight:800,color:e.count>=4?"#ef4444":"#f97316",minWidth:16,textAlign:"center"}}>{e.count}</span><TapBtn onTap={()=>incrementStat("opp_foul",e.num)} size={40} fontSize={16}>+</TapBtn></div>
              </div>)}
              <div onClick={()=>{setShowOppFoulInput(true);setOppFoulNum("");}} style={{textAlign:"center",color:"#ef4444",fontSize:18,cursor:"pointer",marginTop:oppFoulEntries.length>0?2:0,minHeight:40,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>+</div>
            </div>

            <TallyCard title="Turnovers" type="turnover" entries={toEntries} compact onAdd={()=>setPendingTally({type:"turnover",label:"Who turned it over?"})} onInc={n=>incrementStat("turnover",n)} onDec={n=>decrementStat("turnover",n)}/>
          </div>
        </div>

        {/* RIGHT: Tall tally cards — ORB, DRB, Assists, Fouls */}
        <div style={{width:230,display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
          <TallyCard title="Off rebounds" type="rebound_off" entries={orbEntries} onAdd={()=>setPendingTally({type:"rebound_off",label:"Who got the offensive rebound?"})} onInc={n=>incrementStat("rebound_off",n)} onDec={n=>decrementStat("rebound_off",n)}/>
          <TallyCard title="Def rebounds" type="rebound_def" entries={drbEntries} onAdd={()=>setPendingTally({type:"rebound_def",label:"Who got the defensive rebound?"})} onInc={n=>incrementStat("rebound_def",n)} onDec={n=>decrementStat("rebound_def",n)}/>
          <TallyCard title="Assists" type="assist" entries={astEntries} onAdd={()=>setPendingTally({type:"assist",label:"Who got the assist?"})} onInc={n=>incrementStat("assist",n)} onDec={n=>decrementStat("assist",n)}/>
          <TallyCard title="Fouls" type="foul" entries={foulEntries} warnAt={4} onAdd={()=>setPendingTally({type:"foul",label:"Who fouled?"})} onInc={n=>incrementStat("foul",n)} onDec={n=>decrementStat("foul",n)}/>
        </div>
      </div>

      {/* Player Stats + Export */}
      <div style={{padding:"8px 16px",display:"flex",gap:8}}>
        <button onClick={()=>setShowStats(p=>!p)} style={{flex:1,background:showStats?"rgba(250,204,21,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(showStats?"rgba(250,204,21,0.3)":"rgba(255,255,255,0.08)"),color:showStats?"#facc15":"#888",fontSize:12,fontWeight:700,padding:"12px 24px",borderRadius:10,cursor:"pointer",minHeight:44}}>{showStats?"▾ Hide player stats":"▸ Player stats and breakdown"}</button>
        <button onClick={()=>{const g=sessions.find(s=>s.id===curId);if(g)exportGamePdf({...g,events:eventLog,shots:[],players,quarter,teamName,team_name:teamName});}} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#888",fontSize:12,fontWeight:700,padding:"12px 16px",borderRadius:10,cursor:"pointer",minHeight:44}}>Export PDF</button>
      </div>

      {showStats&&players.length>0&&<div style={{padding:"0 16px 16px"}}>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,overflow:"hidden"}}>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:"80px repeat(12,minmax(0,1fr))",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
            <div style={{padding:"8px 8px",fontSize:9,color:"#555",letterSpacing:1}}>PLAYER</div>
            {[{l:"PTS",c:"#facc15"},{l:"FG",c:"#22c55e"},{l:"FT",c:"#818cf8"},{l:"AST",c:"#22c55e"},{l:"ORB",c:"#22c55e"},{l:"DRB",c:"#22c55e"},{l:"STL",c:"#3b82f6"},{l:"BLK",c:"#ec4899"},{l:"FLS",c:"#f97316"},{l:"TO",c:"#a855f7"},{l:"+/-",c:"#facc15"},{l:"OPP",c:"#ef4444"}].map(h=>
              <div key={h.l} style={{padding:"8px 1px",fontSize:9,color:h.c,letterSpacing:0.3,textAlign:"center"}}>{h.l}</div>
            )}
          </div>
          {sortedPlayers.map((p,ri)=>{
            const ps=stats.players[p.number]||{pts:0,fgm:0,fga:0,ftm:0,fta:0,ast:0,orb:0,drb:0,reb:0,stl:0,blk:0,fouls:0,tos:0,teamPtsOn:0,oppPtsOn:0,checkedIn:false};
            const pm=ps.checkedIn?(ps.teamPtsOn-ps.oppPtsOn):null;
            const pmColor=pm===null?"#444":pm>0?"#22c55e":pm<0?"#ef4444":"#888";
            const PM=({val,color,type:t})=><div style={{textAlign:"center"}}><div style={{display:"inline-flex",alignItems:"center"}}><TapBtn onTap={()=>decrementStat(t,p.number)} size={40} fontSize={16}>-</TapBtn><span style={{fontSize:14,fontWeight:800,color:val>0?color:"#444",minWidth:16,textAlign:"center"}}>{val}</span><TapBtn onTap={()=>incrementStat(t,p.number)} size={40} fontSize={16}>+</TapBtn></div></div>;
            return(
              <div key={p.number} style={{display:"grid",gridTemplateColumns:"80px repeat(12,minmax(0,1fr))",alignItems:"center",borderBottom:ri<sortedPlayers.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:ri%2===0?"rgba(250,204,21,0.02)":"transparent"}}>
                <div style={{padding:"6px 8px",display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:24,height:24,borderRadius:5,background:"rgba(250,204,21,0.15)",border:"1px solid rgba(250,204,21,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#facc15",fontSize:11,flexShrink:0}}>{p.number}</div>
                  <span style={{fontSize:11,fontWeight:600,color:"#ccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                </div>
                <div style={{textAlign:"center",fontSize:16,fontWeight:800,color:"#facc15"}}>{ps.pts}</div>
                <div style={{textAlign:"center",fontSize:10,color:ps.fga>0?"#888":"#444"}}>{ps.fgm}/{ps.fga}</div>
                <div style={{textAlign:"center",fontSize:10,color:ps.fta>0?"#888":"#444"}}>{ps.ftm}/{ps.fta}</div>
                <PM val={ps.ast} color="#22c55e" type="assist"/>
                <PM val={ps.orb} color="#22c55e" type="rebound_off"/>
                <PM val={ps.drb} color="#22c55e" type="rebound_def"/>
                <PM val={ps.stl} color="#3b82f6" type="steal"/>
                <PM val={ps.blk} color="#ec4899" type="block"/>
                <PM val={ps.fouls} color={ps.fouls>=4?"#ef4444":"#f97316"} type="foul"/>
                <PM val={ps.tos} color="#a855f7" type="turnover"/>
                <div style={{textAlign:"center",fontSize:14,fontWeight:800,color:pmColor}}>{pm===null?"—":(pm>0?"+":"")+pm}</div>
                <div style={{textAlign:"center",fontSize:9,color:"#666"}}>{ps.checkedIn?ps.oppPtsOn:"—"}</div>
              </div>
            );
          })}
        </div>
        {hasLineup&&<div style={{marginTop:8,padding:"8px 12px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,fontSize:10,color:"#666",lineHeight:1.5}}>Plus/minus reflects team score differential while each player was on the court. It does not adjust for teammates or opponent quality.</div>}
      </div>}
    </div>
  );
}
