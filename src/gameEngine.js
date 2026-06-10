/* ════════════════════════════════════════════════════════════
   gameEngine.js — V2: 9 zones, lineups, opponent score,
   plus/minus, ORB/DRB, stints. Pure, no side effects.
   ════════════════════════════════════════════════════════════ */

/* ─── 9-ZONE COURT (flipped, hoop at top) ─── */
export const ZONES = [
  { id:"layup",              label:"Layup",         x:165, y:5,   w:70,  h:55,  cx:200, cy:32 },
  { id:"two_left",           label:"2PT Left",      x:15,  y:40,  w:110, h:110, cx:70,  cy:95 },
  { id:"two_center",         label:"2PT Center",    x:135, y:68,  w:130, h:80,  cx:200, cy:108 },
  { id:"two_right",          label:"2PT Right",     x:275, y:40,  w:110, h:110, cx:330, cy:95 },
  { id:"three_left_corner",  label:"3PT L Corner",  x:5,   y:160, w:75,  h:110, cx:42,  cy:215 },
  { id:"three_left_wing",    label:"3PT L Wing",    x:5,   y:280, w:120, h:75,  cx:65,  cy:318 },
  { id:"three_top",          label:"3PT Top",       x:135, y:280, w:130, h:75,  cx:200, cy:318 },
  { id:"three_right_wing",   label:"3PT R Wing",    x:275, y:280, w:120, h:75,  cx:335, cy:318 },
  { id:"three_right_corner", label:"3PT R Corner",  x:320, y:160, w:75,  h:110, cx:358, cy:215 },
];
export const THREE_PT = new Set(["three_left_corner","three_left_wing","three_top","three_right_wing","three_right_corner","legacy_three_left","legacy_three_right"]);
export const Q_LABELS = ["Q1","Q2","Q3","Q4","OT","OT2"];
export const TALLY_STATS = ["rebound_off","rebound_def","steal","block","assist","turnover","foul","opp_foul","opp_rebound_off"];

/* Legacy zone → canonical zone. Old data never relabeled. */
const ZONE_MAP = {
  "paint":"legacy_paint","ft-line":"legacy_paint","top-key":"legacy_paint",
  "left-block":"two_left","left-elbow":"two_left","left-mid":"two_left",
  "right-block":"two_right","right-elbow":"two_right","right-mid":"two_right",
  "left-wing3":"legacy_three_left","left-corner3":"legacy_three_left",
  "right-wing3":"legacy_three_right","right-corner3":"legacy_three_right",
  "top3":"three_top",
  "2pt-left":"two_left","2pt-right":"two_right",
  "3pt-left":"legacy_three_left","3pt-right":"legacy_three_right","3pt-top":"three_top",
};
export function mapZone(id) { return ZONE_MAP[id] || id; }

/* Legacy zones for display in old-game reports */
export const LEGACY_ZONES = [
  { id:"legacy_paint", label:"Paint (legacy)" },
  { id:"legacy_three_left", label:"3PT Left (legacy)" },
  { id:"legacy_three_right", label:"3PT Right (legacy)" },
];

export function genId() { return Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10); }
export function nextSeq(events) { let m=0; for(const e of events) if(typeof e.seq==="number"&&e.seq>m) m=e.seq; return m+1; }
export function makeEvent(events,type,quarter,payload={}) {
  return { id:genId(), seq:nextSeq(events), type, quarter, recorded_at:new Date().toISOString(), ...payload };
}

/* ─── Format detection & legacy conversion ─── */
export function isV3(game) { return Array.isArray(game?.events)&&game.events.some(e=>e&&typeof e.seq==="number"); }

