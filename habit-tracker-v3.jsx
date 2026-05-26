import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as d3 from "d3";

const STORAGE_KEY = "habit-tracker-v3";
const C = {
  bg: "#0d1117", surface: "#161b22", surfaceLight: "#1c2128",
  border: "#30363d", borderLight: "#484f58",
  text: "#e6edf3", muted: "#8b949e", dim: "#484f58",
  accent: "#58a6ff", accentDim: "rgba(88,166,255,0.12)",
  danger: "#f85149", success: "#39d353", successDim: "rgba(57,211,83,0.12)", green4: "#39d353",
};
const PALETTES = [
  { name: "Green", shades: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] },
  { name: "Blue", shades: ["#161b22", "#0a3069", "#0550ae", "#1f6feb", "#58a6ff"] },
  { name: "Purple", shades: ["#161b22", "#3b1f63", "#6639ba", "#8957e5", "#bc8cff"] },
  { name: "Orange", shades: ["#161b22", "#5a2d0c", "#9b4215", "#d29922", "#e3b341"] },
  { name: "Pink", shades: ["#161b22", "#5e103e", "#bf3989", "#db61a2", "#f778ba"] },
  { name: "Red", shades: ["#161b22", "#67060c", "#bd561d", "#da3633", "#f85149"] },
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WK_FULL = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const F = "'JetBrains Mono', monospace";
const D3E = d3.easeCubicInOut;
const BUILTIN_UNITS = [
  { id: "min", label: "Minutes", quickAdd: [15,30,60], thresholds: [15,30,60] },
  { id: "reps", label: "Reps", quickAdd: [5,10,25], thresholds: [10,25,50] },
  { id: "count", label: "Count", quickAdd: [1,5,10], thresholds: [1,3,5] },
];
function getUnit(id,units){return units.find(u=>u.id===id)||{id,label:id,quickAdd:[1,5,10],thresholds:[1,3,5]};}
const EMOJIS = ["\uD83C\uDFAF","\uD83D\uDCAA","\uD83D\uDCDA","\uD83E\uDDD8","\uD83C\uDFC3","\uD83D\uDCA7","\uD83C\uDFA8","\u270D\uFE0F","\uD83C\uDFB5","\uD83D\uDCA4","\uD83C\uDF4E","\uD83E\uDDE0","\uD83C\uDF31","\u26A1","\uD83D\uDD25","\uD83C\uDFCB\uFE0F"];
const CSS = `
@keyframes fadeSlideLeft{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
@keyframes fadeSlideRight{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes backdropIn{from{opacity:0;backdrop-filter:blur(0)}to{opacity:1;backdrop-filter:blur(4px)}}
@keyframes dateShiftLeft{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes dateShiftRight{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
@keyframes pulseGlow{0%,100%{box-shadow:0 0 8px rgba(57,211,83,.3)}50%{box-shadow:0 0 20px rgba(57,211,83,.6)}}
.stagger-child{animation:fadeUp .7s cubic-bezier(.16,1,.3,1) both}
.panel-slide-left{animation:fadeSlideLeft .65s cubic-bezier(.16,1,.3,1) both}
.panel-slide-right{animation:fadeSlideRight .65s cubic-bezier(.16,1,.3,1) both}
.modal-backdrop{animation:backdropIn .4s ease both}
.modal-content{animation:scaleIn .5s cubic-bezier(.16,1,.3,1) both}
.date-shift-left{animation:dateShiftLeft .45s cubic-bezier(.16,1,.3,1) both}
.date-shift-right{animation:dateShiftRight .45s cubic-bezier(.16,1,.3,1) both}
.save-pulse{animation:pulseGlow 1s ease}
`;
const inpS={width:"100%",padding:"10px 12px",borderRadius:6,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:14,fontFamily:F,outline:"none",boxSizing:"border-box"};
const lbl={display:"block",fontSize:11,color:C.muted,fontFamily:F,marginBottom:6,textTransform:"uppercase",letterSpacing:".08em"};

/* ─── Helpers ─── */
function dk(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function todayK(){return dk(new Date());}
function fmtVal(v,unit){if(!v||v<=0)return"\u2014";if(unit==="min"){if(v<60)return`${v}m`;const h=Math.floor(v/60),r=v%60;return r>0?`${h}h ${r}m`:`${h}h`;}return`${v} ${unit}`;}
function getQuickAdd(uid,units){return getUnit(uid,units).quickAdd;}

/* Sets helpers */
function isSetMetric(m){return m.mode==="sets";}
function setsVolume(sets){if(!Array.isArray(sets)||!sets.length)return 0;return sets.reduce((s,st)=>s+(st.w||0)*(st.r||0),0);}
function setsTotalReps(sets){if(!Array.isArray(sets))return 0;return sets.reduce((s,st)=>s+(st.r||0),0);}
function setsMaxWeight(sets){if(!Array.isArray(sets)||!sets.length)return 0;return Math.max(...sets.map(st=>st.w||0));}
function metricVal(m,log){
  if(!log)return 0;
  const v=log[m.id];
  if(isSetMetric(m))return setsVolume(v);
  return v||0;
}
function metricActive(m,log){
  if(!log)return false;
  const v=log[m.id];
  if(isSetMetric(m))return Array.isArray(v)&&v.length>0;
  return(v||0)>0;
}
function fmtSets(sets,wUnit){
  if(!Array.isArray(sets)||!sets.length)return"\u2014";
  return`${sets.length} set${sets.length!==1?"s":""} \u00B7 ${setsVolume(sets).toLocaleString()} ${wUnit||"lbs"} vol`;
}
function findLastWeight(logs,metricId){
  // Search recent dates for the most recent set entry with this metric
  const today=new Date();
  for(let i=0;i<=90;i++){
    const d=new Date(today);d.setDate(d.getDate()-i);
    const dayLog=logs[dk(d)];
    if(dayLog&&Array.isArray(dayLog[metricId])&&dayLog[metricId].length>0){
      return dayLog[metricId][dayLog[metricId].length-1].w;
    }
  }
  return null;
}

function logLevel(habit,log,units){
  if(!log)return 0;const ms=habit.metrics||[];if(!ms.length)return 0;
  if(habit.intensityMode==="coverage"){
    const done=ms.filter(m=>metricActive(m,log)).length;const p=done/ms.length;
    if(p<=0)return 0;if(p<.25)return 1;if(p<.5)return 2;if(p<1)return 3;return 4;
  }
  const total=ms.reduce((s,m)=>s+metricVal(m,log),0);if(total<=0)return 0;
  const thr=habit.thresholds||getUnit(ms[0]?.unit||"count",units).thresholds;
  if(total<thr[0])return 1;if(total<thr[1])return 2;if(total<thr[2])return 3;return 4;
}
function logActive(h,log,u){return logLevel(h,log,u)>0;}
function logSummary(h,log){
  if(!log)return"No entry";const ms=h.metrics||[];
  const parts=ms.filter(m=>metricActive(m,log)).map(m=>{
    if(isSetMetric(m))return`${m.name}: ${fmtSets(log[m.id],m.weightUnit)}`;
    return`${m.name}: ${fmtVal(log[m.id],m.unit)}`;
  });
  return parts.length?parts.join(", "):"No entry";
}
function habitStats(h,logs,u){const es=Object.entries(logs||{});let td=0,tv=0;const ms=h.metrics||[];
  es.forEach(([,l])=>{if(logActive(h,l,u))td++;tv+=ms.reduce((s,m)=>s+metricVal(m,l),0);});
  let cs2=0;const t=new Date();for(let i=0;i<=365;i++){const d=new Date(t);d.setDate(d.getDate()-i);if(logActive(h,logs[dk(d)],u))cs2++;else break;}
  let ls=0,cc=0;for(let i=364;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);if(logActive(h,logs[dk(d)],u)){cc++;ls=Math.max(ls,cc);}else cc=0;}
  return{totalDays:td,totalVal:tv,curStreak:cs2,lonStreak:ls};}

/* ─── d3 Layouts ─── */
function getRecentDays(numMonths,monthOffset){
  const now=new Date(),off=monthOffset||0;
  const endMonth=new Date(now.getFullYear(),now.getMonth()+off+1,0);
  const startMonth=new Date(endMonth.getFullYear(),endMonth.getMonth()-(numMonths-1),1);
  const days=[];let d=new Date(startMonth);
  while(d<=endMonth){days.push(new Date(d));d.setDate(d.getDate()+1);}
  return days;
}
function countHeatCols(days,mg){
  let cols=1,curM=-1;
  const continuous=mg===0;
  for(let i=0;i<days.length;i++){
    const day=days[i],m=day.getMonth();
    let dow=day.getDay();dow=dow===0?6:dow-1;
    if(!continuous&&m!==curM){if(curM!==-1)cols++;curM=m;}
    else if(continuous)curM=m;
    const next=days[i+1];
    if(next){
      let nd=next.getDay();nd=nd===0?6:nd-1;
      const sameBlock=continuous||next.getMonth()===curM;
      if(sameBlock&&nd<=dow)cols++;
      if(!continuous&&next.getMonth()!==curM){}/* new col handled above */
    }
  }
  return cols;
}
function countMonthBlocks(days){let c=0,pm=-1;for(const d of days){const m=d.getMonth();if(m!==pm){c++;pm=m;}}return c;}
function fitCellSize(days,cw,view,cg,lp,mg){
  const avail=cw-2*lp;
  if(view==="heatmap"){
    const cols=countHeatCols(days,mg);
    const nGaps=mg>0?countMonthBlocks(days)-1:0;
    const usable=avail-nGaps*mg-(cols-1)*cg;
    return Math.max(6,Math.min(20,usable/cols));
  } else {
    const nM=countMonthBlocks(days);
    const usable=avail-(nM-1)*mg-nM*6*cg;
    return Math.max(6,Math.min(20,usable/(7*nM)));
  }
}
function compactHeatLayout(days,cs,cg,lp,tp,monthGap){
  const cells=[],mLabels=[],tk=todayK();
  const continuous=monthGap===0;
  let curX=lp,curM=-1;
  for(let i=0;i<days.length;i++){
    const day=days[i],key=dk(day),m=day.getMonth(),y=day.getFullYear();
    let dow=day.getDay();dow=dow===0?6:dow-1;
    if(m!==curM){
      if(curM!==-1&&!continuous)curX+=cs+cg+monthGap;
      mLabels.push({key:`hm-${m}-${y}`,label:MONTHS[m],x:curX,y:tp-10});
      curM=m;
    }
    const future=key>tk;
    cells.push({key,date:day,x:curX,y:tp+dow*(cs+cg),w:cs,h:cs,r:2,vis:true,future});
    const next=days[i+1];
    if(next){
      let nd=next.getDay();nd=nd===0?6:nd-1;
      const sameBlock=continuous||next.getMonth()===curM;
      if(sameBlock&&nd<=dow)curX+=cs+cg;
      if(!continuous&&next.getMonth()!==curM){}/* handled above on next iteration */
    }
  }
  return{cells,mLabels};
}
function compactCalLayout(days,cs,cg,lp,tp,monthGap){
  const cells=[],mLabels=[],tk=todayK();
  const months=[];let curM2=-1,curG=null;
  for(const day of days){const m=day.getMonth();if(m!==curM2){curG={month:m,year:day.getFullYear(),days:[]};months.push(curG);curM2=m;}curG.days.push(day);}
  let bx=lp;
  for(const mo of months){
    const first=mo.days[0];let sd=first.getDay();sd=sd===0?6:sd-1;
    const bw=7*(cs+cg)-cg;
    mLabels.push({key:`hm-${mo.month}-${mo.year}`,label:MONTHS[mo.month],x:bx+bw/2,y:tp-10,anchor:"middle"});
    for(const day of mo.days){
      const key=dk(day);let dow=day.getDay();dow=dow===0?6:dow-1;
      const dom=day.getDate(),wk=Math.floor((sd+dom-1)/7);
      const future=key>tk;
      cells.push({key,date:day,x:bx+dow*(cs+cg),y:tp+wk*(cs+cg),w:cs,h:cs,r:2,vis:true,future});
    }
    bx+=bw+monthGap;
  }
  return{cells,mLabels};
}

