// ===========================
// Helpers & State
// ===========================
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const KEY = 'familyApp.v2'; // namespace de stockage
const DEFAULT_STATE = {
  tasks: [], tx: [], notes: "", events: [],
  health: { persons: [] },
  vehicles: { list: [] }
};

let state;
try {
  state = JSON.parse(localStorage.getItem(KEY) || JSON.stringify(DEFAULT_STATE));
  state = { ...DEFAULT_STATE, ...state };
} catch { state = { ...DEFAULT_STATE }; }

function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function fmtEUR(x){ return (x||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}); }
function pad(n){ return String(n).padStart(2,'0'); }
function todayISO(){ const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function addDays(dStr, n){ const d = new Date(dStr); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function uid(){ return Math.random().toString(36).slice(2,9); }

// ===========================
// Navigation (tuiles + bouton maison)
// ===========================
function showPanel(id){
  $$('.panel').forEach(p=> p.classList.remove('active'));
  $('#'+id)?.classList.add('active');
}
function goToTab(id){ if (id) showPanel(id); }
$('#btnHome')?.addEventListener('click', ()=> goToTab('home'));
$$('.tile[data-tab]')?.forEach(t=> t.addEventListener('click', ()=> goToTab(t.dataset.tab)));

// Menu "clic&miam"
const MENU_PREFIX = "https://clicetmiam.fr/mesmenus/5387/5765/";
const tz = "Europe/Paris";
function partsFromDate(d){
  const fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' });
  const [{ value: dd }, , { value: mm }, , { value: yyyy }] = fmt.formatToParts(d);
  return { yyyy, mm, dd };
}
function buildMenuUrl(d){ const { yyyy, mm, dd } = partsFromDate(d); return MENU_PREFIX + `${yyyy}/${mm}/${dd}Menu`; }
$('#tileMenu')?.addEventListener('click', ()=> window.open(buildMenuUrl(new Date()), '_blank'));

// ===========================
// Worker (chat/docs/cal)
// ===========================
const WORKER_URL = 'https://family-app.teiki5320.workers.dev';
const SECRET = 'Partenaire85/';
const ROOM   = 'family';
const WORKER_CAL_ADD  = `${WORKER_URL}/cal/add`;
const WORKER_CAL_LIST = `${WORKER_URL}/cal/list`;

// Calendrier distant
async function addToCalendar({ title, date, time='09:00', place='', category='Autre', note='' }){
  try{
    await fetch(WORKER_CAL_ADD, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET },
      body: JSON.stringify({ title, date, time, place, category, note })
    });
  }catch(e){ /* silencieux */ }
}

// ===========================
// Dashboard
// ===========================
function updateDashboard(){
  const tasksCount = (state.tasks||[]).filter(t=>!t.done).length;
  $('#dashTasksCount') && ($('#dashTasksCount').textContent = String(tasksCount));

  let sumIn=0,sumOut=0; (state.tx||[]).forEach(t=>{ if(t.type==='+') sumIn+=t.amount; else sumOut+=t.amount; });
  $('#dashBalance') && ($('#dashBalance').textContent = fmtEUR(sumIn - sumOut));

  const evs = Array.isArray(state.events)? [...state.events] : [];
  evs.sort((a,b)=> (a.date+(a.time||'00:00')).localeCompare(b.date+(b.time||'00:00')));
  const nowISO = new Date().toISOString().slice(0,16);
  const next = evs.find(e => (e.date+'T'+(e.time||'00:00')) >= nowISO);
  const el = $('#dashNextEvent');
  if (el) el.textContent = next ? `${next.title} -- ${new Date(next.date+'T'+(next.time||'09:00')).toLocaleString('fr-FR')}` : 'Pas d’évènement';
}

// ===========================
// TÂCHES
// ===========================
const taskForm = $('#taskForm'), taskInput = $('#taskInput'), taskWho = $('#taskWho');
const taskList = $('#taskList'), clearDoneBtn = $('#clearDone');

