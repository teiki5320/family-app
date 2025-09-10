// ===== Helpers & State =====
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const KEY = 'familyApp.v1';
const DEFAULT_STATE = { tasks:[], tx:[], notes:"", events:[] };

let state;
try {
  state = JSON.parse(localStorage.getItem(KEY) || JSON.stringify(DEFAULT_STATE));
  state = { ...DEFAULT_STATE, ...state };
} catch { state = { ...DEFAULT_STATE }; }

function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function fmtEUR(x){ return (x||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}); }
function pad(n){ return String(n).padStart(2,'0'); }

// ===== Tabs (délégation d'événements) =====
function showPanel(id){
  document.querySelectorAll('.tab').forEach(t=> t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=> p.classList.remove('active'));
  const btn = document.querySelector(`.tab[data-tab="${id}"]`);
  const panel = document.getElementById(id);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');
}
const tabsBar = document.querySelector('.tabs');
if (tabsBar){
  tabsBar.addEventListener('click', (e)=>{
    const btn = e.target.closest('.tab');
    if (!btn) return;
    if (btn.id === 'menuTab') { e.preventDefault(); return; } // lien externe géré à part
    e.preventDefault();
    const id = btn.dataset.tab;
    if (id) showPanel(id);
  });
}
function goToTab(id){ if (id) showPanel(id); }
(function ensureInitialTab(){
  const current = document.querySelector('.tab.active[data-tab]');
  showPanel(current ? current.dataset.tab : 'home');
})();

// Quand on ouvre l'onglet Calendrier : on remet les filtres à zéro
document.querySelector('.tab[data-tab="calendar"]')?.addEventListener('click', ()=>{
  selectedDate = null;
  const f = document.getElementById('calFilter');  if (f) f.value = '*';
  const s = document.getElementById('calSearch');  if (s) s.value = '';
  renderEvents?.();
});

// ===== MENU (Clic&miam du jour) =====
const MENU_PREFIX = "https://clicetmiam.fr/mesmenus/5387/5765/";
const tz = "Europe/Paris";
function partsFromDate(d){
  const fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' });
  const [{ value: dd }, , { value: mm }, , { value: yyyy }] = fmt.formatToParts(d);
  return { yyyy, mm, dd };
}
function buildMenuUrl(d){
  const { yyyy, mm, dd } = partsFromDate(d);
  return MENU_PREFIX + `${yyyy}/${mm}/${dd}Menu`;
}
$('#menuTab')?.addEventListener('click', (e)=>{ e.preventDefault(); window.open(buildMenuUrl(new Date()), '_blank'); });
$('#tileMenu')?.addEventListener('click', ()=> window.open(buildMenuUrl(new Date()), '_blank'));

// ===== Dashboard interactions (tuiles) =====
document.querySelectorAll('.tile[data-tab]')?.forEach(t=> t.addEventListener('click', ()=> goToTab(t.dataset.tab)));
document.querySelectorAll('.tile[data-external]')?.forEach(t=>{
  t.addEventListener('click', ()=>{
    const map = { docs:'#docs', messages:'#chat' };
    const url = map[t.dataset.external] || '#';
    if (url.startsWith('#')) goToTab(url.slice(1)); else window.open(url, '_blank');
  });
});

// ===== TÂCHES =====
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
        <div>${t.text}</div>
        <div class="who">${t.who || 'Tous'}</div>
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

// ===== BUDGET =====
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
      <div><strong>${t.label}</strong><div class="who">${new Date(t.ts).toLocaleDateString('fr-FR')}</div></div>
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

// ===== NOTES =====
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

// ===== MÉTÉO (Open-Meteo) =====
const LAT = 46.6403, LON = -1.1616; // adapte à ta ville
const wxEmoji = $('#wxEmoji'), wxTemp = $('#wxTemp'), wxDesc = $('#wxDesc'), wxTile = $('#wxTile'), wxPlace = $('#wxPlace'), wxDaily = $('#wxDaily');