const STG=100;
function StaggeredList({children,keyProp}){return(<div key={keyProp}>{Array.isArray(children)?children.map((ch,i)=>(<div key={ch?.key||i} className="stagger-child" style={{animationDelay:`${i*STG}ms`}}>{ch}</div>)):<div className="stagger-child">{children}</div>}</div>);}

/* Shared modal shell */
function ModalShell({onClose,closing,children,width}){
  return(<div className="modal-backdrop" onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)",opacity:closing?0:undefined,transition:closing?"opacity .35s ease":undefined}}>
    <div className="modal-content" onClick={e=>e.stopPropagation()} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:28,width:width||480,maxWidth:"92vw",maxHeight:"88vh",overflowY:"auto",transform:closing?"scale(.95) translateY(8px)":undefined,opacity:closing?0:undefined,transition:closing?"all .35s ease":undefined}}>{children}</div></div>);
}

/* ═══════════════════════════════════════════════
   HABIT FORM FIELDS (shared between Add/Edit)
   ═══════════════════════════════════════════════ */
function HabitFormFields({name,setName,emoji,setEmoji,description,setDescription,color,setColor,metrics,setMetrics,intensityMode,setIntensityMode,units,onAddUnit}){
  const [newMN,setNewMN]=useState("");
  const [newMU,setNewMU]=useState("reps");
  const [newMode,setNewMode]=useState("normal"); // "normal" | "sets"
  const [newWU,setNewWU]=useState("lbs");
  const [showCU,setShowCU]=useState(false);
  const [cuId,setCuId]=useState("");
  const [cuLbl,setCuLbl]=useState("");
  const [cuQA,setCuQA]=useState("1, 5, 10");
  const [cuThr,setCuThr]=useState("1, 3, 5");

  const addMetric=()=>{if(newMN.trim()){
    const m={id:`m_${Date.now()}`,name:newMN.trim(),unit:newMU};
    if(newMode==="sets"){m.mode="sets";m.weightUnit=newWU;}
    setMetrics(p=>[...p,m]);setNewMN("");setNewMode("normal");
  }};
  const rmMetric=id=>setMetrics(p=>p.filter(m=>m.id!==id));
  const parseNums=s=>s.split(",").map(v=>parseInt(v.trim(),10)).filter(v=>!isNaN(v)&&v>0);
  const addCU=()=>{const id=cuId.trim().toLowerCase().replace(/\s+/g,"_"),l2=cuLbl.trim(),qa=parseNums(cuQA),thr=parseNums(cuThr);if(id&&l2&&qa.length>=1&&thr.length>=1){onAddUnit({id,label:l2,quickAdd:qa.slice(0,3),thresholds:thr.slice(0,3)});setNewMU(id);setShowCU(false);setCuId("");setCuLbl("");setCuQA("1, 5, 10");setCuThr("1, 3, 5");}};

  useEffect(()=>{if(metrics.length>1&&intensityMode==="total"){const u=new Set(metrics.map(m=>m.unit));if(u.size>1)setIntensityMode("coverage");}},[metrics,intensityMode,setIntensityMode]);

  return(<>
    <div style={{marginBottom:16}}><label style={lbl}>Icon</label><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{EMOJIS.map(e=>(<button key={e} onClick={()=>setEmoji(e)} style={{width:36,height:36,borderRadius:6,border:`1.5px solid ${emoji===e?C.accent:C.border}`,background:emoji===e?C.accentDim:C.bg,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>{e}</button>))}</div></div>
    <div style={{marginBottom:16}}><label style={lbl}>Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Morning Workout, Reading" style={inpS}/></div>
    <div style={{marginBottom:16}}><label style={lbl}>Description (optional)</label><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short note" style={inpS}/></div>
    <div style={{marginBottom:20}}><label style={lbl}>Color</label><div style={{display:"flex",gap:8}}>{PALETTES.map(c=>(<button key={c.name} onClick={()=>setColor(c.name)} style={{width:32,height:32,borderRadius:6,background:c.shades[3],border:`2px solid ${color===c.name?"#fff":"transparent"}`,cursor:"pointer",transition:"all .25s",transform:color===c.name?"scale(1.2)":"scale(1)"}}/>))}</div></div>

    {/* Metrics */}
    <div style={{marginBottom:16}}>
      <label style={lbl}>What do you measure?</label>
      {metrics.length===0&&(
        <div style={{padding:"16px 12px",borderRadius:6,border:`1px dashed ${C.border}`,background:C.bg,textAlign:"center",marginBottom:8}}>
          <div style={{fontSize:11,color:C.muted,fontFamily:F}}>No metrics yet — add at least one to create this habit</div>
        </div>
      )}
      {metrics.map(m=>(<div key={m.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"8px 12px",borderRadius:6,background:C.bg,border:`1px solid ${C.border}`}}>
        <span style={{flex:1,fontSize:13,color:C.text,fontFamily:F}}>{m.name}</span>
        {m.mode==="sets"&&<span style={{fontSize:9,color:C.accent,fontFamily:F,padding:"2px 6px",borderRadius:3,background:C.accentDim,fontWeight:600}}>SETS · {m.weightUnit||"lbs"}</span>}
        <span style={{fontSize:10,color:C.dim,fontFamily:F,padding:"2px 8px",borderRadius:3,background:C.surface}}>{getUnit(m.unit,units).label}</span>
        <button onClick={()=>rmMetric(m.id)} style={{width:22,height:22,borderRadius:4,border:"none",background:"transparent",color:C.dim,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}} onMouseEnter={e=>e.currentTarget.style.color=C.danger} onMouseLeave={e=>e.currentTarget.style.color=C.dim}>×</button>
      </div>))}
      <div style={{display:"flex",gap:6,marginTop:8}}>
        <input value={newMN} onChange={e=>setNewMN(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMetric()} placeholder="Metric name (e.g. Bench Press, Squats)" style={{...inpS,fontSize:13,flex:1}}/>
        <select value={newMU} onChange={e=>{if(e.target.value==="__custom__")setShowCU(true);else setNewMU(e.target.value);}} style={{...inpS,width:100,fontSize:12,cursor:"pointer"}}>
          {units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}
          <option value="__custom__">+ Custom...</option>
        </select>
        <button onClick={addMetric} style={{padding:"8px 14px",borderRadius:6,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,cursor:"pointer",fontSize:12,fontFamily:F,whiteSpace:"nowrap"}}>+ Add</button>
      </div>
      {/* Sets mode toggle */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
        <button onClick={()=>setNewMode(p=>p==="sets"?"normal":"sets")} style={{
          padding:"5px 12px",borderRadius:5,fontSize:10,fontFamily:F,fontWeight:600,cursor:"pointer",
          border:`1px solid ${newMode==="sets"?C.accent:C.border}`,
          background:newMode==="sets"?C.accentDim:"transparent",
          color:newMode==="sets"?C.accent:C.muted,transition:"all .2s",
        }}>{newMode==="sets"?"◼ Sets mode ON":"○ Enable sets mode"}</button>
        {newMode==="sets"&&(
          <select value={newWU} onChange={e=>setNewWU(e.target.value)} style={{...inpS,width:80,fontSize:11,padding:"5px 8px",cursor:"pointer"}}>
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>
        )}
        {newMode==="sets"&&<span style={{fontSize:9,color:C.dim,fontFamily:F}}>Log weight × reps per set</span>}
      </div>
      {showCU&&(<div style={{marginTop:10,padding:"14px 16px",borderRadius:8,border:`1px solid ${C.accent}`,background:C.accentDim,animation:"fadeIn .3s ease"}}>
        <div style={{fontSize:11,color:C.accent,fontFamily:F,fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>New Unit</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}><div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:4}}>ID</div><input value={cuId} onChange={e=>setCuId(e.target.value)} placeholder="lbs" style={{...inpS,fontSize:12}}/></div><div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:4}}>Label</div><input value={cuLbl} onChange={e=>setCuLbl(e.target.value)} placeholder="Pounds" style={{...inpS,fontSize:12}}/></div></div>
        <div style={{display:"flex",gap:8,marginBottom:10}}><div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:4}}>Quick-add</div><input value={cuQA} onChange={e=>setCuQA(e.target.value)} style={{...inpS,fontSize:12}}/></div><div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:4}}>Thresholds</div><input value={cuThr} onChange={e=>setCuThr(e.target.value)} style={{...inpS,fontSize:12}}/></div></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={()=>setShowCU(false)} style={{padding:"6px 14px",borderRadius:5,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:11,fontFamily:F}}>Cancel</button><button onClick={addCU} style={{padding:"6px 14px",borderRadius:5,border:"none",background:C.accent,color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:F}}>Add Unit</button></div>
      </div>)}
      <div style={{fontSize:10,color:metrics.length===0?C.accent:C.dim,fontFamily:F,marginTop:6}}>{metrics.length===0?"Add a metric name and unit, then click + Add":metrics.length===1?"Single metric = simple tracker. Add more for compound habits.":`${metrics.length} metrics configured.`}</div>
    </div>

    {metrics.length>1&&(<div style={{marginBottom:20}}>
      <label style={lbl}>Intensity based on</label>
      <div style={{display:"flex",gap:6}}>{[{id:"total",l:"Sum total",d:"Higher combined value = brighter"},{id:"coverage",l:"Coverage",d:"More metrics completed = brighter"}].map(m=>(
        <button key={m.id} onClick={()=>setIntensityMode(m.id)} style={{flex:1,padding:"10px 12px",borderRadius:6,border:`1.5px solid ${intensityMode===m.id?C.accent:C.border}`,background:intensityMode===m.id?C.accentDim:C.bg,cursor:"pointer",textAlign:"left",transition:"all .2s"}}>
          <div style={{fontSize:12,fontWeight:600,color:intensityMode===m.id?C.text:C.muted,fontFamily:F}}>{m.l}</div>
          <div style={{fontSize:10,color:C.dim,fontFamily:F,marginTop:2}}>{m.d}</div>
        </button>))}</div>
    </div>)}
  </>);
}

/* ═══════════════════════════════════════════════
   ADD HABIT MODAL
   ═══════════════════════════════════════════════ */
function AddHabitModal({onAdd,onClose,units,onAddUnit}){
  const [name,setName]=useState(""); const [emoji,setEmoji]=useState("\uD83C\uDFAF"); const [desc,setDesc]=useState(""); const [color,setColor]=useState("Green");
  const [metrics,setMetrics]=useState([]); const [intMode,setIntMode]=useState("total"); const [closing,setClosing]=useState(false);
  const hClose=()=>{setClosing(true);setTimeout(onClose,350);};
  const canCreate=name.trim()&&metrics.length>0;
  return(<ModalShell onClose={hClose} closing={closing}>
    <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:600,color:C.text,fontFamily:F}}>New Habit</h2>
    <HabitFormFields name={name} setName={setName} emoji={emoji} setEmoji={setEmoji} description={desc} setDescription={setDesc} color={color} setColor={setColor} metrics={metrics} setMetrics={setMetrics} intensityMode={intMode} setIntensityMode={setIntMode} units={units} onAddUnit={onAddUnit}/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <button onClick={hClose} style={{padding:"8px 18px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:F}}>Cancel</button>
      <button onClick={()=>{if(canCreate){onAdd({name:name.trim(),emoji,description:desc.trim(),color,metrics,intensityMode:intMode});hClose();}}} style={{padding:"8px 18px",borderRadius:6,border:"none",background:canCreate?C.accent:C.borderLight,color:canCreate?"#fff":C.dim,cursor:canCreate?"pointer":"not-allowed",fontSize:13,fontWeight:600,fontFamily:F,transition:"all .2s"}}>Create</button>
    </div>
  </ModalShell>);
}