function renderTasks(){
  if(!taskList) return;
  taskList.innerHTML = '';
  state.tasks.forEach((t, i)=>{
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''} aria-label="Terminer">
      <div>
        <div>${escapeHTML(t.text)}</div>
        <div class="who">${escapeHTML(t.who || 'Tous')}</div>
      </div>
      <div class="spacer"></div>
      <button class="del" aria-label="Supprimer">Suppr</button>
    `;
    li.querySelector('input')?.addEventListener('change', (ev)=>{ t.done = ev.target.checked; save(); updateDashboard(); });
    li.querySelector('.del')?.addEventListener('click', ()=>{ state.tasks.splice(i,1); save(); renderTasks(); });
    taskList.appendChild(li);
  });
  updateDashboard();
}
taskForm?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const text = (taskInput.value||'').trim();
  if (!text) return;
  state.tasks.unshift({ text, who: taskWho?.value || 'Tous', done:false, ts:Date.now() });
  taskInput.value=''; save(); renderTasks();
});
clearDoneBtn?.addEventListener('click', ()=>{ state.tasks = state.tasks.filter(t=>!t.done); save(); renderTasks(); });

// ===========================
// BUDGET
// ===========================
const txForm = $('#txForm'), txLabel = $('#txLabel'), txAmount = $('#txAmount'), txType = $('#txType');
const txList = $('#txList');
function renderBudget(){
  if(!txList) return;
  txList.innerHTML = '';
  let sumIn = 0, sumOut = 0;
  state.tx.forEach((t,i)=>{
    if(t.type==='+') sumIn += t.amount; else sumOut += t.amount;
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <div><strong>${escapeHTML(t.label)}</strong><div class="who">${new Date(t.ts).toLocaleDateString('fr-FR')}</div></div>
      <div class="spacer"></div>
      <div>${t.type==='+'?'+':''}${fmtEUR(t.amount)}</div>
      <button class="del">Suppr</button>
    `;
    li.querySelector('.del')?.addEventListener('click', ()=>{ state.tx.splice(i,1); save(); renderBudget(); });
    txList.appendChild(li);
  });
  $('#in') && ($('#in').textContent = fmtEUR(sumIn));
  $('#out') && ($('#out').textContent = fmtEUR(sumOut));
  $('#balance') && ($('#balance').textContent = fmtEUR(sumIn - sumOut));
  updateDashboard();
}
txForm?.addEventListener('submit',(e)=>{
  e.preventDefault();
  const label = (txLabel.value||'').trim();
  const amount = parseFloat(txAmount.value);
  if(!label || isNaN(amount)) return;
  state.tx.unshift({ label, amount: Math.abs(amount), type: txType.value, ts: Date.now() });
  txLabel.value=''; txAmount.value=''; save(); renderBudget();
});

// ===========================
// NOTES
// ===========================
const notesArea = $('#notesArea'), notesSaved = $('#notesSaved');
function renderNotes(){
  if(!notesArea) return;
  notesArea.value = state.notes || '';
  if (notesSaved) notesSaved.style.opacity = 0.4;
}
let saveT;
notesArea?.addEventListener('input', ()=>{
  state.notes = notesArea.value; save();
  if (notesSaved){
    notesSaved.style.opacity = 1;
    clearTimeout(saveT); saveT = setTimeout(()=> notesSaved.style.opacity = 0.4, 800);
  }
});

