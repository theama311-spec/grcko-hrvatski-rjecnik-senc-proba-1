const SOURCE = [];
const KEY = "grcko_hrvatski_rjecnik_senc_proba1_v2";
const BACKUP_KEY = KEY + "_backup";
let entries = [];
let selectedId = null;
let currentLetter = "";
let returnState = null;
let fontScale = Number(localStorage.getItem(KEY + "_fontScale") || 1);

const $ = id => document.getElementById(id);
const search = $("search"), searchMode = $("searchMode");
const listEl = $("entryList"), lettersEl = $("letters"), countEl = $("count");
const welcome = $("welcome"), view = $("entryView"), editor = $("editor");

function setSaveStatus(text){ const el=$("saveStatus"); if(el) el.textContent=text; }
function cloneEntries(arr){ return arr.map(x=>({id:x.id, lemma:String(x.lemma||""), text:String(x.text||"")})); }
function normalizeEntryArray(arr){
  return arr.map((x,i)=>({id:x.id??i+1,lemma:String(x.lemma??""),text:String(x.text??"")}));
}
function loadLocalEntries(){
  try { const saved=localStorage.getItem(KEY); if(saved) return normalizeEntryArray(JSON.parse(saved)); } catch(e){}
  return cloneEntries(SOURCE);
}
function save(){
  try{
    const previous=localStorage.getItem(KEY);
    if(previous) localStorage.setItem(BACKUP_KEY, JSON.stringify({savedAt:new Date().toISOString(),entries:JSON.parse(previous)}));
    localStorage.setItem(KEY, JSON.stringify(entries));
    setSaveStatus("✓ Promjene spremljene na ovom uređaju. Prethodna verzija je sačuvana kao sigurnosna kopija.");
  }catch(e){ setSaveStatus("Promjena nije mogla biti spremljena lokalno."); }
}
function norm(s){
  return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("hr-HR").trim();
}
function greekBase(s){
  return String(s||"").normalize("NFD")
    .replace(/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u0483-\u0489]/g,"")
    .replace(/[\u0313\u0314\u0342\u0343\u0344\u0345]/g,"")
    .toLowerCase();
}
function firstLetter(s){
  const n=greekBase(s).trim(); if(!n) return "#";
  const ch=n[0];
  const map={"α":"Α","β":"Β","γ":"Γ","δ":"Δ","ε":"Ε","ζ":"Ζ","η":"Η","θ":"Θ","ι":"Ι","κ":"Κ","λ":"Λ","μ":"Μ","ν":"Ν","ξ":"Ξ","ο":"Ο","π":"Π","ρ":"Ρ","σ":"Σ","ς":"Σ","τ":"Τ","υ":"Υ","φ":"Φ","χ":"Χ","ψ":"Ψ","ω":"Ω"};
  return map[ch] || ch.toUpperCase();
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function regexEsc(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function currentQuery(){ return search.value.trim(); }
function haystack(e){ return e.lemma + " " + e.text; }
function matchesQuery(e,q){
  if(!q) return true;
  const nq=norm(q);
  if(searchMode.value==="lemma") return norm(e.lemma).includes(nq);
  if(searchMode.value==="meaning") return norm(e.text).includes(nq);
  return norm(haystack(e)).includes(nq);
}
function filtered(){
  const q=currentQuery();
  return entries.filter(e=>(!currentLetter || firstLetter(e.lemma)===currentLetter) && matchesQuery(e,q));
}
function highlight(text,q){
  const safe=esc(text); if(!q) return safe;
  const nq=norm(q); if(!nq) return safe;
  const words=q.trim().split(/\s+/).filter(Boolean).sort((a,b)=>b.length-a.length);
  let out=safe;
  for(const w of words){
    const re=new RegExp(regexEsc(esc(w)),"gi");
    out=out.replace(re,m=>`<mark>${m}</mark>`);
  }
  return out;
}
function linkedBody(text, currentId){
  let result=esc(text);
  const candidates=entries.filter(e=>e.id!==currentId && e.lemma.trim()).sort((a,b)=>b.lemma.length-a.lemma.length);
  // Replace with placeholders first so generated HTML is not processed again.
  const placeholders=[];
  for(const e of candidates){
    const pattern=new RegExp(`(?<![\p{L}\p{M}])${regexEsc(e.lemma)}(?![\p{L}\p{M}])`,"gu");
    result=result.replace(pattern,()=>{
      const token=`___ENTRYLINK_${placeholders.length}___`;
      placeholders.push({token,id:e.id,label:e.lemma});
      return token;
    });
  }
  for(const p of placeholders){
    result=result.replace(p.token,`<button class="entry-link" data-link-id="${p.id}" type="button">${esc(p.label)}</button>`);
  }
  return result;
}
function renderLetters(){
  const alphabet=["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];
  lettersEl.innerHTML=`<button data-letter="" class="${!currentLetter?'active':''}">SVE</button>`+alphabet.map(l=>`<button data-letter="${esc(l)}" class="${currentLetter===l?'active':''}">${esc(l)}</button>`).join("");
  lettersEl.querySelectorAll("button").forEach(b=>b.onclick=()=>{
    currentLetter=b.dataset.letter; renderAll();
    const first=listEl.querySelector(".entry-row");
    if(first) first.scrollIntoView({behavior:"smooth",block:"start"});
  });
}
function renderList(){
  const list=filtered();
  countEl.textContent=list.length+" nat.";
  listEl.innerHTML=list.map(e=>`<div class="entry-row ${e.id===selectedId?'active':''}" data-id="${e.id}"><div class="lemma">${highlight(e.lemma,currentQuery())}</div><div class="preview">${highlight(e.text,currentQuery())}</div></div>`).join("");
  listEl.querySelectorAll(".entry-row").forEach(r=>r.onclick=()=>showEntry(Number(r.dataset.id)));
}
function renderAll(){renderLetters();renderList();}
function isMobile(){return window.matchMedia("(max-width:800px)").matches;}
function saveReturnState(){
  if(returnState) return;
  returnState={windowY:window.scrollY, listTop:listEl.scrollTop, letter:currentLetter, query:search.value};
}
function restoreReturnState(){
  document.body.classList.remove("entry-open");
  if(returnState){
    currentLetter=returnState.letter||"";
    search.value=returnState.query||"";
    renderAll();
    requestAnimationFrame(()=>{
      listEl.scrollTop=returnState.listTop||0;
      window.scrollTo({top:returnState.windowY||0,behavior:"instant"});
    });
  }
  returnState=null;
}
function showEntry(id){
  const e=entries.find(x=>x.id===id); if(!e)return;
  if(selectedId!==id) saveReturnState();
  selectedId=id;
  welcome.classList.add("hidden"); editor.classList.add("hidden"); view.classList.remove("hidden");
  const list=filtered();
  const idx=list.findIndex(x=>x.id===id);
  const prev=idx>0?list[idx-1]:null, next=idx>=0&&idx<list.length-1?list[idx+1]:null;
  view.innerHTML=`
    <button class="mobile-back" id="backToList" type="button">← Natrag na natuknice</button>
    <div class="entry-meta">Natuknica ${idx>=0?`${idx+1} / ${list.length}`:""}</div>
    <h1 class="entry-title">${esc(e.lemma)}</h1>
    <div class="entry-body">${linkedBody(e.text,e.id)}</div>
    <div class="entry-tools">
      ${prev?`<button id="prevBtn" type="button">← Prethodna</button>`:`<button type="button" disabled>← Prethodna</button>`}
      ${next?`<button id="nextBtn" type="button">Sljedeća →</button>`:`<button type="button" disabled>Sljedeća →</button>`}
      <button id="editBtn" type="button">Uredi</button>
    </div>`;
  $("editBtn").onclick=()=>openEditor(id);
  $("backToList").onclick=()=>{view.classList.add("hidden");selectedId=null;restoreReturnState();};
  if(prev) $("prevBtn").onclick=()=>showEntry(prev.id);
  if(next) $("nextBtn").onclick=()=>showEntry(next.id);
  view.querySelectorAll(".entry-link").forEach(b=>b.onclick=()=>showEntry(Number(b.dataset.linkId)));
  renderList();
  if(isMobile()) document.body.classList.add("entry-open");
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:"instant"})));
}
function openEditor(id=null){
  setSaveStatus("Uređivanje: promjene će se spremiti kad kliknete „Spremi“. Prethodna verzija bit će sačuvana.");
  editor.classList.remove("hidden"); view.classList.add("hidden"); welcome.classList.add("hidden");
  const e=id?entries.find(x=>x.id===id):null;
  $("editorTitle").textContent=e?"Uredi natuknicu":"Nova natuknica";
  $("editLemma").value=e?.lemma||""; $("editText").value=e?.text||"";
  $("deleteEntry").style.display=e?"inline-block":"none"; editor.dataset.id=id||"";
  window.scrollTo({top:0,behavior:"instant"});
}
function closeEditor(){editor.classList.add("hidden");if(selectedId)showEntry(selectedId);else welcome.classList.remove("hidden");}
function duplicateOf(lemma,id){const n=norm(lemma);return entries.find(e=>e.id!==id&&norm(e.lemma)===n);}
function isCombiningMark(ch){ return /\p{M}/u.test(ch); }
function applyQuantity(field, kind){
  if(!field) return;
  const value=field.value;
  let start=field.selectionStart ?? value.length;
  let end=field.selectionEnd ?? start;
  const mark=kind==="short"?"\u0306":kind==="long"?"\u0304":null;
  if(start===0 && end===0){
    alert("Postavite pokazivač odmah iza grčkog samoglasnika ili označite samoglasnik.");
    field.focus(); return;
  }
  // If nothing is selected, take the previous Unicode grapheme (base letter + combining marks).
  if(start===end){
    let i=start;
    while(i>0 && isCombiningMark(value[i-1])) i--;
    if(i>0) i--;
    start=i;
    end=field.selectionStart;
  }
  const selected=value.slice(start,end);
  const decomposed=selected.normalize("NFD");
  // Quantity belongs on one vowel/grapheme, not on punctuation or a whole phrase.
  if(!/^\p{L}\p{M}*$/u.test(decomposed)){
    alert("Označite samo jedan grčki samoglasnik (npr. α, ε, ι, ο, υ, η ili ω), ili stavite pokazivač odmah iza njega.");
    field.focus(); return;
  }
  let cleaned=decomposed.replace(/[\u0304\u0306]/g,"");
  let replacement=cleaned;
  if(mark) replacement+=mark;
  field.setRangeText(replacement,start,end,"end");
  field.dispatchEvent(new Event("input",{bubbles:true}));
  field.focus();
}
document.querySelectorAll("[data-quantity-field]").forEach(btn=>{
  btn.addEventListener("click",()=>applyQuantity($(btn.dataset.quantityField),btn.dataset.quantity));
});

