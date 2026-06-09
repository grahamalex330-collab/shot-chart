import { jsPDF } from "jspdf";

const OLD_ZONE_MAP = {"paint":"paint","ft-line":"paint","top-key":"paint","left-block":"2pt-left","left-elbow":"2pt-left","left-mid":"2pt-left","right-block":"2pt-right","right-elbow":"2pt-right","right-mid":"2pt-right","left-wing3":"3pt-left","left-corner3":"3pt-left","right-wing3":"3pt-right","right-corner3":"3pt-right","top3":"3pt-top"};
const THREE_PT = new Set(["3pt-left","3pt-right","3pt-top"]);
const ZONE_LABELS = {"paint":"Paint","2pt-left":"2PT Left","2pt-right":"2PT Right","3pt-left":"3PT Left","3pt-right":"3PT Right","3pt-top":"3PT Top"};
function mapZ(id) { return OLD_ZONE_MAP[id] || id; }
function pts(s) { if (s.result!=="make") return 0; if (s.isFT) return 1; return THREE_PT.has(mapZ(s.zone)) ? 3 : 2; }

export function exportGamePdf(game) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612; const M = 40; const CW = W - 2*M;
  let y = 40;
  const gray = [100,100,100]; const dark = [30,30,30]; const accent = [250,204,21]; const green = [34,197,94]; const red = [239,68,68]; const purple = [168,85,247]; const orange = [249,115,22]; const blue = [59,130,246]; const pink = [236,72,153];

  const shots = game.shots || []; const events = game.events || []; const players = (game.players || []).sort((a,b) => parseInt(a.number)-parseInt(b.number));
  const teamName = game.team_name || game.teamName || "Game";
  const date = game.created_at || game.createdAt || "";
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}); } catch(e) { return ""; }};

  const fg = shots.filter(s=>!s.isFT); const ft = shots.filter(s=>s.isFT);
  const fgm = fg.filter(s=>s.result==="make").length; const fgt = fg.length;
  const fgp = fgt>0?Math.round(fgm/fgt*100):0;
  const ftm = ft.filter(s=>s.result==="make").length; const ftt = ft.length;
  const ftp = ftt>0?Math.round(ftm/ftt*100):0;
  const p3 = fg.filter(s=>THREE_PT.has(mapZ(s.zone))); const p3m = p3.filter(s=>s.result==="make").length; const p3t = p3.length;
  const p3p = p3t>0?Math.round(p3m/p3t*100):0;
  const totalPts = shots.reduce((sum,s)=>sum+pts(s),0);
  const teamAst = events.filter(e=>e.type==="assist").length + shots.filter(s=>s.assistNum).length;
  const teamReb = events.filter(e=>e.type==="rebound").length;
  const teamStl = events.filter(e=>e.type==="steal").length;
  const teamBlk = events.filter(e=>e.type==="block").length;
  const teamFouls = events.filter(e=>e.type==="foul").length;
  const teamTO = events.filter(e=>e.type==="turnover").length;
  const oppFouls = events.filter(e=>e.type==="opp_foul").length;

  // ─── HEADER ───
  doc.setFontSize(22); doc.setTextColor(...dark); doc.setFont("helvetica","bold");
  doc.text(teamName.toUpperCase(), M, y); y += 18;
  doc.setFontSize(10); doc.setTextColor(...gray); doc.setFont("helvetica","normal");
  doc.text(fmtDate(date), M, y); y += 28;

  // ─── BIG SCORE ───
  doc.setFontSize(48); doc.setTextColor(...dark); doc.setFont("helvetica","bold");
  doc.text(String(totalPts), M, y);
  doc.setFontSize(11); doc.setTextColor(...gray); doc.setFont("helvetica","normal");
  doc.text("TOTAL POINTS", M + 70, y - 8); y += 16;

  // ─── SHOOTING LINE ───
  doc.setFontSize(12); doc.setTextColor(...dark); doc.setFont("helvetica","bold");
  const shootingLine = `FG: ${fgm}/${fgt} (${fgp}%)    3PT: ${p3m}/${p3t} (${p3p}%)    FT: ${ftm}/${ftt} (${ftp}%)`;
  doc.text(shootingLine, M, y); y += 20;

  // ─── TEAM STATS LINE ───
  doc.setFontSize(10); doc.setTextColor(...gray); doc.setFont("helvetica","normal");
  const statsLine = `AST: ${teamAst}    REB: ${teamReb}    STL: ${teamStl}    BLK: ${teamBlk}    FOULS: ${teamFouls}    TO: ${teamTO}` + (oppFouls > 0 ? `    OPP FOULS: ${oppFouls}` : "");
  doc.text(statsLine, M, y); y += 24;

  // ─── DIVIDER ───
  doc.setDrawColor(220,220,220); doc.setLineWidth(0.5);
  doc.line(M, y, W-M, y); y += 16;

  // ─── PLAYER BREAKDOWN ───
  if (players.length > 0) {
    doc.setFontSize(10); doc.setTextColor(...gray); doc.setFont("helvetica","bold");
    doc.text("PLAYER BREAKDOWN", M, y); y += 16;

    // Table header
    const cols = [M, M+30, M+100, M+140, M+180, M+225, M+265, M+305, M+340, M+375, M+410, M+445, M+480];
    const headers = ["#","NAME","PTS","FG","FG%","3PT","FT","AST","REB","STL","BLK","FLS","TO"];
    doc.setFontSize(8); doc.setTextColor(...gray); doc.setFont("helvetica","bold");
    headers.forEach((h,i) => doc.text(h, cols[i], y));
    y += 4;
    doc.setDrawColor(200,200,200); doc.line(M, y, W-M, y); y += 10;

    // Player rows
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    players.forEach(p => {
      const pS = shots.filter(s=>s.playerNum===p.number);
      const pFG = pS.filter(s=>!s.isFT); const pFT = pS.filter(s=>s.isFT);
      const pFGm = pFG.filter(s=>s.result==="make").length; const pFTm = pFT.filter(s=>s.result==="make").length;
      const pFGp = pFG.length>0?Math.round(pFGm/pFG.length*100)+"%":"—";
      const pp3 = pFG.filter(s=>THREE_PT.has(mapZ(s.zone))); const pp3m = pp3.filter(s=>s.result==="make").length;
      const pPts = pS.reduce((sum,s)=>sum+pts(s),0);
      const ast = events.filter(e=>e.type==="assist"&&e.playerNum===p.number).length + shots.filter(s=>s.assistNum===p.number).length;
      const reb = events.filter(e=>e.type==="rebound"&&e.playerNum===p.number).length;
      const stl = events.filter(e=>e.type==="steal"&&e.playerNum===p.number).length;
      const blk = events.filter(e=>e.type==="block"&&e.playerNum===p.number).length;
      const fouls = events.filter(e=>e.type==="foul"&&e.playerNum===p.number).length;
      const tos = events.filter(e=>e.type==="turnover"&&e.playerNum===p.number).length;

      doc.setTextColor(...dark);
      if (fouls >= 4) doc.setTextColor(...red);
      const row = [p.number, p.name, String(pPts), `${pFGm}/${pFG.length}`, pFGp, pp3.length>0?`${pp3m}/${pp3.length}`:"—", pFT.length>0?`${pFTm}/${pFT.length}`:"—", String(ast), String(reb), String(stl), String(blk), String(fouls), String(tos)];
      row.forEach((v,i) => doc.text(v, cols[i], y));
      doc.setTextColor(...dark);
      y += 14;

      if (y > 720) { doc.addPage(); y = 40; }
    });

    // Team totals row
    y += 2;
    doc.setDrawColor(200,200,200); doc.line(M, y-6, W-M, y-6);
    doc.setFont("helvetica","bold"); doc.setTextColor(...dark);
    const totRow = ["","TEAM", String(totalPts), `${fgm}/${fgt}`, fgt?fgp+"%":"—", p3t>0?`${p3m}/${p3t}`:"—", ftt>0?`${ftm}/${ftt}`:"—", String(teamAst), String(teamReb), String(teamStl), String(teamBlk), String(teamFouls), String(teamTO)];
    totRow.forEach((v,i) => doc.text(v, cols[i], y));
    y += 24;
  }

  // ─── ZONE BREAKDOWN ───
  if (y > 660) { doc.addPage(); y = 40; }
  doc.setDrawColor(220,220,220); doc.line(M, y, W-M, y); y += 16;
  doc.setFontSize(10); doc.setTextColor(...gray); doc.setFont("helvetica","bold");
  doc.text("ZONE BREAKDOWN", M, y); y += 16;

  const zoneIds = ["paint","2pt-left","2pt-right","3pt-left","3pt-right","3pt-top"];
  doc.setFont("helvetica","normal"); doc.setFontSize(9);
  zoneIds.forEach(zId => {
    const zShots = fg.filter(s => mapZ(s.zone) === zId);
    if (zShots.length === 0) return;
    const zm = zShots.filter(s=>s.result==="make").length;
    const zp = Math.round(zm/zShots.length*100);

    doc.setTextColor(...dark);
    doc.text(ZONE_LABELS[zId] || zId, M, y);
    doc.text(`${zm}/${zShots.length} (${zp}%)`, M + 100, y);

    // Mini bar
    const barX = M + 170; const barW = 150; const barH = 6;
    doc.setFillColor(235,235,235); doc.rect(barX, y-6, barW, barH, "F");
    const c = zp>=50?green:zp>=35?accent:red;
    doc.setFillColor(...c); doc.rect(barX, y-6, barW*(zp/100), barH, "F");
    y += 16;
  });

  // ─── OPP FOULS ───
  if (oppFouls > 0) {
    y += 8;
    if (y > 700) { doc.addPage(); y = 40; }
    doc.setDrawColor(220,220,220); doc.line(M, y, W-M, y); y += 16;
    doc.setFontSize(10); doc.setTextColor(...red); doc.setFont("helvetica","bold");
    doc.text(`OPPONENT FOULS (${oppFouls})`, M, y); y += 14;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...dark);
    const oppMap = {};
    events.filter(e=>e.type==="opp_foul").forEach(e=>{oppMap[e.playerNum]=(oppMap[e.playerNum]||0)+1;});
    Object.entries(oppMap).sort((a,b)=>b[1]-a[1]).forEach(([num,count]) => {
      doc.text(`#${num}: ${count} foul${count!==1?"s":""}`, M, y); y += 12;
    });
  }

  // ─── FOOTER ───
  y = 750;
  doc.setFontSize(8); doc.setTextColor(180,180,180); doc.setFont("helvetica","normal");
  doc.text("Generated by Shot Chart", M, y);
  doc.text(new Date().toLocaleDateString(), W-M-60, y);

  // Save
  const filename = (teamName.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g,"-").toLowerCase() || "game") + "-stats.pdf";
  doc.save(filename);
}