// ===========================
// MÉTÉO
// ===========================
const LAT = 46.6403, LON = -1.1616;
const wxEmoji = $('#wxEmoji'), wxTemp = $('#wxTemp'), wxDesc = $('#wxDesc'), wxTile = $('#wxTile'), wxPlace = $('#wxPlace'), wxDaily = $('#wxDaily');
function codeToWeather(code){
  const map = {0:"Ciel dégagé",1:"Peu nuageux",2:"Partiellement nuageux",3:"Couvert",45:"Brouillard",48:"Brouillard givrant",51:"Bruine légère",53:"Bruine",55:"Bruine forte",61:"Pluie faible",63:"Pluie",65:"Pluie forte",71:"Neige faible",73:"Neige",75:"Neige forte",95:"Orage",96:"Orage avec grêle",99:"Orage fort grêle"};
  return map[code] || "--";
}
function codeToEmoji(code){
  const map = {0:"☀️",1:"🌤️",2:"⛅️",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌧️",55:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",71:"🌨️",73:"🌨️",75:"❄️",95:"⛈️",96:"⛈️",99:"⛈️"};
  return map[code] || "❓";
}
async function loadWeather(){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Europe%2FParis`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    const cur = data.current;
    if (wxEmoji) wxEmoji.textContent = codeToEmoji(cur.weathercode);
    if (wxTemp)  wxTemp.textContent  = `${Math.round(cur.temperature_2m)}°C`;
    if (wxDesc)  wxDesc.textContent  = codeToWeather(cur.weathercode);
    if (wxTile)  wxTile.textContent  = `${Math.round(cur.temperature_2m)}°C · ${codeToWeather(cur.weathercode)}`;
    if (wxPlace) wxPlace.textContent = 'Maché, Vendée';

    if (wxDaily){
      wxDaily.innerHTML = '';
      data.daily.time.forEach((d,i)=>{
        const li = document.createElement('li');
        li.className='item';
        const txt = new Date(d).toLocaleDateString('fr-FR',{weekday:'short', day:'2-digit', month:'2-digit'});
        li.innerHTML = `<div><strong>${txt}</strong></div>
                        <div class="spacer"></div>
                        <div>${codeToEmoji(data.daily.weathercode[i])}</div>
                        <div>${Math.round(data.daily.temperature_2m_min[i])}° / ${Math.round(data.daily.temperature_2m_max[i])}°</div>`;
        wxDaily.appendChild(li);
      });
    }
  }catch(e){
    if (wxTile) wxTile.textContent = 'Météo indisponible';
    if (wxDesc) wxDesc.textContent = 'Erreur';
  }
}
loadWeather();
setInterval(loadWeather, 2*60*60*1000);

// ===========================
// Chat (léger)
// ===========================
const chatList   = $('#chatList');
const chatInput  = $('#chatInput');
const chatSend   = $('#chatSend');
const chatFile   = $('#chatFile');
const chatUpload = $('#chatUpload');
const chatName   = $('#chatName');

const NAME_KEY = 'familyApp.chatName';
if (chatName) chatName.value = localStorage.getItem(NAME_KEY) || '';
chatName?.addEventListener('change', ()=> localStorage.setItem(NAME_KEY, (chatName.value||'').trim()));

let lastTs = 0;
function linkify(t){ return escapeHTML(t).replace(/https?:\/\/\S+/g, m => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`); }
function scrollBottom(){ if (chatList) chatList.scrollTop = chatList.scrollHeight; }
function renderMessages(msgs){
  if(!chatList) return;
  for(const m of msgs){
    const me = (chatName?.value || '').trim() && (m.author||'') === (chatName?.value||'').trim();
    const el = document.createElement('div');
    el.className = 'msg' + (me ? ' me' : '');
    el.innerHTML = `<div class="bubble">
      <div>${linkify(m.text)}</div>
      <div class="meta">${escapeHTML(m.author||'Anonyme')} · ${new Date(m.ts).toLocaleString('fr-FR')}</div>
    </div>`;
    chatList.appendChild(el);
    lastTs = Math.max(lastTs, m.ts);
  }
  scrollBottom();
}
async function refreshMessages(){
  try{
    const r = await fetch(`${WORKER_URL}/messages?room=${encodeURIComponent(ROOM)}&since=${lastTs}`);
    if(!r.ok) return;
    const data = await r.json();
    if (Array.isArray(data.messages) && data.messages.length) renderMessages(data.messages);
  }catch(e){}
}
async function uploadFile(){
  if (!chatFile?.files?.length) { alert('Choisis un fichier'); return null; }
  const f = chatFile.files[0];
  chatUpload?.setAttribute('disabled', 'true');
  chatSend?.setAttribute('disabled', 'true');
  const oldSend = chatSend?.textContent; if (chatSend) chatSend.textContent = 'Envoi…';
  try{
    const fd = new FormData();
    fd.append('file', f); fd.append('author', (chatName?.value || 'Anonyme')); fd.append('room', ROOM);
    const r = await fetch(`${WORKER_URL}/upload`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET }, body: fd });
    if (!r.ok) { const txt = await r.text().catch(()=> ''); alert('Échec upload ('+ r.status +') ' + txt); return null; }
    const data = await r.json().catch(()=> ({}));
    chatFile.value = ''; return data.url || null;
  } finally {
    chatUpload?.removeAttribute('disabled'); chatSend?.removeAttribute('disabled');
    if (chatSend) chatSend.textContent = oldSend || 'Envoyer';
  }
}
async function sendMessage(){
  const hasFile = !!(chatFile?.files && chatFile.files.length);
  const text = (chatInput?.value || '').trim();
  const author = (chatName?.value || 'Anonyme').trim() || 'Anonyme';
  if (hasFile){
    const url = await uploadFile();
    if (url && text) {
      chatInput.value = '';
      await fetch(`${WORKER_URL}/messages`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET }, body: JSON.stringify({ room: ROOM, author, text }) });
    }
    setTimeout(refreshMessages, 250);
    return;
  }
  if (!text) return;
  chatInput.value = '';
  await fetch(`${WORKER_URL}/messages`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET }, body: JSON.stringify({ room: ROOM, author, text }) });
  renderMessages([{ author, text, ts: Date.now() }]);
  setTimeout(refreshMessages, 200);
}
chatSend?.addEventListener('click', sendMessage);
chatInput?.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }});
refreshMessages(); setInterval(refreshMessages, 4000);

// ===========================
// CALENDRIER (local + sync Worker)
// ===========================
if (!Array.isArray(state.events)) state.events = [];
const eventForm = $('#eventForm'), eventTitle = $('#eventTitle'), eventDate = $('#eventDate'), eventTime = $('#eventTime');

let selectedDate = todayISO();
let calMonth = new Date().getMonth();
let calYear  = new Date().getFullYear();

function renderMonth(y,m){
  const grid = $('#calGrid'); if(!grid) return; grid.innerHTML='';
  const first = new Date(y,m,1);
  const start = first.getDay()===0 ? 6 : first.getDay()-1; // lundi=0
  const daysInMonth = new Date(y,m+1,0).getDate();
  $('#calMonthLabel') && ($('#calMonthLabel').textContent = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(first));
  for(let i=0;i<start;i++){ grid.appendChild(document.createElement('div')); }
  for(let d=1; d<=daysInMonth; d++){
    const cell = document.createElement('div'); cell.className='day';
    const ds = `${y}-${pad(m+1)}-${pad(d)}`;
    if (ds === todayISO())   cell.classList.add('today');
    if (ds === selectedDate) cell.classList.add('selected');
    cell.innerHTML = `<div class="num">${d}</div>`;
    (state.events||[]).filter(ev=>ev.date===ds).forEach(ev=>{
      const dot=document.createElement('span'); dot.className='cal-dot cat-'+(ev.category||'Autre'); cell.appendChild(dot);
    });
    cell.addEventListener('click', ()=>{ selectedDate = (selectedDate === ds) ? null : ds; renderEvents(); renderMonth(calYear, calMonth); });
    grid.appendChild(cell);
  }
}
$('#calPrev')?.addEventListener('click', ()=>{ if(--calMonth<0){ calMonth=11; calYear--; } renderMonth(calYear,calMonth); });
$('#calNext')?.addEventListener('click', ()=>{ if(++calMonth>11){ calMonth=0; calYear++; } renderMonth(calYear,calMonth); });
$('#calToday')?.addEventListener('click', ()=>{ const now = new Date(); calMonth = now.getMonth(); calYear  = now.getFullYear(); selectedDate = todayISO(); renderMonth(calYear, calMonth); renderEvents(); });
$('#calFilter')?.addEventListener('change', renderEvents);
$('#calSearch')?.addEventListener('input', renderEvents);

