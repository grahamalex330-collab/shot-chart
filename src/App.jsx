import { useState, useRef, useCallback, useEffect } from "react";
import { fetchAllGames, createGame, updateGame, deleteGame as apiDeleteGame } from "./api.js";
import { exportGamePdf } from "./exportPdf.js";

/* ─── ZONES (6, flipped court — hoop at top) ─── */
const ZONES = [
  { id: "paint", label: "Paint", x: 140, y: 5, w: 120, h: 92, cx: 200, cy: 50 },
  { id: "2pt-left", label: "2PT Left", x: 15, y: 48, w: 115, h: 122, cx: 72, cy: 108 },
  { id: "2pt-right", label: "2PT Right", x: 270, y: 48, w: 115, h: 122, cx: 328, cy: 108 },
  { id: "3pt-left", label: "3PT Left", x: 8, y: 190, w: 130, h: 100, cx: 73, cy: 240 },
  { id: "3pt-right", label: "3PT Right", x: 262, y: 190, w: 130, h: 100, cx: 327, cy: 240 },
  { id: "3pt-top", label: "3PT Top", x: 148, y: 225, w: 104, h: 80, cx: 200, cy: 265 },
];
const THREE_PT = new Set(["3pt-left", "3pt-right", "3pt-top"]);
const Q_LABELS = ["Q1", "Q2", "Q3", "Q4", "OT", "OT2"];
const DEFAULT_ROSTER = [
  { number: "3", name: "Bella" }, { number: "4", name: "Maliah" }, { number: "5", name: "Hayden" },
  { number: "12", name: "Nikki" }, { number: "21", name: "Adyson" }, { number: "23", name: "Journey" }, { number: "24", name: "Caroline" },
];
const OLD_ZONE_MAP = { "paint":"paint","ft-line":"paint","top-key":"paint","left-block":"2pt-left","left-elbow":"2pt-left","left-mid":"2pt-left","right-block":"2pt-right","right-elbow":"2pt-right","right-mid":"2pt-right","left-wing3":"3pt-left","left-corner3":"3pt-left","right-wing3":"3pt-right","right-corner3":"3pt-right","top3":"3pt-top" };
function mapZone(id) { return OLD_ZONE_MAP[id] || id; }
function getPoints(s) { if (s.result !== "make") return 0; if (s.isFT) return 1; const z = mapZone(s.zone); return THREE_PT.has(z) ? 3 : 2; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

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

/* ─── TALLY CARD COMPONENT ─── */
function TallyCard({ title, type, entries, onAdd, onInc, onDec, compact, warnAt }) {
  const c = CC[type] || CC.rebound;
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const fs = compact ? { title:12, count:11, name:11, num:13, plus:18, pad:"8px 10px", gap:"2px 0", br:10 } : { title:14, count:13, name:12, num:15, plus:20, pad:"10px 12px", gap:"4px 0", br:12 };
  return (
    <div style={{ background:c.bg, border:"1.5px solid "+c.bd, borderRadius:fs.br, padding:fs.pad }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:entries.length>0?6:0 }}>
        <span style={{ fontSize:fs.title, fontWeight:800, color:c.t }}>{title}</span>
        <span style={{ fontSize:fs.count, color:c.t, fontWeight:700 }}>{total}</span>
      </div>
      {entries.map(e => {
        const warn = warnAt && e.count >= warnAt;
        const numColor = warn ? "#ef4444" : c.t;
        return (
          <div key={e.num} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:fs.gap }}>
            <span style={{ fontSize:fs.name, color:"#ccc" }}>{warn?"⚠ ":""}#{e.num} {e.name}</span>
            <div style={{ display:"flex", alignItems:"center", gap:compact?4:6 }}>
              <span onClick={()=>onDec(e.num)} style={{ color:"#555", fontSize:compact?14:16, cursor:"pointer", padding:"0 4px" }}>-</span>
              <span style={{ fontSize:fs.num, fontWeight:800, color:numColor, minWidth:14, textAlign:"center" }}>{e.count}</span>
              <span onClick={()=>onInc(e.num)} style={{ color:"#555", fontSize:compact?14:16, cursor:"pointer", padding:"0 4px" }}>+</span>
            </div>
          </div>
        );
      })}
      <div onClick={onAdd} style={{ textAlign:"center", color:c.t, fontSize:fs.plus, cursor:"pointer", marginTop:entries.length>0?6:2, padding:"2px 0" }}>+</div>
    </div>
  );
}

/* ─── DESCRIBE ACTION (for Recent panel) ─── */
function describeAction(item, players) {
  const pName = (num) => { if (!num) return ""; const p = players.find(x => x.number === num); return p ? "#"+p.number+" "+p.name : "#"+num; };
  const qLabel = Q_LABELS[item.quarter] || "";
  if (item.result !== undefined) {
    const made = item.result === "make" ? "Make" : "Miss";
    if (item.isFT) return "FT "+made+(item.playerNum?" — "+pName(item.playerNum):"")+" — "+qLabel;
    const zone = ZONES.find(z => z.id === mapZone(item.zone));
    return made+" — "+(zone?zone.label:item.zone||"")+(item.playerNum?" — "+pName(item.playerNum):"")+" — "+qLabel;
  }
  if (item.type==="foul") return "Foul — "+pName(item.playerNum)+" — "+qLabel;
  if (item.type==="opp_foul") return "Opp Foul — #"+(item.playerNum||"?")+" — "+qLabel;
  if (item.type==="turnover") return "Turnover — "+pName(item.playerNum)+" — "+qLabel;
  if (item.type==="timeout") return "Timeout "+item.duration+"s — "+qLabel;
  if (item.type==="rebound") return "Rebound — "+pName(item.playerNum)+" — "+qLabel;
  if (item.type==="steal") return "Steal — "+pName(item.playerNum)+" — "+qLabel;
  if (item.type==="block") return "Block — "+pName(item.playerNum)+" — "+qLabel;
  if (item.type==="assist") return "Assist — "+pName(item.playerNum)+" — "+qLabel;
  return "Action — "+qLabel;
}