/* ═══════════════════════════════════════════════
   EDIT HABIT MODAL
   ═══════════════════════════════════════════════ */
function EditHabitModal({habit,onSave,onDelete,onClose,units,onAddUnit}){
  const [name,setName]=useState(habit.name); const [emoji,setEmoji]=useState(habit.emoji); const [desc,setDesc]=useState(habit.description||""); const [color,setColor]=useState(habit.color);
  const [metrics,setMetrics]=useState([...(habit.metrics||[])]); const [intMode,setIntMode]=useState(habit.intensityMode||"total"); const [closing,setClosing]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const hClose=()=>{setClosing(true);setTimeout(onClose,350);};
  const canSave=name.trim()&&metrics.length>0;
  const handleDelete=()=>{if(onDelete){setClosing(true);setTimeout(()=>onDelete(habit.id),350);}};
  return(<ModalShell onClose={hClose} closing={closing}>
    <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:600,color:C.text,fontFamily:F}}>Edit Habit</h2>
    <HabitFormFields name={name} setName={setName} emoji={emoji} setEmoji={setEmoji} description={desc} setDescription={setDesc} color={color} setColor={setColor} metrics={metrics} setMetrics={setMetrics} intensityMode={intMode} setIntensityMode={setIntMode} units={units} onAddUnit={onAddUnit}/>

    {/* Danger zone */}
    <div style={{marginBottom:20,padding:"14px 16px",borderRadius:8,border:`1px solid ${confirmDelete?C.danger:C.border}`,background:confirmDelete?"rgba(248,81,73,0.06)":C.bg,transition:"all .2s"}}>
      {confirmDelete?(<div>
        <div style={{fontSize:13,color:C.danger,fontFamily:F,fontWeight:600,marginBottom:8}}>Delete "{habit.name}"?</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:F,marginBottom:12}}>This will permanently remove the habit and all its logged data. This cannot be undone.</div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>setConfirmDelete(false)} style={{padding:"6px 14px",borderRadius:5,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:11,fontFamily:F}}>Keep it</button>
          <button onClick={handleDelete} style={{padding:"6px 14px",borderRadius:5,border:"none",background:C.danger,color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:F}}>Delete Habit</button>
        </div>
      </div>):(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:C.dim,fontFamily:F}}>Remove this habit and all data</span>
        <button onClick={()=>setConfirmDelete(true)} style={{padding:"5px 12px",borderRadius:5,border:`1px solid ${C.border}`,background:"transparent",color:C.danger,cursor:"pointer",fontSize:11,fontFamily:F,fontWeight:500,transition:"all .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=C.danger;e.currentTarget.style.background="rgba(248,81,73,0.08)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="transparent";}}>Delete habit</button>
      </div>)}
    </div>

    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <button onClick={hClose} style={{padding:"8px 18px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:F}}>Cancel</button>
      <button onClick={()=>{if(canSave){onSave({...habit,name:name.trim(),emoji,description:desc.trim(),color,metrics,intensityMode:intMode});hClose();}}} style={{padding:"8px 18px",borderRadius:6,border:"none",background:canSave?C.accent:C.borderLight,color:canSave?"#fff":C.dim,cursor:canSave?"pointer":"not-allowed",fontSize:13,fontWeight:600,fontFamily:F,transition:"all .2s"}}>Save</button>
    </div>
  </ModalShell>);
}

/* ═══════════════════════════════════════════════
   UNITS MANAGEMENT MODAL
   ═══════════════════════════════════════════════ */
function SettingsModal({units,habits,onUpdateUnit,onDeleteUnit,onAddUnit,appConfig,onUpdateConfig,onClose}){
  const cfg=appConfig||DEFAULT_CONFIG;
  const [closing,setClosing]=useState(false);
  const [editId,setEditId]=useState(null);
  const [eLabel,setELabel]=useState("");
  const [eQA,setEQA]=useState("");
  const [eThr,setEThr]=useState("");
  const [newId,setNewId]=useState("");
  const [newLabel,setNewLabel]=useState("");
  const [newQA,setNewQA]=useState("1, 5, 10");
  const [newThr,setNewThr]=useState("1, 3, 5");

  const hClose=()=>{setClosing(true);setTimeout(onClose,350);};
  const parseNums=s=>s.split(",").map(v=>parseInt(v.trim(),10)).filter(v=>!isNaN(v)&&v>0);

  const usedUnits=useMemo(()=>{const s=new Set();habits.forEach(h=>(h.metrics||[]).forEach(m=>s.add(m.unit)));return s;},[habits]);
  const builtinIds=new Set(BUILTIN_UNITS.map(u=>u.id));

  const startEdit=(u)=>{setEditId(u.id);setELabel(u.label);setEQA(u.quickAdd.join(", "));setEThr(u.thresholds.join(", "));};
  const saveEdit=()=>{const qa=parseNums(eQA),thr=parseNums(eThr);if(eLabel.trim()&&qa.length&&thr.length){onUpdateUnit(editId,{label:eLabel.trim(),quickAdd:qa.slice(0,3),thresholds:thr.slice(0,3)});setEditId(null);}};
  const addNew=()=>{const id=newId.trim().toLowerCase().replace(/\s+/g,"_");if(id&&newLabel.trim()&&!units.find(u=>u.id===id)){const qa=parseNums(newQA),thr=parseNums(newThr);if(qa.length&&thr.length){onAddUnit({id,label:newLabel.trim(),quickAdd:qa.slice(0,3),thresholds:thr.slice(0,3)});setNewId("");setNewLabel("");setNewQA("1, 5, 10");setNewThr("1, 3, 5");}}};

  return(<ModalShell onClose={hClose} closing={closing} width={520}>
    <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:600,color:C.text,fontFamily:F}}>Settings</h2>

    {/* ── App Config ── */}
    <div style={{marginBottom:20}}>
      <div style={{fontSize:11,color:C.accent,fontFamily:F,fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Calendar Display</div>
      <div style={{padding:"12px 14px",borderRadius:8,border:`1px solid ${C.border}`,background:C.bg}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.text,fontFamily:F}}>Months to display</div>
            <div style={{fontSize:9,color:C.dim,fontFamily:F,marginTop:2}}>Number of months shown in the heatmap view</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>{const v=Math.max(2,cfg.numMonths-1);onUpdateConfig({...cfg,numMonths:v});}} style={{width:24,height:24,borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:C.muted,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,transition:"all .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>-</button>
            <span style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:F,minWidth:24,textAlign:"center"}}>{cfg.numMonths}</span>
            <button onClick={()=>{const v=Math.min(12,cfg.numMonths+1);onUpdateConfig({...cfg,numMonths:v});}} style={{width:24,height:24,borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:C.muted,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,transition:"all .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>+</button>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.text,fontFamily:F}}>Month spacing</div>
            <div style={{fontSize:9,color:C.dim,fontFamily:F,marginTop:2}}>Gap between month blocks in heatmap (px)</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            {[0,3,5,8,12].map(v=>(
              <button key={v} onClick={()=>onUpdateConfig({...cfg,monthGap:v})} style={{
                padding:"4px 8px",borderRadius:4,fontSize:10,fontFamily:F,fontWeight:600,cursor:"pointer",
                border:`1px solid ${cfg.monthGap===v?C.accent:C.border}`,
                background:cfg.monthGap===v?C.accentDim:C.surface,
                color:cfg.monthGap===v?C.accent:C.muted,
                transition:"all .15s",
              }}>{v}</button>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* ── Units ── */}
    <div style={{fontSize:11,color:C.accent,fontFamily:F,fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Units</div>
    <div style={{marginBottom:20}}>
      {units.map(u=>{
        const inUse=usedUnits.has(u.id);const isBuiltin=builtinIds.has(u.id);const isEditing=editId===u.id;
        return(<div key={u.id} style={{marginBottom:6,borderRadius:8,border:`1px solid ${isEditing?C.accent:C.border}`,background:isEditing?C.accentDim:C.bg,padding:"10px 14px",transition:"all .2s"}}>
          {isEditing?(<div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:3}}>Label</div><input value={eLabel} onChange={e=>setELabel(e.target.value)} style={{...inpS,fontSize:12}}/></div>
              <div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:3}}>Quick-add</div><input value={eQA} onChange={e=>setEQA(e.target.value)} style={{...inpS,fontSize:12}}/></div>
              <div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:3}}>Thresholds</div><input value={eThr} onChange={e=>setEThr(e.target.value)} style={{...inpS,fontSize:12}}/></div>
            </div>
            <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
              <button onClick={()=>setEditId(null)} style={{padding:"5px 12px",borderRadius:4,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:11,fontFamily:F}}>Cancel</button>
              <button onClick={saveEdit} style={{padding:"5px 12px",borderRadius:4,border:"none",background:C.accent,color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:F}}>Save</button>
            </div>
          </div>):(<div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,fontWeight:600,color:C.text,fontFamily:F,minWidth:80}}>{u.label}</span>
            <span style={{fontSize:10,color:C.dim,fontFamily:F,background:C.surface,padding:"2px 8px",borderRadius:3}}>{u.id}</span>
            <span style={{fontSize:10,color:C.dim,fontFamily:F}}>+{u.quickAdd.join("/")}</span>
            <span style={{fontSize:10,color:C.dim,fontFamily:F}}>thr: {u.thresholds.join("/")}</span>
            {inUse&&<span style={{fontSize:9,color:C.success,fontFamily:F,marginLeft:"auto"}}>in use</span>}
            <div style={{marginLeft:inUse?"0":"auto",display:"flex",gap:4}}>
              <button onClick={()=>startEdit(u)} style={{width:24,height:24,borderRadius:4,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}} title="Edit">✎</button>
              {!isBuiltin&&!inUse&&<button onClick={()=>onDeleteUnit(u.id)} style={{width:24,height:24,borderRadius:4,border:`1px solid transparent`,background:"transparent",color:C.dim,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}} onMouseEnter={e=>e.currentTarget.style.color=C.danger} onMouseLeave={e=>e.currentTarget.style.color=C.dim} title="Delete">×</button>}
            </div>
          </div>)}
        </div>);
      })}
    </div>

    {/* Add new unit */}
    <div style={{padding:"14px 16px",borderRadius:8,border:`1px dashed ${C.border}`,background:C.bg}}>
      <div style={{fontSize:11,color:C.muted,fontFamily:F,fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Add New Unit</div>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:3}}>ID</div><input value={newId} onChange={e=>setNewId(e.target.value)} placeholder="lbs" style={{...inpS,fontSize:12}}/></div>
        <div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:3}}>Label</div><input value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="Pounds" style={{...inpS,fontSize:12}}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:3}}>Quick-add</div><input value={newQA} onChange={e=>setNewQA(e.target.value)} style={{...inpS,fontSize:12}}/></div>
        <div style={{flex:1}}><div style={{fontSize:10,color:C.muted,fontFamily:F,marginBottom:3}}>Thresholds</div><input value={newThr} onChange={e=>setNewThr(e.target.value)} style={{...inpS,fontSize:12}}/></div>
      </div>
      <button onClick={addNew} style={{padding:"7px 16px",borderRadius:6,border:"none",background:C.accent,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:F}}>Add Unit</button>
    </div>

    <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
      <button onClick={hClose} style={{padding:"8px 18px",borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:F}}>Done</button>
    </div>
  </ModalShell>);
}