function codeToWeather(code){
  const map = {
    0:"Ciel dégagé", 1:"Peu nuageux", 2:"Partiellement nuageux", 3:"Couvert",
    45:"Brouillard", 48:"Brouillard givrant",
    51:"Bruine légère", 53:"Bruine", 55:"Bruine forte",
    61:"Pluie faible", 63:"Pluie", 65:"Pluie forte",
    71:"Neige faible", 73:"Neige", 75:"Neige forte",
    95:"Orage", 96:"Orage avec grêle", 99:"Orage fort grêle"
  };
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
    console.error('Météo:', e);
    if (wxTile) wxTile.textContent = 'Météo indisponible';
    if (wxDesc) wxDesc.textContent = 'Erreur';
  }
}
loadWeather();
setInterval(loadWeather, 2*60*60*1000);

// ===== Chat + Fichiers (Cloudflare Worker) =====
const WORKER_URL = 'https://family-app.teiki5320.workers.dev';
const SECRET = 'Partenaire85/';
const ROOM   = 'family';

// URLs calendrier côté Worker
const SUB_URL         = `${WORKER_URL}/calendar.ics?token=Partenaire85/`;
const WORKER_CAL_ADD  = `${WORKER_URL}/cal/add`;
const WORKER_CAL_LIST = `${WORKER_URL}/cal/list`;

const chatList   = document.getElementById('chatList');
const chatInput  = document.getElementById('chatInput');
const chatSend   = document.getElementById('chatSend');
const chatFile   = document.getElementById('chatFile');
const chatUpload = document.getElementById('chatUpload');
const chatName   = document.getElementById('chatName');

const NAME_KEY = 'familyApp.chatName';
if (chatName) chatName.value = localStorage.getItem(NAME_KEY) || '';
chatName?.addEventListener('change', ()=> localStorage.setItem(NAME_KEY, (chatName.value||'').trim()));

let lastTs = 0;
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
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
async function sendMessage(){
  const hasFile = !!(chatFile?.files && chatFile.files.length);
  const text = (chatInput?.value || '').trim();
  const author = (chatName?.value || 'Anonyme').trim() || 'Anonyme';

  if (hasFile){
    const url = await uploadFile();
    if (url && text) {
      chatInput.value = '';
      try{
        await fetch(`${WORKER_URL}/messages`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET },
          body: JSON.stringify({ room: ROOM, author, text })
        });
      }catch(e){ alert('Message après fichier non envoyé : ' + (e?.message||e)); }
    }
    setTimeout(refreshMessages, 250);
    return;
  }

  if (!text) return;
  chatInput.value = '';
  try{
    await fetch(`${WORKER_URL}/messages`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET },
      body: JSON.stringify({ room: ROOM, author, text })
    });
    renderMessages([{ author, text, ts: Date.now() }]);
    setTimeout(refreshMessages, 200);
  }catch(e){
    alert('Envoi message impossible : ' + (e?.message || e));
  }
}
async function uploadFile(){
  if (!chatFile?.files?.length) { alert('Choisis un fichier'); return null; }
  const f = chatFile.files[0];

  chatUpload?.setAttribute('disabled', 'true');
  chatSend?.setAttribute('disabled', 'true');
  const oldSend = chatSend?.textContent;
  if (chatSend) chatSend.textContent = 'Envoi…';

  try{
    const fd = new FormData();
    fd.append('file', f);
    fd.append('author', (chatName?.value || 'Anonyme'));
    fd.append('room', ROOM);

    const r = await fetch(`${WORKER_URL}/upload`, {
      method:'POST',
      headers:{ Authorization:'Bearer '+SECRET },
      body: fd
    });

    if (!r.ok) {
      const txt = await r.text().catch(()=> '');
      alert('Échec upload ('+ r.status +') ' + txt);
      return null;
    }

    const data = await r.json().catch(()=> ({}));
    chatFile.value = '';
    return data.url || null;

  } catch(e){
    alert('Erreur upload : ' + (e?.message || e));
    return null;

  } finally {
    chatUpload?.removeAttribute('disabled');
    chatSend?.removeAttribute('disabled');
    if (chatSend) chatSend.textContent = oldSend || 'Envoyer';
  }
}
chatSend?.addEventListener('click', sendMessage);
chatInput?.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }});
refreshMessages(); setInterval(refreshMessages, 4000);

// ===== CALENDRIER (local + Worker ICS) =====
if (!Array.isArray(state.events)) state.events = [];
const eventForm = $('#eventForm'), eventTitle = $('#eventTitle'), eventDate = $('#eventDate'), eventTime = $('#eventTime');

function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
let selectedDate = todayISO();

