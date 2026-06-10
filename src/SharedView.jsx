import { useState, useEffect } from "react";
import { fetchGame } from "./api.js";
import { ZONES, LEGACY_ZONES, THREE_PT, mapZone, toEventLog, computeGameStats, getLineupNames } from "./gameEngine.js";
const SHELL={minHeight:"100vh",background:"#0a0a0a",fontFamily:"'SF Pro Display','Helvetica Neue',sans-serif",color:"#fff",maxWidth:600,margin:"0 auto"};
const SECHEAD={fontSize:10,color:"#555",letterSpacing:2,marginBottom:8,textTransform:"uppercase"};
const JERSEY={borderRadius:8,background:"rgba(250,204,21,0.15)",border:"1px solid rgba(250,204,21,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#facc15"};

export default function SharedView({gameId}){
  const[game,setGame]=useState(null);const[loading,setLoading]=useState(true);const[error,setError]=useState(null);
  useEffect(()=>{(async()=>{const g=await fetchGame(gameId);if(g)setGame(g);else setError("Game not found");setLoading(false);})();},[gameId]);
  if(loading)return<div style={{...SHELL,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#555",fontSize:14}}>Loading game...</div></div>;
  if(error||!game)return<div style={{...SHELL,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}><div style={{fontSize:40}}>🏀</div><div style={{color:"#888",fontSize:16,fontWeight:600}}>{error||"Game not found"}</div><a href="/" style={{color:"#facc15",fontSize:13,fontWeight:600}}>← Back to Shot Chart</a></div>;

  const players=game.players||[];const teamName=game.team_name||game.teamName||"Game";
  const st=computeGameStats(toEventLog(game),players);
  const sortedPlayers=[...players].sort((a,b)=>parseInt(a.number)-parseInt(b.number));
  const hasLineup=st.lineup.length===5;
  const allZones=[...ZONES,...LEGACY_ZONES];
  const getZC=id=>{const s=st.zoneStats[id];if(!s||!s.total)return"rgba(255,255,255,0.04)";const p=s.makes/s.total;return p>=0.5?"rgba(34,197,94,0.25)":p>=0.35?"rgba(250,204,21,0.15)":"rgba(239,68,68,0.2)";};
  const fmtDate=iso=>{try{return new Date(iso).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}catch(e){return"";}};

  return(<div style={SHELL}>
    <div style={{padding:"20px 16px 8px"}}><div style={{fontSize:10,color:"#555",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Game stats</div><div style={{fontSize:22,fontWeight:800}}>{teamName}</div><div style={{fontSize:12,color:"#666",marginTop:2}}>{fmtDate(game.created_at||game.createdAt)}</div></div>

    {/* Score */}
    <div style={{textAlign:"center",padding:"16px 0 6px"}}>
      {st.oppScore>0?<div><span style={{fontSize:48,fontWeight:900,color:"#facc15"}}>{st.totalPts}</span><span style={{fontSize:24,color:"#555",margin:"0 12px"}}>—</span><span style={{fontSize:48,fontWeight:900,color:"#ef4444"}}>{st.oppScore}</span><div style={{fontSize:11,color:"#666",letterSpacing:2,marginTop:4}}>US — THEM</div></div>
    :<div><div style={{fontSize:56,fontWeight:900,color:"#facc15",lineHeight:1}}>{st.totalPts}</div><div style={{fontSize:11,color:"#666",letterSpacing:2,marginTop:4}}>TOTAL POINTS</div></div>}
    </div>

    {/* Shooting + team stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,padding:"8px 16px"}}>
      <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 4px"}}><div style={{fontSize:18,fontWeight:800,color:st.fgPct>=50?"#22c55e":st.fgPct>=35?"#facc15":st.fgTotal?"#ef4444":"#555"}}>{st.fgTotal?st.fgPct+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FG {st.fgMakes}/{st.fgTotal}</div></div>
      <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 4px"}}><div style={{fontSize:18,fontWeight:800,color:st.ftPct>=70?"#818cf8":st.ftPct>=50?"#facc15":st.ftTotal?"#ef4444":"#555"}}>{st.ftTotal?st.ftPct+"%":"—"}</div><div style={{fontSize:8,color:"#666"}}>FT {st.ftMakes}/{st.ftTotal}</div></div>
      <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 4px"}}><div style={{fontSize:18,fontWeight:800,color:"#f97316"}}>{st.teamFouls}</div><div style={{fontSize:8,color:"#666"}}>FOULS</div></div>
      <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 4px"}}><div style={{fontSize:18,fontWeight:800,color:"#a855f7"}}>{st.teamTOs}</div><div style={{fontSize:8,color:"#666"}}>TO</div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,padding:"0 16px 16px"}}>
      <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{st.teamAst}</div><div style={{fontSize:8,color:"#666"}}>AST</div></div>
      <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{st.teamOrb}</div><div style={{fontSize:8,color:"#666"}}>ORB</div></div>
      <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#22c55e"}}>{st.teamDrb}</div><div style={{fontSize:8,color:"#666"}}>DRB</div></div>
      <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#3b82f6"}}>{st.teamStl}</div><div style={{fontSize:8,color:"#666"}}>STL</div></div>
      <div style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 4px"}}><div style={{fontSize:16,fontWeight:800,color:"#ec4899"}}>{st.teamBlk}</div><div style={{fontSize:8,color:"#666"}}>BLK</div></div>
    </div>

    {/* Player stats */}
    {sortedPlayers.length>0&&<div style={{padding:"0 16px 4px"}}><div style={SECHEAD}>Player stats</div>
      {sortedPlayers.map(p=>{
        const ps=st.players[p.number]||{pts:0,fgm:0,fga:0,ftm:0,fta:0,p3m:0,p3a:0,ast:0,orb:0,drb:0,reb:0,stl:0,blk:0,fouls:0,tos:0,teamPtsOn:0,oppPtsOn:0,checkedIn:false};
        const pm=ps.checkedIn?(ps.teamPtsOn-ps.oppPtsOn):null;const foulColor=ps.fouls>=4?"#ef4444":ps.fouls>=3?"#f97316":"#666";
        const parts=[];parts.push("FG "+ps.fgm+"/"+ps.fga);if(ps.p3a>0)parts.push("3PT "+ps.p3m+"/"+ps.p3a);if(ps.fta>0)parts.push("FT "+ps.ftm+"/"+ps.fta);
        if(ps.ast>0)parts.push(ps.ast+" ast");if(ps.reb>0)parts.push(ps.reb+" reb"+(ps.orb>0?" ("+ps.orb+" orb)":""));if(ps.stl>0)parts.push(ps.stl+" stl");if(ps.blk>0)parts.push(ps.blk+" blk");
        if(ps.fouls>0)parts.push(ps.fouls+" fouls");if(ps.tos>0)parts.push(ps.tos+" TO");
        return<div key={p.number} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{...JERSEY,width:34,height:34,fontSize:14,flexShrink:0}}>{p.number}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"#ccc"}}>{p.name}</div><div style={{fontSize:9,color:"#666",marginTop:2}}>{parts.join(" · ")}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {pm!==null&&<div style={{textAlign:"center"}}><div style={{fontSize:14,fontWeight:800,color:pm>0?"#22c55e":pm<0?"#ef4444":"#888"}}>{pm>0?"+":""}{pm}</div><div style={{fontSize:7,color:"#666"}}>+/-</div></div>}
            {ps.fouls>0&&<div style={{textAlign:"center"}}><div style={{fontSize:15,fontWeight:800,color:foulColor}}>{ps.fouls}</div><div style={{fontSize:7,color:foulColor}}>{ps.fouls>=4?"⚠":""}FLS</div></div>}
            <div style={{textAlign:"right",minWidth:36}}><div style={{fontSize:20,fontWeight:900,color:"#facc15"}}>{ps.pts}</div><div style={{fontSize:7,color:"#666"}}>PTS</div></div>
          </div></div>;
      })}
    </div>}

    {/* Zone breakdown (new + legacy) */}
    {st.fgTotal>0&&<div style={{padding:"12px 16px 20px"}}><div style={SECHEAD}>Zone breakdown</div>
      {allZones.filter(z=>st.zoneStats[z.id]?.total>0).map(z=>{const s=st.zoneStats[z.id];const p=Math.round(s.makes/s.total*100);return<div key={z.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><div style={{width:100,fontSize:12,color:"#888",flexShrink:0}}>{z.label}</div><div style={{flex:1,height:8,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}><div style={{height:"100%",width:p+"%",borderRadius:4,background:p>=50?"#22c55e":p>=35?"#facc15":"#ef4444"}}/></div><div style={{width:60,textAlign:"right",fontSize:12,color:"#ccc",fontWeight:700}}>{s.makes}/{s.total}</div></div>;})}
    </div>}

    {/* Stints */}
    {st.stints.length>0&&<div style={{padding:"0 16px 20px"}}><div style={SECHEAD}>Lineup stints</div>
      {st.stints.map((s,i)=><div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"8px 12px",marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span style={{color:"#888"}}>{s.players.map(n=>"#"+n).join(", ")}</span><span style={{color:s.diff>0?"#22c55e":s.diff<0?"#ef4444":"#888",fontWeight:700}}>{s.diff>0?"+":""}{s.diff}</span></div>
        <div style={{fontSize:10,color:"#555",marginTop:2}}>Score: {s.teamScore}–{s.oppScore} → {s.endTeamScore}–{s.endOppScore}</div>
      </div>)}
    </div>}

    <div style={{textAlign:"center",padding:"12px 16px 24px",borderTop:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontSize:11,color:"#444"}}>Shot Chart</div></div>
  </div>);
}
