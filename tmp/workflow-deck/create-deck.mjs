import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'D:/OneDrive/projects/ministry-procurement-tracker/PTS_Procurement_Approval_Workflow.pptx';
const TMP = 'D:/OneDrive/projects/ministry-procurement-tracker/tmp/workflow-deck';
const LOGO = 'D:/OneDrive/projects/ministry-procurement-tracker/frontend/src/assets/ministry-logo.png';
const W = 1280, H = 720;
const C = { dark:'#063f35', deep:'#075246', teal:'#0f766e', mint:'#ecfdf7', line:'#b9eadb', gold:'#d6a72f', blue:'#2563eb', ink:'#0f172a', muted:'#64748b', canvas:'#f5f7fb', white:'#ffffff', red:'#b91c1c', redSoft:'#fff1f2', green:'#15803d', amber:'#b45309' };

async function bytes(path) { const b = await fs.readFile(path); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
function box(slide, x,y,w,h, fill=C.white, radius=true, line='none', name='box') {
  return slide.shapes.add({ geometry: radius?'roundRect':'rect', name, position:{left:x,top:y,width:w,height:h}, fill, line:{style:'solid',fill:line,width:line==='none'?0:1} });
}
function text(slide, value, x,y,w,h, size=20, color=C.ink, bold=false, align='left', name='text') {
  const s = slide.shapes.add({geometry:'textbox',name,position:{left:x,top:y,width:w,height:h},fill:'none',line:{style:'solid',fill:'none',width:0}});
  s.text=value; s.text.style={fontFamily:'Aptos',fontSize:size,color,bold,alignment:align,verticalAlignment:'middle'}; return s;
}
function rule(slide,x,y,w,color=C.gold,h=4){ box(slide,x,y,w,h,color,false,'none','rule'); }
function arrow(slide,x,y,w,h,color=C.line,dir='rightArrow'){ return slide.shapes.add({geometry:dir,position:{left:x,top:y,width:w,height:h},fill:color,line:{style:'solid',fill:'none',width:0}}); }
function circleStep(slide,n,x,y,fill=C.teal){ const c=box(slide,x,y,44,44,fill,true,'none',`step-${n}`); c.text=String(n); c.text.style={fontFamily:'Aptos',fontSize:20,bold:true,color:C.white,alignment:'center',verticalAlignment:'middle'}; return c; }
function header(slide, eyebrow, title, number){
  text(slide,eyebrow.toUpperCase(),72,34,700,24,13,C.teal,true,'left','eyebrow');
  text(slide,title,72,63,1050,54,36,C.ink,true,'left','slide-title');
  rule(slide,72,126,84,C.gold,5);
  text(slide,String(number).padStart(2,'0'),1162,42,46,28,14,C.muted,true,'right','page-number');
}
function footer(slide){ text(slide,'MoA Procurement Tracking System  •  Approval workflow',72,682,620,18,10,C.muted,false,'left','footer'); }
function notes(slide, lines){ slide.speakerNotes.textFrame.setText(`[Sources]\n${lines.map(x=>`- ${x}`).join('\n')}`); }
function labelChip(slide,value,x,y,w,fill=C.mint,color=C.deep){ const b=box(slide,x,y,w,30,fill,true,'none','label'); b.text=value; b.text.style={fontFamily:'Aptos',fontSize:12,bold:true,color,alignment:'center',verticalAlignment:'middle'}; }

const deck = Presentation.create({slideSize:{width:W,height:H}});
const logo = await bytes(LOGO);

// 1 — Title
{
  const s=deck.slides.add(); s.background.fill=C.dark;
  box(s,0,0,26,H,C.gold,false,'none','gold-edge');
  box(s,820,0,460,H,C.deep,false,'none','brand-field');
  for(let i=0;i<8;i++) box(s,900+i*42,110+i*34,310-i*42,3,'#138a7d',false,'none',`stripe-${i}`);
  s.images.add({blob:logo,contentType:'image/png',alt:'Ministry of Agriculture logo',fit:'contain',position:{left:74,top:62,width:150,height:90}});
  text(s,'PROCUREMENT GOVERNANCE',74,188,600,26,15,C.gold,true);
  text(s,'Approval workflow',74,232,660,72,56,C.white,true);
  text(s,'From procurement planning to final Ministry Management decision',74,320,630,78,25,'#d9f6ec',false);
  rule(s,74,430,110,C.gold,6);
  text(s,'Step-by-step operating guide',74,456,500,35,19,C.white,true);
  text(s,'Ministry of Agriculture  |  Procurement Tracking System',74,632,650,26,13,'#b9eadb',false);
  notes(s,[`Brand asset: ${LOGO}`,'Workflow source: user-approved PTS workflow and local application implementation, 12 August 2026.']);
}

// 2 — End-to-end map
{
  const s=deck.slides.add(); s.background.fill=C.canvas; header(s,'Executive view','One controlled chain moves every plan to a final decision',2);
  const xs=[74,300,526,752,978];
  for(let i=0;i<4;i++) arrow(s,xs[i]+164,293,70,40,i===3?C.gold:C.line);
  const stages=[
    ['01–03','PLAN','Officer','Prepare activities\nand submit'],
    ['04','SCREEN','Director','Approve, return\nor reject'],
    ['05–06','ENDORSE','5 members','Independent vote\n3 votes decide'],
    ['07–08','APPROVE','Management','Final approve\nor reject'],
    ['09–13','DELIVER','Officer','Contract, track\nand close'],
  ];
  stages.forEach((a,i)=>{
    box(s,xs[i],218,182,198,i===3?'#fff8e7':C.white,true,i===3?C.gold:C.line,`stage-${i}`);
    text(s,a[0],xs[i]+18,238,145,22,13,i===3?C.amber:C.teal,true);
    text(s,a[1],xs[i]+18,273,145,35,24,C.ink,true);
    text(s,a[2],xs[i]+18,320,145,22,14,C.deep,true);
    text(s,a[3],xs[i]+18,352,145,48,15,C.muted,false);
  });
  box(s,74,466,1088,116,C.dark,true,'none','control-band');
  text(s,'CONTROL PRINCIPLE',98,486,220,22,13,C.gold,true);
  text(s,'No purchase proceeds without an approved plan, documented decisions and traceable ownership.',98,518,980,40,24,C.white,true);
  footer(s); notes(s,['Workflow source: user-approved PTS workflow and local application implementation, 12 August 2026.']);
}

// 3 — Officer planning
{
  const s=deck.slides.add(); s.background.fill=C.white; header(s,'Steps 1–3','The Procurement Officer creates the auditable foundation',3);
  arrow(s,278,268,90,36,C.line); arrow(s,586,268,90,36,C.line);
  const items=[
    [1,'Select an assigned project','Only projects previously assigned to the requester are available.'],
    [2,'Build the procurement plan','Add activities, methods, estimates, funding and milestone dates.'],
    [3,'Submit a complete plan','Validation blocks submission when activities or planned dates are missing.'],
  ];
  const xs=[74,382,690];
  items.forEach((it,i)=>{ circleStep(s,it[0],xs[i],202,i===2?C.blue:C.teal); text(s,it[1],xs[i],260,240,56,24,C.ink,true); text(s,it[2],xs[i],326,248,90,17,C.muted,false); });
  box(s,976,190,230,238,C.mint,true,C.line,'quality-gate');
  text(s,'QUALITY GATE',998,215,184,22,13,C.teal,true);
  text(s,'Ready to submit?',998,252,184,36,26,C.deep,true);
  text(s,'✓ Assigned project\n✓ Procurement activity\n✓ Method and amount\n✓ All milestone dates',998,309,184,100,17,C.ink,false);
  box(s,74,478,1132,112,C.canvas,true,'none','principle');
  text(s,'Why this matters',98,496,210,25,16,C.teal,true);
  text(s,'Planning data becomes the single source for later purchase requests, approvals, contracts and performance tracking.',98,530,1038,42,22,C.ink,true);
  footer(s); notes(s,['Workflow source: PTS procurement plan validation and assigned-project rules in the local application.']);
}

// 4 — Director gate
{
  const s=deck.slides.add(); s.background.fill=C.canvas; header(s,'Step 4','The Director is the first formal decision gate',4);
  arrow(s,590,235,84,36,C.gold); arrow(s,590,342,84,36,C.line); arrow(s,590,449,84,36,'#fecaca');
  box(s,86,258,430,232,C.dark,true,'none','director-review');
  labelChip(s,'PROCUREMENT DIRECTOR',116,286,210,'#0f766e',C.white);
  text(s,'Review completeness, strategic fit and readiness for endorsement.',116,342,350,94,28,C.white,true);
  const outcomes=[
    ['APPROVE','Send to Endorsing Committee','Comment optional',C.mint,C.green],
    ['RETURN','Officer corrects and resubmits','Reason required','#fff8e7',C.amber],
    ['REJECT','Workflow stops at Director','Reason required',C.redSoft,C.red],
  ];
  outcomes.forEach((o,i)=>{const y=196+i*107; box(s,674,y,500,82,o[3],true,'none',`outcome-${i}`); text(s,o[0],696,y+15,112,24,15,o[4],true); text(s,o[1],826,y+10,320,28,20,C.ink,true); text(s,o[2],826,y+43,300,20,13,C.muted,false);});
  text(s,'Decision comments become part of the permanent approval history.',86,568,900,36,22,C.deep,true);
  footer(s); notes(s,['Workflow source: Director review rules implemented in the PTS backend.']);
}

// 5 — Endorsing Committee vote
{
  const s=deck.slides.add(); s.background.fill=C.white; header(s,'Steps 5–6','Five independent votes produce one Endorsing Committee outcome',5);
  for(let i=0;i<5;i++){ const x=112+i*155; box(s,x,205,78,78,i<3?C.teal:'#dbe4ea',true,'none',`member-${i}`); text(s,String(i+1),x,221,78,38,24,i<3?C.white:C.muted,true,'center'); text(s,'MEMBER',x-4,292,86,20,11,C.muted,true,'center'); }
  arrow(s,868,238,92,40,C.gold);
  box(s,972,190,232,140,C.dark,true,'none','threshold');
  text(s,'3 of 5',992,214,192,48,38,C.gold,true,'center');
  text(s,'votes determine\nthe outcome',992,268,192,48,17,C.white,true,'center');
  box(s,90,389,500,142,C.mint,true,C.line,'endorse');
  text(s,'3 APPROVAL VOTES',116,411,450,24,15,C.green,true);
  text(s,'Plan is endorsed and advances to Ministry Management approval.',116,449,430,58,23,C.ink,true);
  box(s,622,389,500,142,C.redSoft,true,'#fecaca','reject');
  text(s,'3 REJECTION VOTES',648,411,450,24,15,C.red,true);
  text(s,'Plan is rejected by the Endorsing Committee and does not advance.',648,449,430,58,23,C.ink,true);
  text(s,'Every member votes once. Individual decisions and comments remain traceable.',90,576,980,28,18,C.deep,true);
  footer(s); notes(s,['Workflow source: five-member Endorsing Committee and 3-vote thresholds implemented in the PTS backend.']);
}

// 6 — Management final decision
{
  const s=deck.slides.add(); s.background.fill=C.canvas; header(s,'Steps 7–8','Ministry Management makes the final institutional decision',6);
  box(s,74,181,1132,92,C.dark,true,'none','entry');
  text(s,'ENTRY CONDITION',102,200,190,22,13,C.gold,true);
  text(s,'The plan has secured at least three Endorsing Committee approvals.',302,198,840,40,25,C.white,true);
  arrow(s,350,309,54,48,C.line,'downArrow'); arrow(s,874,309,54,48,C.line,'downArrow');
  box(s,100,372,480,178,C.mint,true,C.line,'approve');
  text(s,'FINAL APPROVAL',128,396,420,25,15,C.green,true);
  text(s,'Comment is optional',128,436,420,38,28,C.ink,true);
  text(s,'Plan becomes Finally Approved and implementation may begin.',128,492,410,38,17,C.muted,false);
  box(s,700,372,480,178,C.redSoft,true,'#fecaca','reject');
  text(s,'FINAL REJECTION',728,396,420,25,15,C.red,true);
  text(s,'Reason is mandatory',728,436,420,38,28,C.ink,true);
  text(s,'The system blocks rejection until a reason is entered.',728,492,410,38,17,C.muted,false);
  labelChip(s,'SYSTEM-ENFORCED CONTROL',488,596,304,C.gold,C.dark);
  footer(s); notes(s,['Workflow source: Ministry Management approval and mandatory rejection-reason rules implemented in the PTS backend.']);
}

// 7 — Implementation and accountability
{
  const s=deck.slides.add(); s.background.fill=C.white; header(s,'Steps 9–13','Final approval converts the plan into controlled delivery',7);
  const steps=[['09','IMPLEMENT','Begin approved procurement'],['10','TRACK','Record milestone actuals'],['11','CONTRACT','Register supplier & contract'],['12','PAY','Record payments & delivery'],['13','CLOSE','Complete activity and plan']];
  const xs=[76,302,528,754,980];
  for(let i=0;i<4;i++) arrow(s,xs[i]+165,267,60,34,C.line);
  steps.forEach((a,i)=>{ text(s,a[0],xs[i],194,170,30,14,C.teal,true); rule(s,xs[i],233,52,i===4?C.gold:C.teal,5); text(s,a[1],xs[i],256,180,30,22,C.ink,true); text(s,a[2],xs[i],304,180,58,16,C.muted,false); });
  box(s,76,410,1128,146,C.dark,true,'none','closeout');
  text(s,'THE COMPLETE AUDIT TRAIL',104,434,430,24,14,C.gold,true);
  text(s,'Plan → Director decision → Committee votes → Management decision → Contract → Payment → Closure',104,474,1050,48,24,C.white,true);
  text(s,'Outcome: one traceable record from intent to delivery.',76,596,950,36,26,C.deep,true);
  footer(s); notes(s,['Workflow source: post-approval stage tracking, contract, payment and closure functions in the local PTS application.']);
}

await fs.mkdir(TMP,{recursive:true});
for (const [i,s] of deck.slides.items.entries()) {
  const png=await deck.export({slide:s,format:'png',scale:1});
  await fs.writeFile(`${TMP}/slide-${i+1}.png`,new Uint8Array(await png.arrayBuffer()));
  const layout=await s.export({format:'layout'});
  await fs.writeFile(`${TMP}/slide-${i+1}.layout.json`,await layout.text());
}
const montage=await deck.export({format:'webp',montage:true,scale:1});
await fs.writeFile(`${TMP}/montage.webp`,new Uint8Array(await montage.arrayBuffer()));
const pptx=await PresentationFile.exportPptx(deck); await pptx.save(OUT);
console.log(OUT);