function renderEvents(){
  const filter = $('#calFilter')?.value || '*';
  const search = ($('#calSearch')?.value||'').toLowerCase();
  const list = $('#eventList'); if(!list) return; list.innerHTML='';
  const sel = selectedDate;
  const events = (state.events||[]).filter(ev=>{
    const byDay  = !sel || ev.date === sel;
    const byCat  = (filter==='*' || ev.category===filter);
    const byText = (!search || (ev.title||'').toLowerCase().includes(search) || (ev.place||'').toLowerCase().includes(search));
    return byDay && byCat && byText;
  }).sort((a,b)=> (a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));

  events.forEach(ev=>{
    const li = document.createElement('li'); li.className = 'item';
    const when = `${ev.date} ${ev.time||''}`.trim();
    li.innerHTML = `
      <div>
        <strong>${escapeHTML(ev.title)}</strong>
        <div class="who">${escapeHTML(when)}${ev.place?` · ${escapeHTML(ev.place)}`:''} [${escapeHTML(ev.category||'Autre')}]</div>
      </div>
      <div class="spacer"></div>
      <button class="del" aria-label="Supprimer">Suppr</button>
    `;
    li.querySelector('.del')?.addEventListener('click', ()=>{
      const idx = state.events.indexOf(ev);
      if (idx > -1) { state.events.splice(idx,1); save(); renderEvents(); renderMonth(calYear, calMonth); }
    });
    list.appendChild(li);
  });

  if (!events.length){
    const li = document.createElement('li'); li.className = 'item';
    const msg = sel ? 'Aucun évènement ce jour' : 'Aucun évènement';
    li.innerHTML = `<div><strong>${msg}</strong><div class="who">Clique une autre date ou réinitialise les filtres</div></div>`;
    list.appendChild(li);
  }

  renderMonth(calYear,calMonth);
  updateDashboard();
}
eventForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const title = (eventTitle.value||'').trim();
  if(!title || !eventDate.value) return;
  const ev = {
    title, date: eventDate.value, time: eventTime?.value || '09:00',
    place: ($('#eventPlace')?.value || ''), category: ($('#eventCategory')?.value || 'Autre'),
    note: ($('#eventNote')?.value || '')
  };
  state.events.push(ev); save(); renderEvents(); eventForm.reset();
  try{ const r = await fetch(WORKER_CAL_ADD, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET }, body: JSON.stringify(ev) }); await r.json().catch(()=>null); }catch(e){}
});
(async function syncFromWorker(){
  try{
    const r = await fetch(WORKER_CAL_LIST); const data = await r.json();
    if (!Array.isArray(data.events)) return;
    let changed = false;
    for (const w of data.events){
      if (!state.events.find(e => e.title===w.title && e.date===w.date && (e.time||'')===(w.time||''))){
        state.events.push({ title:w.title, date:w.date, time:w.time||'', place:w.place||'', category:w.category||'Autre', note:w.note||'' });
        changed = true;
      }
    }
    if (changed){ save(); renderEvents(); }
  }catch(e){}
})();

// ===========================
// DOCUMENTS (R2 via Worker)
// ===========================
const folderGrid        = $('#folderGrid');
const filesArea         = $('#filesArea');
const currentFolderName = $('#currentFolderName');
const newFolderName     = $('#newFolderName');
const createFolderBtn   = $('#createFolderBtn');
const deleteFolderBtn   = $('#deleteFolderBtn');
const docFileInput      = $('#docFile');
const uploadDocBtn      = $('#uploadDocBtn');
const docGrid           = $('#docGrid');
const docsRootTools     = $('#docsRootTools');
const fileBar           = $('#fileBar');

const DOCS = { folder:'', folders:[], files:[] };

function isImageType(t){ return /^image\//i.test(t||''); }
function isPdfType(t){ return /^application\/pdf$/i.test(t||''); }

async function docsFetchJSON(url, init = {}) {
  const r = await fetch(url, { ...init, headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(init.headers || {}) }});
  if (!r.ok) throw new Error(await r.text().catch(()=>r.statusText));
  return await r.json();
}
async function loadEntries(folderPath = DOCS.folder) {
  const u = new URL(`${WORKER_URL}/docs/list`);
  if (folderPath) u.searchParams.set('folder', folderPath);
  const data = await docsFetchJSON(u.toString());
  DOCS.folder  = data.folder || '';
  DOCS.folders = data.folders || [];
  DOCS.files   = data.files   || [];
  renderFolderGrid(); renderFiles();
}
window.loadEntries = loadEntries; // expose

