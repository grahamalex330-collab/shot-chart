import { useState, useEffect } from "react";
import { fetchGame } from "./api.js";

const THREE_PT = new Set(["3pt-left","3pt-right","3pt-top","left-wing3","right-wing3","left-corner3","right-corner3","top3"]);
const ZONES = [
  { id:"paint", label:"Paint", x:140, y:5, w:120, h:92, cx:200, cy:50 },
  { id:"2pt-left", label:"2PT Left", x:15, y:48, w:115, h:122, cx:72, cy:108 },
  { id:"2pt-right", label:"2PT Right", x:270, y:48, w:115, h:122, cx:328, cy:108 },
  { id:"3pt-left", label:"3PT Left", x:8, y:190, w:130, h:100, cx:73, cy:240 },
  { id:"3pt-right", label:"3PT Right", x:262, y:190, w:130, h:100, cx:327, cy:240 },
  { id:"3pt-top", label:"3PT Top", x:148, y:225, w:104, h:80, cx:200, cy:265 },
];
const OLD_ZONE_MAP = { "paint":"paint","ft-line":"paint","top-key":"paint","left-block":"2pt-left","left-elbow":"2pt-left","left-mid":"2pt-left","right-block":"2pt-right","right-elbow":"2pt-right","right-mid":"2pt-right","left-wing3":"3pt-left","left-corner3":"3pt-left","right-wing3":"3pt-right","right-corner3":"3pt-right","top3":"3pt-top" };
function mapZone(id) { return OLD_ZONE_MAP[id] || id; }
function getPoints(s) { if (s.result!=="make") return 0; if (s.isFT) return 1; const z = mapZone(s.zone); return THREE_PT.has(z)||THREE_PT.has(s.zone) ? 3 : 2; }

const SHELL = { minHeight:"100vh", background:"#0a0a0a", fontFamily:"'SF Pro Display','Helvetica Neue',sans-serif", color:"#fff", maxWidth:600, margin:"0 auto" };
const SECHEAD = { fontSize:10, color:"#555", letterSpacing:2, marginBottom:8, textTransform:"uppercase" };
const JERSEY = { borderRadius:8, background:"rgba(250,204,21,0.15)", border:"1px solid rgba(250,204,21,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#facc15" };