let calMonth = new Date().getMonth();
let calYear  = new Date().getFullYear();

function renderMonth(y,m){
  const grid = document.getElementById('calGrid');
  if(!grid) return;
  grid.innerHTML='';

  const first = new Date(y,m,1);
  const start = first.getDay()===0 ? 6 : first.getDay()-1; // lundi=0
  const daysInMonth = new Date(y,m+1,0).getDate();

  const monthLabel = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(first);
  const calMonthLabel = document.getElementById('calMonthLabel');
  if (calMonthLabel) calMonthLabel.textContent = monthLabel;

  for(let i=0;i<start;i++){ grid.appendChild(document.createElement('div')); }

  for(let d=1; d<=daysInMonth; d++){
    const cell = document.createElement('div');
    cell.className='day';
    const ds = `${y}-${pad(m+1)}-${pad(d)}`;

    if (ds === todayISO())   cell.classList.add('today');
    if (ds === selectedDate) cell.classList.add('selected');

    cell.innerHTML = `<div class="num">${d}</div>`;

    const evs = (state.events||[]).filter(ev=>ev.date===ds);
    evs.forEach(ev=>{
      const dot=document.createElement('span');
      dot.className='cal-dot cat-'+(ev.category||'Autre');
      cell.appendChild(dot);
    });

    cell.addEventListener('click', ()=>{
      selectedDate = (selectedDate === ds) ? null : ds;
      renderEvents();
      renderMonth(calYear, calMonth);
    });

    grid.appendChild(cell);
  }
}
document.getElementById('calPrev')?.addEventListener('click', ()=>{
  if(--calMonth<0){ calMonth=11; calYear--; }
  renderMonth(calYear,calMonth);
});
document.getElementById('calNext')?.addEventListener('click', ()=>{
  if(++calMonth>11){ calMonth=0; calYear++; }
  renderMonth(calYear,calMonth);
});
document.getElementById('calToday')?.addEventListener('click', ()=>{
  const now = new Date();
  calMonth = now.getMonth();
  calYear  = now.getFullYear();
  selectedDate = todayISO();
  renderMonth(calYear, calMonth);
  renderEvents();
});
document.getElementById('calFilter')?.addEventListener('change', renderEvents);
document.getElementById('calSearch')?.addEventListener('input', renderEvents);