function renderFolderGrid() {
  if (!folderGrid) return;
  folderGrid.innerHTML = '';
  folderGrid.style.display = 'grid';
  folderGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
  folderGrid.style.gap = '12px';

  // Fil d’Ariane
  const trail = document.createElement('div');
  trail.className = 'row'; trail.style.gridColumn = '1 / -1'; trail.style.marginBottom = '6px';
  const homeBtn = document.createElement('button');
  homeBtn.className = 'ghost'; homeBtn.textContent = '🏠 Racine';
  homeBtn.onclick = () => loadEntries('');
  trail.appendChild(homeBtn);

  const crumbs = DOCS.folder ? DOCS.folder.split('/') : [];
  let acc = '';
  crumbs.forEach((part) => {
    const sep = document.createElement('span'); sep.style.opacity = .5; sep.style.margin = '0 6px'; sep.textContent = '/';
    trail.appendChild(sep);
    acc = acc ? acc + '/' + part : part;
    const b = document.createElement('button'); b.className = 'ghost'; b.textContent = part;
    b.onclick = () => loadEntries(acc);
    trail.appendChild(b);
  });

  folderGrid.appendChild(trail);

  // Outils : visibles seulement à la racine
  if (docsRootTools) docsRootTools.style.display = DOCS.folder ? 'none' : 'flex';
  if (fileBar) fileBar.style.display = DOCS.folder ? 'flex' : 'none';

  // Dossiers
  if (!DOCS.folders.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.style.gridColumn = '1 / -1';
    empty.textContent = DOCS.folder ? 'Aucun sous-dossier' : 'Aucun dossier';
    folderGrid.appendChild(empty);
  } else {
    DOCS.folders.forEach(name => {
      const card = document.createElement('button');
      card.className = 'tile'; card.style.alignItems = 'flex-start'; card.style.width = '100%';
      card.innerHTML = `<div class="icon">📁</div><div class="title">${name}</div><div class="subtitle">Ouvrir</div>`;
      card.onclick = () => { const next = DOCS.folder ? `${DOCS.folder}/${name}` : name; loadEntries(next); };
      folderGrid.appendChild(card);
    });
  }

  if (filesArea) filesArea.style.display = 'block';
  if (currentFolderName) currentFolderName.textContent = DOCS.folder || 'Racine';
}

function renderFiles() {
  if (!docGrid) return;
  docGrid.innerHTML = '';

  if (!DOCS.files.length) {
    const empty = document.createElement('div'); empty.className = 'muted';
    empty.textContent = `Aucun fichier dans "${currentFolderName?.textContent || 'Racine'}".`;
    docGrid.appendChild(empty); return;
  }

  const files = [...DOCS.files].sort((a,b)=> new Date(b.uploaded) - new Date(a.uploaded));
  files.forEach(f=>{
    const card = document.createElement('div'); card.className = 'file-card';
    const type = (f.httpMetadata && f.httpMetadata.contentType) || '';
    const isImg = isImageType(type); const isPdf = isPdfType(type);

    if (isImg){
      const img = document.createElement('img'); img.className = 'thumb'; img.alt = f.name; img.loading='lazy';
      img.src = `${WORKER_URL}/docs/get?key=${encodeURIComponent(f.key)}`;
      img.onclick = ()=> window.open(img.src, '_blank', 'noopener'); card.appendChild(img);
    } else {
      const ph = document.createElement('div'); ph.className = 'thumb';
      ph.style.display='flex'; ph.style.alignItems='center'; ph.style.justifyContent='center'; ph.style.fontSize='36px';
      ph.textContent = isPdf ? '📄' : '📦'; card.appendChild(ph);
    }

    const name = document.createElement('div'); name.className='name'; name.title=f.name; name.textContent=f.name; card.appendChild(name);
    const meta = document.createElement('div'); meta.className='meta';
    const when = new Date(f.uploaded).toLocaleString('fr-FR'); const sizeKB = (f.size/1024).toFixed(1) + ' Ko';
    meta.textContent = `${sizeKB} · ${type || 'fichier'} · ${when}`; card.appendChild(meta);

    const actions = document.createElement('div'); actions.className='file-actions';
    const openBtn = document.createElement('a'); openBtn.className='ghost'; openBtn.textContent='Ouvrir';
    openBtn.href = `${WORKER_URL}/docs/get?key=${encodeURIComponent(f.key)}`; openBtn.target='_blank'; openBtn.rel='noopener';
    const dlBtn = document.createElement('a'); dlBtn.className='ghost'; dlBtn.textContent='Télécharger';
    dlBtn.href = `${WORKER_URL}/docs/download?key=${encodeURIComponent(f.key)}`;
    const delBtn = document.createElement('button'); delBtn.className='del'; delBtn.textContent='Suppr';
    delBtn.onclick = async ()=>{ if (!confirm(`Supprimer "${f.name}" ?`)) return;
      await docsFetchJSON(`${WORKER_URL}/docs/del`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET }, body: JSON.stringify({ key: f.key }) });
      loadEntries();
    };
    actions.append(openBtn, dlBtn, delBtn); card.appendChild(actions);
    docGrid.appendChild(card);
  });
}