export function toEventLog(game) {
  if(isV3(game)) return [...game.events].sort((a,b)=>a.seq-b.seq);
  const shots=game?.shots||[]; const evts=game?.events||[];
  const merged=[];
  for(const s of shots) merged.push({_k:"shot",_id:s.id||0,src:s});
  for(const e of evts) merged.push({_k:"event",_id:e.id||0,src:e});
  merged.sort((a,b)=>a._id-b._id);
  const log=[]; let seq=0;
  for(const m of merged) {
    seq++;
    const q=m.src.quarter??0;
    const rec=new Date(typeof m.src.id==="number"?m.src.id:Date.now()).toISOString();
    if(m._k==="shot") {
      const s=m.src;
      if(s.isFT) {
        log.push({id:"lg-"+seq,seq,type:"free_throw_attempt",quarter:q,recorded_at:rec,playerNum:s.playerNum,result:s.result,points:s.result==="make"?1:0});
      } else {
        const z=mapZone(s.zone);
        const pts=s.result==="make"?(THREE_PT.has(z)?3:2):0;
        log.push({id:"lg-"+seq,seq,type:"shot_attempt",quarter:q,recorded_at:rec,playerNum:s.playerNum,zone:z,result:s.result,points:pts});
        if(s.assistNum){seq++;log.push({id:"lg-"+seq,seq,type:"stat_tally",quarter:q,recorded_at:rec,stat:"assist",playerNum:s.assistNum});}
      }
    } else {
      const e=m.src;
      if(e.type==="timeout") log.push({id:"lg-"+seq,seq,type:"timeout",quarter:q,recorded_at:rec,duration:e.duration});
      else if(e.type==="rebound") log.push({id:"lg-"+seq,seq,type:"stat_tally",quarter:q,recorded_at:rec,stat:"rebound_def",playerNum:e.playerNum});
      else if(e.type==="opp_rebound_off") log.push({id:"lg-"+seq,seq,type:"stat_tally",quarter:q,recorded_at:rec,stat:"opp_rebound_off"});
      else if(TALLY_STATS.includes(e.type)) log.push({id:"lg-"+seq,seq,type:"stat_tally",quarter:q,recorded_at:rec,stat:e.type,playerNum:e.playerNum});
      else if(e.type==="assist") log.push({id:"lg-"+seq,seq,type:"stat_tally",quarter:q,recorded_at:rec,stat:"assist",playerNum:e.playerNum});
    }
  }
  return log;
}

/* ─── Reversal helpers ─── */
export function reversedIds(events) { const s=new Set(); for(const e of events) if(e.type==="reversal"&&e.targetId) s.add(e.targetId); return s; }
export function activeEvents(events) { const r=reversedIds(events); return events.filter(e=>e.type!=="reversal"&&!r.has(e.id)).sort((a,b)=>a.seq-b.seq); }
export function lastActiveTally(events,stat,playerNum) {
  const act=activeEvents(events);
  for(let i=act.length-1;i>=0;i--) {
    const e=act[i];
    if(e.type==="stat_tally"&&e.stat===stat&&e.playerNum===playerNum) return e;
  }
  return null;
}
export function lastActiveEventOfType(events,type) {
  const act=activeEvents(events);
  for(let i=act.length-1;i>=0;i--) if(act[i].type===type) return act[i];
  return null;
}

