import { useState, useEffect } from "react";
import { fetchGame } from "./api.js";

const THREE_PT = new Set(["left-wing3", "right-wing3", "left-corner3", "right-corner3", "top3"]);
const Q_LABELS = ["Q1", "Q2", "Q3", "Q4", "OT", "OT2"];

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

function getPoints(s) {
  if (s.result !== "make") return 0;
  if (s.isFT) return 1;
  return THREE_PT.has(s.zone) ? 3 : 2;
}

const SHELL = { minHeight: "100vh", background: "#0a0a0a", fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif", color: "#fff", maxWidth: 440, margin: "0 auto" };
const SECHEAD = { fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" };
const JERSEY = { borderRadius: 8, background: "rgba(250,204,21,0.15)", border: "1px solid rgba(250,204,21,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#facc15" };

export default function SharedView({ gameId }) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const g = await fetchGame(gameId);
      if (g) {
        setGame(g);
      } else {
        setError("Game not found");
      }
      setLoading(false);
    })();
  }, [gameId]);

  if (loading) {
    return (
      <div style={{ ...SHELL, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#555", fontSize: 14 }}>Loading game...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div style={{ ...SHELL, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 40 }}>🏀</div>
        <div style={{ color: "#888", fontSize: 16, fontWeight: 600 }}>{error || "Game not found"}</div>
        <a href="/" style={{ color: "#facc15", fontSize: 13, fontWeight: 600 }}>← Back to Shot Chart</a>
      </div>
    );
  }

  const shots = game.shots || [];
  const events = game.events || [];
  const players = game.players || [];
  const teamName = game.team_name || game.teamName || "Game";

  const fieldGoals = shots.filter(s => !s.isFT);
  const freeThrows = shots.filter(s => s.isFT);
  const fgMakes = fieldGoals.filter(s => s.result === "make").length;
  const fgTotal = fieldGoals.length;
  const fgPct = fgTotal > 0 ? Math.round(fgMakes / fgTotal * 100) : 0;
  const ftMakes = freeThrows.filter(s => s.result === "make").length;
  const ftTotal = freeThrows.length;
  const ftPct = ftTotal > 0 ? Math.round(ftMakes / ftTotal * 100) : 0;
  const totalPts = shots.reduce((sum, s) => sum + getPoints(s), 0);
  const teamFouls = events.filter(e => e.type === "foul").length;
  const teamTOs = events.filter(e => e.type === "turnover").length;

  const y3 = fieldGoals.filter(s => THREE_PT.has(s.zone));
  const y3m = y3.filter(s => s.result === "make").length;
  const y3p = y3.length > 0 ? Math.round(y3m / y3.length * 100) : 0;

  const zoneStats = {};
  ZONES.forEach(z => {
    const zs = fieldGoals.filter(s => s.zone === z.id);
    zoneStats[z.id] = { makes: zs.filter(s => s.result === "make").length, total: zs.length };
  });

  const playerPts = {};
  const playerFouls = {};
  const playerTOs = {};
  players.forEach(p => { playerPts[p.number] = 0; playerFouls[p.number] = 0; playerTOs[p.number] = 0; });
  shots.forEach(s => { if (s.playerNum) playerPts[s.playerNum] = (playerPts[s.playerNum] || 0) + getPoints(s); });
  events.forEach(e => {
    if (e.type === "foul" && e.playerNum) playerFouls[e.playerNum] = (playerFouls[e.playerNum] || 0) + 1;
    if (e.type === "turnover" && e.playerNum) playerTOs[e.playerNum] = (playerTOs[e.playerNum] || 0) + 1;
  });
  const sortedPlayers = [...players].sort((a, b) => parseInt(a.number) - parseInt(b.number));

  const getZoneColor = (id) => {
    const s = zoneStats[id]; if (!s || !s.total) return "rgba(255,255,255,0.04)";
    const p = s.makes / s.total;
    return p >= 0.5 ? "rgba(34,197,94,0.35)" : p >= 0.35 ? "rgba(250,204,21,0.3)" : "rgba(239,68,68,0.3)";
  };
  const getZoneBorder = (id) => {
    const s = zoneStats[id]; if (!s || !s.total) return "rgba(255,255,255,0.12)";
    const p = s.makes / s.total;
    return p >= 0.5 ? "rgba(34,197,94,0.7)" : p >= 0.35 ? "rgba(250,204,21,0.6)" : "rgba(239,68,68,0.6)";
  };

  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch(e) { return ""; } };

  return (
    <div style={SHELL}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Game Stats</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{teamName}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{fmtDate(game.created_at || game.createdAt)}</div>
      </div>

      <div style={{ textAlign: "center", padding: "16px 0 12px" }}>
        <div style={{ fontSize: 56, fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{totalPts}</div>
        <div style={{ fontSize: 11, color: "#666", letterSpacing: 2, marginTop: 4 }}>TOTAL POINTS</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, padding: "0 16px 16px" }}>
        <div style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 4px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: fgPct >= 50 ? "#22c55e" : fgPct >= 35 ? "#facc15" : fgTotal ? "#ef4444" : "#555" }}>{fgTotal ? fgPct + "%" : "—"}</div>
          <div style={{ fontSize: 8, color: "#666" }}>FG {fgMakes}/{fgTotal}</div>
        </div>
        <div style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 4px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: y3p >= 35 ? "#22c55e" : y3p >= 25 ? "#facc15" : y3.length ? "#ef4444" : "#555" }}>{y3.length ? y3p + "%" : "—"}</div>
          <div style={{ fontSize: 8, color: "#666" }}>3PT {y3m}/{y3.length}</div>
        </div>
        <div style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 4px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: ftPct >= 70 ? "#818cf8" : ftPct >= 50 ? "#facc15" : ftTotal ? "#ef4444" : "#555" }}>{ftTotal ? ftPct + "%" : "—"}</div>
          <div style={{ fontSize: 8, color: "#666" }}>FT {ftMakes}/{ftTotal}</div>
        </div>
        <div style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 4px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f97316" }}>{teamFouls}</div>
          <div style={{ fontSize: 8, color: "#666" }}>FOULS</div>
        </div>
      </div>

      <div style={{ padding: "0 10px", margin: "0 8px" }}>
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
            const s = zoneStats[z.id]; const pct = s && s.total ? Math.round(s.makes / s.total * 100) : null;
            return (
              <g key={z.id}>
                <path d={z.path} fill={getZoneColor(z.id)} stroke={getZoneBorder(z.id)} strokeWidth={1} />
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

      {sortedPlayers.length > 0 && (
        <div style={{ padding: "16px 16px 4px" }}>
          <div style={SECHEAD}>Player Stats</div>
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
              return (
                <div key={p.number} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ ...JERSEY, width: 34, height: 34, fontSize: 14, flexShrink: 0 }}>{p.number}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#ccc" }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                      {"FG " + pFGm + "/" + pFG.length + (pFG.length > 0 ? " (" + pFGp + "%)" : "")}
                      {p3.length > 0 ? " · 3PT " + p3m + "/" + p3.length : ""}
                      {pFT.length > 0 ? " · FT " + pFTm + "/" + pFT.length : ""}
                    </div>
                    {(fouls > 0 || tos > 0) && (
                      <div style={{ fontSize: 9, color: "#666", marginTop: 1 }}>
                        {fouls > 0 && <span style={{ color: foulColor }}>{fouls} fouls</span>}
                        {fouls > 0 && tos > 0 ? " · " : ""}
                        {tos > 0 && <span style={{ color: "#a855f7" }}>{tos} TO</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", minWidth: 36 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#facc15" }}>{pts}</div>
                    <div style={{ fontSize: 7, color: "#666", letterSpacing: 0.5 }}>PTS</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fgTotal > 0 && (
        <div style={{ padding: "12px 16px 20px" }}>
          <div style={SECHEAD}>Zone Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {ZONES.filter(z => zoneStats[z.id].total > 0).map(z => {
              const s = zoneStats[z.id]; const p = Math.round(s.makes / s.total * 100);
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

      <div style={{ textAlign: "center", padding: "12px 16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 11, color: "#444" }}>Shot Chart</div>
      </div>
    </div>
  );
}
