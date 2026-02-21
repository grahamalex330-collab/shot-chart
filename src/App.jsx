import { useState, useRef, useCallback, useEffect } from "react";
import { fetchAllGames, createGame, updateGame, deleteGame as apiDeleteGame } from "./api.js";

/* ─── ZONES ─── */
const ZONES = [
  { id: "paint", label: "Paint", path: "M 160,340 L 240,340 240,260 160,260 Z", cx: 200, cy: 300 },
  { id: "left-block", label: "L Block", path: "M 100,340 L 160,340 160,280 100,310 Z", cx: 128, cy: 312 },
  { id: "right-block", label: "R Block", path: "M 240,340 L 300,340 300,310 240,280 Z", cx: 272, cy: 312 },
  { id: "left-elbow", label: "L Elbow", path: "M 100,310 L 160,280 160,220 120,220 Z", cx: 132, cy: 264 },
  { id: "right-elbow", label: "R Elbow", path: "M 240,280 L 300,310 280,220 240,220 Z", cx: 268, cy: 264 },
  { id: "ft-line", label: "FT Line", path: "M 160,260 L 240,260 240,220 160,220 Z", cx: 200, cy: 240 },
  { id: "left-mid", label: "L Mid", path: "M 40,340 L 100,340 100,310 120,220 80,220 20,280 Z", cx: 68, cy: 284 },
  { id: "right-mid", label: "R Mid", path: "M 300,340 L 360,340 380,280 320,220 280,220 300,310 Z", cx: 332, cy: 284 },
  { id: "top-key", label: "Top Key", path: "M 120,220 L 280,220 260,160 140,160 Z", cx: 200, cy: 192 },
  { id: "left-wing3", label: "L Wing 3", path: "M 0,340 L 40,340 20,280 80,220 60,160 0,200 Z", cx: 32, cy: 264 },
  { id: "right-wing3", label: "R Wing 3", path: "M 360,340 L 400,340 400,200 340,160 320,220 380,280 Z", cx: 368, cy: 264 },
  { id: "left-corner3", label: "L Corner", path: "M 0,400 L 0,340 40,340 20,400 Z", cx: 14, cy: 370 },
  { id: "right-corner3", label: "R Corner", path: "M 380,400 L 360,340 400,340 400,400 Z", cx: 386, cy: 370 },
  { id: "top3", label: "Top 3", path: "M 60,160 L 140,160 200,100 260,160 340,160 300,80 200,40 100,80 Z", cx: 200, cy: 120 },
];

const THREE_PT = new Set(["left-wing3", "right-wing3", "left-corner3", "right-corner3", "top3"]);
const Q_LABELS = ["Q1", "Q2", "Q3", "Q4", "OT", "OT2"];

const DEFAULT_ROSTER = [
  { number: "3", name: "Bella" },
  { number: "4", name: "Maliah" },
  { number: "5", name: "Hayden" },
  { number: "12", name: "Nikki" },
  { number: "21", name: "Adyson" },
  { number: "23", name: "Journey" },
  { number: "24", name: "Caroline" },
];