/* ─── THE STAT ENGINE ─── */
export function computeGameStats(events, players=[]) {
  const act = activeEvents(events);
  const allZoneStats = {};
  ZONES.forEach(z => { allZoneStats[z.id] = { makes:0, total:0 }; });
  LEGACY_ZONES.forEach(z => { allZoneStats[z.id] = { makes:0, total:0 }; });

  let totalPts=0, fgMakes=0, fgTotal=0, ftMakes=0, ftTotal=0, oppScore=0;
  let to60used=0, to30used=0, oppOrbTotal=0;
  const qtrFouls={}, oppQtrFouls={}, oppFoulsByPlayer={};
  let oppTotalFouls=0;

  const P = {};
  const ensure = n => { if(!P[n]) P[n]={pts:0,fgm:0,fga:0,ftm:0,fta:0,p3m:0,p3a:0,ast:0,orb:0,drb:0,reb:0,stl:0,blk:0,fouls:0,tos:0,teamPtsOn:0,oppPtsOn:0,checkedIn:false}; return P[n]; };
  players.forEach(p => ensure(p.number));

  /* Lineup state */
  let lineup = new Set();
  const stints = [];
  let stintStart = null;
  function openStint(q) { stintStart = { quarter:q, players:[...lineup], teamScore:totalPts, oppScore }; }
  function closeStint(q) {
    if(!stintStart||lineup.size===0) return;
    stints.push({ ...stintStart, endTeamScore:totalPts, endOppScore:oppScore, ptsFor:totalPts-stintStart.teamScore, ptsAgainst:oppScore-stintStart.oppScore, diff:(totalPts-stintStart.teamScore)-(oppScore-stintStart.oppScore) });
  }
  function applyTeamPts(pts) { for(const n of lineup){const p=ensure(n);p.teamPtsOn+=pts;p.checkedIn=true;} }
  function applyOppPts(pts)  { for(const n of lineup){const p=ensure(n);p.oppPtsOn+=pts;p.checkedIn=true;} }

  for (const e of act) {
    if (e.type === "lineup_set") {
      if(lineup.size>0) closeStint(e.quarter);
      lineup = new Set(e.players||[]);
      (e.players||[]).forEach(n => { ensure(n).checkedIn=true; });
      openStint(e.quarter);
    } else if (e.type === "lineup_change") {
      closeStint(e.quarter);
      if(e.playerOut) lineup.delete(e.playerOut);
      if(e.playerIn) { lineup.add(e.playerIn); ensure(e.playerIn).checkedIn=true; }
      openStint(e.quarter);
    } else if (e.type === "shot_attempt") {
      fgTotal++;
      const z = mapZone(e.zone);
      if(allZoneStats[z]) allZoneStats[z].total++;
      const pp = e.playerNum ? ensure(e.playerNum) : null;
      if(pp) { pp.fga++; if(THREE_PT.has(z)) pp.p3a++; }
      if(e.result==="make") {
        const pts = e.points || (THREE_PT.has(z)?3:2);
        fgMakes++; totalPts+=pts;
        if(allZoneStats[z]) allZoneStats[z].makes++;
        if(pp) { pp.fgm++; pp.pts+=pts; if(THREE_PT.has(z)) pp.p3m++; }
        applyTeamPts(pts);
      }
    } else if (e.type === "free_throw_attempt") {
      ftTotal++;
      const pp = e.playerNum ? ensure(e.playerNum) : null;
      if(pp) pp.fta++;
      if(e.result==="make") { ftMakes++; totalPts+=1; if(pp){pp.ftm++;pp.pts+=1;} applyTeamPts(1); }
    } else if (e.type === "opp_score") {
      const pts = e.points||0;
      oppScore += pts;
      applyOppPts(pts);
    } else if (e.type === "stat_tally") {
      if(e.stat==="opp_foul") {
        oppTotalFouls++;
        oppQtrFouls[e.quarter]=(oppQtrFouls[e.quarter]||0)+1;
        if(e.playerNum) oppFoulsByPlayer[e.playerNum]=(oppFoulsByPlayer[e.playerNum]||0)+1;
      } else if(e.stat==="opp_rebound_off") {
        oppOrbTotal++;
      } else if(e.playerNum) {
        const pp = ensure(e.playerNum);
        if(e.stat==="rebound_off"){pp.orb++;pp.reb++;}
        else if(e.stat==="rebound_def"){pp.drb++;pp.reb++;}
        else if(e.stat==="rebound"){pp.drb++;pp.reb++;} // legacy single rebound → DRB
        else if(e.stat==="steal") pp.stl++;
        else if(e.stat==="block") pp.blk++;
        else if(e.stat==="assist") pp.ast++;
        else if(e.stat==="turnover") pp.tos++;
        else if(e.stat==="foul"){pp.fouls++;qtrFouls[e.quarter]=(qtrFouls[e.quarter]||0)+1;}
      }
    } else if (e.type === "timeout") {
      if(e.duration===60) to60used++; else if(e.duration===30) to30used++;
    }
  }
  // Close final stint
  if(lineup.size>0) closeStint(act.length>0?act[act.length-1].quarter:0);

  const teamFouls=Object.values(qtrFouls).reduce((a,b)=>a+b,0);
  let teamAst=0,teamReb=0,teamOrb=0,teamDrb=0,teamStl=0,teamBlk=0,teamTOs=0;
  Object.values(P).forEach(p=>{teamAst+=p.ast;teamOrb+=p.orb;teamDrb+=p.drb;teamReb+=p.reb;teamStl+=p.stl;teamBlk+=p.blk;teamTOs+=p.tos;});

  return {
    totalPts, oppScore, fgMakes, fgTotal, ftMakes, ftTotal,
    fgPct:fgTotal?Math.round(fgMakes/fgTotal*100):0,
    ftPct:ftTotal?Math.round(ftMakes/ftTotal*100):0,
    zoneStats:allZoneStats, players:P, lineup:[...lineup],
    teamFouls, qtrFouls, teamAst, teamReb, teamOrb, teamDrb, teamStl, teamBlk, teamTOs,
    oppTotalFouls, oppQtrFouls, oppFoulsByPlayer, oppOrbTotal, oppScore,
    to60left:3-to60used, to30left:2-to30used,
    stints, activeEvents:act,
  };
}