createFolderBtn?.addEventListener('click', async ()=>{
  const name = (newFolderName?.value || '').trim();
  if (!name) return alert('Nom de dossier vide');
  await docsFetchJSON(`${WORKER_URL}/docs/mkdir`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET }, body: JSON.stringify({ name, parent: DOCS.folder }) });
  newFolderName.value = ''; await loadEntries(DOCS.folder);
});
deleteFolderBtn?.addEventListener('click', async ()=>{
  if (!DOCS.folder) return alert('Tu es à la racine (rien à supprimer).');
  if (!confirm(`Supprimer le dossier "${DOCS.folder}" et tout son contenu ?`)) return;
  await docsFetchJSON(`${WORKER_URL}/docs/rmdir`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET, 'x-confirm-delete':'yes' }, body: JSON.stringify({ folder: DOCS.folder }) });
  const parent = DOCS.folder.includes('/') ? DOCS.folder.split('/').slice(0,-1).join('/') : '';
  await loadEntries(parent);
});
uploadDocBtn?.addEventListener('click', async ()=>{
  if (!docFileInput?.files?.length) return alert('Choisis un ou plusieurs fichiers');
  const fd = new FormData(); fd.append('folder', DOCS.folder); for (const f of docFileInput.files) fd.append('file', f);
  const r = await fetch(`${WORKER_URL}/docs/upload`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET }, body: fd });
  if (!r.ok) return alert('Upload échoué: ' + (await r.text().catch(()=>r.statusText)));
  docFileInput.value = ''; loadEntries();
});
(async function initDocs(){ await loadEntries(''); })();

// ===========================
// SANTÉ
// ===========================
const healthPeople = $('#healthPeople');
const healthAddForm = $('#healthAddForm');

function renderHealth(){
  if (!healthPeople) return;
  healthPeople.innerHTML = '';
  const persons = state.health?.persons || [];
  if (!persons.length){
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<strong>Aucune personne</strong><div class="muted">Ajoute une personne ci-dessus.</div>`;
    healthPeople.appendChild(empty);
    return;
  }

  persons.forEach(p=>{
    const card = document.createElement('div'); card.className='card';

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-wrap">
          <h3 class="card-title">${escapeHTML(p.name||'--')}</h3>
          <div class="card-meta">${escapeHTML(p.blood||'--')}${(p.allergies && p.allergies.length)?' · ⚠︎ Allergies':''}</div>
        </div>
        <div class="card-actions">
          <button class="badge open-docs">📂 Dossier</button>
          <button class="btn btn-danger del-person">Suppr</button>
        </div>
      </div>

      <details class="box">
        <summary>Infos clés</summary>
        <div class="section-body">
          <div class="meta">Médecin : ${escapeHTML(p.doctor||'--')} · Urgence : ${escapeHTML(p.emergency||'--')}</div>
          <div class="meta">Maladies : ${escapeHTML((p.conditions||[]).join(', ')||'--')}</div>
          <div class="meta">Allergies : ${escapeHTML((p.allergies||[]).join(', ')||'--')}</div>
        </div>
      </details>

      <details class="box">
        <summary>Vaccins</summary>
        <div class="section-body">
          <div id="vaccins-${p.id||p.name}"></div>
          <form class="row add-vaccin" style="margin-top:8px">
            <input name="name" placeholder="Nom vaccin (ex: DTP)">
            <input name="last" type="date" placeholder="Dernière dose">
            <input name="next" type="date" placeholder="Prochaine dose">
            <button>Ajouter</button>
          </form>
        </div>
      </details>

      <details class="box">
        <summary>Traitements</summary>
        <div class="section-body">
          <div id="meds-${p.id||p.name}"></div>
          <form class="grid2 add-med" style="margin-top:8px">
            <input name="name" placeholder="Nom (ex: Ventoline)">
            <input name="dose" placeholder="Dose (ex: 2 bouffées)">
            <input name="freq" placeholder="Fréquence (ex: si besoin)">
            <input name="start" type="date" placeholder="Début">
            <input name="end" type="date" placeholder="Fin (optionnel)">
            <button>Ajouter</button>
          </form>
        </div>
      </details>

      <details class="box">
        <summary>Carnet médical</summary>
        <div class="section-body">
          <div id="records-${p.id||p.name}"></div>
          <form class="grid2 add-record" style="margin-top:8px">
            <input name="date" type="date" value="${todayISO()}">
            <input name="type" placeholder="Type (Consultation, Analyse, …)">
            <input name="title" placeholder="Titre (ex: Pédiatre)">
            <input name="note" placeholder="Note">
            <button>Ajouter</button>
          </form>
        </div>
      </details>
    `;

    // actions
    card.querySelector('.open-docs')?.addEventListener('click', ()=>{
      goToTab('docs');
      window.loadEntries(`Sante/${p.name}`);
    });
    card.querySelector('.del-person')?.addEventListener('click', ()=>{
      if (!confirm(`Supprimer ${p.name} ?`)) return;
      state.health.persons = persons.filter(x=> x!==p); save(); renderHealth();
    });

    // vaccins
    renderVaccinsList(p);
    card.querySelector('.add-vaccin')?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const name = (fd.get('name')||'').trim();
      const last = (fd.get('last')||'').trim();
      const next = (fd.get('next')||'').trim();
      if (!name) return;
      (p.vaccines ||= []).push({ name, last, next });
      save(); renderVaccinsList(p); e.currentTarget.reset();
      if (next){ addToCalendar({ title:`Rappel vaccin ${name} (${p.name})`, date: next, category:'Santé' }); }
    });

    // traitements
    renderMedsList(p);
    card.querySelector('.add-med')?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const m = { name:fd.get('name')||'', dose:fd.get('dose')||'', freq:fd.get('freq')||'', start:fd.get('start')||'', end:fd.get('end')||'' };
      if (!m.name) return;
      (p.meds ||= []).push(m); save(); renderMedsList(p); e.currentTarget.reset();
      if (m.end){ addToCalendar({ title:`Fin traitement ${m.name} (${p.name})`, date:m.end, category:'Santé' }); }
    });

    // carnet
    renderRecords(p);
    card.querySelector('.add-record')?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const r = { date:fd.get('date')||todayISO(), type:fd.get('type')||'', title:fd.get('title')||'', note:fd.get('note')||'' };
      (p.records ||= []).push(r); save(); renderRecords(p); e.currentTarget.reset();
    });

    healthPeople.appendChild(card);
  });
}
function renderVaccinsList(p){
  const host = $(`#vaccins-${p.id||p.name}`); if (!host) return;
  host.innerHTML = '';
  const list = p.vaccines||[];
  if (!list.length){ host.innerHTML = `<div class="muted">Aucun vaccin</div>`; return; }
  list.forEach((v,idx)=>{
    const row = document.createElement('div'); row.className='item';
    row.innerHTML = `<div><strong>${escapeHTML(v.name)}</strong><div class="who">Dernière: ${escapeHTML(v.last||'--')} · Prochaine: ${escapeHTML(v.next||'--')}</div></div>
    <div class="spacer"></div>
    ${v.next?`<button class="ghost sendCal">→ Calendrier</button>`:''}
    <button class="del">Suppr</button>`;
    row.querySelector('.sendCal')?.addEventListener('click', ()=> addToCalendar({ title:`Rappel vaccin ${v.name} (${p.name})`, date:v.next, category:'Santé' }));
    row.querySelector('.del')?.addEventListener('click', ()=>{ (p.vaccines||=[]).splice(idx,1); save(); renderVaccinsList(p); });
    host.appendChild(row);
  });
}
function renderMedsList(p){
  const host = $(`#meds-${p.id||p.name}`); if (!host) return;
  host.innerHTML = '';
  const list = p.meds||[];
  if (!list.length){ host.innerHTML = `<div class="muted">Aucun traitement</div>`; return; }
  list.forEach((m,idx)=>{
    const row = document.createElement('div'); row.className='item';
    row.innerHTML = `<div><strong>${escapeHTML(m.name)}</strong><div class="who">${escapeHTML(m.dose||'--')} · ${escapeHTML(m.freq||'--')} · ${escapeHTML(m.start||'--')} → ${escapeHTML(m.end||'--')}</div></div>
    <div class="spacer"></div><button class="del">Suppr</button>`;
    row.querySelector('.del')?.addEventListener('click', ()=>{ (p.meds||=[]).splice(idx,1); save(); renderMedsList(p); });
    host.appendChild(row);
  });
}
function renderRecords(p){
  const host = $(`#records-${p.id||p.name}`); if (!host) return;
  host.innerHTML = '';
  const list = (p.records||[]).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  if (!list.length){ host.innerHTML = `<div class="muted">Aucune entrée</div>`; return; }
  list.forEach((r,idx)=>{
    const row = document.createElement('div'); row.className='item';
    row.innerHTML = `<div><strong>${escapeHTML(r.date)} -- ${escapeHTML(r.type||'')}</strong><div class="who">${escapeHTML(r.title||'')} · ${escapeHTML(r.note||'')}</div></div>
    <div class="spacer"></div><button class="del">Suppr</button>`;
    row.querySelector('.del')?.addEventListener('click', ()=>{ (p.records||=[]).splice(idx,1); save(); renderRecords(p); });
    host.appendChild(row);
  });
}