/* ─── TALLY ENTRIES HELPER ─── */
function tallyEntries(events, type, players) {
  const counts = {};
  events.filter(e => e.type === type).forEach(e => { if (e.playerNum) counts[e.playerNum] = (counts[e.playerNum]||0) + 1; });
  return Object.entries(counts).map(([num, count]) => { const p = players.find(x => x.number === num); return { num, name: p ? p.name : "#"+num, count }; }).sort((a,b) => b.count - a.count);
}
function assistEntries(events, shots, players) {
  const counts = {};
  events.filter(e => e.type === "assist").forEach(e => { if (e.playerNum) counts[e.playerNum] = (counts[e.playerNum]||0) + 1; });
  shots.forEach(s => { if (s.assistNum) counts[s.assistNum] = (counts[s.assistNum]||0) + 1; });
  return Object.entries(counts).map(([num, count]) => { const p = players.find(x => x.number === num); return { num, name: p ? p.name : "#"+num, count }; }).sort((a,b) => b.count - a.count);
}
function ftEntries(shots, players) {
  const data = {};
  shots.filter(s => s.isFT && s.playerNum).forEach(s => { if (!data[s.playerNum]) data[s.playerNum] = { made:0, att:0 }; data[s.playerNum].att++; if (s.result==="make") data[s.playerNum].made++; });
  return Object.entries(data).map(([num, d]) => { const p = players.find(x => x.number === num); return { num, name: p ? p.name : "#"+num, made:d.made, att:d.att }; }).sort((a,b) => b.att - a.att);
}