function saveEditor(){
  const lemma=$("editLemma").value.trim(), text=$("editText").value.trim();
  if(!lemma||!text){alert("Upišite natuknicu i tekst unosa.");return;}
  const id=Number(editor.dataset.id)||0;
  const dup=duplicateOf(lemma,id);
  if(dup){alert(`Natuknica „${lemma}“ već postoji (ID ${dup.id}).\n\nAko je riječ o istoj natuknici, uredite postojeći unos umjesto stvaranja duplikata.`);return;}
  if(id){const e=entries.find(x=>x.id===id);if(!e)return;e.lemma=lemma;e.text=text;}
  else{const newId=entries.length?Math.max(...entries.map(x=>Number(x.id)||0))+1:1;entries.push({id:newId,lemma,text});selectedId=newId;}
  save(); renderAll(); showEntry(selectedId);
}
function deleteEditor(){
  const id=Number(editor.dataset.id);if(!id)return;const entry=entries.find(x=>x.id===id);
  if(!confirm(`Obrisati natuknicu „${entry?.lemma||""}“? Prije brisanja prethodna verzija je već sačuvana kao sigurnosna kopija.`))return;
  save(); entries=entries.filter(x=>x.id!==id); save(); selectedId=null; editor.classList.add("hidden");view.classList.add("hidden");welcome.classList.remove("hidden");document.body.classList.remove("entry-open");renderAll();
}
function exportDictionary(){
  const stamp=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  const blob=new Blob([JSON.stringify(entries,null,2)],{type:"application/json;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`rjecnik-${stamp}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  setSaveStatus("✓ Sigurnosna kopija rječnika je preuzeta.");
}
$("newEntry").onclick=()=>openEditor(); $("closeEditor").onclick=closeEditor; $("saveEntry").onclick=saveEditor; $("deleteEntry").onclick=deleteEditor;
search.oninput=renderList; searchMode.onchange=renderList;
$("clearSearch").onclick=()=>{search.value="";renderList();search.focus();};
$("exportBtn").onclick=exportDictionary;
$("publishBtn").onclick=()=>{exportDictionary();alert("Sigurnosna kopija je preuzeta. Za objavu na GitHubu učitajte ovu novu rjecnik-*.json datoteku u repository i spremite Commit changes. Programske datoteke ne treba mijenjati ako ste samo uređivali natuknice.");};
$("importBtn").onclick=()=>$("fileInput").click();
$("fileInput").onchange=async ev=>{
  const file=ev.target.files[0];if(!file)return;
  try{const imported=JSON.parse(await file.text());if(!Array.isArray(imported))throw Error();
    const normalized=normalizeEntryArray(imported); const bad=normalized.find(x=>!x.lemma||!x.text); if(bad)throw Error();
    const seen=new Map();for(const e of normalized){const n=norm(e.lemma);if(seen.has(n))throw Error(`Duplikat: ${e.lemma}`);seen.set(n,e.id);}
    if(confirm("Uvoz će zamijeniti trenutačni rječnik na ovom uređaju. Nastaviti?")){save();entries=normalized;save();selectedId=null;renderAll();alert("Rječnik je uspješno uvezen.");}
  }catch(err){alert("Datoteka nije valjani JSON rječnik ili sadrži duplikate/neudovoljavajuće unose.");}
  ev.target.value="";
};
$("themeBtn").onclick=()=>document.body.classList.toggle("dark");
function applyFont(){document.documentElement.style.setProperty("--font-scale",fontScale);localStorage.setItem(KEY+"_fontScale",fontScale);}
$("fontDown").onclick=()=>{fontScale=Math.max(.85,Math.round((fontScale-.1)*10)/10);applyFont();};
$("fontReset").onclick=()=>{fontScale=1;applyFont();};
$("fontUp").onclick=()=>{fontScale=Math.min(1.35,Math.round((fontScale+.1)*10)/10);applyFont();};
window.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();search.focus();search.select();return;}
  if(e.key==="Escape" && document.activeElement===search){search.value="";renderList();search.blur();return;}
  if(e.key==="Escape" && !view.classList.contains("hidden")){view.classList.add("hidden");selectedId=null;restoreReturnState();return;}
  if(e.target.matches("input,textarea,select")) return;
  if(!view.classList.contains("hidden")){
    const list=filtered(), idx=list.findIndex(x=>x.id===selectedId);
    if(e.key==="ArrowLeft"&&idx>0){e.preventDefault();showEntry(list[idx-1].id);}
    if(e.key==="ArrowRight"&&idx>=0&&idx<list.length-1){e.preventDefault();showEntry(list[idx+1].id);}
  }
});
window.addEventListener("resize",()=>{if(!isMobile())document.body.classList.remove("entry-open");});

async function boot(){
  applyFont();
  if(location.protocol==="http:"||location.protocol==="https:"){
    try{
      const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),5000);
      const url=new URL("rjecnik.json",location.href);url.searchParams.set("v",Date.now().toString());
      const response=await fetch(url.toString(),{cache:"no-store",signal:controller.signal});clearTimeout(timer);
      if(!response.ok)throw Error("HTTP "+response.status);const imported=await response.json();if(!Array.isArray(imported))throw Error("Neispravan rječnik");
      entries=normalizeEntryArray(imported);
    }catch(e){
      entries=[];
      listEl.innerHTML="";
      countEl.textContent="0 nat.";
      view.classList.remove("hidden");
      welcome.classList.add("hidden");
      view.innerHTML=`<h1 class="entry-title">Greška</h1><div class="entry-body">rjecnik.json nije moguće učitati.</div>`;
      return;
    }
  }else entries=loadLocalEntries();
  renderAll();
}
boot();
