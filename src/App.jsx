import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { fetchAllGames, createGame, deleteGame as apiDeleteGame } from "./api.js";
import { exportGamePdf } from "./exportPdf.js";
import { ZONES, Q_LABELS, genId, makeEvent, toEventLog, computeGameStats, lastActiveTally, tallyEntries, ftEntries, describeEvent, getPoints } from "./gameEngine.js";
import { dbPutGame, dbGetAllGames, dbDeleteGame, dbAvailable } from "./db.js";
import { enqueue, onSyncStatus, startSyncLoop } from "./sync.js";

const DEFAULT_ROSTER = [
  { number: "3", name: "Bella" }, { number: "4", name: "Maliah" }, { number: "5", name: "Hayden" },
  { number: "12", name: "Nikki" }, { number: "21", name: "Adyson" }, { number: "23", name: "Journey" }, { number: "24", name: "Caroline" },
];

/* ─── STYLES ─── */
const SHELL = { minHeight:"100vh", background:"#0a0a0a", fontFamily:"'SF Pro Display','Helvetica Neue',sans-serif", color:"#fff", userSelect:"none", WebkitUserSelect:"none", WebkitTouchCallout:"none", maxWidth:900, margin:"0 auto" };
const INP = { background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:14, padding:"10px 12px", borderRadius:8, outline:"none", width:"100%", boxSizing:"border-box" };
const ACCENT = { background:"#facc15", border:"none", color:"#000", fontSize:13, fontWeight:700, padding:"10px 20px", borderRadius:8, cursor:"pointer" };
const LINK = { background:"none", border:"none", color:"#facc15", fontSize:13, cursor:"pointer", padding:0, fontWeight:600 };
const LABEL = { fontSize:11, color:"#666", letterSpacing:1, textTransform:"uppercase", display:"block", marginBottom:6 };
const SUBHEAD = { fontSize:11, color:"#555", letterSpacing:2, textTransform:"uppercase", marginTop:2 };
const SECHEAD = { fontSize:10, color:"#555", letterSpacing:2, marginBottom:8, textTransform:"uppercase" };
const JERSEY = { borderRadius:8, background:"rgba(250,204,21,0.15)", border:"1px solid rgba(250,204,21,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#facc15" };
const CC = { rebound:{t:"#22c55e",bg:"rgba(34,197,94,0.08)",bd:"rgba(34,197,94,0.3)"}, assist:{t:"#22c55e",bg:"rgba(34,197,94,0.08)",bd:"rgba(34,197,94,0.3)"}, foul:{t:"#f97316",bg:"rgba(249,115,22,0.08)",bd:"rgba(249,115,22,0.3)"}, turnover:{t:"#a855f7",bg:"rgba(168,85,247,0.08)",bd:"rgba(168,85,247,0.3)"}, steal:{t:"#3b82f6",bg:"rgba(59,130,246,0.08)",bd:"rgba(59,130,246,0.3)"}, block:{t:"#ec4899",bg:"rgba(236,72,153,0.08)",bd:"rgba(236,72,153,0.3)"}, opp_foul:{t:"#ef4444",bg:"rgba(239,68,68,0.06)",bd:"rgba(239,68,68,0.25)"}, ft:{t:"#818cf8",bg:"rgba(129,140,248,0.08)",bd:"rgba(129,140,248,0.3)"} };

function StatBox({ label, value, color }) {
  return <div style={{ textAlign:"center" }}><div style={{ fontSize:22, fontWeight:800, color, lineHeight:1 }}>{value}</div><div style={{ fontSize:8, color:"#555", letterSpacing:1.2, marginTop:3, textTransform:"uppercase" }}>{label}</div></div>;
}

/* Touch-friendly +/- (44px min targets, pressed feedback) */
function TapBtn({ onTap, children, color = "#555", size = 44, fontSize = 20 }) {
  const [pressed, setPressed] = useState(false);
  return (
    <span
      onClick={onTap}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", minWidth:size, minHeight:size, color, fontSize, cursor:"pointer", borderRadius:8, background:pressed?"rgba(255,255,255,0.12)":"transparent", transform:pressed?"scale(0.92)":"none", transition:"transform 0.05s", touchAction:"manipulation" }}
    >{children}</span>
  );
}