export default function SharedView({ gameId }) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => { (async()=>{ const g=await fetchGame(gameId); if(g) setGame(g); else setError("Game not found"); setLoading(false); })(); }, [gameId]);
  if (loading) return <div style={{...SHELL,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#555",fontSize:14}}>Loading game...</div></div>;
  if (error||!game) return <div style={{...SHELL,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}><div style={{fontSize:40}}>🏀</div><div style={{color:"#888",fontSize:16,fontWeight:600}}>{error||"Game not found"}</div><a href="/" style={{color:"#facc15",fontSize:13,fontWeight:600}}>← Back to Shot Chart</a></div>;

  const shots=game.shots||[]; const events=game.events||[]; const players=game.players||[]; const teamName=game.team_name||game.teamName||"Game";
  const fieldGoals=shots.filter(s=>!s.isFT); const freeThrows=shots.filter(s=>s.isFT);
  const fgMakes=fieldGoals.filter(s=>s.result==="make").length; const fgTotal=fieldGoals.length;
  const fgPct=fgTotal>0?Math.round(fgMakes/fgTotal*100):0;
  const ftMakes=freeThrows.filter(s=>s.result==="make").length; const ftTotal=freeThrows.length;
  const ftPct=ftTotal>0?Math.round(ftMakes/ftTotal*100):0;
  const totalPts=shots.reduce((sum,s)=>sum+getPoints(s),0);
  const teamFouls=events.filter(e=>e.type==="foul").length; const teamTOs=events.filter(e=>e.type==="turnover").length;
  const teamAst=events.filter(e=>e.type==="assist").length+shots.filter(s=>s.assistNum).length;
  const teamReb=events.filter(e=>e.type==="rebound").length; const teamStl=events.filter(e=>e.type==="steal").length; const teamBlk=events.filter(e=>e.type==="block").length;
  const oppFouls=events.filter(e=>e.type==="opp_foul").length;
  const y3=fieldGoals.filter(s=>THREE_PT.has(mapZone(s.zone))||THREE_PT.has(s.zone)); const y3m=y3.filter(s=>s.result==="make").length; const y3p=y3.length>0?Math.round(y3m/y3.length*100):0;

  const zoneStats={};
  ZONES.forEach(z=>{const zs=fieldGoals.filter(s=>mapZone(s.zone)===z.id);zoneStats[z.id]={makes:zs.filter(s=>s.result==="make").length,total:zs.length};});

  const playerPts={}; const playerFouls={}; const playerTOs={};
  const playerAst={}; const playerReb={}; const playerStl={}; const playerBlk={};
  players.forEach(p=>{playerPts[p.number]=0;playerFouls[p.number]=0;playerTOs[p.number]=0;playerAst[p.number]=0;playerReb[p.number]=0;playerStl[p.number]=0;playerBlk[p.number]=0;});
  shots.forEach(s=>{if(s.playerNum) playerPts[s.playerNum]=(playerPts[s.playerNum]||0)+getPoints(s); if(s.assistNum) playerAst[s.assistNum]=(playerAst[s.assistNum]||0)+1;});
  events.forEach(e=>{
    if(e.type==="foul"&&e.playerNum) playerFouls[e.playerNum]=(playerFouls[e.playerNum]||0)+1;
    if(e.type==="turnover"&&e.playerNum) playerTOs[e.playerNum]=(playerTOs[e.playerNum]||0)+1;
    if(e.type==="rebound"&&e.playerNum) playerReb[e.playerNum]=(playerReb[e.playerNum]||0)+1;
    if(e.type==="steal"&&e.playerNum) playerStl[e.playerNum]=(playerStl[e.playerNum]||0)+1;
    if(e.type==="block"&&e.playerNum) playerBlk[e.playerNum]=(playerBlk[e.playerNum]||0)+1;
    if(e.type==="assist"&&e.playerNum) playerAst[e.playerNum]=(playerAst[e.playerNum]||0)+1;
  });
  const sortedPlayers=[...players].sort((a,b)=>parseInt(a.number)-parseInt(b.number));
  const getZoneColor=(id)=>{const s=zoneStats[id];if(!s||!s.total)return"rgba(255,255,255,0.04)";const p=s.makes/s.total;return p>=0.5?"rgba(34,197,94,0.25)":p>=0.35?"rgba(250,204,21,0.15)":"rgba(239,68,68,0.2)";};
  const getZoneBorder=(id)=>{const s=zoneStats[id];if(!s||!s.total)return"rgba(255,255,255,0.12)";const p=s.makes/s.total;return p>=0.5?"rgba(34,197,94,0.5)":p>=0.35?"rgba(250,204,21,0.4)":"rgba(239,68,68,0.45)";};
  const getZoneText=(id)=>{const s=zoneStats[id];if(!s||!s.total)return"rgba(255,255,255,0.12)";const p=s.makes/s.total;return p>=0.5?"#22c55e":p>=0.35?"#facc15":"#ef4444";};
  const fmtDate=(iso)=>{try{return new Date(iso).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}catch(e){return"";}};

  return (
    <div style={SHELL}>
      <div style={{padding:"20px 16px 8px"}}><div style={{fontSize:10,color:"#555",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Game stats</div><div style={{fontSize:22,fontWeight:800}}>{teamName}</div><div style={{fontSize:12,color:"#666",marginTop:2}}>{fmtDate(game.created_at||game.createdAt)}</div></div>

      <div style={{textAlign:"center",padding:"16px 0 12px"}}><div style={{fontSize:56,fontWeight:900,color:"#facc15",lineHeight:1}}>{totalPts}</div><div style={{fontSize:11,color:"#666",letterSpacing:2,marginTop:4}}>TOTAL POINTS</div></div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,padding:"0 16px 8px"}}>
        <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 4px"}}><div style={{fontSize:18,fontWeight:800,color:fgPct>=50?"#22c55e":fgPct>=35?"#facc15":fgTotal?"#ef4444":"#555"}}>{fgTotal?fgPct+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FG {fgMakes}/{fgTotal}</div></div>
        <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 4px"}}><div style={{fontSize:18,fontWeight:800,color:y3p>=35?"#22c55e":y3p>=25?"#facc15":y3.length?"#ef4444":"#555"}}>{y3.length?y3p+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>3PT {y3m}/{y3.length}</div></div>
        <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 4px"}}><div style={{fontSize:18,fontWeight:800,color:ftPct>=70?"#818cf8":ftPct>=50?"#facc15":ftTotal?"#ef4444":"#555"}}>{ftTotal?ftPct+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FT {ftMakes}/{ftTotal}</div></div>
        <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 4px"}}><div style={{fontSize:18,fontWeight:800,color:"#f97316"}}>{teamFouls}</div><div style={{fontSize:8,color:"#666"}}>FOULS</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,padding:"0 16px 16px"}}>
        <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{teamAst}</div><div style={{fontSize:8,color:"#666"}}>AST</div></div>
        <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{teamReb}</div><div style={{fontSize:8,color:"#666"}}>REB</div></div>
        <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#a855f7"}}>{teamTOs}</div><div style={{fontSize:8,color:"#666"}}>TO</div></div>
        <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#3b82f6"}}>{teamStl}</div><div style={{fontSize:8,color:"#666"}}>STL</div></div>
      </div>

      {/* Court (flipped, hoop at top) */}
      <div style={{padding:"0 16px",margin:"0 8px"}}>
        <svg viewBox="0 0 400 320" style={{width:"100%",height:"auto",display:"block"}}>
          <rect x="0" y="0" width="400" height="320" rx="10" fill="#1a1206" stroke="rgba(255,180,50,0.15)" strokeWidth="1" />
          <circle cx="200" cy="18" r="8" fill="none" stroke="rgba(255,180,50,0.5)" strokeWidth="1.5" />
          <line x1="185" y1="4" x2="215" y2="4" stroke="rgba(255,180,50,0.35)" strokeWidth="1.5" />
          <rect x="130" y="0" width="140" height="110" fill="none" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
          <circle cx="200" cy="110" r="60" fill="none" stroke="rgba(255,180,50,0.2)" strokeWidth="1" strokeDasharray="4,4" />
          <path d="M 40,0 L 40,80 Q 40,250 200,270 Q 360,250 360,80 L 360,0" fill="none" stroke="rgba(255,180,50,0.25)" strokeWidth="1.5" />
          {ZONES.map(z=>{const s=zoneStats[z.id];const pct=s&&s.total?Math.round(s.makes/s.total*100):null;return(
            <g key={z.id}><rect x={z.x} y={z.y} width={z.w} height={z.h} rx="8" fill={getZoneColor(z.id)} stroke={getZoneBorder(z.id)} strokeWidth={2} />
            {s&&s.total>0?<><text x={z.cx} y={z.cy-2} textAnchor="middle" fill={getZoneText(z.id)} fontSize="14" fontWeight="800" style={{pointerEvents:"none"}}>{z.label}</text><text x={z.cx} y={z.cy+14} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600" style={{pointerEvents:"none"}}>{s.makes}/{s.total}</text></>
            :<text x={z.cx} y={z.cy+5} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="12" style={{pointerEvents:"none"}}>{z.label}</text>}
            </g>);})}
        </svg>
      </div>

      {sortedPlayers.length>0&&<div style={{padding:"16px 16px 4px"}}><div style={SECHEAD}>Player stats</div>
        {sortedPlayers.map(p=>{
          const pS=shots.filter(s=>s.playerNum===p.number); const pFG=pS.filter(s=>!s.isFT); const pFT=pS.filter(s=>s.isFT);
          const pFGm=pFG.filter(s=>s.result==="make").length; const pFTm=pFT.filter(s=>s.result==="make").length;
          const pFGp=pFG.length>0?Math.round(pFGm/pFG.length*100):0;
          const p3=pFG.filter(s=>THREE_PT.has(mapZone(s.zone))||THREE_PT.has(s.zone)); const p3m=p3.filter(s=>s.result==="make").length;
          const pts=playerPts[p.number]||0; const fouls=playerFouls[p.number]||0; const tos=playerTOs[p.number]||0;
          const ast=playerAst[p.number]||0; const reb=playerReb[p.number]||0; const stl=playerStl[p.number]||0; const blk=playerBlk[p.number]||0;
          const foulColor=fouls>=4?"#ef4444":fouls>=3?"#f97316":"#666";
          const parts=[]; parts.push("FG "+pFGm+"/"+pFG.length+(pFG.length>0?" ("+pFGp+"%)":""));
          if(p3.length>0)parts.push("3PT "+p3m+"/"+p3.length); if(pFT.length>0)parts.push("FT "+pFTm+"/"+pFT.length);
          if(ast>0)parts.push(ast+" ast"); if(reb>0)parts.push(reb+" reb"); if(stl>0)parts.push(stl+" stl"); if(blk>0)parts.push(blk+" blk");
          if(fouls>0)parts.push(fouls+" fouls"); if(tos>0)parts.push(tos+" TO");
          return <div key={p.number} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{...JERSEY,width:34,height:34,fontSize:14,flexShrink:0}}>{p.number}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"#ccc"}}>{p.name}</div><div style={{fontSize:9,color:"#666",marginTop:2}}>{parts.join(" · ")}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {fouls>0&&<div style={{textAlign:"center"}}><div style={{fontSize:15,fontWeight:800,color:foulColor}}>{fouls}</div><div style={{fontSize:7,color:foulColor}}>{fouls>=4?"⚠ FOUL":"FOUL"}</div></div>}
              <div style={{textAlign:"right",minWidth:36}}><div style={{fontSize:20,fontWeight:900,color:"#facc15"}}>{pts}</div><div style={{fontSize:7,color:"#666"}}>PTS</div></div>
            </div></div>;
        })}
      </div>}

      {oppFouls>0&&<div style={{padding:"8px 16px"}}><div style={{...SECHEAD,color:"#ef4444"}}>Opponent fouls ({oppFouls})</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{Object.entries((()=>{const m={};events.filter(e=>e.type==="opp_foul").forEach(e=>{m[e.playerNum]=(m[e.playerNum]||0)+1;});return m;})()).sort((a,b)=>b[1]-a[1]).map(([num,count])=><div key={num} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"4px 10px",fontSize:11}}><span style={{color:"#ef4444",fontWeight:700}}>#{num}</span><span style={{color:"#888",marginLeft:4}}>{count}f</span></div>)}</div>
      </div>}

      {fgTotal>0&&<div style={{padding:"12px 16px 20px"}}><div style={SECHEAD}>Zone breakdown</div>
        {ZONES.filter(z=>zoneStats[z.id].total>0).map(z=>{const s=zoneStats[z.id];const p=Math.round(s.makes/s.total*100);return <div key={z.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><div style={{width:80,fontSize:12,color:"#888",flexShrink:0}}>{z.label}</div><div style={{flex:1,height:8,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}><div style={{height:"100%",width:p+"%",borderRadius:4,background:p>=50?"#22c55e":p>=35?"#facc15":"#ef4444"}} /></div><div style={{width:60,textAlign:"right",fontSize:12,color:"#ccc",fontWeight:700}}>{s.makes}/{s.total} <span style={{color:"#666",fontWeight:400}}>({p}%)</span></div></div>;})}
      </div>}

      <div style={{textAlign:"center",padding:"12px 16px 24px",borderTop:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontSize:11,color:"#444"}}>Shot Chart</div></div>
    </div>
  );
}
