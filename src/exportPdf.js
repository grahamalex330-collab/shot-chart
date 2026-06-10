import { jsPDF } from "jspdf";
import { ZONES, LEGACY_ZONES, toEventLog, computeGameStats } from "./gameEngine.js";

export function exportGamePdf(game) {
  const doc=new jsPDF({unit:"pt",format:"letter"});const W=612;const M=40;let y=40;
  const gray=[100,100,100],dark=[30,30,30],accent=[250,204,21],green=[34,197,94],red=[239,68,68];
  const players=(game.players||[]).sort((a,b)=>parseInt(a.number)-parseInt(b.number));
  const teamName=game.team_name||game.teamName||"Game";
  const date=game.created_at||game.createdAt||"";
  const fmtDate=iso=>{try{return new Date(iso).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}catch(e){return"";}};
  const st=computeGameStats(toEventLog(game),players);
  const p3m=Object.values(st.players).reduce((s,v)=>s+v.p3m,0);
  const p3a=Object.values(st.players).reduce((s,v)=>s+v.p3a,0);

  // Header
  doc.setFontSize(22);doc.setTextColor(...dark);doc.setFont("helvetica","bold");
  doc.text(teamName.toUpperCase(),M,y);y+=18;
  doc.setFontSize(10);doc.setTextColor(...gray);doc.setFont("helvetica","normal");
  doc.text(fmtDate(date),M,y);y+=20;
  // Score
  doc.setFontSize(14);doc.setTextColor(...dark);doc.setFont("helvetica","bold");
  if(st.oppScore>0) doc.text("US "+st.totalPts+" — THEM "+st.oppScore,M,y);
  else doc.text("Total Points: "+st.totalPts,M,y);
  y+=18;
  doc.setFontSize(11);doc.setFont("helvetica","normal");
  doc.text("FG: "+st.fgMakes+"/"+st.fgTotal+" ("+st.fgPct+"%)    3PT: "+p3m+"/"+p3a+"    FT: "+st.ftMakes+"/"+st.ftTotal+" ("+st.ftPct+"%)",M,y);y+=16;
  doc.setFontSize(9);doc.setTextColor(...gray);
  doc.text("AST: "+st.teamAst+"    ORB: "+st.teamOrb+"    DRB: "+st.teamDrb+"    REB: "+st.teamReb+"    STL: "+st.teamStl+"    BLK: "+st.teamBlk+"    FOULS: "+st.teamFouls+"    TO: "+st.teamTOs+(st.oppOrbTotal>0?"    OPP ORB: "+st.oppOrbTotal:""),M,y);y+=20;
  doc.setDrawColor(220,220,220);doc.setLineWidth(0.5);doc.line(M,y,W-M,y);y+=14;

  // Player Box Score
  if(players.length>0){
    doc.setFontSize(10);doc.setTextColor(...gray);doc.setFont("helvetica","bold");doc.text("PLAYER BOX SCORE",M,y);y+=14;
    const cols=[M,M+25,M+85,M+120,M+155,M+190,M+225,M+260,M+290,M+320,M+345,M+370,M+395,M+425,M+455];
    const headers=["#","NAME","PTS","FG","FG%","3PT","FT","AST","ORB","DRB","STL","BLK","FLS","TO"];
    doc.setFontSize(7);doc.setTextColor(...gray);doc.setFont("helvetica","bold");
    headers.forEach((h,i)=>doc.text(h,cols[i],y));y+=4;
    doc.setDrawColor(200,200,200);doc.line(M,y,W-M,y);y+=10;
    doc.setFont("helvetica","normal");doc.setFontSize(8);
    players.forEach(p=>{
      const ps=st.players[p.number]||{pts:0,fgm:0,fga:0,ftm:0,fta:0,p3m:0,p3a:0,ast:0,orb:0,drb:0,stl:0,blk:0,fouls:0,tos:0};
      doc.setTextColor(...(ps.fouls>=4?red:dark));
      const row=[p.number,p.name,ps.pts,ps.fgm+"/"+ps.fga,ps.fga>0?Math.round(ps.fgm/ps.fga*100)+"%":"—",ps.p3a>0?ps.p3m+"/"+ps.p3a:"—",ps.fta>0?ps.ftm+"/"+ps.fta:"—",ps.ast,ps.orb,ps.drb,ps.stl,ps.blk,ps.fouls,ps.tos];
      row.forEach((v,i)=>doc.text(String(v),cols[i],y));doc.setTextColor(...dark);y+=13;
      if(y>720){doc.addPage();y=40;}
    });
    y+=6;doc.setDrawColor(200,200,200);doc.line(M,y-4,W-M,y-4);y+=6;
  }

  // Plus/Minus table (only if lineup tracking was used)
  const hasLineup=st.stints.length>0;
  if(hasLineup&&players.length>0){
    if(y>660){doc.addPage();y=40;}
    doc.setDrawColor(220,220,220);doc.line(M,y,W-M,y);y+=14;
    doc.setFontSize(10);doc.setTextColor(...gray);doc.setFont("helvetica","bold");doc.text("PLUS/MINUS",M,y);y+=14;
    const pmCols=[M,M+30,M+120,M+180,M+250,M+320];
    ["#","NAME","+/-","TEAM PTS ON","OPP PTS ON"].forEach((h,i)=>{doc.setFontSize(7);doc.text(h,pmCols[i],y);});y+=10;
    doc.setFont("helvetica","normal");doc.setFontSize(8);
    players.forEach(p=>{
      const ps=st.players[p.number]||{teamPtsOn:0,oppPtsOn:0,checkedIn:false};
      if(!ps.checkedIn){doc.setTextColor(...gray);doc.text(p.number,pmCols[0],y);doc.text(p.name,pmCols[1],y);doc.text("—",pmCols[2],y);y+=12;doc.setTextColor(...dark);return;}
      const pm=ps.teamPtsOn-ps.oppPtsOn;
      doc.setTextColor(...(pm>0?green:pm<0?red:dark));
      doc.text(p.number,pmCols[0],y);doc.text(p.name,pmCols[1],y);doc.text((pm>0?"+":"")+pm,pmCols[2],y);doc.text(String(ps.teamPtsOn),pmCols[3],y);doc.text(String(ps.oppPtsOn),pmCols[4],y);
      doc.setTextColor(...dark);y+=12;if(y>720){doc.addPage();y=40;}
    });
    y+=6;
  }

  // Zone Breakdown
  if(y>660){doc.addPage();y=40;}
  const allZones=[...ZONES,...LEGACY_ZONES].filter(z=>st.zoneStats[z.id]?.total>0);
  if(allZones.length>0){
    doc.setDrawColor(220,220,220);doc.line(M,y,W-M,y);y+=14;
    doc.setFontSize(10);doc.setTextColor(...gray);doc.setFont("helvetica","bold");doc.text("ZONE BREAKDOWN",M,y);y+=14;
    doc.setFont("helvetica","normal");doc.setFontSize(9);
    allZones.forEach(z=>{
      const s=st.zoneStats[z.id];const zp=Math.round(s.makes/s.total*100);
      doc.setTextColor(...dark);doc.text(z.label,M,y);doc.text(s.makes+"/"+s.total+" ("+zp+"%)",M+120,y);
      const bx=M+200,bw=150,bh=6;doc.setFillColor(235,235,235);doc.rect(bx,y-6,bw,bh,"F");
      const c=zp>=50?green:zp>=35?accent:red;doc.setFillColor(...c);doc.rect(bx,y-6,bw*(zp/100),bh,"F");
      y+=14;
    });
    y+=6;
  }

  // Lineup Stints
  if(hasLineup&&st.stints.length>0){
    if(y>660){doc.addPage();y=40;}
    doc.setDrawColor(220,220,220);doc.line(M,y,W-M,y);y+=14;
    doc.setFontSize(10);doc.setTextColor(...gray);doc.setFont("helvetica","bold");doc.text("LINEUP STINTS",M,y);y+=14;
    doc.setFont("helvetica","normal");doc.setFontSize(8);
    st.stints.forEach((s,i)=>{
      doc.setTextColor(...dark);
      const lineup=s.players.map(n=>"#"+n).join(", ");
      const diff=s.diff;const diffStr=(diff>0?"+":"")+diff;
      doc.text(lineup,M,y);doc.text(s.teamScore+"–"+s.oppScore+" → "+s.endTeamScore+"–"+s.endOppScore,M+260,y);
      doc.setTextColor(...(diff>0?green:diff<0?red:gray));doc.text(diffStr,W-M-30,y);doc.setTextColor(...dark);
      y+=12;if(y>720){doc.addPage();y=40;}
    });
  }

  if(!hasLineup&&players.length>0){
    y+=10;doc.setFontSize(8);doc.setTextColor(...gray);doc.setFont("helvetica","normal");
    doc.text("Lineup tracking was not active for this game. Plus/minus and stint data not available.",M,y);
  }

  // Footer
  y=750;doc.setFontSize(8);doc.setTextColor(180,180,180);doc.setFont("helvetica","normal");
  doc.text("Generated by Shot Chart",M,y);doc.text(new Date().toLocaleDateString(),W-M-60,y);
  const filename=(teamName.replace(/[^a-zA-Z0-9]/g,"-").replace(/-+/g,"-").toLowerCase()||"game")+"-stats.pdf";
  doc.save(filename);
}