function renderEvents(){
  const filter = document.getElementById('calFilter')?.value || '*';
  const search = (document.getElementById('calSearch')?.value||'').toLowerCase();
  const list = document.getElementById('eventList');
  if(!list) return;
  list.innerHTML='';

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
        <strong>${ev.title}</strong>
        <div class="who">${when}${ev.place?` · ${ev.place}`:''} [${ev.category||'Autre'}]</div>
      </div>
      <div class="spacer"></div>
      <button class="del" aria-label="Supprimer">Suppr</button>
    `;
    li.querySelector('.del')?.addEventListener('click', async ()=>{
      if (ev.remoteId) {
        try{
          await fetch(`${WORKER_URL}/cal/del?id=${encodeURIComponent(ev.remoteId)}`, {
            method:'POST',
            headers:{ Authorization:'Bearer '+SECRET }
          });
        }catch(e){ /* non bloquant */ }
      }
      const idx = state.events.indexOf(ev);
      if (idx > -1) { state.events.splice(idx,1); save(); renderEvents(); renderMonth(calYear, calMonth); }
    });
    list.appendChild(li);
  });

  if (!events.length){
    const li = document.createElement('li');
    li.className = 'item';
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
    title,
    date: eventDate.value,
    time: eventTime?.value || '09:00',
    place: (document.getElementById('eventPlace')?.value || ''),
    category: (document.getElementById('eventCategory')?.value || 'Autre'),
    note: (document.getElementById('eventNote')?.value || '')
  };

  // local
  state.events.push(ev); save(); renderEvents(); eventForm.reset();

  // Worker
  try{
    const r = await fetch(WORKER_CAL_ADD, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET },
      body: JSON.stringify(ev)
    });
    const data = await r.json().catch(()=>null);
    if (data && data.id) { ev.remoteId = data.id; save(); }
  }catch(e){ /* silencieux */ }
});

async function syncFromWorker(){
  try{
    const r = await fetch(WORKER_CAL_LIST);
    const data = await r.json();
    if (!Array.isArray(data.events)) return;
    let changed = false;

    for (const w of data.events){
      let local = state.events.find(e => e.remoteId === w.id) ||
                  state.events.find(e => e.title===w.title && e.date===w.date && (e.time||'')===(w.time||''));
      if (!local){
        state.events.push({
          title:w.title, date:w.date, time:w.time||'',
          place:w.place||'', category:w.category||'Autre', note:w.note||'',
          remoteId:w.id
        });
        changed = true;
      } else if (!local.remoteId){
        local.remoteId = w.id; changed = true;
      }
    }
    if (changed){ save(); renderEvents(); }
  }catch(e){}
}

// init calendrier
(function initCalendar(){
  const now = new Date();
  calMonth = now.getMonth();
  calYear  = now.getFullYear();
  renderEvents();
  syncFromWorker();
})();

// ===== DOCUMENTS (Cloudflare R2 via Worker, navigation dossiers) =====
const docsBreadcrumb     = document.getElementById('docsBreadcrumb');
const folderGrid         = document.getElementById('folderGrid');
const docList            = document.getElementById('docList');

const newFolderName      = document.getElementById('newFolderName');      // racine
const createFolderBtn    = document.getElementById('createFolderBtn');

const newSubFolderName   = document.getElementById('newSubFolderName');   // sous-dossier
const createSubFolderBtn = document.getElementById('createSubFolderBtn');

const deleteFolderBtn    = document.getElementById('deleteFolderBtn');

const docsFileInput      = document.getElementById('docFile');
const docsUploadBtn      = document.getElementById('uploadDocBtn');

const DOCS = {
  path: '',    // chemin courant ("" = racine, sinon "Ecole/2025")
  folders: [], // sous-dossiers du chemin courant
  files: []    // fichiers du chemin courant
};

function breadcrumbs(){
  const parts = DOCS.path ? DOCS.path.split('/') : [];
  const items = ['<a href="#" data-path="">/</a>'];
  let acc = '';
  for (let i=0;i<parts.length;i++){
    acc = i===0 ? parts[0] : acc + '/' + parts[i];
    items.push(`<span>›</span><a href="#" data-path="${acc}">${parts[i]}</a>`);
  }
  docsBreadcrumb.innerHTML = `<div class="breadcrumb">${items.join(' ')}</div>`;
  docsBreadcrumb.querySelectorAll('a').forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      DOCS.path = a.dataset.path || '';
      refreshDocs();
    });
  });
}

function renderFolders(){
  folderGrid.innerHTML = '';
  if (!DOCS.folders.length){
    folderGrid.innerHTML = `<div class="muted">Aucun sous-dossier</div>`;
    return;
  }
  DOCS.folders.forEach(name=>{
    const el = document.createElement('div');
    el.className = 'folder-item';
    el.innerHTML = `
      <div class="top">
        <div style="font-size:22px">📁</div>
        <div class="name">${name}</div>
      </div>
      <div class="actions">
        <button class="ghost open">Ouvrir</button>
        <button class="del">Suppr</button>
      </div>
    `;
    el.querySelector('.open')?.addEventListener('click', ()=>{
      DOCS.path = DOCS.path ? `${DOCS.path}/${name}` : name;
      refreshDocs();
    });
    el.querySelector('.del')?.addEventListener('click', async ()=>{
      if (!confirm(`Supprimer le dossier "${name}" et tout son contenu ?`)) return;
      const full = DOCS.path ? `${DOCS.path}/${name}` : name;
      await docsFetchJSON(`${WORKER_URL}/docs/rmdir`, {
        method:'POST',
        headers:{ Authorization:'Bearer '+SECRET },
        body: JSON.stringify({ folder: full })
      }).catch(e=> alert(e.message||e));
      refreshDocs();
    });
    folderGrid.appendChild(el);
  });
}

function renderFiles(){
  docList.innerHTML = '';
  if (!DOCS.files.length){
    docList.innerHTML = `<li class="item"><div><strong>Aucun fichier</strong><div class="who">Ajoute des fichiers au dossier "${DOCS.path || '/'}".</div></div></li>`;
    return;
  }
  DOCS.files
    .sort((a,b)=> new Date(b.uploaded) - new Date(a.uploaded))
    .forEach(f=>{
      const when = new Date(f.uploaded).toLocaleString('fr-FR');
      const sizeKB = (f.size/1024).toFixed(1) + ' Ko';
      const li = document.createElement('li'); li.className='item';
      li.innerHTML = `
        <div>
          <div class="name">${f.name}</div>
          <div class="who">${sizeKB} · ${f.httpMetadata?.contentType||'fichier'} · ${when}</div>
        </div>
        <div class="spacer"></div>
        <a class="ghost" href="${WORKER_URL}/docs/get?key=${encodeURIComponent(f.key)}" target="_blank" rel="noopener">Ouvrir</a>
        <a class="ghost" href="${WORKER_URL}/docs/download?key=${encodeURIComponent(f.key)}">Télécharger</a>
        <button class="del">Suppr</button>
      `;
      li.querySelector('.del')?.addEventListener('click', async ()=>{
        if (!confirm(`Supprimer "${f.name}" ?`)) return;
        await docsFetchJSON(`${WORKER_URL}/docs/del`, {
          method:'POST',
          headers:{ Authorization:'Bearer '+SECRET },
          body: JSON.stringify({ key: f.key })
        }).catch(e=> alert(e.message||e));
        refreshDocs();
      });
      docList.appendChild(li);
    });
}

/* --- appels réseau util --- */
async function docsFetchJSON(url, init={}){
  const r = await fetch(url, {
    ...init,
    headers: { 'Content-Type':'application/json', ...(init.headers||{}) }
  });
  if (!r.ok) throw new Error(await r.text().catch(()=>r.statusText));
  return await r.json();
}
async function loadEntries(){
  const q = DOCS.path ? `?folder=${encodeURIComponent(DOCS.path)}` : '';
  const data = await docsFetchJSON(`${WORKER_URL}/docs/list${q}`);
  DOCS.folders = data.folders || [];
  DOCS.files   = data.files || [];
}

/* --- actions UI --- */
createFolderBtn?.addEventListener('click', async ()=>{
  const name = (newFolderName?.value||'').trim();
  if (!name) return alert('Nom vide');
  await docsFetchJSON(`${WORKER_URL}/docs/mkdir`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+SECRET },
    body: JSON.stringify({ name, parent:'' })
  }).catch(e=> alert(e.message||e));
  newFolderName.value='';
  refreshDocs();
});

createSubFolderBtn?.addEventListener('click', async ()=>{
  const name = (newSubFolderName?.value||'').trim();
  if (!name) return alert('Nom vide');
  await docsFetchJSON(`${WORKER_URL}/docs/mkdir`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+SECRET },
    body: JSON.stringify({ name, parent: DOCS.path })
  }).catch(e=> alert(e.message||e));
  newSubFolderName.value='';
  refreshDocs();
});

deleteFolderBtn?.addEventListener('click', async ()=>{
  if (!DOCS.path){ alert('Tu es à la racine.'); return; }
  if (!confirm(`Supprimer le dossier "${DOCS.path}" et tout son contenu ?`)) return;
  await docsFetchJSON(`${WORKER_URL}/docs/rmdir`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+SECRET },
    body: JSON.stringify({ folder: DOCS.path })
  }).catch(e=> alert(e.message||e));
  // remonter au parent
  DOCS.path = DOCS.path.includes('/') ? DOCS.path.split('/').slice(0,-1).join('/') : '';
  refreshDocs();
});

docsUploadBtn?.addEventListener('click', async ()=>{
  if (!docsFileInput?.files?.length) return alert('Choisis des fichiers');
  const fd = new FormData();
  fd.append('folder', DOCS.path);
  for (const f of docsFileInput.files) fd.append('file', f);
  const r = await fetch(`${WORKER_URL}/docs/upload`, {
    method:'POST',
    headers:{ Authorization:'Bearer '+SECRET },
    body: fd
  });
  if (!r.ok) return alert('Upload échoué: ' + (await r.text().catch(()=>r.statusText)));
  docsFileInput.value='';
  refreshDocs();
});

/* --- cycle de rendu --- */
async function refreshDocs(){
  breadcrumbs();
  await loadEntries();
  renderFolders();
  renderFiles();
}

// init
refreshDocs();

// ===== Dashboard numbers =====
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

// ===== Initial render =====
renderTasks();
renderBudget();
renderNotes();
updateDashboard();