healthAddForm?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(healthAddForm);
  const p = {
    id: (fd.get('name')||'').toLowerCase().replace(/\s+/g,'-') || uid(),
    name: fd.get('name')||'',
    blood: fd.get('blood')||'',
    allergies: (fd.get('allergies')||'').split(',').map(s=>s.trim()).filter(Boolean),
    conditions: (fd.get('conditions')||'').split(',').map(s=>s.trim()).filter(Boolean),
    doctor: fd.get('doctor')||'',
    emergency: fd.get('emergency')||'',
    vaccines:[], meds:[], records:[]
  };
  if (!p.name) return;
  (state.health.persons ||= []).unshift(p); // en tête
  save(); healthAddForm.reset(); renderHealth();
});

// ===========================
// VÉHICULES
// ===========================
const vehicleList = $('#vehicleList');
const vehicleAddForm = $('#vehicleAddForm');

function renderVehicles(){
  if (!vehicleList) return;
  vehicleList.innerHTML = '';
  const vs = state.vehicles?.list || [];
  if (!vs.length){
    const empty = document.createElement('div');
    empty.className='card';
    empty.innerHTML = `<strong>Aucun véhicule</strong><div class="muted">Ajoute un véhicule ci-dessus.</div>`;
    vehicleList.appendChild(empty); return;
  }

  vs.forEach(v=>{
    const card = document.createElement('div'); card.className='card';

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-wrap">
          <h3 class="card-title">${escapeHTML(v.make||'--')} ${escapeHTML(v.model||'')}</h3>
          <div class="card-meta">${escapeHTML(v.plate||'')} · ${escapeHTML(String(v.year||'--'))} · ${v.mileage?`${escapeHTML(String(v.mileage))} km`:'--'}</div>
          ${v.vin ? `<div class="card-meta">VIN : ${escapeHTML(v.vin)}</div>` : ``}
        </div>
        <div class="card-actions">
          <button class="badge open-docs">📂 Dossier</button>
          <button class="btn btn-danger del-veh">Suppr</button>
        </div>
      </div>

      <details class="box">
        <summary>Entretiens & rappels</summary>
        <div class="section-body">
          <div id="maint-${v.id}"></div>
          <form class="grid2 add-maint" style="margin-top:8px">
            <input name="title" placeholder="Intitulé (ex: Vidange)">
            <input name="date" type="date" value="${todayISO()}">
            <input name="next" type="date" placeholder="Prochain (optionnel)">
            <input name="km" type="number" placeholder="Km (optionnel)">
            <button>Ajouter</button>
          </form>
        </div>
      </details>

      <details class="box">
        <summary>Assurance / CT</summary>
        <div class="section-body">
          <form class="grid2 set-deadlines" style="margin-top:8px">
            <input name="insurance" type="date" value="${v.insurance||''}" placeholder="Assurance (échéance)">
            <input name="inspection" type="date" value="${v.inspection||''}" placeholder="Contrôle technique">
            <button>Enregistrer</button>
          </form>
        </div>
      </details>
    `;

    // actions
    card.querySelector('.open-docs')?.addEventListener('click', ()=>{
      goToTab('docs'); window.loadEntries(`Vehicules/${v.plate || v.id}`);
    });
    card.querySelector('.del-veh')?.addEventListener('click', ()=>{
      if (!confirm(`Supprimer ${v.make||''} ${v.model||''} (${v.plate||''}) ?`)) return;
      state.vehicles.list = vs.filter(x=> x!==v); save(); renderVehicles();
    });

    // entretiens
    renderMaint(v);
    card.querySelector('.add-maint')?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const m = { title:fd.get('title')||'', date:fd.get('date')||todayISO(), next:fd.get('next')||'', km:fd.get('km')||'' };
      if (!m.title) return;
      (v.maintenance ||= []).push(m); save(); renderMaint(v); e.currentTarget.reset();
      if (m.next){ addToCalendar({ title:`${m.title} (${v.make||''} ${v.model||''} ${v.plate||''})`, date:m.next, category:'Autre' }); }
    });

    // deadlines
    card.querySelector('.set-deadlines')?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      v.insurance  = fd.get('insurance') || '';
      v.inspection = fd.get('inspection') || '';
      save();
      if (v.insurance){  addToCalendar({ title:`Assurance véhicule (${v.plate})`,  date:v.insurance, category:'Autre' }); }
      if (v.inspection){ addToCalendar({ title:`Contrôle technique (${v.plate})`, date:v.inspection, category:'Autre' }); }
      alert('Échéances enregistrées');
    });

    vehicleList.appendChild(card);
  });
}
function renderMaint(v){
  const host = $(`#maint-${v.id}`); if (!host) return;
  host.innerHTML = '';
  const list = (v.maintenance||[]).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  if (!list.length){ host.innerHTML = `<div class="muted">Aucun entretien</div>`; return; }
  list.forEach((m,idx)=>{
    const row = document.createElement('div'); row.className='item';
    row.innerHTML = `<div><strong>${escapeHTML(m.date)} -- ${escapeHTML(m.title)}</strong><div class="who">${m.km?`${escapeHTML(String(m.km))} km · `:''}Prochain: ${escapeHTML(m.next||'--')}</div></div>
    <div class="spacer"></div>${m.next?`<button class="ghost sendCal">→ Calendrier</button>`:''}<button class="del">Suppr</button>`;
    row.querySelector('.sendCal')?.addEventListener('click', ()=> addToCalendar({ title:`${m.title} (${v.plate})`, date:m.next, category:'Autre' }));
    row.querySelector('.del')?.addEventListener('click', ()=>{ (v.maintenance||=[]).splice(idx,1); save(); renderMaint(v); });
    host.appendChild(row);
  });
}

vehicleAddForm?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(vehicleAddForm);
  const v = {
    id: (fd.get('plate')||'').toUpperCase().replace(/\W+/g,'-') || ('veh-'+uid()),
    plate: (fd.get('plate')||'').toUpperCase(),
    make: fd.get('make')||'',
    model: fd.get('model')||'',
    year: Number(fd.get('year')||'')||'',
    vin: fd.get('vin')||'',
    mileage: Number(fd.get('mileage')||'')||'',
    maintenance: []
  };
  if (!v.plate) return;
  (state.vehicles.list ||= []).unshift(v); // en tête
  save(); vehicleAddForm.reset(); renderVehicles();
});

// ===========================
// INIT
// ===========================
(function init(){
  showPanel('home');               // assure une section visible
  renderTasks(); renderBudget(); renderNotes();
  const now = new Date();          // calendrier
  calMonth = now.getMonth(); calYear = now.getFullYear();
  renderEvents();
  updateDashboard();
  renderHealth(); renderVehicles(); // santé / véhicules
})();