function TallyCard({ title, type, entries, onAdd, onInc, onDec, compact, warnAt }) {
  const c = CC[type] || CC.rebound;
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const fs = compact ? { title:12, count:11, name:11, num:14 } : { title:14, count:13, name:12, num:15 };
  return (
    <div style={{ background:c.bg, border:"1.5px solid "+c.bd, borderRadius:compact?10:12, padding:compact?"8px 10px":"10px 12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:entries.length>0?4:0 }}>
        <span style={{ fontSize:fs.title, fontWeight:800, color:c.t }}>{title}</span>
        <span style={{ fontSize:fs.count, color:c.t, fontWeight:700 }}>{total}</span>
      </div>
      {entries.map(e => {
        const warn = warnAt && e.count >= warnAt;
        return (
          <div key={e.num} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1px 0" }}>
            <span style={{ fontSize:fs.name, color:"#ccc" }}>{warn?"⚠ ":""}#{e.num} {e.name}</span>
            <div style={{ display:"flex", alignItems:"center" }}>
              <TapBtn onTap={()=>onDec(e.num)} size={compact?40:44} fontSize={compact?16:18}>-</TapBtn>
              <span style={{ fontSize:fs.num, fontWeight:800, color:warn?"#ef4444":c.t, minWidth:18, textAlign:"center" }}>{e.count}</span>
              <TapBtn onTap={()=>onInc(e.num)} size={compact?40:44} fontSize={compact?16:18}>+</TapBtn>
            </div>
          </div>
        );
      })}
      <div onClick={onAdd} style={{ textAlign:"center", color:c.t, fontSize:compact?18:20, cursor:"pointer", marginTop:entries.length>0?2:0, minHeight:40, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"manipulation" }}>+</div>
    </div>
  );
}

/* ─── APP ─── */
export default function App() {
  const [sessions, setSessions] = useState([]);
  const [curId, setCurId] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const [players, setPlayers] = useState([]);
  const [quarter, setQuarter] = useState(0);
  const [activeZone, setActiveZone] = useState(null);
  const [ftMode, setFtMode] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [editName, setEditName] = useState(false);
  const [flash, setFlash] = useState(null);
  const [view, setView] = useState("loading");
  const [pending, setPending] = useState(null);
  const [pendingAssist, setPendingAssist] = useState(null);
  const [pendingTally, setPendingTally] = useState(null);
  const [showTOPicker, setShowTOPicker] = useState(false);
  const [showOppFoulInput, setShowOppFoulInput] = useState(false);
  const [oppFoulNum, setOppFoulNum] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showYearStats, setShowYearStats] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [foulWarning, setFoulWarning] = useState(null);
  const [rName, setRName] = useState("");
  const [rNum, setRNum] = useState("");
  const [syncState, setSyncState] = useState("synced");
  const [shareMsg, setShareMsg] = useState(null);
  const idRef = useRef(null);
  idRef.current = curId;
  const logRef = useRef(eventLog);
  logRef.current = eventLog;

  /* ─── BOOT: IndexedDB first (instant), Supabase merge in background ─── */
  useEffect(() => {
    let cancelled = false;
    onSyncStatus(s => { if (!cancelled) setSyncState(s); });
    (async () => {
      let localGames = [];
      if (dbAvailable()) {
        try { localGames = await dbGetAllGames(); } catch (e) {}
      }
      if (!cancelled && localGames.length > 0) {
        setSessions(sortGames(localGames));
        setView("history");
      }
      // Background: fetch server, merge (dirty-local wins)
      const serverGames = await fetchAllGames();
      if (cancelled) return;
      if (serverGames !== null) {
        let dirtyIds = [];
        try { const { dbGetDirtyIds } = await import("./db.js"); dirtyIds = await dbGetDirtyIds(); } catch (e) {}
        const dirty = new Set(dirtyIds);
        const localById = {}; localGames.forEach(g => { localById[g.id] = g; });
        const merged = serverGames.map(sg => dirty.has(sg.id) && localById[sg.id] ? localById[sg.id] : normalizeGame(sg));
        // local-only games (created offline) that server doesn't have yet
        const serverIds = new Set(serverGames.map(g => g.id));
        localGames.forEach(lg => { if (!serverIds.has(lg.id)) merged.push(lg); });
        if (!cancelled) { setSessions(sortGames(merged)); for (const g of merged) { try { await dbPutGame(g); } catch (e) {} } }
        startSyncLoop();
      } else if (localGames.length === 0 && !cancelled) {
        setSyncState("error");
      }
      if (!cancelled) setView(v => v === "loading" ? "history" : v);
    })();
    return () => { cancelled = true; };
  }, []);

  function normalizeGame(g) {
    return { id:g.id, teamName:g.team_name||g.teamName||"", team_name:g.team_name||g.teamName||"", players:g.players||[], shots:g.shots||[], events:g.events||[], quarter:g.quarter||0, created_at:g.created_at||g.createdAt||new Date().toISOString() };
  }
  function sortGames(arr) { return [...arr].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)); }

  /* ─── PERSIST: every change → state + IndexedDB + sync queue, instantly ─── */
  const persist = useCallback((newLog, newQuarter) => {
    const sid = idRef.current; if (!sid) return;
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id !== sid) return s;
        const u = { ...s, events: newLog !== undefined ? newLog : s.events, shots: [], quarter: newQuarter !== undefined ? newQuarter : s.quarter };
        try { dbPutGame(u); } catch (e) {}
        try { enqueue(u.id); } catch (e) {}
        return u;
      });
      return updated;
    });
  }, []);

  /* Append one event: the single write path for every game action */
  const append = useCallback((type, payload) => {
    const e = makeEvent(logRef.current, type, quarter, payload);
    const newLog = [...logRef.current, e];
    setEventLog(newLog);
    persist(newLog, undefined);
    return e;
  }, [quarter, persist]);

  const doFlash = (r) => { setFlash(r); setTimeout(() => setFlash(null), 350); };
  const addPlayer = () => { if (!rNum.trim()) return; const n = rNum.trim(); if (players.find(p => p.number === n)) return; setPlayers(prev => [...prev, { number: n, name: rName.trim() || ("#"+n) }]); setRName(""); setRNum(""); };

  const startSession = async () => {
    const id = genId();
    const game = { id, teamName: teamName||"Game", team_name: teamName||"Game", players:[...players], shots:[], events:[], quarter:0, created_at: new Date().toISOString() };
    // Server create in background; offline-safe (game exists locally either way)
    (async () => {
      const saved = await createGame({ team_name: game.team_name, players: game.players, shots: [], events: [], quarter: 0, created_at: game.created_at });
      if (saved && saved.id && saved.id !== id) {
        // Server assigned its own id: rekey local copy
        setSessions(prev => prev.map(s => s.id === id ? { ...s, id: saved.id } : s));
        if (idRef.current === id) setCurId(saved.id);
        try { await dbDeleteGame(id); } catch (e) {}
        const rekeyed = { ...game, id: saved.id };
        try { await dbPutGame(rekeyed); } catch (e) {}
      } else {
        try { enqueue(id); } catch (e) {}
      }
    })();
    try { await dbPutGame(game); } catch (e) {}
    setSessions(prev => [game, ...prev]);
    setCurId(id); setEventLog([]); setQuarter(0); setActiveZone(null); setFtMode(false); setPending(null); setPendingAssist(null); setPendingTally(null); setView("tracker");
  };

  const openSession = (s) => {
    setCurId(s.id);
    setEventLog(toEventLog(s)); // legacy games convert losslessly; V3 passes through
    setPlayers([...(s.players||[])]);
    setTeamName(s.teamName||s.team_name||"");
    setQuarter(s.quarter||0);
    setActiveZone(null); setFtMode(false); setPending(null); setPendingAssist(null); setPendingTally(null); setShowRecent(false); setView("tracker");
  };

  const deleteSession = async (id, e) => { e.stopPropagation(); setSessions(prev => prev.filter(s => s.id !== id)); if (curId === id) { setCurId(null); setEventLog([]); setPlayers([]); } try { await dbDeleteGame(id); } catch (er) {} if (navigator.onLine !== false) await apiDeleteGame(id); };

  const shareGame = (id) => {
    const url = window.location.origin + "/game/" + id;
    if (navigator.clipboard) { navigator.clipboard.writeText(url); setShareMsg(id); setTimeout(() => setShareMsg(null), 2000); } else { prompt("Share this link:", url); }
  };

  /* ─── DERIVED STATS: one engine call, memoized ─── */
  const stats = useMemo(() => computeGameStats(eventLog, players), [eventLog, players]);
  const sortedPlayers = useMemo(() => [...players].sort((a,b) => parseInt(a.number) - parseInt(b.number)), [players]);
  const recentActions = useMemo(() => [...stats.activeEvents].sort((a,b) => b.seq - a.seq).slice(0, 15), [stats]);

  const qtrFoulsNow = stats.qtrFouls[quarter] || 0;
  const inBonus = qtrFoulsNow >= 5;
  const oppQtrFoulsNow = stats.oppQtrFouls[quarter] || 0;
  const oppInBonus = oppQtrFoulsNow >= 5;
  const anyPending = !!pending || !!pendingAssist || !!pendingTally || showTOPicker || showOppFoulInput;

  const rebEntries = tallyEntries(stats, "rebound", players);
  const astEntries = tallyEntries(stats, "assist", players);
  const foulEntries = tallyEntries(stats, "foul", players);
  const toEntries = tallyEntries(stats, "turnover", players);
  const stlEntries = tallyEntries(stats, "steal", players);
  const blkEntries = tallyEntries(stats, "block", players);
  const oppFoulEntries = Object.entries(stats.oppFoulsByPlayer).map(([num,count]) => ({ num, count })).sort((a,b) => b.count - a.count);
  const ftData = ftEntries(stats, players);

  /* ─── ACTION HANDLERS: everything appends events ─── */
  const handleZoneTap = useCallback((id) => { if (!ftMode && !anyPending) setActiveZone(id); }, [ftMode, anyPending]);

  const handleMakeMiss = (result) => {
    if (anyPending) return;
    if (ftMode) {
      if (players.length === 0) { append("free_throw_attempt", { result, points: result==="make"?1:0 }); doFlash(result); }
      else setPending({ kind:"ft", result });
      return;
    }
    if (!activeZone) return;
    if (players.length === 0) { append("shot_attempt", { zone:activeZone, result, points:getPoints(activeZone,result,false) }); doFlash(result); setActiveZone(null); }
    else setPending({ kind:"fg", result, zone:activeZone });
  };

  const pickPlayer = (num) => {
    if (!pending) return;
    if (pending.kind === "ft") {
      append("free_throw_attempt", { playerNum:num, result:pending.result, points:pending.result==="make"?1:0 });
      doFlash(pending.result); setPending(null); return;
    }
    append("shot_attempt", { playerNum:num, zone:pending.zone, result:pending.result, points:getPoints(pending.zone,pending.result,false) });
    doFlash(pending.result); setActiveZone(null);
    if (pending.result === "make" && players.length > 1) { setPending(null); setPendingAssist({ scorerNum:num }); return; }
    setPending(null);
  };

  const pickAssist = (num) => { append("stat_tally", { stat:"assist", playerNum:num }); setPendingAssist(null); };

  const incrementStat = (stat, playerNum) => {
    append("stat_tally", { stat, playerNum });
    if (stat === "foul") {
      const newCount = (stats.players[playerNum]?.fouls || 0) + 1;
      if (newCount >= 4) { const p = players.find(x => x.number===playerNum); setFoulWarning((p?p.name:"#"+playerNum)+" has "+newCount+" fouls!"); setTimeout(() => setFoulWarning(null), 3500); }
    }
  };

  const decrementStat = (stat, playerNum) => {
    const target = lastActiveTally(logRef.current, stat, playerNum);
    if (!target) return;
    append("reversal", { targetId: target.id });
  };

  const tallyPickPlayer = (num) => { if (!pendingTally) return; incrementStat(pendingTally.type, num); setPendingTally(null); };
  const handleOppFoulAdd = (num) => { if (!num) return; incrementStat("opp_foul", String(num)); setOppFoulNum(""); };
  const handleTimeout = (duration) => {
    const left = duration===60 ? stats.to60left : stats.to30left; if (left <= 0) return;
    append("timeout", { duration }); setShowTOPicker(false);
  };

  const advanceQuarter = () => { const nq = (quarter+1) % Q_LABELS.length; setQuarter(nq); const e = makeEvent(logRef.current, "quarter_set", nq, { toQuarter: nq }); const nl = [...logRef.current, e]; setEventLog(nl); persist(nl, nq); };
  const backQuarter = () => { const nq = (quarter-1+Q_LABELS.length) % Q_LABELS.length; setQuarter(nq); const e = makeEvent(logRef.current, "quarter_set", nq, { toQuarter: nq }); const nl = [...logRef.current, e]; setEventLog(nl); persist(nl, nq); };

  const deleteAction = (item) => { append("reversal", { targetId: item.id }); };

  /* ─── VISUAL HELPERS ─── */
  const zoneStats = stats.zoneStats;
  const getZoneColor = (id) => { const s = zoneStats[id]; if (!s||!s.total) return "rgba(255,255,255,0.04)"; const p = s.makes/s.total; return p>=0.5?"rgba(34,197,94,0.25)":p>=0.35?"rgba(250,204,21,0.15)":"rgba(239,68,68,0.2)"; };
  const getZoneBorder = (id) => { if (activeZone===id) return "rgba(255,255,255,0.9)"; const s = zoneStats[id]; if (!s||!s.total) return "rgba(255,255,255,0.12)"; const p = s.makes/s.total; return p>=0.5?"rgba(34,197,94,0.5)":p>=0.35?"rgba(250,204,21,0.4)":"rgba(239,68,68,0.45)"; };
  const getZoneText = (id) => { const s = zoneStats[id]; if (!s||!s.total) return "rgba(255,255,255,0.12)"; const p = s.makes/s.total; return p>=0.5?"#22c55e":p>=0.35?"#facc15":"#ef4444"; };
  const flashBorder = flash==="make"?"2px solid #22c55e":flash==="miss"?"2px solid #ef4444":"2px solid transparent";
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); } catch(e) { return ""; } };
  const StatusBadge = () => {
    if (syncState==="synced") return <span style={{color:"#22c55e",fontSize:10,marginLeft:8}}>✓ Synced</span>;
    if (syncState==="syncing") return <span style={{color:"#facc15",fontSize:10,marginLeft:8}}>↻ Syncing…</span>;
    if (syncState==="local") return <span style={{color:"#facc15",fontSize:10,marginLeft:8}}>● Saved on iPad</span>;
    if (syncState==="offline") return <span style={{color:"#f97316",fontSize:10,marginLeft:8}}>● Offline — saved on iPad</span>;
    if (syncState==="error") return <span style={{color:"#f97316",fontSize:10,marginLeft:8}}>● Saved on iPad — will retry</span>;
    return null;
  };

  if (view === "loading") return <div style={{...SHELL,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#555",fontSize:14}}>Loading...</div></div>;

  // ═══ ROSTER ═══
  if (view === "roster") return (
    <div style={SHELL}>
      <div style={{padding:"20px 16px 8px"}}><button onClick={()=>setView("history")} style={LINK}>← Back</button><div style={{fontSize:20,fontWeight:800,marginTop:8}}>New Session</div><div style={SUBHEAD}>Add your roster</div></div>
      <div style={{padding:"0 16px",marginBottom:16}}><label style={LABEL}>Team / Game Name</label><input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="e.g. Varsity vs Lincoln" style={INP} /></div>
      <div style={{padding:"0 16px",marginBottom:16}}><label style={LABEL}>Add Player</label>
        <div style={{display:"flex",gap:8}}><input value={rNum} onChange={e=>setRNum(e.target.value.replace(/\D/g,"").slice(0,3))} placeholder="#" style={{...INP,width:56,textAlign:"center",fontSize:18,fontWeight:800}} inputMode="numeric" /><input value={rName} onChange={e=>setRName(e.target.value)} placeholder="Name (optional)" style={{...INP,flex:1}} onKeyDown={e=>e.key==="Enter"&&addPlayer()} /><button onClick={addPlayer} style={{...ACCENT,padding:"0 16px",fontSize:20,fontWeight:800,borderRadius:10}}>+</button></div>
      </div>
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
        {players.length===0&&<div style={{color:"#444",fontSize:13,padding:"16px 0",textAlign:"center"}}>No players yet — add jersey numbers above</div>}
        {players.map(p=><div key={p.number} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 14px"}}><div style={{...JERSEY,width:40,height:40,fontSize:18}}>{p.number}</div><div style={{flex:1,fontSize:15,fontWeight:600}}>{p.name}</div><button onClick={()=>setPlayers(x=>x.filter(q=>q.number!==p.number))} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>×</button></div>)}
      </div>
      <div style={{padding:"0 16px"}}><button onClick={startSession} style={{width:"100%",padding:"16px 0",borderRadius:14,border:"none",fontSize:16,fontWeight:800,cursor:"pointer",background:"#facc15",color:"#000"}}>Start Tracking →</button><div style={{textAlign:"center",fontSize:11,color:"#555",marginTop:8}}>{players.length===0?"Track without players (team-level)":players.length+" player"+(players.length!==1?"s":"")}</div></div>
    </div>
  );

  // ═══ HISTORY ═══
  if (view === "history") return (
    <div style={SHELL}>
      <div style={{padding:"20px 16px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:20,fontWeight:800}}>Shot Chart<StatusBadge /></div><div style={SUBHEAD}>Saved Sessions</div></div><button onClick={()=>{setPlayers([...DEFAULT_ROSTER]);setTeamName("");setRName("");setRNum("");setView("roster");}} style={ACCENT}>+ New Game</button></div>
      {syncState==="offline"&&<div style={{margin:"0 16px 8px",padding:"8px 12px",background:"rgba(249,115,22,0.1)",border:"1px solid rgba(249,115,22,0.25)",borderRadius:8,fontSize:11,color:"#f97316"}}>● Offline — everything saves to this iPad and syncs when you're back online</div>}
      {sessions.length===0?<div style={{textAlign:"center",padding:"60px 20px",color:"#444"}}><div style={{fontSize:40,marginBottom:12}}>🏀</div><div style={{fontSize:15,fontWeight:600}}>No sessions yet</div></div>:(
        <div style={{padding:"4px 16px 20px",display:"flex",flexDirection:"column",gap:8}}>
          {(()=>{
            // Season stats: engine per game, summed
            let yPts=0,yFGm=0,yFGa=0,yFTm=0,yFTa=0,yAst=0,yReb=0,yStl=0,yBlk=0,yFouls=0,yTOs=0;
            let any=false;
            for (const s of sessions) {
              const st = computeGameStats(toEventLog(s), s.players||[]);
              if (st.activeEvents.length>0) any=true;
              yPts+=st.totalPts; yFGm+=st.fgMakes; yFGa+=st.fgTotal; yFTm+=st.ftMakes; yFTa+=st.ftTotal;
              yAst+=st.teamAst; yReb+=st.teamReb; yStl+=st.teamStl; yBlk+=st.teamBlk; yFouls+=st.teamFouls; yTOs+=st.teamTOs;
            }
            if (!any) return null;
            const numGames = sessions.length;
            return (
              <><button onClick={()=>setShowYearStats(p=>!p)} style={{background:showYearStats?"rgba(250,204,21,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(showYearStats?"rgba(250,204,21,0.25)":"rgba(255,255,255,0.08)"),color:showYearStats?"#facc15":"#888",fontSize:12,fontWeight:700,padding:"10px 16px",borderRadius:10,cursor:"pointer",textAlign:"center"}}>{showYearStats?"▾ Hide Season Stats":"▸ Season Stats — "+numGames+" Game"+(numGames!==1?"s":"")+" · "+yPts+" Total Pts"}</button>
              {showYearStats&&<div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:14}}>
                <div style={SECHEAD}>Season Totals</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8}}>
                  <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:900,color:"#facc15"}}>{yPts}</div><div style={{fontSize:8,color:"#666"}}>PTS</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#facc15"}}>{numGames>0?(yPts/numGames).toFixed(1):"—"}</div><div style={{fontSize:8,color:"#666"}}>PPG</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{yFGa?Math.round(yFGm/yFGa*100)+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FG {yFGm}/{yFGa}</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#818cf8"}}>{yFTa?Math.round(yFTm/yFTa*100)+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FT {yFTm}/{yFTa}</div></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{yAst}</div><div style={{fontSize:8,color:"#666"}}>AST</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{yReb}</div><div style={{fontSize:8,color:"#666"}}>REB</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#f97316"}}>{yFouls}</div><div style={{fontSize:8,color:"#666"}}>FOULS</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#a855f7"}}>{yTOs}</div><div style={{fontSize:8,color:"#666"}}>TO</div></div>
                </div>
              </div>}</>
            );
          })()}
          {sessions.map(s=>{
            const st = computeGameStats(toEventLog(s), s.players||[]);
            const sFGp = st.fgTotal?Math.round(st.fgMakes/st.fgTotal*100):0;
            return (
              <div key={s.id} onClick={()=>openSession(s)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"14px 16px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:15,fontWeight:700}}>{s.teamName||s.team_name||"Unnamed"}</div><div style={{fontSize:11,color:"#666",marginTop:2}}>{fmtDate(s.created_at||s.createdAt)}</div></div>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#facc15"}}>{st.totalPts}</div><div style={{fontSize:8,color:"#666"}}>PTS</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:800,color:sFGp>=50?"#22c55e":sFGp>=35?"#facc15":st.fgTotal?"#ef4444":"#555"}}>{st.fgTotal?sFGp+"%":"—"}</div><div style={{fontSize:9,color:"#666"}}>FG {st.fgMakes}/{st.fgTotal}</div></div>
                    <button onClick={e=>{e.stopPropagation();shareGame(s.id);}} style={{background:"none",border:"none",color:shareMsg===s.id?"#22c55e":"#facc15",fontSize:13,cursor:"pointer",padding:"4px"}}>{shareMsg===s.id?"✓":"🔗"}</button>
                    <button onClick={e=>deleteSession(s.id,e)} style={{background:"none",border:"none",color:"#555",fontSize:18,cursor:"pointer",padding:"4px 2px"}}>×</button>
                  </div>
                </div>
                {(st.teamFouls>0||st.teamTOs>0)&&<div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:"#666"}}>{st.teamFouls>0&&<span style={{color:"#f97316"}}>{st.teamFouls} fouls</span>}{st.teamTOs>0&&<span style={{color:"#a855f7"}}>{st.teamTOs} TO</span>}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ═══ TRACKER ═══
  const canRecord = ftMode || activeZone;
  const Picker = ({ title, sub, subColor, list, onPick, onCancel, cancelLabel }) => (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      {sub&&<div style={{fontSize:12,color:"#888",marginBottom:4,letterSpacing:1,textTransform:"uppercase"}}>{sub}</div>}
      <div style={{fontSize:18,fontWeight:800,marginBottom:20,color:subColor||"#fff"}}>{title}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,width:"100%",maxWidth:480,marginBottom:20}}>
        {list.map(p=><button key={p.number} onClick={()=>onPick(p.number)} style={{background:"rgba(255,255,255,0.08)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:14,padding:"14px 8px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,minHeight:64}}>
          <div style={{fontSize:28,fontWeight:900,color:"#facc15",lineHeight:1}}>{p.number}</div>
          <div style={{fontSize:10,color:"#aaa",fontWeight:600}}>{p.name}</div>
        </button>)}
      </div>
      <button onClick={onCancel} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"12px 28px",borderRadius:8,cursor:"pointer",fontSize:13,minHeight:44}}>{cancelLabel||"Cancel"}</button>
    </div>
  );
  return (
    <div style={SHELL}>
      {pending && <Picker title="Who took the shot?" sub={(pending.result==="make"?"Make":"Miss")+(pending.kind==="ft"?" (FT)":pending.zone?" — "+(ZONES.find(z=>z.id===pending.zone)?.label||""):"")} subColor={pending.result==="make"?"#22c55e":"#ef4444"} list={sortedPlayers} onPick={pickPlayer} onCancel={()=>setPending(null)} />}
      {pendingAssist && <Picker title="Assisted by?" sub="Make recorded" subColor="#22c55e" list={sortedPlayers.filter(p=>p.number!==pendingAssist.scorerNum)} onPick={pickAssist} onCancel={()=>setPendingAssist(null)} cancelLabel="Skip" />}
      {pendingTally && <Picker title={pendingTally.label} subColor={CC[pendingTally.type]?.t} list={sortedPlayers} onPick={tallyPickPlayer} onCancel={()=>setPendingTally(null)} />}
      {showTOPicker && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:24,color:"#fff"}}>Call Timeout</div>
          <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:280}}>
            <button onClick={()=>handleTimeout(60)} disabled={stats.to60left<=0} style={{padding:"18px 0",borderRadius:14,border:stats.to60left>0?"2px solid rgba(255,255,255,0.2)":"2px solid rgba(255,255,255,0.06)",background:stats.to60left>0?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.02)",cursor:stats.to60left>0?"pointer":"default",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:stats.to60left>0?"#fff":"#333"}}>60 sec</div><div style={{fontSize:12,color:stats.to60left>0?"#888":"#333",marginTop:4}}>{stats.to60left} remaining</div></button>
            <button onClick={()=>handleTimeout(30)} disabled={stats.to30left<=0} style={{padding:"18px 0",borderRadius:14,border:stats.to30left>0?"2px solid rgba(255,255,255,0.2)":"2px solid rgba(255,255,255,0.06)",background:stats.to30left>0?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.02)",cursor:stats.to30left>0?"pointer":"default",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:stats.to30left>0?"#fff":"#333"}}>30 sec</div><div style={{fontSize:12,color:stats.to30left>0?"#888":"#333",marginTop:4}}>{stats.to30left} remaining</div></button>
          </div>
          <button onClick={()=>setShowTOPicker(false)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"12px 28px",borderRadius:8,cursor:"pointer",fontSize:13,marginTop:20,minHeight:44}}>Cancel</button>
        </div>
      )}
      {showOppFoulInput && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:20,color:"#ef4444"}}>Opponent Foul</div>
          <div style={{display:"flex",gap:8,marginBottom:20,width:"100%",maxWidth:280}}>
            <input value={oppFoulNum} onChange={e=>setOppFoulNum(e.target.value.replace(/\D/g,"").slice(0,3))} placeholder="Opp #" style={{...INP,width:80,textAlign:"center",fontSize:20,fontWeight:800}} inputMode="numeric" autoFocus />
            <button onClick={()=>{if(oppFoulNum.trim()){handleOppFoulAdd(oppFoulNum.trim());setShowOppFoulInput(false);}}} disabled={!oppFoulNum.trim()} style={{flex:1,padding:"12px 0",borderRadius:10,border:"none",fontSize:14,fontWeight:700,cursor:oppFoulNum.trim()?"pointer":"default",background:oppFoulNum.trim()?"#ef4444":"rgba(239,68,68,0.15)",color:oppFoulNum.trim()?"#fff":"rgba(239,68,68,0.4)"}}>Add Foul</button>
          </div>
          <button onClick={()=>{setShowOppFoulInput(false);setOppFoulNum("");}} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"12px 28px",borderRadius:8,cursor:"pointer",fontSize:13,minHeight:44}}>Cancel</button>
        </div>
      )}

      {/* Header */}
      <div style={{padding:"12px 16px 4px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center"}}><button onClick={()=>setView("history")} style={LINK}>← All Sessions</button><StatusBadge /></div>
          {editName?<input autoFocus value={teamName} onChange={e=>{setTeamName(e.target.value);setSessions(p=>p.map(s=>s.id===curId?{...s,teamName:e.target.value,team_name:e.target.value}:s));}} onBlur={()=>{setEditName(false);const g=sessions.find(s=>s.id===curId);if(g){try{dbPutGame({...g,teamName,team_name:teamName});}catch(e){}try{enqueue(g.id);}catch(e){}}}} onKeyDown={e=>e.key==="Enter"&&setEditName(false)} placeholder="Team name" style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",fontSize:16,fontWeight:700,padding:"4px 10px",borderRadius:6,outline:"none",width:200,marginTop:4,display:"block"}} />
          :<div onClick={()=>setEditName(true)} style={{fontSize:16,fontWeight:700,color:teamName?"#fff":"#555",cursor:"pointer",marginTop:2}}>{teamName||"Tap to set name"}<span style={{fontSize:11,color:"#444",marginLeft:6}}>✎</span></div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={backQuarter} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#888",fontSize:12,fontWeight:700,padding:"10px 12px",borderRadius:6,cursor:"pointer",minHeight:44}}>◂</button>
          <button onClick={advanceQuarter} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#facc15",fontSize:14,fontWeight:800,padding:"10px 16px",borderRadius:8,cursor:"pointer",minWidth:52,minHeight:44,textAlign:"center"}}>{Q_LABELS[quarter]}</button>
          <button onClick={()=>setShowTOPicker(true)} disabled={anyPending||(stats.to60left<=0&&stats.to30left<=0)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:anyPending||(stats.to60left<=0&&stats.to30left<=0)?"rgba(255,255,255,0.2)":"#ccc",fontSize:12,fontWeight:700,padding:"10px 12px",borderRadius:6,cursor:anyPending?"default":"pointer",minHeight:44}}>⏱{stats.to60left+stats.to30left}</button>
          <button onClick={()=>setShowRecent(p=>!p)} style={{background:showRecent?"rgba(250,204,21,0.12)":"rgba(255,255,255,0.08)",border:"1px solid "+(showRecent?"rgba(250,204,21,0.25)":"rgba(255,255,255,0.1)"),color:showRecent?"#facc15":"#999",fontSize:11,padding:"10px 12px",borderRadius:6,cursor:"pointer",letterSpacing:1,textTransform:"uppercase",minHeight:44}}>Recent</button>
        </div>
      </div>

      {/* Banners */}
      {foulWarning&&<div style={{margin:"0 16px 4px",padding:"8px 12px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:8,fontSize:13,fontWeight:700,color:"#ef4444",textAlign:"center"}}>⚠ {foulWarning}</div>}
      {inBonus&&<div style={{margin:"0 16px 4px",padding:"6px 12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,fontSize:11,fontWeight:700,color:"#ef4444",textAlign:"center"}}>BONUS — {qtrFoulsNow} team fouls in {Q_LABELS[quarter]}</div>}
      {oppInBonus&&<div style={{margin:"0 16px 4px",padding:"6px 12px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:8,fontSize:11,fontWeight:700,color:"#22c55e",textAlign:"center"}}>OPP BONUS — {oppQtrFoulsNow} opponent fouls in {Q_LABELS[quarter]}</div>}

      {/* Recent Panel */}
      {showRecent&&<div style={{margin:"0 16px 8px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,overflow:"hidden"}}>
        <div style={{padding:"8px 12px 6px",fontSize:10,color:"#555",letterSpacing:1,textTransform:"uppercase"}}>Last {Math.min(recentActions.length,15)} actions</div>
        {recentActions.length===0?<div style={{padding:"12px",fontSize:12,color:"#444",textAlign:"center"}}>No actions yet</div>:
        <div style={{maxHeight:220,overflowY:"auto"}}>{recentActions.map((item,i)=>{
          const desc=describeEvent(item,players);
          const dot=item.type==="shot_attempt"?(item.result==="make"?"#22c55e":"#ef4444"):item.type==="free_throw_attempt"?(item.result==="make"?"#818cf8":"#ef4444"):item.type==="stat_tally"?(CC[item.stat]?.t||"#888"):"#888";
          return <div key={item.id} style={{display:"flex",alignItems:"center",padding:"6px 12px",borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none"}}><div style={{width:6,height:6,borderRadius:3,background:dot,flexShrink:0,marginRight:8}} /><div style={{flex:1,fontSize:11,color:"#aaa",lineHeight:1.3}}>{desc}</div><TapBtn onTap={()=>deleteAction(item)} size={40} fontSize={14} color="#555">✕</TapBtn></div>;
        })}</div>}
      </div>}

      {/* Score bar */}
      <div style={{display:"flex",justifyContent:"center",gap:14,padding:"6px 16px",flexWrap:"wrap",alignItems:"center"}}>
        <StatBox label="PTS" value={stats.totalPts} color="#facc15" />
        <StatBox label="FG" value={stats.fgMakes+"/"+stats.fgTotal} color="#22c55e" />
        <StatBox label="FG%" value={stats.fgTotal?stats.fgPct+"":"0"} color={stats.fgPct>=50?"#22c55e":stats.fgPct>=35?"#facc15":"#ef4444"} />
        <StatBox label="FT" value={stats.ftMakes+"/"+stats.ftTotal} color="#818cf8" />
      </div>

      {/* Opponent bar — Phase 3 will add US/THEM scoreboard and +1/+2/+3 here */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,padding:"4px 16px 6px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:10,padding:"6px 14px"}}>
          <span style={{fontSize:11,color:"#ef4444",fontWeight:700,letterSpacing:0.5}}>OPP ORB</span>
          <TapBtn onTap={()=>{const t=lastActiveTally(logRef.current,"opp_rebound_off",undefined);if(t)append("reversal",{targetId:t.id});}} size={40} fontSize={16} color="#555">-</TapBtn>
          <span style={{fontSize:18,fontWeight:800,color:stats.oppOrbTotal>0?"#ef4444":"#444",minWidth:20,textAlign:"center"}}>{stats.oppOrbTotal}</span>
          <TapBtn onTap={()=>append("stat_tally",{stat:"opp_rebound_off"})} size={40} fontSize={16} color="#555">+</TapBtn>
        </div>
      </div>

      {/* ═══ TWO-COLUMN LAYOUT ═══ */}
      <div style={{display:"flex",gap:12,padding:"4px 16px",alignItems:"flex-start"}}>

        {/* LEFT: Court + Make/Miss + compact cards */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{transition:"border-color 0.2s",border:ftMode?"2px solid rgba(129,140,248,0.3)":flashBorder,borderRadius:12,opacity:ftMode?0.4:1,pointerEvents:ftMode?"none":"auto"}}>
            <svg viewBox="0 0 400 320" style={{width:"100%",height:"auto",display:"block"}}>
              <rect x="0" y="0" width="400" height="320" rx="10" fill="#1a1206" stroke="rgba(255,180,50,0.15)" strokeWidth="1" />
              <circle cx="200" cy="18" r="8" fill="none" stroke="rgba(255,180,50,0.5)" strokeWidth="1.5" />
              <line x1="185" y1="4" x2="215" y2="4" stroke="rgba(255,180,50,0.35)" strokeWidth="1.5" />
              <rect x="130" y="0" width="140" height="110" fill="none" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
              <circle cx="200" cy="110" r="60" fill="none" stroke="rgba(255,180,50,0.2)" strokeWidth="1" strokeDasharray="4,4" />
              <path d="M 40,0 L 40,80 Q 40,250 200,270 Q 360,250 360,80 L 360,0" fill="none" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
              {ZONES.map(z=>{const s=zoneStats[z.id];const isA=activeZone===z.id;return(
                <g key={z.id} onClick={()=>handleZoneTap(z.id)} style={{cursor:"pointer"}}>
                  <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="8" fill={isA?"rgba(255,255,255,0.15)":getZoneColor(z.id)} stroke={getZoneBorder(z.id)} strokeWidth={isA?2.5:2} style={{transition:"fill 0.2s"}} />
                  {s&&s.total>0?<><text x={z.cx} y={z.cy-2} textAnchor="middle" fill={getZoneText(z.id)} fontSize="14" fontWeight="800" style={{pointerEvents:"none"}}>{z.label}</text><text x={z.cx} y={z.cy+14} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600" style={{pointerEvents:"none"}}>{s.makes}/{s.total}</text></>
                  :<text x={z.cx} y={z.cy+5} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="12" style={{pointerEvents:"none"}}>{z.label}</text>}
                </g>
              );})}
            </svg>
          </div>

          {ftMode&&<div style={{textAlign:"center",padding:"4px 0"}}><span style={{color:"#818cf8",fontSize:12,fontWeight:600}}>Free throw mode — tap Make or Miss</span></div>}
          {!ftMode&&activeZone&&<div style={{textAlign:"center",padding:"2px 0"}}><span style={{color:"#facc15",fontSize:12,fontWeight:600}}>{ZONES.find(z=>z.id===activeZone)?.label}</span><span style={{color:"#444",fontSize:12}}> — tap Make or Miss</span></div>}

          <div style={{display:"flex",gap:8,marginTop:6}}>
            <button onClick={()=>handleMakeMiss("make")} disabled={!canRecord||anyPending} style={{flex:1,padding:"14px 0",borderRadius:12,border:"none",fontSize:18,fontWeight:800,letterSpacing:2,cursor:canRecord&&!anyPending?"pointer":"default",background:canRecord&&!anyPending?(ftMode?"#818cf8":"#22c55e"):(ftMode?"rgba(129,140,248,0.15)":"rgba(34,197,94,0.15)"),color:canRecord&&!anyPending?"#000":(ftMode?"rgba(129,140,248,0.4)":"rgba(34,197,94,0.4)"),transition:"all 0.2s",minHeight:52}}>MAKE</button>
            <button onClick={()=>handleMakeMiss("miss")} disabled={!canRecord||anyPending} style={{flex:1,padding:"14px 0",borderRadius:12,border:"none",fontSize:18,fontWeight:800,letterSpacing:2,cursor:canRecord&&!anyPending?"pointer":"default",background:canRecord&&!anyPending?"#ef4444":"rgba(239,68,68,0.15)",color:canRecord&&!anyPending?"#fff":"rgba(239,68,68,0.4)",transition:"all 0.2s",minHeight:52}}>MISS</button>
          </div>

          {!ftMode&&!activeZone&&!anyPending&&<div style={{textAlign:"center",padding:"4px 0",color:"#444",fontSize:11}}>Tap a zone, then Make or Miss</div>}

          {/* Compact cards: FT, Steals, Blocks, Opp Fouls */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:8}}>
            <div onClick={()=>{setFtMode(p=>!p);setActiveZone(null);setPending(null);}} style={{background:ftMode?CC.ft.bg:"rgba(129,140,248,0.05)",border:ftMode?"2px solid #818cf8":"1.5px solid "+CC.ft.bd,borderRadius:10,padding:"8px 10px",cursor:"pointer",touchAction:"manipulation"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ftData.length>0?4:0}}>
                <span style={{fontSize:12,fontWeight:800,color:"#818cf8"}}>Free throws</span>
                <span style={{fontSize:11,color:"#818cf8",fontWeight:700}}>{stats.ftMakes}/{stats.ftTotal}</span>
              </div>
              {ftData.map(e=><div key={e.num} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:11,color:"#ccc"}}>#{e.num} {e.name}</span><span style={{fontSize:11,color:"#888"}}>{e.made}/{e.att}</span></div>)}
              {ftMode&&<div style={{textAlign:"center",fontSize:10,color:"#818cf8",fontWeight:700,marginTop:4}}>TAP TO EXIT FT MODE</div>}
            </div>

            <TallyCard title="Steals" type="steal" entries={stlEntries} compact onAdd={()=>setPendingTally({type:"steal",label:"Who got the steal?"})} onInc={(n)=>incrementStat("steal",n)} onDec={(n)=>decrementStat("steal",n)} />
            <TallyCard title="Blocks" type="block" entries={blkEntries} compact onAdd={()=>setPendingTally({type:"block",label:"Who blocked it?"})} onInc={(n)=>incrementStat("block",n)} onDec={(n)=>decrementStat("block",n)} />

            <div style={{background:CC.opp_foul.bg,border:"1.5px solid "+CC.opp_foul.bd,borderRadius:10,padding:"8px 10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:oppFoulEntries.length>0?4:0}}>
                <span style={{fontSize:12,fontWeight:800,color:"#ef4444"}}>Opp fouls</span>
                <span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>{stats.oppTotalFouls}</span>
              </div>
              {oppFoulEntries.map(e=><div key={e.num} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1px 0"}}>
                <span style={{fontSize:11,color:"#ccc"}}>#{e.num}</span>
                <div style={{display:"flex",alignItems:"center"}}><TapBtn onTap={()=>decrementStat("opp_foul",e.num)} size={40} fontSize={16}>-</TapBtn><span style={{fontSize:14,fontWeight:800,color:e.count>=4?"#ef4444":"#f97316",minWidth:16,textAlign:"center"}}>{e.count}</span><TapBtn onTap={()=>incrementStat("opp_foul",e.num)} size={40} fontSize={16}>+</TapBtn></div>
              </div>)}
              <div onClick={()=>{setShowOppFoulInput(true);setOppFoulNum("");}} style={{textAlign:"center",color:"#ef4444",fontSize:18,cursor:"pointer",marginTop:oppFoulEntries.length>0?2:0,minHeight:40,display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}>+</div>
            </div>
          </div>
        </div>

        {/* RIGHT: Tall tally cards */}
        <div style={{width:230,display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
          <TallyCard title="Rebounds" type="rebound" entries={rebEntries} onAdd={()=>setPendingTally({type:"rebound",label:"Who rebounded?"})} onInc={(n)=>incrementStat("rebound",n)} onDec={(n)=>decrementStat("rebound",n)} />
          <TallyCard title="Assists" type="assist" entries={astEntries} onAdd={()=>setPendingTally({type:"assist",label:"Who got the assist?"})} onInc={(n)=>incrementStat("assist",n)} onDec={(n)=>decrementStat("assist",n)} />
          <TallyCard title="Fouls" type="foul" entries={foulEntries} warnAt={4} onAdd={()=>setPendingTally({type:"foul",label:"Who fouled?"})} onInc={(n)=>incrementStat("foul",n)} onDec={(n)=>decrementStat("foul",n)} />
          <TallyCard title="Turnovers" type="turnover" entries={toEntries} onAdd={()=>setPendingTally({type:"turnover",label:"Who turned it over?"})} onInc={(n)=>incrementStat("turnover",n)} onDec={(n)=>decrementStat("turnover",n)} />
        </div>
      </div>

      {/* Player Stats Toggle + Export */}
      <div style={{padding:"8px 16px",display:"flex",gap:8}}>
        <button onClick={()=>setShowStats(p=>!p)} style={{flex:1,background:showStats?"rgba(250,204,21,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(showStats?"rgba(250,204,21,0.3)":"rgba(255,255,255,0.08)"),color:showStats?"#facc15":"#888",fontSize:12,fontWeight:700,padding:"12px 24px",borderRadius:10,cursor:"pointer",minHeight:44}}>{showStats?"▾ Hide player stats":"▸ Player stats and breakdown"}</button>
        <button onClick={()=>{const g=sessions.find(s=>s.id===curId);if(g)exportGamePdf({...g,events:eventLog,shots:[],players,quarter,teamName,team_name:teamName});}} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#888",fontSize:12,fontWeight:700,padding:"12px 16px",borderRadius:10,cursor:"pointer",minHeight:44}}>Export PDF</button>
      </div>

      {showStats&&players.length>0&&<div style={{padding:"0 16px 16px"}}>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"90px repeat(9,minmax(0,1fr))",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
            <div style={{padding:"10px 10px",fontSize:10,color:"#555",letterSpacing:1}}>PLAYER</div>
            {[{l:"PTS",c:"#facc15"},{l:"FG",c:"#22c55e"},{l:"FT",c:"#818cf8"},{l:"AST",c:"#22c55e"},{l:"REB",c:"#22c55e"},{l:"STL",c:"#3b82f6"},{l:"BLK",c:"#ec4899"},{l:"FLS",c:"#f97316"},{l:"TO",c:"#a855f7"}].map(h=>
              <div key={h.l} style={{padding:"10px 2px",fontSize:10,color:h.c,letterSpacing:0.5,textAlign:"center"}}>{h.l}</div>
            )}
          </div>
          {sortedPlayers.map((p,ri)=>{
            const ps = stats.players[p.number] || { pts:0,fgm:0,fga:0,ftm:0,fta:0,ast:0,reb:0,stl:0,blk:0,fouls:0,tos:0 };
            const PM=({val,color,type:t})=><div style={{textAlign:"center"}}><div style={{display:"inline-flex",alignItems:"center"}}><TapBtn onTap={()=>decrementStat(t,p.number)} size={44} fontSize={18}>-</TapBtn><span style={{fontSize:15,fontWeight:800,color:val>0?color:"#444",minWidth:18,textAlign:"center"}}>{val}</span><TapBtn onTap={()=>incrementStat(t,p.number)} size={44} fontSize={18}>+</TapBtn></div></div>;
            return (
              <div key={p.number} style={{display:"grid",gridTemplateColumns:"90px repeat(9,minmax(0,1fr))",alignItems:"center",borderBottom:ri<sortedPlayers.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:ri%2===0?"rgba(250,204,21,0.02)":"transparent"}}>
                <div style={{padding:"8px 10px",display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:28,height:28,borderRadius:6,background:"rgba(250,204,21,0.15)",border:"1px solid rgba(250,204,21,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#facc15",fontSize:12,flexShrink:0}}>{p.number}</div>
                  <span style={{fontSize:12,fontWeight:600,color:"#ccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                </div>
                <div style={{textAlign:"center",fontSize:18,fontWeight:800,color:"#facc15"}}>{ps.pts}</div>
                <div style={{textAlign:"center",fontSize:11,color:ps.fga>0?"#888":"#444"}}>{ps.fgm}/{ps.fga}</div>
                <div style={{textAlign:"center",fontSize:11,color:ps.fta>0?"#888":"#444"}}>{ps.ftm}/{ps.fta}</div>
                <PM val={ps.ast} color="#22c55e" type="assist" />
                <PM val={ps.reb} color="#22c55e" type="rebound" />
                <PM val={ps.stl} color="#3b82f6" type="steal" />
                <PM val={ps.blk} color="#ec4899" type="block" />
                <PM val={ps.fouls} color={ps.fouls>=4?"#ef4444":"#f97316"} type="foul" />
                <PM val={ps.tos} color="#a855f7" type="turnover" />
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