/* ═══════════════════════════════════════════════
   TIMER BUTTON (for "min" unit metrics)
   ═══════════════════════════════════════════════ */
function TimerButton({startTime,onStart,onStop,pal,compact}){
  const [elapsed,setElapsed]=useState(0);
  const rafRef=useRef(null);
  const running=!!startTime;

  useEffect(()=>{
    if(!startTime){setElapsed(0);if(rafRef.current)cancelAnimationFrame(rafRef.current);return;}
    const tick=()=>{setElapsed(Math.floor((Date.now()-startTime)/1000));rafRef.current=requestAnimationFrame(tick);};
    rafRef.current=requestAnimationFrame(tick);
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[startTime]);

  const toggle=()=>{if(running)onStop();else onStart();};
  const mm=String(Math.floor(elapsed/60)).padStart(2,"0");
  const ss=String(elapsed%60).padStart(2,"0");

  if(compact){
    return(<div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
      <button onClick={toggle} style={{
        padding:"6px 12px",borderRadius:6,
        border:`1px solid ${running?pal.shades[3]:C.border}`,
        background:running?pal.shades[1]:C.bg,
        color:running?pal.shades[4]:C.muted,
        cursor:"pointer",fontSize:11,fontFamily:F,fontWeight:600,
        display:"flex",alignItems:"center",gap:6,
        transition:"all .2s cubic-bezier(.22,1,.36,1)",
      }} onMouseEnter={e=>{if(!running){e.currentTarget.style.borderColor=pal.shades[3];e.currentTarget.style.color=pal.shades[4];}}}
        onMouseLeave={e=>{if(!running){e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}}>
        <span style={{fontSize:13,lineHeight:1}}>{running?"■":"▶"}</span>
        {running?"Stop":"Timer"}
      </button>
      {running&&<span style={{fontSize:13,fontFamily:F,fontWeight:700,color:pal.shades[4],letterSpacing:".04em",animation:"fadeIn .3s ease"}}>{mm}:{ss}</span>}
      {running&&<span style={{fontSize:9,color:C.dim,fontFamily:F}}>≈ {Math.max(1,Math.round(elapsed/60))}m</span>}
    </div>);
  }

  return(<button onClick={toggle} title={running?"Stop and log":"Start timer"} style={{
    padding:"3px 7px",borderRadius:4,
    border:`1px solid ${running?pal.shades[3]:C.border}`,
    background:running?pal.shades[1]:C.bg,
    color:running?pal.shades[4]:C.muted,
    cursor:"pointer",fontSize:9,fontFamily:F,fontWeight:600,
    transition:"all .2s",display:"flex",alignItems:"center",gap:3,
  }}>
    <span style={{fontSize:8,lineHeight:1}}>{running?"■":"▶"}</span>
    {running?`${mm}:${ss}`:""}
  </button>);
}

/* ═══════════════════════════════════════════════
   SET INPUT INLINE (for sets-mode metrics)
   ═══════════════════════════════════════════════ */
function SetInput({metric,sets,pal,onAddSet,onRemoveSet,lastWeight}){
  const hasSets=Array.isArray(sets)&&sets.length>0;
  // Default weight: last set in current session > lastWeight from history > empty
  const defaultW=hasSets?String(sets[sets.length-1].w):lastWeight?String(lastWeight):"";
  const [w,setW]=useState(defaultW);
  const [r,setR]=useState("");
  const wUnit=metric.weightUnit||"lbs";
  // Update default when sets change (after adding a set, pre-fill with that weight)
  const prevSetLen=useRef(0);
  useEffect(()=>{
    if(Array.isArray(sets)&&sets.length>prevSetLen.current&&sets.length>0){
      setW(String(sets[sets.length-1].w));setR("");
    }
    prevSetLen.current=Array.isArray(sets)?sets.length:0;
  },[sets]);
  // Also seed from lastWeight if nothing typed yet and no current sets
  useEffect(()=>{if(!hasSets&&!w&&lastWeight)setW(String(lastWeight));},[hasSets,lastWeight,w]);
  const add=()=>{const wn=parseInt(w,10),rn=parseInt(r,10);if(wn>0&&rn>0){onAddSet(metric.id,{w:wn,r:rn});}};
  const vol=setsVolume(sets);
  return(<div>
    {/* Existing sets */}
    {hasSets&&(<div style={{marginBottom:6}}>
      {sets.map((s,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:4,background:`${pal.shades[1]}33`,marginBottom:3,animation:"fadeIn .2s ease"}}>
        <span style={{fontSize:9,color:C.dim,fontFamily:F,width:16}}>#{i+1}</span>
        <span style={{fontSize:11,color:pal.shades[4],fontFamily:F,fontWeight:600}}>{s.w} {wUnit}</span>
        <span style={{fontSize:9,color:C.muted,fontFamily:F}}>×</span>
        <span style={{fontSize:11,color:C.text,fontFamily:F,fontWeight:600}}>{s.r} reps</span>
        <span style={{fontSize:9,color:C.dim,fontFamily:F,marginLeft:"auto"}}>{(s.w*s.r).toLocaleString()}</span>
        <button onClick={()=>onRemoveSet(metric.id,i)} style={{width:16,height:16,borderRadius:3,border:"none",background:"transparent",color:C.dim,cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",transition:"color .15s"}}
          onMouseEnter={e=>e.currentTarget.style.color=C.danger} onMouseLeave={e=>e.currentTarget.style.color=C.dim}>×</button>
      </div>))}
      <div style={{fontSize:9,color:pal.shades[4],fontFamily:F,fontWeight:600,textAlign:"right",marginTop:2}}>
        {sets.length} set{sets.length!==1?"s":""} · {vol.toLocaleString()} {wUnit} total volume
      </div>
    </div>)}
    {/* Add set form */}
    <div style={{display:"flex",gap:4,alignItems:"center"}}>
      <div style={{position:"relative",flex:1}}>
        <input type="text" inputMode="numeric" value={w} onChange={e=>setW(e.target.value.replace(/[^0-9]/g,""))} placeholder="Weight" onKeyDown={e=>e.key==="Enter"&&add()} style={{...inpS,fontSize:12,paddingRight:28,padding:"6px 28px 6px 8px"}}/>
        <span style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",fontSize:9,color:C.dim,fontFamily:F,pointerEvents:"none"}}>{wUnit}</span>
      </div>
      <span style={{fontSize:10,color:C.dim,fontFamily:F}}>×</span>
      <div style={{position:"relative",flex:1}}>
        <input type="text" inputMode="numeric" value={r} onChange={e=>setR(e.target.value.replace(/[^0-9]/g,""))} placeholder="Reps" onKeyDown={e=>e.key==="Enter"&&add()} style={{...inpS,fontSize:12,padding:"6px 8px"}}/>
      </div>
      <button onClick={add} style={{padding:"6px 10px",borderRadius:5,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,cursor:"pointer",fontSize:10,fontFamily:F,fontWeight:600,whiteSpace:"nowrap",transition:"all .15s"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=pal.shades[3];e.currentTarget.style.color=pal.shades[4];}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>+ Set</button>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════
   QUICK-LOG SECTION (inline on dashboard cards)
   ═══════════════════════════════════════════════ */
function QuickLogSection({habit,logs,units,pal,onQuickLog,onQuickReset,onAddSet,onRemoveSet,timers,onStartTimer,onStopTimer,habitId}){
  const [justTapped,setJustTapped]=useState(null);
  const ms=habit.metrics||[];
  const compact=ms.length===1;
  const tKey=todayK();
  const todayLog=logs[tKey]||{};
  const hasAny=ms.some(m=>metricActive(m,todayLog));
  const level=logLevel(habit,todayLog,units);
  const priIsMin=ms[0]?.unit==="min";
  const priIsSets=ms[0]?.mode==="sets";
  const timerKey=(mId)=>`${habitId}:${mId}`;

  const qAdd=(mId,amt)=>{onQuickLog(mId,amt);setJustTapped(`${mId}-${amt}`);setTimeout(()=>setJustTapped(null),350);};

  // Summary for header
  const summary=(()=>{
    if(!hasAny)return null;
    if(compact){
      if(priIsSets)return fmtSets(todayLog[ms[0].id],ms[0].weightUnit);
      return fmtVal(ms.reduce((s,m)=>s+(todayLog[m.id]||0),0),ms[0].unit);
    }
    return`${ms.filter(m=>metricActive(m,todayLog)).length}/${ms.length}`;
  })();

  return(<div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
      <span style={{fontSize:8,color:C.dim,fontFamily:F,textTransform:"uppercase",letterSpacing:".06em"}}>Quick log today</span>
      {hasAny&&<span style={{fontSize:11,color:pal.shades[4],fontFamily:F,fontWeight:700,animation:"fadeIn .3s ease"}}>{summary}</span>}
    </div>

    {/* Single metric: sets or normal */}
    {compact&&priIsSets?(<>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
        <span style={{fontSize:11,fontFamily:F,fontWeight:600,color:C.text}}>{ms[0].name}</span>
        <span style={{fontSize:9,color:C.accent,fontFamily:F,padding:"1px 5px",borderRadius:2,background:C.accentDim,fontWeight:600}}>SETS · {ms[0].weightUnit||"lbs"}</span>
      </div>
      <SetInput metric={ms[0]} sets={todayLog[ms[0].id]} pal={pal} onAddSet={onAddSet} onRemoveSet={onRemoveSet} lastWeight={findLastWeight(logs,ms[0].id)}/>
      <div style={{display:"flex",gap:3,marginTop:6}}>{[1,2,3,4].map(i=><div key={i} style={{flex:1,height:3,borderRadius:2,background:level>=i?pal.shades[i]:C.bg,transition:"background .4s"}}/>)}</div>
    </>):compact?(<>
      <div style={{display:"flex",gap:4}}>
        {getQuickAdd(ms[0].unit,units).map(n=>{const isA=justTapped===`${ms[0].id}-${n}`;return(
          <button key={n} onClick={()=>qAdd(ms[0].id,n)} style={{
            flex:1,padding:"8px 0",borderRadius:6,
            border:`1px solid ${hasAny?pal.shades[2]:C.border}`,
            background:isA?pal.shades[2]:C.bg,
            color:isA?"#fff":hasAny?pal.shades[4]:C.muted,
            cursor:"pointer",fontSize:12,fontFamily:F,fontWeight:600,
            transition:"all .2s cubic-bezier(.22,1,.36,1)",
            transform:isA?"scale(.95)":"scale(1)",
          }} onMouseEnter={e=>{e.currentTarget.style.borderColor=pal.shades[3];e.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=hasAny?pal.shades[2]:C.border;e.currentTarget.style.transform="scale(1)";}}>+{n}</button>);})}
        {hasAny&&<button onClick={()=>onQuickReset(ms[0].id)} style={{width:34,padding:"8px 0",borderRadius:6,border:`1px solid ${C.border}`,background:C.bg,color:C.dim,cursor:"pointer",fontSize:10,fontFamily:F,transition:"all .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.color=C.danger;e.currentTarget.style.borderColor=C.danger;}}
          onMouseLeave={e=>{e.currentTarget.style.color=C.dim;e.currentTarget.style.borderColor=C.border;}}>↺</button>}
      </div>
      {priIsMin&&<TimerButton startTime={timers?.[timerKey(ms[0].id)]} onStart={()=>onStartTimer(ms[0].id)} onStop={()=>onStopTimer(ms[0].id)} pal={pal} compact={true}/>}
      <div style={{display:"flex",gap:3,marginTop:6}}>{[1,2,3,4].map(i=><div key={i} style={{flex:1,height:3,borderRadius:2,background:level>=i?pal.shades[i]:C.bg,transition:"background .4s"}}/>)}</div>
    </>):(<>
      {/* Multi-metric */}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {ms.map(m=>{
          const isSets=isSetMetric(m);
          if(isSets){
            const sets=todayLog[m.id];const hasSets2=Array.isArray(sets)&&sets.length>0;
            return(<div key={m.id} style={{padding:"6px 8px",borderRadius:6,background:hasSets2?`${pal.shades[1]}44`:C.bg,border:`1px solid ${hasSets2?pal.shades[1]:C.border}`,transition:"all .2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${hasSets2?pal.shades[3]:C.border}`,background:hasSets2?pal.shades[3]:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",flexShrink:0}}>
                  {hasSets2&&<span style={{fontSize:8,color:"#fff"}}>✓</span>}
                </div>
                <span style={{fontSize:10,fontFamily:F,fontWeight:500,color:hasSets2?C.text:C.muted}}>{m.name}</span>
                <span style={{fontSize:9,color:C.accent,fontFamily:F,padding:"1px 5px",borderRadius:2,background:C.accentDim}}>SETS</span>
                {hasSets2&&<span style={{fontSize:9,color:pal.shades[4],fontFamily:F,fontWeight:600,marginLeft:"auto"}}>{fmtSets(sets,m.weightUnit)}</span>}
              </div>
              <SetInput metric={m} sets={sets} pal={pal} onAddSet={onAddSet} onRemoveSet={onRemoveSet} lastWeight={findLastWeight(logs,m.id)}/>
            </div>);
          }
          const val=todayLog[m.id]||0;const done=val>0;const isMin=m.unit==="min";
          return(<div key={m.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:6,background:done?`${pal.shades[1]}44`:C.bg,border:`1px solid ${done?pal.shades[1]:C.border}`,transition:"all .2s"}}>
            <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${done?pal.shades[3]:C.border}`,background:done?pal.shades[3]:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",flexShrink:0}}>
              {done&&<span style={{fontSize:8,color:"#fff"}}>✓</span>}
            </div>
            <span style={{fontSize:10,fontFamily:F,fontWeight:500,color:done?C.text:C.muted,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
            {done&&<span style={{fontSize:10,color:pal.shades[4],fontFamily:F,fontWeight:600,animation:"fadeIn .3s ease"}}>{fmtVal(val,m.unit)}</span>}
            <div style={{display:"flex",gap:3}}>
              {isMin&&<TimerButton startTime={timers?.[timerKey(m.id)]} onStart={()=>onStartTimer(m.id)} onStop={()=>onStopTimer(m.id)} pal={pal} compact={false}/>}
              {getQuickAdd(m.unit,units).slice(0,2).map(n=>{const isA=justTapped===`${m.id}-${n}`;return(
                <button key={n} onClick={()=>qAdd(m.id,n)} style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${done?pal.shades[1]:C.border}`,background:isA?pal.shades[2]:C.bg,color:isA?"#fff":C.muted,cursor:"pointer",fontSize:9,fontFamily:F,transition:"all .15s",transform:isA?"scale(.9)":"scale(1)"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>+{n}</button>);})}
              {done&&<button onClick={()=>onQuickReset(m.id)} style={{padding:"3px 5px",borderRadius:4,border:"1px solid transparent",background:"transparent",color:C.dim,cursor:"pointer",fontSize:9,fontFamily:F,transition:"all .15s"}}
                onMouseEnter={e=>e.currentTarget.style.color=C.danger} onMouseLeave={e=>e.currentTarget.style.color=C.dim}>↺</button>}
            </div>
          </div>);
        })}
      </div>
      <div style={{display:"flex",gap:3,marginTop:4}}>{ms.map(m=><div key={m.id} style={{flex:1,height:3,borderRadius:2,background:metricActive(m,todayLog)?pal.shades[3]:C.bg,transition:"background .4s"}}/>)}</div>
    </>)}
  </div>);
}

/* ═══════════════════════════════════════════════
   d3 CALENDAR (compact, no scroll)
   ═══════════════════════════════════════════════ */
const DEFAULT_CONFIG={numMonths:4,monthGap:5};
function D3Calendar({habit,logs,units,onCellClick,onEdit,onQuickLog,onQuickReset,onAddSet,onRemoveSet,timers,onStartTimer,onStopTimer,habitId,appConfig}){
  const cfg=appConfig||DEFAULT_CONFIG;
  const NUM_MONTHS=cfg.numMonths||4;
  const svgRef=useRef(null),cRef=useRef(null);
  const longPressRef=useRef(null);
  const [cw,setCw]=useState(400);const [tip,setTip]=useState(null);
  const [view,setView]=useState("heatmap");
  const [offset,setOffset]=useState(0);
  const [zoomed,setZoomed]=useState(false);
  const [pressing,setPressing]=useState(false);
  const [svgHeight,setSvgHeight]=useState(120);

  const startPress=()=>{setPressing(true);longPressRef.current=setTimeout(()=>{setPressing(false);if(onEdit)onEdit();},500);};
  const cancelPress=()=>{setPressing(false);if(longPressRef.current){clearTimeout(longPressRef.current);longPressRef.current=null;}};
  useEffect(()=>()=>{if(longPressRef.current)clearTimeout(longPressRef.current);},[]);

  const numM=zoomed?1:NUM_MONTHS;
  const days=useMemo(()=>getRecentDays(numM,offset),[numM,offset]);
  const tKey=todayK();
  const pal=PALETTES.find(p=>p.name===habit.color)||PALETTES[0];
  const stats=useMemo(()=>habitStats(habit,logs,units),[habit,logs,units]);
  const pu=(habit.metrics||[])[0]?.unit||"count";
  const sLabel=pu==="min"?"Hours":getUnit(pu,units).label||"Total";
  const sVal=pu==="min"?(stats.totalVal>=60?`${(stats.totalVal/60).toFixed(1)}`:`${stats.totalVal}m`):stats.totalVal;

  const navBack=()=>{if(zoomed){setZoomed(false);setView("heatmap");}else{setOffset(o=>o-NUM_MONTHS);}};
  const navFwd=()=>{if(offset===0&&!zoomed){setZoomed(true);setView("calendar");}else if(zoomed){/* already at present, do nothing */}else{setOffset(o=>{const next=o+NUM_MONTHS;if(next>=0){setZoomed(false);return 0;}return next;});}};
  const canFwd=zoomed?false:(offset<0||offset===0);

  // Date range label
  const rangeLabel=days.length>0?(numM===1?`${MONTHS[days[0].getMonth()]} ${days[0].getFullYear()}`:`${MONTHS[days[0].getMonth()]} \u2013 ${MONTHS[days[days.length-1].getMonth()]} ${days[days.length-1].getFullYear()}`):"";

  useEffect(()=>{const el=cRef.current;if(!el)return;const obs=new ResizeObserver(e=>{for(const en of e)setCw(en.contentRect.width);});obs.observe(el);setCw(el.getBoundingClientRect().width);return()=>obs.disconnect();},[]);

  useEffect(()=>{
    const svg=d3.select(svgRef.current);
    const svgAvail=cw;
    // Larger cells when zoomed to 1 month
    const cg=zoomed?4:2,lp=zoomed?8:6,tp=zoomed?28:24,mg=zoomed?0:(cfg.monthGap!=null?cfg.monthGap:5);
    const cs=zoomed
      ?Math.min((svgAvail-2*lp-6*cg)/7,36)
      :fitCellSize(days,svgAvail,view,cg,lp,mg);
    const sh=pal.shades,DUR=700;
    svg.selectAll("*").interrupt();

    const{cells:layout,mLabels}=view==="heatmap"
      ?compactHeatLayout(days,cs,cg,lp,tp,mg)
      :compactCalLayout(days,cs,cg,lp,tp,mg);

    // Center layout within SVG by shifting everything right
    const maxX=d3.max(layout,d=>d.x+d.w)||300;
    const shiftX=Math.max(0,(svgAvail-maxX)/2);
    if(shiftX>0){
      layout.forEach(c=>{c.x+=shiftX;});
      mLabels.forEach(l=>{l.x+=shiftX;});
    }

    const maxY=d3.max(layout,d=>d.y+d.h)||100;
    const svgH=maxY+8;
    setSvgHeight(svgH);

    // Ripple from today (or center if today not visible)
    const todayCell=layout.find(c=>c.key===tKey);
    const tX=todayCell?todayCell.x:maxX/2,tY=todayCell?todayCell.y:maxY/2;
    const maxDist=Math.sqrt(maxX**2+maxY**2)||1;
    const stag=d=>{const dist=Math.sqrt((d.x-tX)**2+(d.y-tY)**2);return(dist/maxDist)*350;};

    const dnFontSz=zoomed?13:Math.max(7,Math.round(cs*0.7));
    const mlFontSz=zoomed?13:Math.max(8,Math.round(cs*0.8));
    const wkFontSz=zoomed?10:Math.max(7,Math.round(cs*0.65));

    const cellR=zoomed?6:Math.max(2,Math.round(cs*0.2));

    const greyFill="#1c2128";
    const cellFill=d=>d.future?greyFill:sh[logLevel(habit,logs[d.key],units)];
    const cellOp=d=>d.future?0.35:1;

    const cellStroke=d=>d.key===tKey?C.accent:"rgba(255,255,255,0.06)";
    const cellStrokeW=d=>d.key===tKey?1.5:1;

    const cells=svg.selectAll(".dc").data(layout,d=>d.key);
    cells.exit().each(function(d){d3.select(this).transition("ex").delay(stag(d)).duration(DUR*.3).ease(D3E).style("opacity",0).attr("width",0).attr("height",0).remove();});
    const enter=cells.enter().append("rect").attr("class","dc")
      .attr("x",d=>d.x).attr("y",d=>d.y).attr("width",d=>d.w).attr("height",d=>d.h)
      .attr("rx",cellR).attr("ry",cellR)
      .attr("fill",cellFill).attr("stroke",cellStroke).attr("stroke-width",cellStrokeW)
      .style("cursor",d=>d.future?"default":"pointer").style("opacity",0);
    enter.each(function(d){d3.select(this).transition("en").delay(stag(d)).duration(DUR*.6).ease(D3E).style("opacity",cellOp(d));});
    const merged=cells.merge(enter);
    merged.on("click",(_,d)=>{if(!d.future&&onCellClick)onCellClick(d.key);})
      .on("mouseenter",(ev,d)=>{if(d.future)return;setTip({label:logSummary(habit,logs[d.key]),date:d.date.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})});d3.select(ev.currentTarget).attr("stroke",sh[4]).attr("stroke-width",2);})
      .on("mouseleave",(ev,d)=>{setTip(null);d3.select(ev.currentTarget).attr("stroke",cellStroke(d)).attr("stroke-width",cellStrokeW(d));});
    merged.each(function(d){d3.select(this).transition("up").delay(stag(d)).duration(DUR*.6).ease(D3E)
      .attr("x",d.x).attr("y",d.y).attr("width",d.w).attr("height",d.h).attr("rx",cellR).attr("ry",cellR)
      .attr("fill",cellFill(d)).attr("stroke",cellStroke(d)).attr("stroke-width",cellStrokeW(d)).style("opacity",cellOp(d));});

    // Month labels
    svg.selectAll(".ml").interrupt();
    const mls=svg.selectAll(".ml").data(mLabels,d=>d.key);
    mls.exit().transition("mle").duration(DUR/3).ease(D3E).style("opacity",0).remove();
    const mlEn=mls.enter().append("text").attr("class","ml").attr("x",d=>d.x).attr("y",d=>d.y)
      .attr("fill",C.muted).attr("font-size",mlFontSz).attr("font-family",F).attr("font-weight",600)
      .attr("text-anchor",d=>d.anchor||"start").style("opacity",0).text(d=>d.label);
    mlEn.transition("mlen").delay(DUR/3).duration(DUR/2).ease(D3E).style("opacity",1);
    mls.merge(mlEn).transition("mlup").delay(DUR*.3).duration(DUR/2).ease(D3E)
      .attr("x",d=>d.x).attr("y",d=>d.y).attr("text-anchor",d=>d.anchor||"start").style("opacity",1);

    // Day numbers in cal view
    const dayNums=view==="calendar"?layout.map(c=>({
      key:`dn-${c.key}`,label:String(c.date.getDate()),x:c.x+c.w/2,y:c.y+c.h/2+Math.round(dnFontSz*0.38),
      future:c.future,level:logLevel(habit,logs[c.key],units),_x:c.x,_y:c.y,
    })):[];
    svg.selectAll(".dn").interrupt();
    const dns=svg.selectAll(".dn").data(dayNums,d=>d.key);
    dns.exit().each(function(d){d3.select(this).transition("dne").delay(stag({x:d._x,y:d._y})).duration(DUR/3).ease(D3E).style("opacity",0).remove();});
    const dnEn=dns.enter().append("text").attr("class","dn").attr("x",d=>d.x).attr("y",d=>d.y)
      .attr("fill",d=>d.future?C.dim:d.level>0?"#fff":C.muted)
      .attr("font-size",dnFontSz).attr("font-family",F).attr("font-weight",d=>d.key===`dn-${tKey}`?700:400)
      .attr("text-anchor","middle").style("pointer-events","none").style("opacity",0).text(d=>d.label);
    dnEn.each(function(d){d3.select(this).transition("dnen").delay(DUR*.5+stag({x:d._x,y:d._y})).duration(DUR/2).ease(D3E).style("opacity",1);});
    dns.merge(dnEn).each(function(d){d3.select(this).transition("dnup").delay(DUR*.3+stag({x:d._x,y:d._y})).duration(DUR/2).ease(D3E)
      .attr("x",d.x).attr("y",d.y).attr("fill",d.future?C.dim:d.level>0?"#fff":C.muted).style("opacity",1);});

    // Weekday headers in cal view — one set per month block
    const wkLabels=view==="calendar"?(()=>{
      // Compute block start x positions (same logic as compactCalLayout)
      const moGroups=[];let pm2=-1,gp=null;
      for(const day of days){const m=day.getMonth();if(m!==pm2){gp={month:m,year:day.getFullYear(),days:[]};moGroups.push(gp);pm2=m;}gp.days.push(day);}
      const labels=[];let bx2=lp+shiftX;
      for(const mo of moGroups){
        const bw=7*(cs+cg)-cg;
        WK_FULL.forEach((d,i)=>{labels.push({key:`wk-${d}-${mo.month}-${mo.year}`,label:zoomed?d.slice(0,3):d[0],x:bx2+i*(cs+cg)+cs/2,y:tp-2});});
        bx2+=bw+mg;
      }
      return labels;
    })():[];
    svg.selectAll(".wk").interrupt();
    const wks=svg.selectAll(".wk").data(wkLabels,d=>d.key);
    wks.exit().transition("wke").duration(DUR/3).ease(D3E).style("opacity",0).remove();
    const wkEn=wks.enter().append("text").attr("class","wk").attr("x",d=>d.x).attr("y",d=>d.y)
      .attr("fill",C.dim).attr("font-size",wkFontSz).attr("font-family",F).attr("text-anchor","middle")
      .style("opacity",0).text(d=>d.label);
    wkEn.transition("wken").delay(DUR/3).duration(DUR/2).ease(D3E).style("opacity",1);
    wks.merge(wkEn).transition("wkup").delay(DUR*.3).duration(DUR/2).ease(D3E)
      .attr("x",d=>d.x).attr("y",d=>d.y).style("opacity",1);
  },[view,offset,zoomed,cw,days,logs,habit,pal,units,tKey,onCellClick,cfg]);

  return(
    <div ref={cRef} style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:"16px 16px",marginBottom:16,transition:"border-color .3s",position:"relative"}}>
      {/* Header: name + stats */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,cursor:"default",userSelect:"none",WebkitUserSelect:"none"}}
          onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
          onTouchStart={startPress} onTouchEnd={cancelPress} onTouchCancel={cancelPress}>
          <span style={{fontSize:18,transition:"transform .2s",transform:pressing?"scale(0.9)":"scale(1)"}}>{habit.emoji}</span>
          <div>
            <h3 style={{margin:0,fontSize:14,fontWeight:600,color:pressing?C.accent:C.text,fontFamily:F,transition:"color .2s"}}>{habit.name}</h3>
            {habit.description&&<p style={{margin:"1px 0 0",fontSize:10,color:C.muted,fontFamily:F}}>{habit.description}</p>}
            <div style={{fontSize:8,color:C.dim,fontFamily:F,marginTop:1,opacity:pressing?1:0,transition:"opacity .2s"}}>hold to edit...</div>
          </div>
        </div>
        <div style={{display:"flex",gap:12,textAlign:"right"}}>
          {[{l:"Days",v:stats.totalDays},{l:sLabel,v:sVal},{l:"Streak",v:`${stats.curStreak}d`}].map(s=>(
            <div key={s.l}><div style={{fontSize:14,fontWeight:700,color:pal.shades[4],fontFamily:F}}>{s.v}</div><div style={{fontSize:8,color:C.muted,fontFamily:F,letterSpacing:".04em",textTransform:"uppercase"}}>{s.l}</div></div>))}
        </div>
      </div>

      {/* Controls: view toggle + range + nav arrows */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:6}}>
        <div style={{display:"flex",background:C.bg,borderRadius:5,border:`1px solid ${C.border}`,padding:2,gap:2}}>
          {[{id:"heatmap",label:"Heat"},{id:"calendar",label:"Cal"}].map(v=>{const disabled=zoomed&&v.id==="heatmap";return(<button key={v.id} onClick={()=>{if(!disabled)setView(v.id);}} disabled={disabled} style={{padding:"3px 10px",borderRadius:3,border:"none",background:view===v.id?C.surface:"transparent",color:disabled?C.dim:view===v.id?C.text:C.dim,cursor:disabled?"default":"pointer",fontSize:9,fontFamily:F,fontWeight:view===v.id?600:400,transition:"all .2s",boxShadow:view===v.id?"0 1px 2px rgba(0,0,0,.3)":"none",opacity:disabled?0.35:1}}>{v.label}</button>);})}
        </div>
        <div style={{fontSize:10,color:C.muted,fontFamily:F,fontWeight:500}}>{rangeLabel}</div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={navBack} style={{width:22,height:22,borderRadius:4,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,transition:"all .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;}}>‹</button>
          <button onClick={navFwd} disabled={!canFwd} style={{width:22,height:22,borderRadius:4,border:`1px solid ${canFwd?C.border:C.bg}`,background:C.bg,color:canFwd?C.muted:C.dim,cursor:canFwd?"pointer":"default",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,opacity:canFwd?1:.35,transition:"all .15s"}}
            onMouseEnter={e=>{if(canFwd){e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}} onMouseLeave={e=>{e.currentTarget.style.borderColor=canFwd?C.border:C.bg;e.currentTarget.style.color=canFwd?C.muted:C.dim;}}>›</button>
        </div>
      </div>

      {/* SVG */}
      <svg ref={svgRef} width={cw} height={svgHeight} style={{display:"block",transition:"height .5s cubic-bezier(.22,1,.36,1)"}}/>

      {/* Legend */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5,marginTop:8}}>
        <span style={{fontSize:9,color:C.muted,fontFamily:F}}>Less</span>
        {pal.shades.map((c,i)=><div key={i} style={{width:11,height:11,borderRadius:2,background:c}}/>)}
        <span style={{fontSize:9,color:C.muted,fontFamily:F}}>More</span>
      </div>

      {/* Quick-log for today */}
      {onQuickLog&&<QuickLogSection habit={habit} logs={logs} units={units} pal={pal} onQuickLog={(mId,amt)=>{if(!zoomed){setZoomed(true);setOffset(0);setView("calendar");}onQuickLog(mId,amt);}} onQuickReset={onQuickReset} onAddSet={onAddSet?(mId,set)=>{if(!zoomed){setZoomed(true);setOffset(0);setView("calendar");}onAddSet(mId,set);}:null} onRemoveSet={onRemoveSet} timers={timers} onStartTimer={onStartTimer} onStopTimer={onStopTimer} habitId={habitId}/>}

      {/* Tooltip */}
      {tip&&(<div style={{position:"absolute",top:8,right:16,pointerEvents:"none",background:"#1c2128",border:`1px solid ${C.borderLight}`,borderRadius:6,padding:"5px 9px",fontSize:10,color:C.text,fontFamily:F,boxShadow:"0 4px 12px rgba(0,0,0,.4)",zIndex:10,maxWidth:260}}>
        <div>{tip.label}</div><div style={{fontSize:9,color:C.muted,marginTop:1}}>{tip.date}</div>
      </div>)}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LIVE TIMER INDICATOR (for log view)
   ═══════════════════════════════════════════════ */
function LiveTimer({startTime,metricName,pal,onStop}){
  const [elapsed,setElapsed]=useState(0);
  const rafRef=useRef(null);
  useEffect(()=>{
    const tick=()=>{setElapsed(Math.floor((Date.now()-startTime)/1000));rafRef.current=requestAnimationFrame(tick);};
    rafRef.current=requestAnimationFrame(tick);
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[startTime]);
  const mm=String(Math.floor(elapsed/60)).padStart(2,"0");
  const ss=String(elapsed%60).padStart(2,"0");
  const mins=Math.max(1,Math.round(elapsed/60));
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:pal.shades[1],border:`1px solid ${pal.shades[2]}`,marginBottom:8,animation:"fadeIn .3s ease"}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:pal.shades[4],animation:"pulseGlow 1.5s ease infinite",flexShrink:0}}/>
      <span style={{fontSize:10,color:pal.shades[4],fontFamily:F,fontWeight:600}}>{metricName}</span>
      <span style={{fontSize:13,color:"#fff",fontFamily:F,fontWeight:700,letterSpacing:".04em"}}>{mm}:{ss}</span>
      <span style={{fontSize:9,color:C.muted,fontFamily:F}}>{"≈"} {mins}m</span>
      <button onClick={onStop} style={{marginLeft:"auto",padding:"3px 10px",borderRadius:4,border:`1px solid ${pal.shades[3]}`,background:pal.shades[2],color:"#fff",cursor:"pointer",fontSize:9,fontFamily:F,fontWeight:600,display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}
        onMouseEnter={e=>{e.currentTarget.style.background=pal.shades[3];}} onMouseLeave={e=>{e.currentTarget.style.background=pal.shades[2];}}>
        <span style={{fontSize:8}}>{"■"}</span>Stop
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LOG ENTRY SCREEN
   ═══════════════════════════════════════════════ */
function LogEntry({habits,allLogs,units,onSaveLog,selectedDate,onDateChange,timers,onStopTimer}){
  const [local,setLocal]=useState({});const [saved,setSaved]=useState(false);const [dDir,setDDir]=useState(null);const [dKey,setDKey]=useState(0);
  useEffect(()=>{const loc={};habits.forEach(h=>{const ex=allLogs[h.id]?.[selectedDate]||{};const vals={};(h.metrics||[]).forEach(m=>{
    if(isSetMetric(m)){vals[m.id]=Array.isArray(ex[m.id])?[...ex[m.id].map(s=>({...s}))]:[]}
    else{vals[m.id]=ex[m.id]>0?String(ex[m.id]):"";}
  });loc[h.id]=vals;});setLocal(loc);setSaved(false);},[selectedDate,habits,allLogs]);
  const setV=(hId,mId,val)=>setLocal(p=>({...p,[hId]:{...(p[hId]||{}),[mId]:val.replace(/[^0-9]/g,"")}}));
  const qAdd=(hId,mId,amt)=>setLocal(p=>{const cur=parseInt(p[hId]?.[mId]||"0",10)||0;return{...p,[hId]:{...(p[hId]||{}),[mId]:String(cur+amt)}};});
  const addSet=(hId,mId,set)=>setLocal(p=>{const prev=p[hId]||{};const cur=Array.isArray(prev[mId])?prev[mId]:[];return{...p,[hId]:{...prev,[mId]:[...cur,set]}};});
  const rmSet=(hId,mId,idx)=>setLocal(p=>{const prev=p[hId]||{};const cur=Array.isArray(prev[mId])?[...prev[mId]]:[];cur.splice(idx,1);return{...p,[hId]:{...prev,[mId]:cur}};});
  const handleSave=()=>{const parsed={};habits.forEach(h=>{const entry={};(h.metrics||[]).forEach(m=>{
    if(isSetMetric(m)){entry[m.id]=Array.isArray(local[h.id]?.[m.id])?local[h.id][m.id]:[];}
    else{entry[m.id]=parseInt(local[h.id]?.[m.id]||"0",10)||0;}
  });parsed[h.id]=entry;});onSaveLog(selectedDate,parsed);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const navDay=off=>{setDDir(off>0?"left":"right");setDKey(k=>k+1);const d=new Date(selectedDate+"T12:00:00");d.setDate(d.getDate()+off);onDateChange(dk(d));};
  const isToday=selectedDate===todayK();const dateObj=new Date(selectedDate+"T12:00:00");const dispDate=dateObj.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});

  return(<div>
    <div className="stagger-child" style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:"20px 24px",marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",fontFamily:F}}>Log Date</div>
        {!isToday&&<button onClick={()=>{setDDir("right");setDKey(k=>k+1);onDateChange(todayK());}} style={{padding:"4px 12px",borderRadius:4,border:`1px solid ${C.accent}`,background:C.accentDim,color:C.accent,cursor:"pointer",fontSize:11,fontFamily:F,fontWeight:500}}>Jump to Today</button>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}>
        <button onClick={()=>navDay(-1)} style={{width:36,height:36,borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F}}>‹</button>
        <div key={dKey} className={dDir==="left"?"date-shift-left":dDir==="right"?"date-shift-right":""} style={{textAlign:"center",minWidth:260}}>
          <div style={{fontSize:18,fontWeight:600,color:C.text,fontFamily:F}}>{isToday?"Today":dispDate.split(",")[0]}</div>
          <div style={{fontSize:12,color:C.muted,fontFamily:F,marginTop:2}}>{dispDate}</div>
        </div>
        <button onClick={()=>navDay(1)} disabled={isToday} style={{width:36,height:36,borderRadius:8,border:`1px solid ${isToday?C.bg:C.border}`,background:C.bg,color:isToday?C.dim:C.muted,cursor:isToday?"default":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,opacity:isToday?.4:1}}>›</button>
      </div>
      <div style={{display:"flex",justifyContent:"center",marginTop:12}}>
        <input type="date" value={selectedDate} max={todayK()} onChange={e=>{setDDir(null);onDateChange(e.target.value);}} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,fontSize:12,fontFamily:F,outline:"none",colorScheme:"dark"}}/>
      </div>
    </div>
    {habits.length===0?(<div className="stagger-child" style={{background:C.surface,borderRadius:10,border:`1px dashed ${C.border}`,padding:"50px 20px",textAlign:"center"}}><div style={{fontSize:32,marginBottom:12}}>✏️</div><div style={{fontSize:14,color:C.muted,fontFamily:F}}>Add habits first</div></div>):(
    <StaggeredList keyProp={selectedDate}>
      {habits.map(h=>{const pal2=PALETTES.find(p=>p.name===h.color)||PALETTES[0];const hL=local[h.id]||{};const ms=h.metrics||[];const compact=ms.length===1;
        // Compute has/level using the local editable state
        const localLog={};ms.forEach(m=>{if(isSetMetric(m))localLog[m.id]=hL[m.id];else localLog[m.id]=parseInt(hL[m.id]||"0",10)||0;});
        const has=ms.some(m=>metricActive(m,localLog));
        const level=logLevel(h,localLog,units);
        const priUnit=ms[0]?.unit||"count";
        const thr=getUnit(priUnit,units).thresholds;
        const activeTimers=ms.filter(m=>timers?.[`${h.id}:${m.id}`]);
        const priIsSets=ms[0]?.mode==="sets";
      return(<div key={h.id} style={{background:C.surface,borderRadius:10,border:`1px solid ${has?pal2.shades[2]:C.border}`,padding:"16px 20px",transition:"all .3s",marginBottom:10,boxShadow:has?`0 0 12px ${pal2.shades[1]}44`:"none"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:activeTimers.length>0?8:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22,transition:"transform .3s",transform:has?"scale(1.1)":"scale(1)"}}>{h.emoji}</span>
            <div style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:F}}>{h.name}</div>
          </div>
          {has&&<span style={{fontSize:12,color:pal2.shades[4],fontFamily:F,fontWeight:600,animation:"fadeIn .3s ease"}}>
            {compact?(priIsSets?fmtSets(hL[ms[0].id],ms[0].weightUnit):fmtVal(parseInt(hL[ms[0].id]||"0",10),ms[0].unit)):`${ms.filter(m=>metricActive(m,localLog)).length}/${ms.length}`}
          </span>}
        </div>
        {activeTimers.map(m=><LiveTimer key={m.id} startTime={timers[`${h.id}:${m.id}`]} metricName={m.name} pal={pal2} onStop={()=>onStopTimer(h.id,m.id)}/>)}

        {/* Single sets metric */}
        {compact&&priIsSets?(<>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <span style={{fontSize:13,fontFamily:F,fontWeight:600,color:C.text}}>{ms[0].name}</span>
            <span style={{fontSize:9,color:C.accent,fontFamily:F,padding:"1px 5px",borderRadius:2,background:C.accentDim,fontWeight:600}}>SETS · {ms[0].weightUnit||"lbs"}</span>
          </div>
          <SetInput metric={ms[0]} sets={hL[ms[0].id]} pal={pal2} onAddSet={(_,set)=>addSet(h.id,ms[0].id,set)} onRemoveSet={(_,idx)=>rmSet(h.id,ms[0].id,idx)} lastWeight={findLastWeight(allLogs[h.id]||{},ms[0].id)}/>
          <div style={{display:"flex",gap:3,marginTop:8}}>{[1,2,3,4].map(i=><div key={i} style={{flex:1,height:4,borderRadius:2,background:level>=i?pal2.shades[i]:C.bg,transition:"background .4s"}}/>)}</div>
        </>)
        /* Single normal metric */
        :compact?(<>
          <div style={{fontSize:12,fontFamily:F,fontWeight:600,color:C.text,marginBottom:6}}>{ms[0].name}</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{position:"relative",flex:1}}><input type="text" inputMode="numeric" value={hL[ms[0].id]||""} onChange={e=>setV(h.id,ms[0].id,e.target.value)} placeholder="0" style={{...inpS,paddingRight:46,borderColor:has?pal2.shades[2]:C.border,fontSize:16,fontWeight:600,transition:"border-color .3s, box-shadow .3s",boxShadow:has?`0 0 0 1px ${pal2.shades[1]}44`:"none"}}/><span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:C.muted,fontFamily:F,pointerEvents:"none"}}>{ms[0].unit}</span></div>
            <div style={{display:"flex",gap:4}}>{getQuickAdd(ms[0].unit,units).map(n=>(<button key={n} onClick={()=>qAdd(h.id,ms[0].id,n)} style={{padding:"8px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,cursor:"pointer",fontSize:11,fontFamily:F,fontWeight:500,transition:"all .2s",minWidth:40,textAlign:"center"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=pal2.shades[3];e.currentTarget.style.color=pal2.shades[4];e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted;e.currentTarget.style.transform="translateY(0)";}}>+{n}</button>))}</div>
          </div>
          <div style={{display:"flex",gap:3,marginTop:10}}>{[1,2,3,4].map(i=><div key={i} style={{flex:1,height:4,borderRadius:2,background:level>=i?pal2.shades[i]:C.bg,transition:"background .4s"}}/>)}</div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
            {thr.map((t,i)=><span key={i} style={{fontSize:8,color:C.dim,fontFamily:F}}>{i===0?`<${t}`:t}{i<thr.length-1?"":"+"}  </span>)}
          </div>
        </>)
        /* Multi-metric */
        :(<div style={{display:"flex",flexDirection:"column",gap:6}}>
          {ms.map(m=>{
            if(isSetMetric(m)){
              const sets=hL[m.id];const hasSets=Array.isArray(sets)&&sets.length>0;
              return(<div key={m.id} style={{padding:"8px 12px",borderRadius:6,background:hasSets?`${pal2.shades[1]}44`:C.bg,border:`1px solid ${hasSets?pal2.shades[1]:C.border}`,transition:"all .2s"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:12,color:hasSets?C.text:C.muted,fontFamily:F,fontWeight:500}}>{m.name}</span>
                  <span style={{fontSize:9,color:C.accent,fontFamily:F,padding:"1px 5px",borderRadius:2,background:C.accentDim,fontWeight:600}}>SETS</span>
                  {hasSets&&<span style={{fontSize:10,color:pal2.shades[4],fontFamily:F,fontWeight:600,marginLeft:"auto"}}>{fmtSets(sets,m.weightUnit)}</span>}
                </div>
                <SetInput metric={m} sets={sets} pal={pal2} onAddSet={(_,set)=>addSet(h.id,m.id,set)} onRemoveSet={(_,idx)=>rmSet(h.id,m.id,idx)} lastWeight={findLastWeight(allLogs[h.id]||{},m.id)}/>
              </div>);
            }
            const sv=hL[m.id]||"";const sr=parseInt(sv,10)||0;return(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:6,background:sr>0?`${pal2.shades[1]}44`:C.bg,border:`1px solid ${sr>0?pal2.shades[1]:C.border}`,transition:"all .2s"}}>
              <span style={{fontSize:12,color:sr>0?C.text:C.muted,fontFamily:F,fontWeight:500,minWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
              <div style={{position:"relative",flex:1}}><input type="text" inputMode="numeric" value={sv} onChange={e=>setV(h.id,m.id,e.target.value)} placeholder="0" style={{...inpS,fontSize:14,fontWeight:600,paddingRight:40}}/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:10,color:C.dim,fontFamily:F,pointerEvents:"none"}}>{m.unit}</span></div>
              <div style={{display:"flex",gap:3}}>{getQuickAdd(m.unit,units).map(n=>(<button key={n} onClick={()=>qAdd(h.id,m.id,n)} style={{padding:"6px 8px",borderRadius:4,border:`1px solid ${C.border}`,background:C.bg,color:C.dim,cursor:"pointer",fontSize:10,fontFamily:F,transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=pal2.shades[3];e.currentTarget.style.color=pal2.shades[4];e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;e.currentTarget.style.transform="translateY(0)";}}>+{n}</button>))}</div>
            </div>);})}
          <div style={{display:"flex",gap:3,marginTop:4}}>{ms.map(m=><div key={m.id} style={{flex:1,height:4,borderRadius:2,background:metricActive(m,localLog)?pal2.shades[3]:C.bg,transition:"background .4s"}}/>)}</div>
        </div>)}
      </div>);})}
      <div key="save" style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
        <div style={{fontFamily:F,fontSize:12,color:C.muted}}>{habits.length} habit{habits.length!==1?"s":""} · {selectedDate}</div>
        <button onClick={handleSave} className={saved?"save-pulse":""} style={{padding:"10px 24px",borderRadius:8,border:"none",background:saved?C.success:C.accent,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:F,transition:"all .3s",transform:saved?"scale(1.04)":"scale(1)"}}>{saved?"\u2713 Saved":"Save Log"}</button>
      </div>
    </StaggeredList>)}
  </div>);
}