/* ─── APP ─── */
export default function App() {
  const [sessions, setSessions] = useState([]);
  const [curId, setCurId] = useState(null);
  const [shots, setShots] = useState([]);
  const [events, setEvents] = useState([]);
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
  const [dbStatus, setDbStatus] = useState("loading");
  const [saveOk, setSaveOk] = useState(null);
  const [shareMsg, setShareMsg] = useState(null);
  const idRef = useRef(null);
  idRef.current = curId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const games = await fetchAllGames();
      if (cancelled) return;
      if (games === null) { setDbStatus("error"); try { const l = localStorage.getItem("sc_data"); if (l) setSessions(JSON.parse(l)); } catch(e){} }
      else { setDbStatus("ok"); setSessions(games); }
      setView("history");
    })();
    return () => { cancelled = true; };
  }, []);

  const saveTimer = useRef(null);
  const saveToDb = useCallback((gameData) => {
    if (dbStatus !== "ok") { try { localStorage.setItem("sc_data", JSON.stringify(sessions)); } catch(e){} return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await updateGame(gameData);
      if (result) { setSaveOk(true); setTimeout(() => setSaveOk(null), 1200); } else { setSaveOk(false); }
    }, 800);
  }, [dbStatus, sessions]);

  const syncAll = (newShots, newEvents, newQuarter) => {
    const sid = idRef.current; if (!sid) return;
    setSessions(prev => {
      const updated = prev.map(s => { if (s.id !== sid) return s; const u = { ...s }; if (newShots !== undefined) u.shots = newShots; if (newEvents !== undefined) u.events = newEvents; if (newQuarter !== undefined) u.quarter = newQuarter; return u; });
      const game = updated.find(s => s.id === sid); if (game) saveToDb(game); return updated;
    });
  };

  const doFlash = (r) => { setFlash(r); setTimeout(() => setFlash(null), 350); };
  const addPlayer = () => { if (!rNum.trim()) return; const n = rNum.trim(); if (players.find(p => p.number === n)) return; setPlayers(prev => [...prev, { number: n, name: rName.trim() || ("#"+n) }]); setRName(""); setRNum(""); };

  const startSession = async () => {
    const gd = { team_name: teamName||"Game", players:[...players], shots:[], events:[], quarter:0, created_at: new Date().toISOString() };
    let saved; if (dbStatus === "ok") saved = await createGame(gd);
    const s = saved || { id: genId(), ...gd, teamName: gd.team_name };
    const n = { id:s.id, teamName:s.team_name||s.teamName||gd.team_name, players:s.players||gd.players, shots:s.shots||[], events:s.events||[], quarter:s.quarter||0, createdAt:s.created_at||s.createdAt||gd.created_at };
    setSessions(prev => [n, ...prev]); setCurId(n.id); setShots([]); setEvents([]); setQuarter(0); setActiveZone(null); setFtMode(false); setPending(null); setPendingAssist(null); setPendingTally(null); setView("tracker");
  };

  const openSession = (s) => {
    setCurId(s.id); setShots([...(s.shots||[])]); setEvents([...(s.events||[])]); setPlayers([...(s.players||[])]);
    setTeamName(s.teamName||s.team_name||""); setQuarter(s.quarter||0);
    setActiveZone(null); setFtMode(false); setPending(null); setPendingAssist(null); setPendingTally(null); setShowRecent(false); setView("tracker");
  };

  const deleteSession = async (id, e) => { e.stopPropagation(); setSessions(prev => prev.filter(s => s.id !== id)); if (curId === id) { setCurId(null); setShots([]); setEvents([]); setPlayers([]); } if (dbStatus === "ok") await apiDeleteGame(id); };

  const shareGame = (id) => {
    const url = window.location.origin + "/game/" + id;
    if (navigator.clipboard) { navigator.clipboard.writeText(url); setShareMsg(id); setTimeout(() => setShareMsg(null), 2000); } else { prompt("Share this link:", url); }
  };

  /* ─── COMPUTED STATS ─── */
  const fieldGoals = shots.filter(s => !s.isFT);
  const freeThrows = shots.filter(s => s.isFT);
  const zoneStats = {};
  ZONES.forEach(z => { const zs = fieldGoals.filter(s => mapZone(s.zone) === z.id); zoneStats[z.id] = { makes: zs.filter(s => s.result==="make").length, total: zs.length }; });
  const fgMakes = fieldGoals.filter(s => s.result==="make").length;
  const fgTotal = fieldGoals.length;
  const fgPct = fgTotal > 0 ? Math.round(fgMakes/fgTotal*100) : 0;
  const ftMakes = freeThrows.filter(s => s.result==="make").length;
  const ftTotal = freeThrows.length;
  const totalPts = shots.reduce((sum, s) => sum + getPoints(s), 0);
  const teamFouls = events.filter(e => e.type==="foul").length;
  const qtrFouls = events.filter(e => e.type==="foul" && e.quarter===quarter).length;
  const inBonus = qtrFouls >= 5;
  const oppFoulEvents = events.filter(e => e.type==="opp_foul");
  const oppQtrFouls = oppFoulEvents.filter(e => e.quarter===quarter).length;
  const oppInBonus = oppQtrFouls >= 5;
  const to60used = events.filter(e => e.type==="timeout" && e.duration===60).length;
  const to30used = events.filter(e => e.type==="timeout" && e.duration===30).length;
  const to60left = 3 - to60used; const to30left = 2 - to30used;
  const sortedPlayers = [...players].sort((a,b) => parseInt(a.number) - parseInt(b.number));
  const recentActions = [...shots, ...events].sort((a,b) => b.id - a.id).slice(0, 15);

  // Tally entries for cards
  const rebEntries = tallyEntries(events, "rebound", players);
  const astEntries = assistEntries(events, shots, players);
  const foulEntries = tallyEntries(events, "foul", players);
  const toEntries = tallyEntries(events, "turnover", players);
  const stlEntries = tallyEntries(events, "steal", players);
  const blkEntries = tallyEntries(events, "block", players);
  const oppFoulEntries = tallyEntries(events, "opp_foul", players);
  const ftData = ftEntries(shots, players);

  const anyPending = !!pending || !!pendingAssist || !!pendingTally || showTOPicker || showOppFoulInput;

  /* ─── ACTION HANDLERS ─── */
  const handleZoneTap = useCallback((id) => { if (!ftMode && !anyPending) setActiveZone(id); }, [ftMode, anyPending]);

  const handleMakeMiss = (result) => {
    if (anyPending) return;
    if (ftMode) {
      if (players.length === 0) { const ns = [...shots, { result, id:Date.now(), isFT:true, quarter }]; setShots(ns); syncAll(ns,undefined,undefined); doFlash(result); }
      else { setPending({ type:"shot", result, isFT:true }); }
      return;
    }
    if (!activeZone) return;
    if (players.length === 0) { const ns = [...shots, { zone:activeZone, result, id:Date.now(), isFT:false, quarter }]; setShots(ns); syncAll(ns,undefined,undefined); doFlash(result); setActiveZone(null); }
    else { setPending({ type:"shot", result, zone:activeZone, isFT:false }); }
  };

  const handleTimeout = (duration) => {
    const left = duration===60 ? to60left : to30left; if (left <= 0) return;
    const ne = [...events, { type:"timeout", duration, id:Date.now(), quarter }]; setEvents(ne); syncAll(undefined,ne,undefined); setShowTOPicker(false);
  };

  const pickPlayer = (num) => {
    if (!pending) return;
    if (pending.type === "shot") {
      const shotId = Date.now();
      const newShot = { result:pending.result, id:shotId, isFT:pending.isFT, zone:pending.zone, playerNum:num, quarter };
      const ns = [...shots, newShot]; setShots(ns); syncAll(ns,undefined,undefined); doFlash(pending.result); setActiveZone(null);
      if (pending.result === "make" && !pending.isFT && players.length > 1) { setPending(null); setPendingAssist({ shotId, scorerNum:num }); return; }
    }
    setPending(null);
  };

  const pickAssist = (num) => {
    if (!pendingAssist) return;
    const ne = [...events, { type:"assist", playerNum:num, id:Date.now(), quarter }]; setEvents(ne); syncAll(undefined,ne,undefined);
    setPendingAssist(null);
  };
  const skipAssist = () => { setPendingAssist(null); };

  /* ─── TALLY CARD HANDLERS ─── */
  const incrementStat = (type, playerNum) => {
    const ne = [...events, { type, playerNum, id:Date.now(), quarter }]; setEvents(ne); syncAll(undefined,ne,undefined);
    if (type === "foul") {
      const newCount = ne.filter(e => e.type==="foul" && e.playerNum===playerNum).length;
      if (newCount >= 4) { const p = players.find(x => x.number===playerNum); setFoulWarning((p?p.name:"#"+playerNum)+" has "+newCount+" fouls!"); setTimeout(() => setFoulWarning(null), 3500); }
    }
  };

  const decrementStat = (type, playerNum) => {
    const idx = [...events].reverse().findIndex(e => e.type===type && e.playerNum===playerNum);
    if (idx === -1) return;
    const realIdx = events.length - 1 - idx;
    const ne = events.filter((_,i) => i !== realIdx); setEvents(ne); syncAll(undefined,ne,undefined);
  };

  const tallyPickPlayer = (num) => {
    if (!pendingTally) return;
    incrementStat(pendingTally.type, num);
    setPendingTally(null);
  };

  const handleOppFoulAdd = (num) => {
    if (!num) return;
    incrementStat("opp_foul", String(num));
    setOppFoulNum("");
  };

  const advanceQuarter = () => { const nq = (quarter+1) % Q_LABELS.length; setQuarter(nq); syncAll(undefined,undefined,nq); };
  const backQuarter = () => { const nq = (quarter-1+Q_LABELS.length) % Q_LABELS.length; setQuarter(nq); syncAll(undefined,undefined,nq); };

  const deleteAction = (item) => {
    if (item.result !== undefined) { const ns = shots.filter(s => s.id !== item.id); setShots(ns); syncAll(ns,undefined,undefined); }
    else { const ne = events.filter(e => e.id !== item.id); setEvents(ne); syncAll(undefined,ne,undefined); }
  };

  /* ─── VISUAL HELPERS ─── */
  const getZoneColor = (id) => { const s = zoneStats[id]; if (!s||!s.total) return "rgba(255,255,255,0.04)"; const p = s.makes/s.total; return p>=0.5?"rgba(34,197,94,0.25)":p>=0.35?"rgba(250,204,21,0.15)":"rgba(239,68,68,0.2)"; };
  const getZoneBorder = (id) => { if (activeZone===id) return "rgba(255,255,255,0.9)"; const s = zoneStats[id]; if (!s||!s.total) return "rgba(255,255,255,0.12)"; const p = s.makes/s.total; return p>=0.5?"rgba(34,197,94,0.5)":p>=0.35?"rgba(250,204,21,0.4)":"rgba(239,68,68,0.45)"; };
  const getZoneText = (id) => { const s = zoneStats[id]; if (!s||!s.total) return "rgba(255,255,255,0.12)"; const p = s.makes/s.total; return p>=0.5?"#22c55e":p>=0.35?"#facc15":"#ef4444"; };
  const flashBorder = flash==="make"?"2px solid #22c55e":flash==="miss"?"2px solid #ef4444":"2px solid transparent";
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); } catch(e) { return ""; } };
  const StatusBadge = () => { if (dbStatus==="error") return <span style={{color:"#ef4444",fontSize:9,marginLeft:6}}>⚠ offline</span>; if (saveOk===true) return <span style={{color:"#22c55e",fontSize:10,marginLeft:8}}>✓ Saved</span>; if (saveOk===false) return <span style={{color:"#ef4444",fontSize:10,marginLeft:8}}>✕ Save failed</span>; return null; };

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
      <div style={{padding:"20px 16px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:20,fontWeight:800}}>Shot Chart</div><div style={SUBHEAD}>Saved Sessions</div></div><button onClick={()=>{setPlayers([...DEFAULT_ROSTER]);setTeamName("");setRName("");setRNum("");setView("roster");}} style={ACCENT}>+ New Game</button></div>
      {dbStatus==="error"&&<div style={{margin:"0 16px 8px",padding:"8px 12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,fontSize:11,color:"#ef4444"}}>⚠ Database unavailable — using local storage only</div>}
      {dbStatus==="ok"&&<div style={{margin:"0 16px 8px",padding:"8px 12px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:8,fontSize:11,color:"#22c55e"}}>✓ Connected — games auto-save & are shareable</div>}
      {sessions.length===0?<div style={{textAlign:"center",padding:"60px 20px",color:"#444"}}><div style={{fontSize:40,marginBottom:12}}>🏀</div><div style={{fontSize:15,fontWeight:600}}>No sessions yet</div></div>:(
        <div style={{padding:"4px 16px 20px",display:"flex",flexDirection:"column",gap:8}}>
          {/* Season Stats */}
          {(()=>{
            const allShots=sessions.flatMap(s=>s.shots||[]); const allEvents=sessions.flatMap(s=>s.events||[]); const numGames=sessions.length;
            if (allShots.length===0&&allEvents.length===0) return null;
            const yFG=allShots.filter(s=>!s.isFT); const yFT=allShots.filter(s=>s.isFT);
            const yFGm=yFG.filter(s=>s.result==="make").length; const yFTm=yFT.filter(s=>s.result==="make").length;
            const yPts=allShots.reduce((sum,s)=>sum+getPoints(s),0);
            const yFouls=allEvents.filter(e=>e.type==="foul").length; const yTOs=allEvents.filter(e=>e.type==="turnover").length;
            const yAst=allEvents.filter(e=>e.type==="assist").length + allShots.filter(s=>s.assistNum).length;
            const yReb=allEvents.filter(e=>e.type==="rebound").length; const yStl=allEvents.filter(e=>e.type==="steal").length; const yBlk=allEvents.filter(e=>e.type==="block").length;
            return (
              <><button onClick={()=>setShowYearStats(p=>!p)} style={{background:showYearStats?"rgba(250,204,21,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(showYearStats?"rgba(250,204,21,0.25)":"rgba(255,255,255,0.08)"),color:showYearStats?"#facc15":"#888",fontSize:12,fontWeight:700,padding:"10px 16px",borderRadius:10,cursor:"pointer",textAlign:"center"}}>{showYearStats?"▾ Hide Season Stats":"▸ Season Stats — "+numGames+" Game"+(numGames!==1?"s":"")+" · "+yPts+" Total Pts"}</button>
              {showYearStats&&<div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:14}}>
                <div style={SECHEAD}>Season Totals</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8}}>
                  <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:900,color:"#facc15"}}>{yPts}</div><div style={{fontSize:8,color:"#666"}}>PTS</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#facc15"}}>{numGames>0?(yPts/numGames).toFixed(1):"—"}</div><div style={{fontSize:8,color:"#666"}}>PPG</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{yFG.length?Math.round(yFGm/yFG.length*100)+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FG {yFGm}/{yFG.length}</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:"#818cf8"}}>{yFT.length?Math.round(yFTm/yFT.length*100)+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FT {yFTm}/{yFT.length}</div></div>
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
          {/* Game list */}
          {sessions.map(s=>{
            const all=s.shots||[]; const ev=s.events||[];
            const sFG=all.filter(x=>!x.isFT); const sFGm=sFG.filter(x=>x.result==="make").length; const sFGt=sFG.length;
            const sFGp=sFGt?Math.round(sFGm/sFGt*100):0; const sPts=all.reduce((sum,x)=>sum+getPoints(x),0);
            const sFouls=ev.filter(x=>x.type==="foul").length; const sTOs=ev.filter(x=>x.type==="turnover").length;
            return (
              <div key={s.id} onClick={()=>openSession(s)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"14px 16px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:15,fontWeight:700}}>{s.teamName||s.team_name||"Unnamed"}</div><div style={{fontSize:11,color:"#666",marginTop:2}}>{fmtDate(s.created_at||s.createdAt)}</div></div>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#facc15"}}>{sPts}</div><div style={{fontSize:8,color:"#666"}}>PTS</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:800,color:sFGp>=50?"#22c55e":sFGp>=35?"#facc15":sFGt?"#ef4444":"#555"}}>{sFGt?sFGp+"%":"—"}</div><div style={{fontSize:9,color:"#666"}}>FG {sFGm}/{sFGt}</div></div>
                    <button onClick={e=>{e.stopPropagation();shareGame(s.id);}} style={{background:"none",border:"none",color:shareMsg===s.id?"#22c55e":"#facc15",fontSize:13,cursor:"pointer",padding:"4px"}}>{shareMsg===s.id?"✓":"🔗"}</button>
                    <button onClick={e=>deleteSession(s.id,e)} style={{background:"none",border:"none",color:"#555",fontSize:18,cursor:"pointer",padding:"4px 2px"}}>×</button>
                  </div>
                </div>
                {(sFouls>0||sTOs>0)&&<div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:"#666"}}>{sFouls>0&&<span style={{color:"#f97316"}}>{sFouls} fouls</span>}{sTOs>0&&<span style={{color:"#a855f7"}}>{sTOs} TO</span>}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ═══ TRACKER ═══
  const canRecord = ftMode || activeZone;
  return (
    <div style={SHELL}>
      {/* Player Picker Overlay (for shots) */}
      {pending && pending.type==="shot" && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:12,color:"#888",marginBottom:4,letterSpacing:1,textTransform:"uppercase"}}>{(pending.result==="make"?"Make":"Miss")+(pending.isFT?" (FT)":pending.zone?" — "+(ZONES.find(z=>z.id===pending.zone)?.label||""):"")}</div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:20,color:pending.result==="make"?"#22c55e":"#ef4444"}}>Who took the shot?</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,width:"100%",maxWidth:480,marginBottom:20}}>
            {sortedPlayers.map(p=><button key={p.number} onClick={()=>pickPlayer(p.number)} style={{background:"rgba(255,255,255,0.08)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:14,padding:"14px 8px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{fontSize:28,fontWeight:900,color:"#facc15",lineHeight:1}}>{p.number}</div>
              <div style={{fontSize:10,color:"#aaa",fontWeight:600}}>{p.name}</div>
            </button>)}
          </div>
          <button onClick={()=>setPending(null)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"10px 28px",borderRadius:8,cursor:"pointer",fontSize:13}}>Cancel</button>
        </div>
      )}
      {/* Assist Picker Overlay */}
      {pendingAssist && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:12,color:"#888",marginBottom:4,letterSpacing:1,textTransform:"uppercase"}}>Make recorded</div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:20,color:"#22c55e"}}>Assisted by?</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,width:"100%",maxWidth:480,marginBottom:20}}>
            {sortedPlayers.filter(p=>p.number!==pendingAssist.scorerNum).map(p=><button key={p.number} onClick={()=>pickAssist(p.number)} style={{background:"rgba(255,255,255,0.08)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:14,padding:"14px 8px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{fontSize:28,fontWeight:900,color:"#facc15",lineHeight:1}}>{p.number}</div>
              <div style={{fontSize:10,color:"#aaa",fontWeight:600}}>{p.name}</div>
            </button>)}
          </div>
          <button onClick={skipAssist} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"10px 28px",borderRadius:8,cursor:"pointer",fontSize:13}}>Skip</button>
        </div>
      )}
      {/* Tally Add Player Overlay */}
      {pendingTally && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:20,color:CC[pendingTally.type]?.t||"#fff"}}>{pendingTally.label}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,width:"100%",maxWidth:480,marginBottom:20}}>
            {sortedPlayers.map(p=><button key={p.number} onClick={()=>tallyPickPlayer(p.number)} style={{background:"rgba(255,255,255,0.08)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:14,padding:"14px 8px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{fontSize:28,fontWeight:900,color:"#facc15",lineHeight:1}}>{p.number}</div>
              <div style={{fontSize:10,color:"#aaa",fontWeight:600}}>{p.name}</div>
            </button>)}
          </div>
          <button onClick={()=>setPendingTally(null)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"10px 28px",borderRadius:8,cursor:"pointer",fontSize:13}}>Cancel</button>
        </div>
      )}
      {/* Timeout Picker */}
      {showTOPicker && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:24,color:"#fff"}}>Call Timeout</div>
          <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:280}}>
            <button onClick={()=>handleTimeout(60)} disabled={to60left<=0} style={{padding:"18px 0",borderRadius:14,border:to60left>0?"2px solid rgba(255,255,255,0.2)":"2px solid rgba(255,255,255,0.06)",background:to60left>0?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.02)",cursor:to60left>0?"pointer":"default",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:to60left>0?"#fff":"#333"}}>60 sec</div><div style={{fontSize:12,color:to60left>0?"#888":"#333",marginTop:4}}>{to60left} remaining</div></button>
            <button onClick={()=>handleTimeout(30)} disabled={to30left<=0} style={{padding:"18px 0",borderRadius:14,border:to30left>0?"2px solid rgba(255,255,255,0.2)":"2px solid rgba(255,255,255,0.06)",background:to30left>0?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.02)",cursor:to30left>0?"pointer":"default",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:to30left>0?"#fff":"#333"}}>30 sec</div><div style={{fontSize:12,color:to30left>0?"#888":"#333",marginTop:4}}>{to30left} remaining</div></button>
          </div>
          <button onClick={()=>setShowTOPicker(false)} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"10px 28px",borderRadius:8,cursor:"pointer",fontSize:13,marginTop:20}}>Cancel</button>
        </div>
      )}
      {/* Opp Foul Input */}
      {showOppFoulInput && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:20,color:"#ef4444"}}>Opponent Foul</div>
          <div style={{display:"flex",gap:8,marginBottom:20,width:"100%",maxWidth:280}}>
            <input value={oppFoulNum} onChange={e=>setOppFoulNum(e.target.value.replace(/\D/g,"").slice(0,3))} placeholder="Opp #" style={{...INP,width:80,textAlign:"center",fontSize:20,fontWeight:800}} inputMode="numeric" autoFocus />
            <button onClick={()=>{if(oppFoulNum.trim()){handleOppFoulAdd(oppFoulNum.trim());setShowOppFoulInput(false);}}} disabled={!oppFoulNum.trim()} style={{flex:1,padding:"12px 0",borderRadius:10,border:"none",fontSize:14,fontWeight:700,cursor:oppFoulNum.trim()?"pointer":"default",background:oppFoulNum.trim()?"#ef4444":"rgba(239,68,68,0.15)",color:oppFoulNum.trim()?"#fff":"rgba(239,68,68,0.4)"}}>Add Foul</button>
          </div>
          <button onClick={()=>{setShowOppFoulInput(false);setOppFoulNum("");}} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"#888",padding:"10px 28px",borderRadius:8,cursor:"pointer",fontSize:13}}>Cancel</button>
        </div>
      )}

      {/* Header */}
      <div style={{padding:"12px 16px 4px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center"}}><button onClick={()=>setView("history")} style={LINK}>← All Sessions</button><StatusBadge /></div>
          {editName?<input autoFocus value={teamName} onChange={e=>{setTeamName(e.target.value);setSessions(p=>p.map(s=>s.id===curId?{...s,teamName:e.target.value,team_name:e.target.value}:s));}} onBlur={()=>{setEditName(false);const g=sessions.find(s=>s.id===curId);if(g)saveToDb(g);}} onKeyDown={e=>e.key==="Enter"&&setEditName(false)} placeholder="Team name" style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",fontSize:16,fontWeight:700,padding:"4px 10px",borderRadius:6,outline:"none",width:200,marginTop:4,display:"block"}} />
          :<div onClick={()=>setEditName(true)} style={{fontSize:16,fontWeight:700,color:teamName?"#fff":"#555",cursor:"pointer",marginTop:2}}>{teamName||"Tap to set name"}<span style={{fontSize:11,color:"#444",marginLeft:6}}>✎</span></div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={backQuarter} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#888",fontSize:12,fontWeight:700,padding:"6px 8px",borderRadius:6,cursor:"pointer"}}>◂</button>
          <button onClick={advanceQuarter} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#facc15",fontSize:14,fontWeight:800,padding:"6px 14px",borderRadius:8,cursor:"pointer",minWidth:44,textAlign:"center"}}>{Q_LABELS[quarter]}</button>
          <button onClick={()=>setShowTOPicker(true)} disabled={anyPending||(to60left<=0&&to30left<=0)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:anyPending||(to60left<=0&&to30left<=0)?"rgba(255,255,255,0.2)":"#ccc",fontSize:12,fontWeight:700,padding:"6px 10px",borderRadius:6,cursor:anyPending?"default":"pointer"}}>⏱{to60left+to30left}</button>
          <button onClick={()=>setShowRecent(p=>!p)} style={{background:showRecent?"rgba(250,204,21,0.12)":"rgba(255,255,255,0.08)",border:"1px solid "+(showRecent?"rgba(250,204,21,0.25)":"rgba(255,255,255,0.1)"),color:showRecent?"#facc15":"#999",fontSize:11,padding:"6px 10px",borderRadius:6,cursor:"pointer",letterSpacing:1,textTransform:"uppercase"}}>Recent</button>
        </div>
      </div>

      {/* Banners */}
      {foulWarning&&<div style={{margin:"0 16px 4px",padding:"8px 12px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:8,fontSize:13,fontWeight:700,color:"#ef4444",textAlign:"center"}}>⚠ {foulWarning}</div>}
      {inBonus&&<div style={{margin:"0 16px 4px",padding:"6px 12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,fontSize:11,fontWeight:700,color:"#ef4444",textAlign:"center"}}>BONUS — {qtrFouls} team fouls in {Q_LABELS[quarter]}</div>}
      {oppInBonus&&<div style={{margin:"0 16px 4px",padding:"6px 12px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:8,fontSize:11,fontWeight:700,color:"#22c55e",textAlign:"center"}}>OPP BONUS — {oppQtrFouls} opponent fouls in {Q_LABELS[quarter]}</div>}

      {/* Recent Panel */}
      {showRecent&&<div style={{margin:"0 16px 8px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,overflow:"hidden"}}>
        <div style={{padding:"8px 12px 6px",fontSize:10,color:"#555",letterSpacing:1,textTransform:"uppercase"}}>Last {Math.min(recentActions.length,15)} actions</div>
        {recentActions.length===0?<div style={{padding:"12px",fontSize:12,color:"#444",textAlign:"center"}}>No actions yet</div>:
        <div style={{maxHeight:220,overflowY:"auto"}}>{recentActions.map((item,i)=>{
          const desc=describeAction(item,players);
          const isShot=item.result!==undefined;
          const dot=isShot?(item.result==="make"?"#22c55e":"#ef4444"):item.type==="foul"?"#f97316":item.type==="opp_foul"?"#ef4444":item.type==="turnover"?"#a855f7":item.type==="rebound"?"#22c55e":item.type==="steal"?"#3b82f6":item.type==="block"?"#ec4899":item.type==="assist"?"#22c55e":"#888";
          return <div key={item.id+"-"+i} style={{display:"flex",alignItems:"center",padding:"6px 12px",borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none"}}><div style={{width:6,height:6,borderRadius:3,background:dot,flexShrink:0,marginRight:8}} /><div style={{flex:1,fontSize:11,color:"#aaa",lineHeight:1.3}}>{desc}</div><button onClick={()=>deleteAction(item)} style={{background:"none",border:"none",color:"#555",fontSize:16,cursor:"pointer",padding:"2px 4px",marginLeft:6}}>✕</button></div>;
        })}</div>}
      </div>}

      {/* Score bar */}
      <div style={{display:"flex",justifyContent:"center",gap:14,padding:"6px 16px",flexWrap:"wrap",alignItems:"center"}}>
        <StatBox label="PTS" value={totalPts} color="#facc15" />
        <StatBox label="FG" value={fgMakes+"/"+fgTotal} color="#22c55e" />
        <StatBox label="FG%" value={fgTotal?fgPct+"":"0"} color={fgPct>=50?"#22c55e":fgPct>=35?"#facc15":"#ef4444"} />
        <StatBox label="FT" value={ftMakes+"/"+ftTotal} color="#818cf8" />
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
              {ZONES.map(z=>{const s=zoneStats[z.id];const pct=s&&s.total?Math.round(s.makes/s.total*100):null;const isA=activeZone===z.id;return(
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
            <button onClick={()=>handleMakeMiss("make")} disabled={!canRecord||anyPending} style={{flex:1,padding:"14px 0",borderRadius:12,border:"none",fontSize:18,fontWeight:800,letterSpacing:2,cursor:canRecord&&!anyPending?"pointer":"default",background:canRecord&&!anyPending?(ftMode?"#818cf8":"#22c55e"):(ftMode?"rgba(129,140,248,0.15)":"rgba(34,197,94,0.15)"),color:canRecord&&!anyPending?"#000":(ftMode?"rgba(129,140,248,0.4)":"rgba(34,197,94,0.4)"),transition:"all 0.2s"}}>MAKE</button>
            <button onClick={()=>handleMakeMiss("miss")} disabled={!canRecord||anyPending} style={{flex:1,padding:"14px 0",borderRadius:12,border:"none",fontSize:18,fontWeight:800,letterSpacing:2,cursor:canRecord&&!anyPending?"pointer":"default",background:canRecord&&!anyPending?"#ef4444":"rgba(239,68,68,0.15)",color:canRecord&&!anyPending?"#fff":"rgba(239,68,68,0.4)",transition:"all 0.2s"}}>MISS</button>
          </div>

          {!ftMode&&!activeZone&&!anyPending&&<div style={{textAlign:"center",padding:"4px 0",color:"#444",fontSize:11}}>Tap a zone, then Make or Miss</div>}

          {/* Compact cards: FT, Steals, Blocks, Opp Fouls */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:8}}>
            {/* FT Card (toggles FT mode) */}
            <div onClick={()=>{setFtMode(p=>!p);setActiveZone(null);setPending(null);}} style={{background:ftMode?CC.ft.bg:"rgba(129,140,248,0.05)",border:ftMode?"2px solid #818cf8":"1.5px solid "+CC.ft.bd,borderRadius:10,padding:"8px 10px",cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:ftData.length>0?4:0}}>
                <span style={{fontSize:12,fontWeight:800,color:"#818cf8"}}>Free throws</span>
                <span style={{fontSize:11,color:"#818cf8",fontWeight:700}}>{ftMakes}/{ftTotal}</span>
              </div>
              {ftData.map(e=><div key={e.num} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:11,color:"#ccc"}}>#{e.num} {e.name}</span><span style={{fontSize:11,color:"#888"}}>{e.made}/{e.att}</span></div>)}
              {ftMode&&<div style={{textAlign:"center",fontSize:10,color:"#818cf8",fontWeight:700,marginTop:4}}>TAP TO EXIT FT MODE</div>}
            </div>

            <TallyCard title="Steals" type="steal" entries={stlEntries} compact onAdd={()=>setPendingTally({type:"steal",label:"Who got the steal?"})} onInc={(n)=>incrementStat("steal",n)} onDec={(n)=>decrementStat("steal",n)} />
            <TallyCard title="Blocks" type="block" entries={blkEntries} compact onAdd={()=>setPendingTally({type:"block",label:"Who blocked it?"})} onInc={(n)=>incrementStat("block",n)} onDec={(n)=>decrementStat("block",n)} />

            {/* Opp Fouls card */}
            <div style={{background:CC.opp_foul.bg,border:"1.5px solid "+CC.opp_foul.bd,borderRadius:10,padding:"8px 10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:oppFoulEntries.length>0?4:0}}>
                <span style={{fontSize:12,fontWeight:800,color:"#ef4444"}}>Opp fouls</span>
                <span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>{oppFoulEvents.length}</span>
              </div>
              {oppFoulEntries.map(e=><div key={e.num} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"2px 0"}}>
                <span style={{fontSize:11,color:"#ccc"}}>#{e.num}</span>
                <div style={{display:"flex",alignItems:"center",gap:4}}><span onClick={()=>decrementStat("opp_foul",e.num)} style={{color:"#555",fontSize:14,cursor:"pointer"}}>-</span><span style={{fontSize:13,fontWeight:800,color:e.count>=4?"#ef4444":"#f97316",minWidth:14,textAlign:"center"}}>{e.count}</span><span onClick={()=>incrementStat("opp_foul",e.num)} style={{color:"#555",fontSize:14,cursor:"pointer"}}>+</span></div>
              </div>)}
              <div onClick={()=>{setShowOppFoulInput(true);setOppFoulNum("");}} style={{textAlign:"center",color:"#ef4444",fontSize:18,cursor:"pointer",marginTop:oppFoulEntries.length>0?4:2}}>+</div>
            </div>
          </div>
        </div>

        {/* RIGHT: Tall tally cards */}
        <div style={{width:220,display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
          <TallyCard title="Rebounds" type="rebound" entries={rebEntries} onAdd={()=>setPendingTally({type:"rebound",label:"Who rebounded?"})} onInc={(n)=>incrementStat("rebound",n)} onDec={(n)=>decrementStat("rebound",n)} />
          <TallyCard title="Assists" type="assist" entries={astEntries} onAdd={()=>setPendingTally({type:"assist",label:"Who got the assist?"})} onInc={(n)=>incrementStat("assist",n)} onDec={(n)=>decrementStat("assist",n)} />
          <TallyCard title="Fouls" type="foul" entries={foulEntries} warnAt={4} onAdd={()=>setPendingTally({type:"foul",label:"Who fouled?"})} onInc={(n)=>incrementStat("foul",n)} onDec={(n)=>decrementStat("foul",n)} />
          <TallyCard title="Turnovers" type="turnover" entries={toEntries} onAdd={()=>setPendingTally({type:"turnover",label:"Who turned it over?"})} onInc={(n)=>incrementStat("turnover",n)} onDec={(n)=>decrementStat("turnover",n)} />
        </div>
      </div>

      {/* Player Stats Toggle + Export */}
      <div style={{padding:"8px 16px",display:"flex",gap:8}}>
        <button onClick={()=>setShowStats(p=>!p)} style={{flex:1,background:showStats?"rgba(250,204,21,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(showStats?"rgba(250,204,21,0.3)":"rgba(255,255,255,0.08)"),color:showStats?"#facc15":"#888",fontSize:12,fontWeight:700,padding:"10px 24px",borderRadius:10,cursor:"pointer"}}>{showStats?"▾ Hide player stats":"▸ Player stats and breakdown"}</button>
        <button onClick={()=>{const g=sessions.find(s=>s.id===curId);if(g)exportGamePdf({...g,shots,events,players,quarter});}} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#888",fontSize:12,fontWeight:700,padding:"10px 16px",borderRadius:10,cursor:"pointer"}}>Export PDF</button>
      </div>

      {showStats&&players.length>0&&<div style={{padding:"0 16px 16px"}}>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,overflow:"hidden"}}>
          {/* Grid header */}
          <div style={{display:"grid",gridTemplateColumns:"90px repeat(9,minmax(0,1fr))",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
            <div style={{padding:"10px 10px",fontSize:10,color:"#555",letterSpacing:1}}>PLAYER</div>
            {[{l:"PTS",c:"#facc15"},{l:"FG",c:"#22c55e"},{l:"FT",c:"#818cf8"},{l:"AST",c:"#22c55e"},{l:"REB",c:"#22c55e"},{l:"STL",c:"#3b82f6"},{l:"BLK",c:"#ec4899"},{l:"FLS",c:"#f97316"},{l:"TO",c:"#a855f7"}].map(h=>
              <div key={h.l} style={{padding:"10px 2px",fontSize:10,color:h.c,letterSpacing:0.5,textAlign:"center"}}>{h.l}</div>
            )}
          </div>
          {/* Player rows */}
          {sortedPlayers.map((p,ri)=>{
            const pS=shots.filter(s=>s.playerNum===p.number);
            const pFG=pS.filter(s=>!s.isFT); const pFT=pS.filter(s=>s.isFT);
            const pFGm=pFG.filter(s=>s.result==="make").length; const pFTm=pFT.filter(s=>s.result==="make").length;
            const pPts=pS.reduce((sum,s)=>sum+getPoints(s),0);
            const ast=events.filter(e=>e.type==="assist"&&e.playerNum===p.number).length+shots.filter(s=>s.assistNum===p.number).length;
            const reb=events.filter(e=>e.type==="rebound"&&e.playerNum===p.number).length;
            const stl=events.filter(e=>e.type==="steal"&&e.playerNum===p.number).length;
            const blk=events.filter(e=>e.type==="block"&&e.playerNum===p.number).length;
            const fls=events.filter(e=>e.type==="foul"&&e.playerNum===p.number).length;
            const to=events.filter(e=>e.type==="turnover"&&e.playerNum===p.number).length;
            const flsColor=fls>=4?"#ef4444":fls>=3?"#f97316":"#f97316";
            const PM=({val,color,type:t})=><div style={{textAlign:"center"}}><div style={{display:"inline-flex",alignItems:"center",gap:2}}><span onClick={()=>decrementStat(t,p.number)} style={{color:"#444",fontSize:18,cursor:"pointer",padding:"4px 6px",lineHeight:1}}>-</span><span style={{fontSize:15,fontWeight:800,color:val>0?color:"#444",minWidth:16,textAlign:"center"}}>{val}</span><span onClick={()=>incrementStat(t,p.number)} style={{color:"#444",fontSize:18,cursor:"pointer",padding:"4px 6px",lineHeight:1}}>+</span></div></div>;
            return (
              <div key={p.number} style={{display:"grid",gridTemplateColumns:"90px repeat(9,minmax(0,1fr))",alignItems:"center",borderBottom:ri<sortedPlayers.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:ri%2===0?"rgba(250,204,21,0.02)":"transparent"}}>
                <div style={{padding:"8px 10px",display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:28,height:28,borderRadius:6,background:"rgba(250,204,21,0.15)",border:"1px solid rgba(250,204,21,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#facc15",fontSize:12,flexShrink:0}}>{p.number}</div>
                  <span style={{fontSize:12,fontWeight:600,color:"#ccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                </div>
                <div style={{textAlign:"center",fontSize:18,fontWeight:800,color:"#facc15"}}>{pPts}</div>
                <div style={{textAlign:"center",fontSize:11,color:pFG.length>0?"#888":"#444"}}>{pFGm}/{pFG.length}</div>
                <div style={{textAlign:"center",fontSize:11,color:pFT.length>0?"#888":"#444"}}>{pFTm}/{pFT.length}</div>
                <PM val={ast} color="#22c55e" type="assist" />
                <PM val={reb} color="#22c55e" type="rebound" />
                <PM val={stl} color="#3b82f6" type="steal" />
                <PM val={blk} color="#ec4899" type="block" />
                <PM val={fls} color={flsColor} type="foul" />
                <PM val={to} color="#a855f7" type="turnover" />
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