function getPoints(s) {
  if (s.result !== "make") return 0;
  if (s.isFT) return 1;
  return THREE_PT.has(s.zone) ? 3 : 2;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ─── STYLES ─── */
const SHELL = { minHeight: "100vh", background: "#0a0a0a", fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif", color: "#fff", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", maxWidth: 440, margin: "0 auto" };
const INP = { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 14, padding: "10px 12px", borderRadius: 8, outline: "none", width: "100%", boxSizing: "border-box" };
const BTN = { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#999", fontSize: 11, padding: "5px 12px", borderRadius: 6, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" };
const ACCENT = { background: "#facc15", border: "none", color: "#000", fontSize: 13, fontWeight: 700, padding: "10px 20px", borderRadius: 8, cursor: "pointer" };
const LINK = { background: "none", border: "none", color: "#facc15", fontSize: 13, cursor: "pointer", padding: 0, fontWeight: 600 };
const LABEL = { fontSize: 11, color: "#666", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 };
const SUBHEAD = { fontSize: 11, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginTop: 2 };
const SECHEAD = { fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" };
const JERSEY = { borderRadius: 8, background: "rgba(250,204,21,0.15)", border: "1px solid rgba(250,204,21,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#facc15" };

function StatBox({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 8, color: "#555", letterSpacing: 1.2, marginTop: 3, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function PBar({ label, pct, color, mb }) {
  return (
    <div style={{ padding: mb ? "2px 16px 6px" : "2px 16px 2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: "#555", width: 18 }}>{label}</span>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 3, transition: "width 0.3s ease" }} />
        </div>
      </div>
    </div>
  );
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
  const [showTOPicker, setShowTOPicker] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showYearStats, setShowYearStats] = useState(false);
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
      if (games === null) {
        setDbStatus("error");
        try {
          const local = localStorage.getItem("sc_data");
          if (local) setSessions(JSON.parse(local));
        } catch (e) {}
      } else {
        setDbStatus("ok");
        setSessions(games);
      }
      setView("history");
    })();
    return () => { cancelled = true; };
  }, []);

  const saveTimer = useRef(null);
  const saveToDb = useCallback((gameData) => {
    if (dbStatus !== "ok") {
      try { localStorage.setItem("sc_data", JSON.stringify(sessions)); } catch (e) {}
      return;
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await updateGame(gameData);
      if (result) {
        setSaveOk(true);
        setTimeout(() => setSaveOk(null), 1200);
      } else {
        setSaveOk(false);
      }
    }, 800);
  }, [dbStatus, sessions]);

  const syncAll = (newShots, newEvents, newQuarter) => {
    const sid = idRef.current;
    if (!sid) return;
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id !== sid) return s;
        const upd = { ...s };
        if (newShots !== undefined) upd.shots = newShots;
        if (newEvents !== undefined) upd.events = newEvents;
        if (newQuarter !== undefined) upd.quarter = newQuarter;
        return upd;
      });
      const game = updated.find(s => s.id === sid);
      if (game) saveToDb(game);
      return updated;
    });
  };

  const doFlash = (r) => { setFlash(r); setTimeout(() => setFlash(null), 350); };

  const addPlayer = () => {
    if (!rNum.trim()) return;
    const n = rNum.trim();
    if (players.find(p => p.number === n)) return;
    setPlayers(prev => [...prev, { number: n, name: rName.trim() || ("#" + n) }]);
    setRName(""); setRNum("");
  };

  const startSession = async () => {
    const gameData = {
      team_name: teamName || "Game",
      players: [...players],
      shots: [],
      events: [],
      quarter: 0,
      created_at: new Date().toISOString(),
    };

    let saved;
    if (dbStatus === "ok") {
      saved = await createGame(gameData);
    }

    const s = saved || { id: genId(), ...gameData, teamName: gameData.team_name };

    const normalized = {
      id: s.id,
      teamName: s.team_name || s.teamName || gameData.team_name,
      players: s.players || gameData.players,
      shots: s.shots || [],
      events: s.events || [],
      quarter: s.quarter || 0,
      createdAt: s.created_at || s.createdAt || gameData.created_at,
    };

    setSessions(prev => [normalized, ...prev]);
    setCurId(normalized.id);
    setShots([]);
    setEvents([]);
    setQuarter(0);
    setActiveZone(null);
    setFtMode(false);
    setPending(null);
    setView("tracker");
  };

  const openSession = (s) => {
    setCurId(s.id);
    setShots([...(s.shots || [])]);
    setEvents([...(s.events || [])]);
    setPlayers([...(s.players || [])]);
    setTeamName(s.teamName || s.team_name || "");
    setQuarter(s.quarter || 0);
    setActiveZone(null);
    setFtMode(false);
    setPending(null);
    setView("tracker");
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (curId === id) { setCurId(null); setShots([]); setEvents([]); setPlayers([]); }
    if (dbStatus === "ok") await apiDeleteGame(id);
  };

  const shareGame = (id) => {
    const url = window.location.origin + "/game/" + id;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setShareMsg(id);
      setTimeout(() => setShareMsg(null), 2000);
    } else {
      prompt("Share this link:", url);
    }
  };

  const fieldGoals = shots.filter(s => !s.isFT);
  const freeThrows = shots.filter(s => s.isFT);
  const zoneStats = {};
  ZONES.forEach(z => {
    const zs = fieldGoals.filter(s => s.zone === z.id);
    zoneStats[z.id] = { makes: zs.filter(s => s.result === "make").length, total: zs.length };
  });
  const fgMakes = fieldGoals.filter(s => s.result === "make").length;
  const fgTotal = fieldGoals.length;
  const fgPct = fgTotal > 0 ? Math.round(fgMakes / fgTotal * 100) : 0;
  const ftMakes = freeThrows.filter(s => s.result === "make").length;
  const ftTotal = freeThrows.length;
  const ftPct = ftTotal > 0 ? Math.round(ftMakes / ftTotal * 100) : 0;

  const playerPts = {};
  const playerFouls = {};
  const playerTOs = {};
  const playerCounts = {};
  players.forEach(p => { playerPts[p.number] = 0; playerFouls[p.number] = 0; playerTOs[p.number] = 0; playerCounts[p.number] = 0; });
  shots.forEach(s => {
    if (s.playerNum) {
      playerPts[s.playerNum] = (playerPts[s.playerNum] || 0) + getPoints(s);
      playerCounts[s.playerNum] = (playerCounts[s.playerNum] || 0) + 1;
    }
  });
  events.forEach(e => {
    if (e.type === "foul") playerFouls[e.playerNum] = (playerFouls[e.playerNum] || 0) + 1;
    if (e.type === "turnover") playerTOs[e.playerNum] = (playerTOs[e.playerNum] || 0) + 1;
  });
  const sortedPlayers = [...players].sort((a, b) => parseInt(a.number) - parseInt(b.number));
  const teamFouls = events.filter(e => e.type === "foul").length;
  const teamTOs = events.filter(e => e.type === "turnover").length;
  const to60used = events.filter(e => e.type === "timeout" && e.duration === 60).length;
  const to30used = events.filter(e => e.type === "timeout" && e.duration === 30).length;
  const to60left = 3 - to60used;
  const to30left = 2 - to30used;
  const qtrFouls = events.filter(e => e.type === "foul" && e.quarter === quarter).length;
  const inBonus = qtrFouls >= 5;

  const handleZoneTap = useCallback((id) => {
    if (!ftMode && !pending) setActiveZone(id);
  }, [ftMode, pending]);

  const handleMakeMiss = (result) => {
    if (pending) return;
    if (ftMode) {
      if (players.length === 0) {
        const ns = [...shots, { result, id: Date.now(), isFT: true, quarter }];
        setShots(ns); syncAll(ns, undefined, undefined); doFlash(result);
      } else {
        setPending({ type: "shot", result, isFT: true });
      }
      return;
    }
    if (!activeZone) return;
    if (players.length === 0) {
      const ns = [...shots, { zone: activeZone, result, id: Date.now(), isFT: false, quarter }];
      setShots(ns); syncAll(ns, undefined, undefined); doFlash(result); setActiveZone(null);
    } else {
      setPending({ type: "shot", result, zone: activeZone, isFT: false });
    }
  };

  const handleFoul = () => {
    if (pending) return;
    if (players.length === 0) {
      const ne = [...events, { type: "foul", id: Date.now(), quarter }];
      setEvents(ne); syncAll(undefined, ne, undefined);
    } else {
      setPending({ type: "foul" });
    }
  };

  const handleTurnover = () => {
    if (pending) return;
    if (players.length === 0) {
      const ne = [...events, { type: "turnover", id: Date.now(), quarter }];
      setEvents(ne); syncAll(undefined, ne, undefined);
    } else {
      setPending({ type: "turnover" });
    }
  };

  const handleTimeout = (duration) => {
    const left = duration === 60 ? to60left : to30left;
    if (left <= 0) return;
    const ne = [...events, { type: "timeout", duration, id: Date.now(), quarter }];
    setEvents(ne); syncAll(undefined, ne, undefined);
    setShowTOPicker(false);
  };

  const pickPlayer = (num) => {
    if (!pending) return;
    if (pending.type === "shot") {
      const ns = [...shots, { result: pending.result, id: Date.now(), isFT: pending.isFT, zone: pending.zone, playerNum: num, quarter }];
      setShots(ns); syncAll(ns, undefined, undefined); doFlash(pending.result); setActiveZone(null);
    } else if (pending.type === "foul") {
      const ne = [...events, { type: "foul", playerNum: num, id: Date.now(), quarter }];
      setEvents(ne); syncAll(undefined, ne, undefined);
      const newCount = (playerFouls[num] || 0) + 1;
      if (newCount >= 4) {
        const p = players.find(x => x.number === num);
        setFoulWarning((p ? p.name : "#" + num) + " has " + newCount + " fouls!");
        setTimeout(() => setFoulWarning(null), 3500);
      }
    } else if (pending.type === "turnover") {
      const ne = [...events, { type: "turnover", playerNum: num, id: Date.now(), quarter }];
      setEvents(ne); syncAll(undefined, ne, undefined);
    }
    setPending(null);
  };

  const advanceQuarter = () => {
    const nq = (quarter + 1) % Q_LABELS.length;
    setQuarter(nq); syncAll(undefined, undefined, nq);
  };

  const backQuarter = () => {
    const nq = (quarter - 1 + Q_LABELS.length) % Q_LABELS.length;
    setQuarter(nq); syncAll(undefined, undefined, nq);
  };

  const undo = () => {
    const lastShot = shots.length > 0 ? shots[shots.length - 1] : null;
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;
    if (!lastShot && !lastEvent) return;
    const shotId = lastShot ? lastShot.id : 0;
    const eventId = lastEvent ? lastEvent.id : 0;
    if (shotId > eventId) {
      const ns = shots.slice(0, -1);
      setShots(ns); syncAll(ns, undefined, undefined);
    } else {
      const ne = events.slice(0, -1);
      setEvents(ne); syncAll(undefined, ne, undefined);
    }
    setActiveZone(null); setPending(null);
  };

  const getZoneColor = (id) => {
    const s = zoneStats[id]; if (!s || !s.total) return "rgba(255,255,255,0.04)";
    const p = s.makes / s.total;
    return p >= 0.5 ? "rgba(34,197,94,0.35)" : p >= 0.35 ? "rgba(250,204,21,0.3)" : "rgba(239,68,68,0.3)";
  };
  const getZoneBorder = (id) => {
    if (activeZone === id) return "rgba(255,255,255,0.9)";
    const s = zoneStats[id]; if (!s || !s.total) return "rgba(255,255,255,0.12)";
    const p = s.makes / s.total;
    return p >= 0.5 ? "rgba(34,197,94,0.7)" : p >= 0.35 ? "rgba(250,204,21,0.6)" : "rgba(239,68,68,0.6)";
  };

  const flashBorder = flash === "make" ? "2px solid #22c55e" : flash === "miss" ? "2px solid #ef4444" : "2px solid transparent";
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

  const StatusBadge = () => {
    if (dbStatus === "error") return (<span style={{ color: "#ef4444", fontSize: 9, marginLeft: 6 }}>⚠ offline</span>);
    if (saveOk === true) return (<span style={{ color: "#22c55e", fontSize: 10, marginLeft: 8 }}>✓ Saved</span>);
    if (saveOk === false) return (<span style={{ color: "#ef4444", fontSize: 10, marginLeft: 8 }}>✕ Save failed</span>);
    return null;
  };

  const pickerTitle = pending
    ? pending.type === "foul" ? "Who fouled?"
      : pending.type === "turnover" ? "Who turned it over?"
      : "Who took the shot?"
    : "";
  const pickerSubtext = pending
    ? pending.type === "shot"
      ? (pending.result === "make" ? "Make" : "Miss") + (pending.isFT ? " (FT)" : pending.zone ? " — " + (ZONES.find(z => z.id === pending.zone)?.label || "") : "")
      : pending.type === "foul" ? "Personal Foul" : "Turnover"
    : "";
  const pickerColor = pending
    ? pending.type === "foul" ? "#f97316"
      : pending.type === "turnover" ? "#a855f7"
      : pending.result === "make" ? "#22c55e" : "#ef4444"
    : "#fff";

  if (view === "loading") {
    return (
      <div style={{ ...SHELL, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#555", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }
  // ═══ ROSTER ═══
  if (view === "roster") {
    return (
      <div style={SHELL}>
        <div style={{ padding: "20px 16px 8px" }}>
          <button onClick={() => setView("history")} style={LINK}>← Back</button>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>New Session</div>
          <div style={SUBHEAD}>Add your roster</div>
        </div>
        <div style={{ padding: "0 16px", marginBottom: 16 }}>
          <label style={LABEL}>Team / Game Name</label>
          <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Varsity vs Lincoln" style={INP} />
        </div>
        <div style={{ padding: "0 16px", marginBottom: 16 }}>
          <label style={LABEL}>Add Player</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={rNum} onChange={e => setRNum(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="#" style={{ ...INP, width: 56, textAlign: "center", fontSize: 18, fontWeight: 800 }} inputMode="numeric" />
            <input value={rName} onChange={e => setRName(e.target.value)} placeholder="Name (optional)" style={{ ...INP, flex: 1 }} onKeyDown={e => e.key === "Enter" && addPlayer()} />
            <button onClick={addPlayer} style={{ ...ACCENT, padding: "0 16px", fontSize: 20, fontWeight: 800, borderRadius: 10 }}>+</button>
          </div>
        </div>
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {players.length === 0 && (
            <div style={{ color: "#444", fontSize: 13, padding: "16px 0", textAlign: "center" }}>No players yet — add jersey numbers above</div>
          )}
          {players.map(p => (
            <div key={p.number} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ ...JERSEY, width: 40, height: 40, fontSize: 18 }}>{p.number}</div>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{p.name}</div>
              <button onClick={() => setPlayers(x => x.filter(q => q.number !== p.number))} style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ padding: "0 16px" }}>
          <button onClick={startSession} style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", fontSize: 16, fontWeight: 800, cursor: "pointer", background: "#facc15", color: "#000" }}>
            Start Tracking →
          </button>
          <div style={{ textAlign: "center", fontSize: 11, color: "#555", marginTop: 8 }}>
            {players.length === 0 ? "Track without players (team-level)" : players.length + " player" + (players.length !== 1 ? "s" : "")}
          </div>
        </div>
      </div>
    );
  }

  // ═══ HISTORY ═══
  if (view === "history") {
    return (
      <div style={SHELL}>
        <div style={{ padding: "20px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Shot Chart</div>
            <div style={SUBHEAD}>Saved Sessions</div>
          </div>
          <button onClick={() => { setPlayers([...DEFAULT_ROSTER]); setTeamName(""); setRName(""); setRNum(""); setView("roster"); }} style={ACCENT}>+ New Game</button>
        </div>
        {dbStatus === "error" && (
          <div style={{ margin: "0 16px 8px", padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 11, color: "#ef4444" }}>
            ⚠ Database unavailable — using local storage only
          </div>
        )}
        {dbStatus === "ok" && (
          <div style={{ margin: "0 16px 8px", padding: "8px 12px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, fontSize: 11, color: "#22c55e" }}>
            ✓ Connected — games auto-save & are shareable
          </div>
        )}
        {sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏀</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No sessions yet</div>
          </div>
        ) : (
          <div style={{ padding: "4px 16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Season Stats Toggle */}
            {(() => {
              const allShots = sessions.flatMap(s => s.shots || []);
              const allEvents = sessions.flatMap(s => s.events || []);
              const numGames = sessions.length;
              if (allShots.length === 0 && allEvents.length === 0) return null;

              const yFG = allShots.filter(s => !s.isFT);
              const yFT = allShots.filter(s => s.isFT);
              const yFGm = yFG.filter(s => s.result === "make").length;
              const yFTm = yFT.filter(s => s.result === "make").length;
              const yFGp = yFG.length > 0 ? Math.round(yFGm / yFG.length * 100) : 0;
              const yFTp = yFT.length > 0 ? Math.round(yFTm / yFT.length * 100) : 0;
              const yPts = allShots.reduce((sum, s) => sum + getPoints(s), 0);
              const yFouls = allEvents.filter(e => e.type === "foul").length;
              const yTOs = allEvents.filter(e => e.type === "turnover").length;
              const y3 = yFG.filter(s => THREE_PT.has(s.zone));
              const y3m = y3.filter(s => s.result === "make").length;
              const y3p = y3.length > 0 ? Math.round(y3m / y3.length * 100) : 0;
              const y2 = yFG.filter(s => !THREE_PT.has(s.zone));
              const y2m = y2.filter(s => s.result === "make").length;
              const y2p = y2.length > 0 ? Math.round(y2m / y2.length * 100) : 0;

              const pMap = {};
              sessions.forEach(s => {
                (s.players || []).forEach(p => {
                  if (!pMap[p.number]) pMap[p.number] = { number: p.number, name: p.name, games: 0, pts: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, p3m: 0, p3a: 0, fouls: 0, tos: 0 };
                });
                const hasPlayer = (s.players || []).length > 0;
                if (hasPlayer) {
                  (s.players || []).forEach(p => { pMap[p.number].games++; });
                  (s.shots || []).forEach(sh => {
                    if (!sh.playerNum || !pMap[sh.playerNum]) return;
                    const pp = pMap[sh.playerNum];
                    pp.pts += getPoints(sh);
                    if (sh.isFT) { pp.fta++; if (sh.result === "make") pp.ftm++; }
                    else { pp.fga++; if (sh.result === "make") pp.fgm++; if (THREE_PT.has(sh.zone)) { pp.p3a++; if (sh.result === "make") pp.p3m++; } }
                  });
                  (s.events || []).forEach(ev => {
                    if (!ev.playerNum || !pMap[ev.playerNum]) return;
                    if (ev.type === "foul") pMap[ev.playerNum].fouls++;
                    if (ev.type === "turnover") pMap[ev.playerNum].tos++;
                  });
                }
              });
              const pList = Object.values(pMap).sort((a, b) => parseInt(a.number) - parseInt(b.number));

              const yZone = {};
              ZONES.forEach(z => {
                const zs = yFG.filter(s => s.zone === z.id);
                yZone[z.id] = { makes: zs.filter(s => s.result === "make").length, total: zs.length };
              });

              return (
                <>
                  <button onClick={() => setShowYearStats(p => !p)} style={{ background: showYearStats ? "rgba(250,204,21,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid " + (showYearStats ? "rgba(250,204,21,0.25)" : "rgba(255,255,255,0.08)"), color: showYearStats ? "#facc15" : "#888", fontSize: 12, fontWeight: 700, padding: "10px 16px", borderRadius: 10, cursor: "pointer", textAlign: "center" }}>
                    {showYearStats ? "▾ Hide Season Stats" : "▸ Season Stats — " + numGames + " Game" + (numGames !== 1 ? "s" : "") + " · " + yPts + " Total Pts"}
                  </button>

                  {showYearStats && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 4 }}>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
                        <div style={SECHEAD}>Season Team Totals</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                          <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 900, color: "#facc15" }}>{yPts}</div><div style={{ fontSize: 8, color: "#666" }}>TOTAL PTS</div></div>
                          <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#facc15" }}>{numGames > 0 ? (yPts / numGames).toFixed(1) : "—"}</div><div style={{ fontSize: 8, color: "#666" }}>PPG</div></div>
                          <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#f97316" }}>{yFouls}</div><div style={{ fontSize: 8, color: "#666" }}>FOULS</div></div>
                          <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#a855f7" }}>{yTOs}</div><div style={{ fontSize: 8, color: "#666" }}>TURNOVERS</div></div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                          <div style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 800, color: yFGp >= 50 ? "#22c55e" : yFGp >= 35 ? "#facc15" : yFG.length ? "#ef4444" : "#555" }}>{yFG.length ? yFGp + "%" : "—"}</div><div style={{ fontSize: 8, color: "#666" }}>FG {yFGm}/{yFG.length}</div></div>
                          <div style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 800, color: y3p >= 35 ? "#22c55e" : y3p >= 25 ? "#facc15" : y3.length ? "#ef4444" : "#555" }}>{y3.length ? y3p + "%" : "—"}</div><div style={{ fontSize: 8, color: "#666" }}>3PT {y3m}/{y3.length}</div></div>
                          <div style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 800, color: yFTp >= 70 ? "#818cf8" : yFTp >= 50 ? "#facc15" : yFT.length ? "#ef4444" : "#555" }}>{yFT.length ? yFTp + "%" : "—"}</div><div style={{ fontSize: 8, color: "#666" }}>FT {yFTm}/{yFT.length}</div></div>
                        </div>
                        <div style={{ marginTop: 8, textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "6px 4px" }}>
                          <span style={{ fontSize: 12, color: "#888" }}>2PT: </span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: y2p >= 50 ? "#22c55e" : y2p >= 35 ? "#facc15" : y2.length ? "#ef4444" : "#555" }}>{y2.length ? y2p + "%" : "—"}</span>
                          <span style={{ fontSize: 10, color: "#666" }}> ({y2m}/{y2.length})</span>
                        </div>
                      </div>

                      {pList.length > 0 && (
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
                          <div style={SECHEAD}>Player Season Stats</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                            {pList.map(p => {
                              const fgp = p.fga > 0 ? Math.round(p.fgm / p.fga * 100) : 0;
                              const ftp = p.fta > 0 ? Math.round(p.ftm / p.fta * 100) : 0;
                              const p3p = p.p3a > 0 ? Math.round(p.p3m / p.p3a * 100) : 0;
                              const ppg = p.games > 0 ? (p.pts / p.games).toFixed(1) : "0";
                              return (
                                <div key={p.number} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ ...JERSEY, width: 34, height: 34, fontSize: 14, flexShrink: 0 }}>{p.number}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#ccc" }}>{p.name}</div>
                                    <div style={{ fontSize: 9, color: "#666", marginTop: 1 }}>
                                      {p.games + "G · FG " + p.fgm + "/" + p.fga + (p.fga > 0 ? " (" + fgp + "%)" : "")}
                                      {p.p3a > 0 ? " · 3PT " + p.p3m + "/" + p.p3a + " (" + p3p + "%)" : ""}
                                      {p.fta > 0 ? " · FT " + p.ftm + "/" + p.fta + " (" + ftp + "%)" : ""}
                                    </div>
                                    {(p.fouls > 0 || p.tos > 0) && (
                                      <div style={{ fontSize: 9, color: "#666", marginTop: 1 }}>
                                        {p.fouls > 0 ? p.fouls + " fouls" : ""}{p.fouls > 0 && p.tos > 0 ? " · " : ""}{p.tos > 0 ? p.tos + " TO" : ""}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: "#facc15" }}>{p.pts}</div>
                                    <div style={{ fontSize: 8, color: "#666" }}>{ppg} PPG</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {yFG.length > 0 && (
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
                          <div style={SECHEAD}>Season Zone Breakdown</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {ZONES.filter(z => yZone[z.id].total > 0).map(z => {
                              const s = yZone[z.id]; const p = Math.round(s.makes / s.total * 100);
                              return (
                                <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 80, fontSize: 12, color: "#888", flexShrink: 0 }}>{z.label}</div>
                                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: p + "%", borderRadius: 4, background: p >= 50 ? "#22c55e" : p >= 35 ? "#facc15" : "#ef4444" }} />
                                  </div>
                                  <div style={{ width: 60, textAlign: "right", fontSize: 12, color: "#ccc", fontWeight: 700 }}>
                                    {s.makes}/{s.total} <span style={{ color: "#666", fontWeight: 400 }}>({p}%)</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Game list */}
            {sessions.map(s => {
              const all = s.shots || []; const ev = s.events || [];
              const sFG = all.filter(x => !x.isFT); const sFT = all.filter(x => x.isFT);
              const sFGm = sFG.filter(x => x.result === "make").length; const sFGt = sFG.length;
              const sFGp = sFGt ? Math.round(sFGm / sFGt * 100) : 0;
              const sFTm = sFT.filter(x => x.result === "make").length; const sFTt = sFT.length;
              const sFTp = sFTt ? Math.round(sFTm / sFTt * 100) : 0;
              const sPts = all.reduce((sum, x) => sum + getPoints(x), 0);
              const sFouls = ev.filter(x => x.type === "foul").length;
              const sTOs = ev.filter(x => x.type === "turnover").length;
              return (
                <div key={s.id} onClick={() => openSession(s)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{s.teamName || s.team_name || "Unnamed"}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{fmtDate(s.created_at || s.createdAt)}</div>
                      {(s.players || []).length > 0 && <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{s.players.length} players</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#facc15" }}>{sPts}</div>
                        <div style={{ fontSize: 8, color: "#666", letterSpacing: 1 }}>PTS</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: sFGp >= 50 ? "#22c55e" : sFGp >= 35 ? "#facc15" : sFGt ? "#ef4444" : "#555" }}>{sFGt ? sFGp + "%" : "—"}</div>
                        <div style={{ fontSize: 9, color: "#666" }}>FG {sFGm}/{sFGt}</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); shareGame(s.id); }} style={{ background: "none", border: "none", color: shareMsg === s.id ? "#22c55e" : "#facc15", fontSize: 13, cursor: "pointer", padding: "4px" }}>
                        {shareMsg === s.id ? "✓" : "🔗"}
                      </button>
                      <button onClick={e => deleteSession(s.id, e)} style={{ background: "none", border: "none", color: "#555", fontSize: 18, cursor: "pointer", padding: "4px 2px" }}>×</button>
                    </div>
                  </div>
                  {(sFouls > 0 || sTOs > 0 || sFTt > 0) && (
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: "#666" }}>
                      {sFTt > 0 && <span>FT {sFTm}/{sFTt} ({sFTp}%)</span>}
                      {sFouls > 0 && <span style={{ color: "#f97316" }}>{sFouls} fouls</span>}
                      {sTOs > 0 && <span style={{ color: "#a855f7" }}>{sTOs} TO</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  // ═══ TRACKER ═══
  const canRecord = ftMode || activeZone;
  const totalPts = shots.reduce((sum, s) => sum + getPoints(s), 0);

  return (
    <div style={SHELL}>
      {/* Player Picker Overlay */}
      {pending && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>{pickerSubtext}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: pickerColor }}>{pickerTitle}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%", maxWidth: 360, marginBottom: 20 }}>
            {sortedPlayers.map(p => {
              const fouls = playerFouls[p.number] || 0;
              const foulWarn = fouls >= 4 ? "#ef4444" : fouls >= 3 ? "#f97316" : null;
              return (
                <button key={p.number} onClick={() => pickPlayer(p.number)} style={{ background: "rgba(255,255,255,0.08)", border: "2px solid " + (foulWarn || "rgba(255,255,255,0.15)"), borderRadius: 14, padding: "12px 8px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, position: "relative" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{p.number}</div>
                  <div style={{ fontSize: 9, color: "#aaa", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{p.name}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    {(playerPts[p.number] || 0) > 0 && <span style={{ fontSize: 9, color: "#666" }}>{playerPts[p.number]}p</span>}
                    {fouls > 0 && <span style={{ fontSize: 9, color: foulWarn || "#f97316" }}>{fouls}f</span>}
                    {(playerTOs[p.number] || 0) > 0 && <span style={{ fontSize: 9, color: "#a855f7" }}>{playerTOs[p.number]}to</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={() => setPending(null)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "#888", padding: "10px 28px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancel</button>
        </div>
      )}

      {/* Timeout Picker Overlay */}
      {showTOPicker && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, color: "#fff" }}>Call Timeout</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 280 }}>
            <button onClick={() => handleTimeout(60)} disabled={to60left <= 0} style={{ padding: "18px 0", borderRadius: 14, border: to60left > 0 ? "2px solid rgba(255,255,255,0.2)" : "2px solid rgba(255,255,255,0.06)", background: to60left > 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)", cursor: to60left > 0 ? "pointer" : "default", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: to60left > 0 ? "#fff" : "#333" }}>60 sec</div>
              <div style={{ fontSize: 12, color: to60left > 0 ? "#888" : "#333", marginTop: 4 }}>{to60left} remaining</div>
            </button>
            <button onClick={() => handleTimeout(30)} disabled={to30left <= 0} style={{ padding: "18px 0", borderRadius: 14, border: to30left > 0 ? "2px solid rgba(255,255,255,0.2)" : "2px solid rgba(255,255,255,0.06)", background: to30left > 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)", cursor: to30left > 0 ? "pointer" : "default", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: to30left > 0 ? "#fff" : "#333" }}>30 sec</div>
              <div style={{ fontSize: 12, color: to30left > 0 ? "#888" : "#333", marginTop: 4 }}>{to30left} remaining</div>
            </button>
          </div>
          <button onClick={() => setShowTOPicker(false)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "#888", padding: "10px 28px", borderRadius: 8, cursor: "pointer", fontSize: 13, marginTop: 20 }}>Cancel</button>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "12px 16px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button onClick={() => setView("history")} style={LINK}>← All Sessions</button>
            <StatusBadge />
          </div>
          {editName ? (
            <input autoFocus value={teamName} onChange={e => { setTeamName(e.target.value); setSessions(p => p.map(s => s.id === curId ? { ...s, teamName: e.target.value, team_name: e.target.value } : s)); }} onBlur={() => { setEditName(false); const g = sessions.find(s => s.id === curId); if (g) saveToDb(g); }} onKeyDown={e => e.key === "Enter" && setEditName(false)} placeholder="Team name" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 16, fontWeight: 700, padding: "4px 10px", borderRadius: 6, outline: "none", width: 180, marginTop: 4, display: "block" }} />
          ) : (
            <div onClick={() => setEditName(true)} style={{ fontSize: 16, fontWeight: 700, color: teamName ? "#fff" : "#555", cursor: "pointer", marginTop: 2 }}>
              {teamName || "Tap to set name"}<span style={{ fontSize: 11, color: "#444", marginLeft: 6 }}>✎</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={backQuarter} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#888", fontSize: 11, fontWeight: 700, padding: "6px 6px", borderRadius: 6, cursor: "pointer" }}>◂</button>
          <button onClick={advanceQuarter} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#facc15", fontSize: 13, fontWeight: 800, padding: "6px 12px", borderRadius: 8, cursor: "pointer", minWidth: 42, textAlign: "center" }}>{Q_LABELS[quarter]}</button>
          <button onClick={undo} style={BTN}>Undo</button>
        </div>
      </div>

      {/* Foul Warning Banner */}
      {foulWarning && (
        <div style={{ margin: "0 16px 4px", padding: "8px 12px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#ef4444", textAlign: "center" }}>
          ⚠ {foulWarning}
        </div>
      )}

      {/* Bonus Banner */}
      {inBonus && (
        <div style={{ margin: "0 16px 4px", padding: "6px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#ef4444", textAlign: "center" }}>
          BONUS — {qtrFouls} team fouls in {Q_LABELS[quarter]}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "6px 16px", flexWrap: "wrap", alignItems: "center" }}>
        <StatBox label="PTS" value={totalPts} color="#facc15" />
        <StatBox label="FG" value={fgMakes + "/" + fgTotal} color="#22c55e" />
        <StatBox label="FG%" value={"" + fgPct} color={fgPct >= 50 ? "#22c55e" : fgPct >= 35 ? "#facc15" : "#ef4444"} />
        <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "4px 0", alignSelf: "stretch" }} />
        <StatBox label="FT" value={ftMakes + "/" + ftTotal} color="#818cf8" />
        <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "4px 0", alignSelf: "stretch" }} />
        <StatBox label={"FOULS (" + Q_LABELS[quarter] + ")"} value={qtrFouls} color={inBonus ? "#ef4444" : "#f97316"} />
        <StatBox label="TO" value={teamTOs} color="#a855f7" />
      </div>

      {/* Court */}
      <div style={{ padding: "4px 10px", transition: "border-color 0.2s", border: ftMode ? "2px solid rgba(129,140,248,0.3)" : flashBorder, borderRadius: 16, margin: "0 8px", opacity: ftMode ? 0.4 : 1, pointerEvents: ftMode ? "none" : "auto" }}>
        <svg viewBox="0 0 400 420" style={{ width: "100%", height: "auto", display: "block" }}>
          <rect x="0" y="0" width="400" height="400" rx="8" fill="#1a1206" stroke="rgba(255,180,50,0.15)" strokeWidth="1" />
          <line x1="0" y1="400" x2="400" y2="400" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="0" y2="400" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
          <line x1="400" y1="0" x2="400" y2="400" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="400" y2="0" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
          <rect x="130" y="280" width="140" height="120" fill="none" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
          <circle cx="200" cy="280" r="60" fill="none" stroke="rgba(255,180,50,0.2)" strokeWidth="1" strokeDasharray="4,4" />
          <circle cx="200" cy="380" r="8" fill="none" stroke="rgba(255,180,50,0.5)" strokeWidth="1.5" />
          <line x1="185" y1="396" x2="215" y2="396" stroke="rgba(255,180,50,0.35)" strokeWidth="1.5" />
          <path d="M 40,400 L 40,300 Q 40,80 200,60 Q 360,80 360,300 L 360,400" fill="none" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
          {ZONES.map(z => {
            const s = zoneStats[z.id]; const pct = s && s.total ? Math.round(s.makes / s.total * 100) : null; const isActive = activeZone === z.id;
            return (
              <g key={z.id} onClick={() => handleZoneTap(z.id)} style={{ cursor: "pointer" }}>
                <path d={z.path} fill={isActive ? "rgba(255,255,255,0.15)" : getZoneColor(z.id)} stroke={getZoneBorder(z.id)} strokeWidth={isActive ? 2 : 1} style={{ transition: "fill 0.2s, stroke 0.2s" }} />
                {s && s.total > 0 ? (
                  <>
                    <text x={z.cx} y={z.cy - 4} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800" style={{ pointerEvents: "none" }}>{s.makes}/{s.total}</text>
                    <text x={z.cx} y={z.cy + 12} textAnchor="middle" fill={pct >= 50 ? "#22c55e" : pct >= 35 ? "#facc15" : "#ef4444"} fontSize="11" fontWeight="600" style={{ pointerEvents: "none" }}>{pct}%</text>
                  </>
                ) : (
                  <text x={z.cx} y={z.cy + 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="10" style={{ pointerEvents: "none" }}>{z.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {ftMode && (
        <div style={{ textAlign: "center", padding: "4px 16px 0" }}>
          <span style={{ color: "#818cf8", fontSize: 12, fontWeight: 600 }}>Free Throw mode</span>
        </div>
      )}
      {!ftMode && activeZone && (
        <div style={{ textAlign: "center", padding: "0 16px 6px" }}>
          <span style={{ color: "#facc15", fontSize: 12, fontWeight: 600 }}>{ZONES.find(z => z.id === activeZone)?.label}</span>
          <span style={{ color: "#444", fontSize: 12 }}> — tap Make or Miss</span>
        </div>
      )}

      {/* Action row */}
      <div style={{ padding: "8px 16px 0", display: "flex", justifyContent: "center", gap: 8 }}>
        <button onClick={() => { setFtMode(p => !p); setActiveZone(null); setPending(null); }} style={{ background: ftMode ? "#818cf8" : "rgba(129,140,248,0.12)", border: ftMode ? "none" : "1px solid rgba(129,140,248,0.3)", color: ftMode ? "#000" : "#818cf8", fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 8, cursor: "pointer", transition: "all 0.2s" }}>
          {ftMode ? "🏀 FT MODE ON" : "Free Throw"}
        </button>
        <button onClick={handleFoul} disabled={!!pending} style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", color: pending ? "rgba(249,115,22,0.3)" : "#f97316", fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, cursor: pending ? "default" : "pointer" }}>
          Foul
        </button>
        <button onClick={handleTurnover} disabled={!!pending} style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: pending ? "rgba(168,85,247,0.3)" : "#a855f7", fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, cursor: pending ? "default" : "pointer" }}>
          TO
        </button>
        <button onClick={() => setShowTOPicker(true)} disabled={!!pending || (to60left <= 0 && to30left <= 0)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: pending || (to60left <= 0 && to30left <= 0) ? "rgba(255,255,255,0.2)" : "#ccc", fontSize: 11, fontWeight: 700, padding: "7px 10px", borderRadius: 8, cursor: pending ? "default" : "pointer" }}>
          ⏱ {to60left + to30left}
        </button>
      </div>

      {/* Make / Miss */}
      <div style={{ padding: "8px 16px", display: "flex", gap: 12 }}>
        <button onClick={() => handleMakeMiss("make")} disabled={!canRecord || !!pending} style={{ flex: 1, padding: "14px 0", borderRadius: 14, border: "none", fontSize: 18, fontWeight: 800, letterSpacing: 2, cursor: canRecord && !pending ? "pointer" : "default", background: canRecord && !pending ? (ftMode ? "#818cf8" : "#22c55e") : (ftMode ? "rgba(129,140,248,0.15)" : "rgba(34,197,94,0.15)"), color: canRecord && !pending ? "#000" : (ftMode ? "rgba(129,140,248,0.4)" : "rgba(34,197,94,0.4)"), transition: "all 0.2s" }}>
          MAKE
        </button>
        <button onClick={() => handleMakeMiss("miss")} disabled={!canRecord || !!pending} style={{ flex: 1, padding: "14px 0", borderRadius: 14, border: "none", fontSize: 18, fontWeight: 800, letterSpacing: 2, cursor: canRecord && !pending ? "pointer" : "default", background: canRecord && !pending ? "#ef4444" : "rgba(239,68,68,0.15)", color: canRecord && !pending ? "#fff" : "rgba(239,68,68,0.4)", transition: "all 0.2s" }}>
          MISS
        </button>
      </div>

      {!ftMode && !activeZone && !pending && (
        <div style={{ textAlign: "center", padding: "2px 16px 8px", color: "#444", fontSize: 12 }}>Tap a zone, then Make or Miss. Use Foul / TO for other events.</div>
      )}

      {/* Stats Toggle */}
      <div style={{ padding: "4px 16px 8px", textAlign: "center" }}>
        <button onClick={() => setShowStats(p => !p)} style={{ background: showStats ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.06)", border: "1px solid " + (showStats ? "rgba(250,204,21,0.3)" : "rgba(255,255,255,0.12)"), color: showStats ? "#facc15" : "#888", fontSize: 12, fontWeight: 700, padding: "8px 24px", borderRadius: 8, cursor: "pointer", width: "100%" }}>
          {showStats ? "▾ Hide Stats" : "▸ Full Stats & Breakdown"}
        </button>
      </div>

      {/* Expanded Stats */}
      {showStats && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={SECHEAD}>Team Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 900, color: "#facc15" }}>{totalPts}</div><div style={{ fontSize: 9, color: "#666" }}>TOTAL PTS</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800, color: fgPct >= 50 ? "#22c55e" : fgPct >= 35 ? "#facc15" : fgTotal ? "#ef4444" : "#555" }}>{fgTotal ? fgPct + "%" : "—"}</div><div style={{ fontSize: 9, color: "#666" }}>FG {fgMakes}/{fgTotal}</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800, color: ftPct >= 70 ? "#818cf8" : ftPct >= 50 ? "#facc15" : ftTotal ? "#ef4444" : "#555" }}>{ftTotal ? ftPct + "%" : "—"}</div><div style={{ fontSize: 9, color: "#666" }}>FT {ftMakes}/{ftTotal}</div></div>
            </div>
            <PBar label="FG" pct={fgPct} color={fgPct >= 50 ? "#22c55e" : fgPct >= 35 ? "#facc15" : "#ef4444"} />
            <PBar label="FT" pct={ftPct} color={ftPct >= 70 ? "#818cf8" : ftPct >= 50 ? "#facc15" : "#ef4444"} mb />
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 6 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#f97316" }}>{teamFouls}</div><div style={{ fontSize: 8, color: "#666" }}>TOTAL FOULS</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: inBonus ? "#ef4444" : "#f97316" }}>{qtrFouls}</div><div style={{ fontSize: 8, color: inBonus ? "#ef4444" : "#666" }}>{Q_LABELS[quarter]} FOULS {inBonus ? "(BONUS)" : ""}</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#a855f7" }}>{teamTOs}</div><div style={{ fontSize: 8, color: "#666" }}>TURNOVERS</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#ccc" }}>{to60left + to30left}</div><div style={{ fontSize: 8, color: "#666" }}>TIMEOUTS</div></div>
            </div>
          </div>

          {players.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={SECHEAD}>Player Breakdown</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {sortedPlayers.map(p => {
                  const pS = shots.filter(s => s.playerNum === p.number);
                  const pFG = pS.filter(s => !s.isFT); const pFT = pS.filter(s => s.isFT);
                  const pFGm = pFG.filter(s => s.result === "make").length;
                  const pFTm = pFT.filter(s => s.result === "make").length;
                  const pFGp = pFG.length > 0 ? Math.round(pFGm / pFG.length * 100) : 0;
                  const p3 = pFG.filter(s => THREE_PT.has(s.zone));
                  const p3m = p3.filter(s => s.result === "make").length;
                  const fouls = playerFouls[p.number] || 0;
                  const tos = playerTOs[p.number] || 0;
                  const pts = playerPts[p.number] || 0;
                  const foulColor = fouls >= 4 ? "#ef4444" : fouls >= 3 ? "#f97316" : "#666";
                  const hasActivity = pts > 0 || fouls > 0 || tos > 0 || pFG.length > 0 || pFT.length > 0;
                  return (
                    <div key={p.number} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ ...JERSEY, width: 34, height: 34, fontSize: 14, flexShrink: 0 }}>{p.number}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#ccc" }}>{p.name}</div>
                        {hasActivity ? (
                          <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                            {"FG " + pFGm + "/" + pFG.length + (pFG.length > 0 ? " (" + pFGp + "%)" : "")}
                            {p3.length > 0 ? " · 3PT " + p3m + "/" + p3.length : ""}
                            {pFT.length > 0 ? " · FT " + pFTm + "/" + pFT.length : ""}
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>No activity</div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {fouls > 0 && (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: foulColor }}>{fouls}</div>
                            <div style={{ fontSize: 7, color: foulColor, letterSpacing: 0.5 }}>{fouls >= 4 ? "⚠ FOUL" : "FOUL"}</div>
                          </div>
                        )}
                        {tos > 0 && (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#a855f7" }}>{tos}</div>
                            <div style={{ fontSize: 7, color: "#a855f7", letterSpacing: 0.5 }}>TO</div>
                          </div>
                        )}
                        <div style={{ textAlign: "right", minWidth: 36 }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: "#facc15" }}>{pts}</div>
                          <div style={{ fontSize: 7, color: "#666", letterSpacing: 0.5 }}>PTS</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(fgTotal > 0 || ftTotal > 0) && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
              <div style={SECHEAD}>Zone Breakdown</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {ZONES.filter(z => zoneStats[z.id].total > 0).map(z => {
                  const s = zoneStats[z.id]; const p = Math.round(s.makes / s.total * 100);
                  return (
                    <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 80, fontSize: 12, color: "#888", flexShrink: 0 }}>{z.label}</div>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: p + "%", borderRadius: 4, background: p >= 50 ? "#22c55e" : p >= 35 ? "#facc15" : "#ef4444", transition: "width 0.3s" }} />
                      </div>
                      <div style={{ width: 60, textAlign: "right", fontSize: 12, color: "#ccc", fontWeight: 700 }}>
                        {s.makes}/{s.total} <span style={{ color: "#666", fontWeight: 400 }}>({p}%)</span>
                      </div>
                    </div>
                  );
                })}
                {ftTotal > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ width: 80, fontSize: 12, color: "#818cf8", flexShrink: 0, fontWeight: 600 }}>Free Throws</div>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: ftPct + "%", borderRadius: 4, background: "#818cf8", transition: "width 0.3s" }} />
                    </div>
                    <div style={{ width: 60, textAlign: "right", fontSize: 12, color: "#ccc", fontWeight: 700 }}>
                      {ftMakes}/{ftTotal} <span style={{ color: "#666", fontWeight: 400 }}>({ftPct}%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