/* ─── Tally/display helpers ─── */
export function tallyEntries(stats,statKey,players) {
  const field={rebound_off:"orb",rebound_def:"drb",rebound:"reb",steal:"stl",block:"blk",assist:"ast",turnover:"tos",foul:"fouls"}[statKey];
  if(!field) return [];
  return Object.entries(stats.players).filter(([,v])=>v[field]>0).map(([num,v])=>{const p=players.find(x=>x.number===num);return{num,name:p?p.name:"#"+num,count:v[field]};}).sort((a,b)=>b.count-a.count);
}

export function ftEntries(stats,players) {
  return Object.entries(stats.players).filter(([,v])=>v.fta>0).map(([num,v])=>{const p=players.find(x=>x.number===num);return{num,name:p?p.name:"#"+num,made:v.ftm,att:v.fta};}).sort((a,b)=>b.att-a.att);
}

export function describeEvent(e,players) {
  const pName=n=>{if(!n)return"";const p=players.find(x=>x.number===n);return p?"#"+p.number+" "+p.name:"#"+n;};
  const q=Q_LABELS[e.quarter]||"";
  if(e.type==="shot_attempt"){const z=ZONES.find(x=>x.id===e.zone)||LEGACY_ZONES.find(x=>x.id===mapZone(e.zone));return(e.result==="make"?"Make":"Miss")+" — "+(z?z.label:e.zone)+(e.playerNum?" — "+pName(e.playerNum):"")+" — "+q;}
  if(e.type==="free_throw_attempt") return "FT "+(e.result==="make"?"Make":"Miss")+(e.playerNum?" — "+pName(e.playerNum):"")+" — "+q;
  if(e.type==="opp_score") return "Opp +"+e.points+" — "+q;
  if(e.type==="lineup_set") return "Lineup set — "+q;
  if(e.type==="lineup_change") return "Sub: "+pName(e.playerIn)+" in, "+pName(e.playerOut)+" out — "+q;
  if(e.type==="stat_tally") {
    const labels={rebound_off:"Off Rebound",rebound_def:"Def Rebound",rebound:"Rebound",steal:"Steal",block:"Block",assist:"Assist",turnover:"Turnover",foul:"Foul",opp_foul:"Opp Foul",opp_rebound_off:"Opp ORB"};
    if(e.stat==="opp_foul") return "Opp Foul — #"+(e.playerNum||"?")+" — "+q;
    if(e.stat==="opp_rebound_off") return "Opp ORB — "+q;
    return (labels[e.stat]||e.stat)+" — "+pName(e.playerNum)+" — "+q;
  }
  if(e.type==="timeout") return "Timeout "+e.duration+"s — "+q;
  if(e.type==="quarter_set") return "Quarter → "+(Q_LABELS[e.toQuarter]||"");
  return "Event — "+q;
}

export function getPoints(zone,result,isFT) {
  if(result!=="make") return 0;
  if(isFT) return 1;
  return THREE_PT.has(mapZone(zone))?3:2;
}

/* Helpers for lineup display */
export function getLineupNames(lineupNums, players) {
  return lineupNums.map(n => { const p = players.find(x => x.number === n); return p ? { number: n, name: p.name } : { number: n, name: "#"+n }; }).sort((a,b) => parseInt(a.number) - parseInt(b.number));
}