/* ═══════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════ */
export default function App(){
  const [habits,setHabits]=useState([]);const [logs,setLogs]=useState({});const [units,setUnits]=useState(BUILTIN_UNITS);
  const [appConfig,setAppConfig]=useState(DEFAULT_CONFIG);
  const [showAdd,setShowAdd]=useState(false);const [editHabit,setEditHabit]=useState(null);const [showUnits,setShowUnits]=useState(false);
  const [loading,setLoading]=useState(true);const [tab,setTab]=useState("dashboard");const [logDate,setLogDate]=useState(todayK());
  const [slideDir,setSlideDir]=useState("left");const [transKey,setTransKey]=useState(0);const prevTab=useRef("dashboard");
  const [timers,setTimers]=useState({}); // { "habitId:metricId": startTimestamp }

  useEffect(()=>{(async()=>{try{
    // Try v3 first, fall back to v2
    let r=await window.storage.get(STORAGE_KEY);
    if(!r?.value){try{r=await window.storage.get("habit-tracker-v2");}catch(e2){}}
    if(r?.value){const p=JSON.parse(r.value);setHabits(p.habits||[]);setLogs(p.logs||{});if(p.units)setUnits(p.units);if(p.config)setAppConfig(c=>({...c,...p.config}));
      try{await window.storage.set(STORAGE_KEY,r.value);}catch(e3){}
    }}catch(e){console.log("Fresh");}setLoading(false);})();},[]);
  const save=useCallback(async(h,l,u,c)=>{try{await window.storage.set(STORAGE_KEY,JSON.stringify({habits:h,logs:l,units:u,config:c}));}catch(e){console.error(e);}},[]);
  const updateConfig=useCallback(c=>{setAppConfig(c);save(habits,logs,units,c);},[habits,logs,units,save]);

  const addUnit=useCallback(ud=>{if(units.find(u=>u.id===ud.id))return;const nu=[...units,ud];setUnits(nu);save(habits,logs,nu,appConfig);},[units,habits,logs,appConfig,save]);
  const updateUnit=useCallback((id,updates)=>{const nu=units.map(u=>u.id===id?{...u,...updates}:u);setUnits(nu);save(habits,logs,nu,appConfig);},[units,habits,logs,appConfig,save]);
  const deleteUnit=useCallback(id=>{const nu=units.filter(u=>u.id!==id);setUnits(nu);save(habits,logs,nu,appConfig);},[units,habits,logs,appConfig,save]);

  const addHabit=useCallback(props=>{const id=`h_${Date.now()}`;const nh=[...habits,{id,...props}];const nl={...logs,[id]:{}};setHabits(nh);setLogs(nl);save(nh,nl,units,appConfig);},[habits,logs,units,appConfig,save]);
  const updateHabit=useCallback(updated=>{const nh=habits.map(h=>h.id===updated.id?updated:h);setHabits(nh);save(nh,logs,units,appConfig);},[habits,logs,units,appConfig,save]);
  const deleteHabit=useCallback(id=>{const nh=habits.filter(h=>h.id!==id);const nl={...logs};delete nl[id];setHabits(nh);setLogs(nl);save(nh,nl,units,appConfig);},[habits,logs,units,appConfig,save]);
  const saveLog=useCallback((dateKey,parsed)=>{const nl={...logs};Object.entries(parsed).forEach(([hId,entry])=>{if(!nl[hId])nl[hId]={};nl[hId][dateKey]=entry;});setLogs(nl);save(habits,nl,units,appConfig);},[logs,habits,units,appConfig,save]);
  const quickLog=useCallback((hId,mId,amt)=>{const tk=todayK();const prev=logs[hId]||{};const prevDay=prev[tk]||{};const nl={...logs,[hId]:{...prev,[tk]:{...prevDay,[mId]:(prevDay[mId]||0)+amt}}};setLogs(nl);save(habits,nl,units,appConfig);},[logs,habits,units,appConfig,save]);
  const quickReset=useCallback((hId,mId)=>{const tk=todayK();const prev=logs[hId]||{};const prevDay=prev[tk]||{};const nl={...logs,[hId]:{...prev,[tk]:{...prevDay,[mId]:0}}};setLogs(nl);save(habits,nl,units,appConfig);},[logs,habits,units,appConfig,save]);
  const quickAddSet=useCallback((hId,mId,set)=>{const tk=todayK();const prev=logs[hId]||{};const prevDay=prev[tk]||{};const curSets=Array.isArray(prevDay[mId])?prevDay[mId]:[];const nl={...logs,[hId]:{...prev,[tk]:{...prevDay,[mId]:[...curSets,set]}}};setLogs(nl);save(habits,nl,units,appConfig);},[logs,habits,units,appConfig,save]);
  const quickRemoveSet=useCallback((hId,mId,idx)=>{const tk=todayK();const prev=logs[hId]||{};const prevDay=prev[tk]||{};const curSets=Array.isArray(prevDay[mId])?[...prevDay[mId]]:[];curSets.splice(idx,1);const nl={...logs,[hId]:{...prev,[tk]:{...prevDay,[mId]:curSets}}};setLogs(nl);save(habits,nl,units,appConfig);},[logs,habits,units,appConfig,save]);
  const startTimer=useCallback((hId,mId)=>{setTimers(p=>({...p,[`${hId}:${mId}`]:Date.now()}));},[]);
  const stopTimer=useCallback((hId,mId)=>{const key=`${hId}:${mId}`;const start=timers[key];if(!start)return;const mins=Math.max(1,Math.round((Date.now()-start)/60000));setTimers(p=>{const nt={...p};delete nt[key];return nt;});quickLog(hId,mId,mins);},[timers,quickLog]);

  const switchTab=useCallback(t=>{if(t===tab)return;setSlideDir(t==="log"?"left":"right");setTransKey(k=>k+1);prevTab.current=tab;setTab(t);},[tab]);
  const navToLog=useCallback(dateKey=>{setLogDate(dateKey);setSlideDir("left");setTransKey(k=>k+1);prevTab.current="dashboard";setTab("log");},[]);
  const tKey=todayK();const completed=habits.filter(h=>logActive(h,logs[h.id]?.[tKey],units)).length;

  if(loading)return(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:C.muted,fontFamily:F,fontSize:14,animation:"fadeIn .5s ease"}}>Loading...</div></div>);

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:F}}>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{maxWidth:960,margin:"0 auto",padding:"32px 20px"}}>
        {/* Header */}
        <div className="stagger-child" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div>
            <h1 style={{margin:0,fontSize:26,fontWeight:700,letterSpacing:"-.02em",display:"flex",alignItems:"center",gap:10}}>
              <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:C.green4,boxShadow:`0 0 12px ${C.green4}`}}/>
              habits<span style={{color:C.dim,fontWeight:400}}>.v2</span>
            </h1>
            <p style={{margin:"4px 0 0 18px",fontSize:12,color:C.muted}}>{habits.length>0?`${completed}/${habits.length} completed today`:"Start tracking"}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {/* Gear icon — units config */}
            <button onClick={()=>setShowUnits(true)} title="Unit settings" style={{width:36,height:36,borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,color:C.dim,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.muted;e.currentTarget.style.color=C.text;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>⚙</button>
            <button onClick={()=>setShowAdd(true)} style={{padding:"9px 18px",borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,color:C.text,cursor:"pointer",fontSize:13,fontFamily:F,fontWeight:500,display:"flex",alignItems:"center",gap:8,transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text;e.currentTarget.style.transform="translateY(0)";}}>
              <span style={{fontSize:16,lineHeight:1}}>+</span> New Habit</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:2,marginBottom:24,background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:4}}>
          {[{id:"dashboard",label:"Dashboard",icon:"◻"},{id:"log",label:"Log Entry",icon:"✎"}].map(t=>(
            <button key={t.id} onClick={()=>switchTab(t.id)} style={{flex:1,padding:"10px 16px",borderRadius:7,border:"none",background:tab===t.id?C.bg:"transparent",color:tab===t.id?C.text:C.muted,cursor:"pointer",fontSize:13,fontFamily:F,fontWeight:tab===t.id?600:400,transition:"all .35s cubic-bezier(.16,1,.3,1)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,.3)":"none",transform:tab===t.id?"scale(1)":"scale(.98)"}}><span style={{fontSize:14}}>{t.icon}</span>{t.label}</button>))}
        </div>

        {/* Content */}
        <div key={transKey} className={slideDir==="left"?"panel-slide-left":"panel-slide-right"} style={{minHeight:200}}>
          {tab==="dashboard"&&(habits.length===0?(
            <div style={{background:C.surface,borderRadius:10,border:`1px dashed ${C.border}`,padding:"60px 20px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:16}}>📊</div>
              <div style={{fontSize:16,color:C.muted,marginBottom:8}}>No habits yet</div>
              <div style={{fontSize:12,color:C.dim}}>Click "New Habit" to start</div>
            </div>
          ):(
            <StaggeredList keyProp={`d-${transKey}`}>
              {habits.map(h=>(<div key={h.id}>
                <D3Calendar habit={h} logs={logs[h.id]||{}} units={units} onCellClick={navToLog} onEdit={()=>setEditHabit(h)} onQuickLog={(mId,amt)=>quickLog(h.id,mId,amt)} onQuickReset={(mId)=>quickReset(h.id,mId)} onAddSet={(mId,set)=>quickAddSet(h.id,mId,set)} onRemoveSet={(mId,idx)=>quickRemoveSet(h.id,mId,idx)} timers={timers} onStartTimer={(mId)=>startTimer(h.id,mId)} onStopTimer={(mId)=>stopTimer(h.id,mId)} habitId={h.id} appConfig={appConfig}/>
              </div>))}
            </StaggeredList>))}
          {tab==="log"&&<LogEntry habits={habits} allLogs={logs} units={units} onSaveLog={saveLog} selectedDate={logDate} onDateChange={setLogDate} timers={timers} onStopTimer={stopTimer}/>}
        </div>

        <div className="stagger-child" style={{textAlign:"center",marginTop:32,fontSize:11,color:C.dim,animationDelay:"500ms"}}>
          metrics + units · heat \u2194 cal · \u2039\u203A to navigate · long-press to edit
        </div>
      </div>

      {/* Modals */}
      {showAdd&&<AddHabitModal onAdd={addHabit} onClose={()=>setShowAdd(false)} units={units} onAddUnit={addUnit}/>}
      {editHabit&&<EditHabitModal habit={editHabit} onSave={updateHabit} onDelete={id=>{deleteHabit(id);setEditHabit(null);}} onClose={()=>setEditHabit(null)} units={units} onAddUnit={addUnit}/>}
      {showUnits&&<SettingsModal units={units} habits={habits} onUpdateUnit={updateUnit} onDeleteUnit={deleteUnit} onAddUnit={addUnit} appConfig={appConfig} onUpdateConfig={updateConfig} onClose={()=>setShowUnits(false)}/>}
    </div>);
}
