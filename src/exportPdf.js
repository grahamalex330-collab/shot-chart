import { jsPDF } from "jspdf";
import { ZONES, toEventLog, computeGameStats } from "./gameEngine.js";

export function exportGamePdf(game) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612; const M = 40;
  let y = 40;
  const gray = [100,100,100]; const dark = [30,30,30]; const accent = [250,204,21]; const green = [34,197,94]; const red = [239,68,68];

  const players = (game.players || []).sort((a,b) => parseInt(a.number)-parseInt(b.number));
  const teamName = game.team_name || game.teamName || "Game";
  const date = game.created_at || game.createdAt || "";
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}); } catch(e) { return ""; }};

  const st = computeGameStats(toEventLog(game), players);
  const p3m = Object.values(st.players).reduce((s,v)=>s+v.p3m,0);
  const p3a = Object.values(st.players).reduce((s,v)=>s+v.p3a,0);
  const p3p = p3a>0?Math.round(p3m/p3a*100):0;

  doc.setFontSize(22); doc.setTextColor(...dark); doc.setFont("helvetica","bold");
  doc.text(teamName.toUpperCase(), M, y); y += 18;
  doc.setFontSize(10); doc.setTextColor(...gray); doc.setFont("helvetica","normal");
  doc.text(fmtDate(date), M, y); y += 28;

  doc.setFontSize(48); doc.setTextColor(...dark); doc.setFont("helvetica","bold");
  doc.text(String(st.totalPts), M, y);
  doc.setFontSize(11); doc.setTextColor(...gray); doc.setFont("helvetica","normal");
  doc.text("TOTAL POINTS", M + 70, y - 8); y += 16;

  doc.setFontSize(12); doc.setTextColor(...dark); doc.setFont("helvetica","bold");
  doc.text(`FG: ${st.fgMakes}/${st.fgTotal} (${st.fgPct}%)    3PT: ${p3m}/${p3a} (${p3p}%)    FT: ${st.ftMakes}/${st.ftTotal} (${st.ftPct}%)`, M, y); y += 20;

  doc.setFontSize(10); doc.setTextColor(...gray); doc.setFont("helvetica","normal");
  doc.text(`AST: ${st.teamAst}    REB: ${st.teamReb}    STL: ${st.teamStl}    BLK: ${st.teamBlk}    FOULS: ${st.teamFouls}    TO: ${st.teamTOs}` + (st.oppTotalFouls > 0 ? `    OPP FOULS: ${st.oppTotalFouls}` : "") + (st.oppOrbTotal > 0 ? `    OPP ORB: ${st.oppOrbTotal}` : ""), M, y); y += 24;

  doc.setDrawColor(220,220,220); doc.setLineWidth(0.5);
  doc.line(M, y, W-M, y); y += 16;

  if (players.length > 0) {
    doc.setFontSize(10); doc.setTextColor(...gray); doc.setFont("helvetica","bold");
    doc.text("PLAYER BREAKDOWN", M, y); y += 16;
    const cols = [M, M+30, M+105, M+145, M+185, M+230, M+270, M+310, M+345, M+380, M+415, M+450, M+485];
    const headers = ["#","NAME","PTS","FG","FG%","3PT","FT","AST","REB","STL","BLK","FLS","TO"];
    doc.setFontSize(8); doc.setTextColor(...gray); doc.setFont("helvetica","bold");
    headers.forEach((h,i) => doc.text(h, cols[i], y));
    y += 4;
    doc.setDrawColor(200,200,200); doc.line(M, y, W-M, y); y += 10;
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    players.forEach(p => {
      const ps = st.players[p.number] || { pts:0,fgm:0,fga:0,ftm:0,fta:0,p3m:0,p3a:0,ast:0,reb:0,stl:0,blk:0,fouls:0,tos:0 };
      const pFGp = ps.fga>0?Math.round(ps.fgm/ps.fga*100)+"%":"—";
      doc.setTextColor(...(ps.fouls >= 4 ? red : dark));
      const row = [p.number, p.name, String(ps.pts), `${ps.fgm}/${ps.fga}`, pFGp, ps.p3a>0?`${ps.p3m}/${ps.p3a}`:"—", ps.fta>0?`${ps.ftm}/${ps.fta}`:"—", String(ps.ast), String(ps.reb), String(ps.stl), String(ps.blk), String(ps.fouls), String(ps.tos)];
      row.forEach((v,i) => doc.text(String(v), cols[i], y));
      doc.setTextColor(...dark);
      y += 14;
      if (y > 720) { doc.addPage(); y = 40; }
    });
    y += 2;
    doc.setDrawColor(200,200,200); doc.line(M, y-6, W-M, y-6);
    doc.setFont("helvetica","bold"); doc.setTextColor(...dark);
    const totRow = ["","TEAM", String(st.totalPts), `${st.fgMakes}/${st.fgTotal}`, st.fgTotal?st.fgPct+"%":"—", p3a>0?`${p3m}/${p3a}`:"—", st.ftTotal>0?`${st.ftMakes}/${st.ftTotal}`:"—", String(st.teamAst), String(st.teamReb), String(st.teamStl), String(st.teamBlk), String(st.teamFouls), String(st.teamTOs)];
    totRow.forEach((v,i) => doc.text(String(v), cols[i], y));
    y += 24;
  }

  if (y > 660) { doc.addPage(); y = 40; }
  doc.setDrawColor(220,220,220); doc.line(M, y, W-M, y); y += 16;
  doc.setFontSize(10); doc.setTextColor(...gray); doc.setFont("helvetica","bold");
  doc.text("ZONE BREAKDOWN", M, y); y += 16;
  doc.setFont("helvetica","normal"); doc.setFontSize(9);
  ZONES.forEach(z => {
    const s = st.zoneStats[z.id];
    if (!s || s.total === 0) return;
    const zp = Math.round(s.makes/s.total*100);
    doc.setTextColor(...dark);
    doc.text(z.label, M, y);
    doc.text(`${s.makes}/${s.total} (${zp}%)`, M + 100, y);
    const barX = M + 170; const barW = 150; const barH = 6;
    doc.setFillColor(235,235,235); doc.rect(barX, y-6, barW, barH, "F");
    const c = zp>=50?green:zp>=35?accent:red;
    doc.setFillColor(...c); doc.rect(barX, y-6, barW*(zp/100), barH, "F");
    y += 16;
  });

  if (st.oppTotalFouls > 0) {
    y += 8;
    if (y > 700) { doc.addPage(); y = 40; }
    doc.setDrawColor(220,220,220); doc.line(M, y, W-M, y); y += 16;
    doc.setFontSize(10); doc.setTextColor(...red); doc.setFont("helvetica","bold");
    doc.text(`OPPONENT FOULS (${st.oppTotalFouls})`, M, y); y += 14;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...dark);
    Object.entries(st.oppFoulsByPlayer).sort((a,b)=>b[1]-a[1]).forEach(([num,count]) => {
      doc.text(`#${num}: ${count} foul${count!==1?"s":""}`, M, y); y += 12;
    });
  }

  y = 750;
  doc.setFontSize(8); doc.setTextColor(180,180,180); doc.setFont("helvetica","normal");
  doc.text("Generated by Shot Chart", M, y);
  doc.text(new Date().toLocaleDateString(), W-M-60, y);

  const filename = (teamName.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g,"-").toLowerCase() || "game") + "-stats.pdf";
  doc.save(filename);
}
