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

// ===== Tabs (ignore le lien externe "Menu") =====
$$('.tab').forEach(btn=>{
  if (btn.id === 'menuTab') return;
  btn.addEventListener('click', ()=>{
    $$('.tab').forEach(b=>b.classList.remove('active'));
    $$('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('#'+btn.dataset.tab)?.classList.add('active');
  });
});
function goToTab(id){
  const tab = document.querySelector(`.tab[data-tab="${id}"]`);
  if (!tab) return; tab.click();
}

// Quand on ouvre l'onglet Calendrier : on remet les filtres à zéro
document.querySelector('.tab[data-tab="calendar"]')?.addEventListener('click', ()=>{
  selectedDate = null; // enlève le filtre par jour
  const f = document.getElementById('calFilter');  if (f) f.value = '*';
  const s = document.getElementById('calSearch');  if (s) s.value = '';
  renderEvents();
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

// ===== Dashboard interactions =====
document.querySelectorAll('.tile[data-tab]')?.forEach(t=> t.addEventListener('click', ()=> goToTab(t.dataset.tab)));
document.querySelectorAll('.tile[data-external]')?.forEach(t=>{
  t.addEventListener('click', ()=>{
    const map = { docs:'https://drive.google.com/', messages:'#chat' };
    const url = map[t.dataset.external] || '#';
    if (url === '#chat') goToTab('chat'); else window.open(url, '_blank');
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

// ===== EXPORT / IMPORT global =====
$('#shareBtn')?.addEventListener('click', async ()=>{
  const data = JSON.stringify(state, null, 2);
  const file = new File([data], 'famille-data.json', {type:'application/json'});
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try{ await navigator.share({ files:[file], title:'Famille - Export', text:'Données de l’app' }); }catch(e){}
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = 'famille-data.json'; a.click();
    URL.revokeObjectURL(url);
    alert('Export effectué : "famille-data.json".');
  }
});
$('#importBtn')?.addEventListener('click', ()=> $('#importFile')?.click());
$('#importFile')?.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  try{
    const obj = JSON.parse(await f.text());
    state.tasks  = Array.isArray(obj.tasks)? obj.tasks : state.tasks;
    state.tx     = Array.isArray(obj.tx)? obj.tx : state.tx;
    state.notes  = typeof obj.notes==='string'? obj.notes : state.notes;
    state.events = Array.isArray(obj.events)? obj.events : state.events;
    save(); renderTasks(); renderBudget(); renderNotes(); renderEvents();
    alert('Import réussi ✔︎');
  }catch(err){ alert('Import impossible: ' + err.message); }
});

// ===== CALENDRIER local + ICS =====
if (!Array.isArray(state.events)) state.events = [];
const eventForm = $('#eventForm'), eventTitle = $('#eventTitle'), eventDate = $('#eventDate'), eventTime = $('#eventTime');
const eventList = $('#eventList');

// URLs Worker
const SUB_URL = 'https://family-app.teiki5320.workers.dev/calendar.ics?token=Partenaire85/'; // (utilisé seulement pour info)
const WORKER_CAL_ADD  = `${WORKER_URL}/cal/add`;
const WORKER_CAL_LIST = `${WORKER_URL}/cal/list`;

// --- Helpers sélection jour
function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
let selectedDate = todayISO();

// --- Grille mensuelle
let calMonth = new Date().getMonth();
let calYear  = new Date().getFullYear();

function renderMonth(y,m){
  const grid = document.getElementById('calGrid');
  if(!grid) return;
  grid.innerHTML='';

  const first = new Date(y,m,1);
  const start = first.getDay()===0 ? 6 : first.getDay()-1; // lundi=0
  const daysInMonth = new Date(y,m+1,0).getDate();

  // label
  const monthLabel = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(first);
  document.getElementById('calMonthLabel')?.textContent = monthLabel;

  // cases vides avant le 1er
  for(let i=0;i<start;i++){ grid.appendChild(document.createElement('div')); }

  // jours
  for(let d=1; d<=daysInMonth; d++){
    const cell = document.createElement('div');
    cell.className='day';
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    if (ds === todayISO())   cell.classList.add('today');
    if (ds === selectedDate) cell.classList.add('selected');

    cell.innerHTML = `<div class="num">${d}</div>`;

    // pastilles d'évènements
    const evs = (state.events||[]).filter(ev=>ev.date===ds);
    evs.forEach(ev=>{
      const dot=document.createElement('span');
      dot.className='cal-dot cat-'+(ev.category||'Autre');
      cell.appendChild(dot);
    });

    // clic = sélection / dé-sélection du jour
    cell.addEventListener('click', ()=>{
      selectedDate = (selectedDate === ds) ? null : ds;
      renderEvents();
      renderMonth(calYear, calMonth);
    });

    grid.appendChild(cell);
  }
}

// nav mois
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

// filtre & recherche
document.getElementById('calFilter')?.addEventListener('change', renderEvents);
document.getElementById('calSearch')?.addEventListener('input', renderEvents);

// --- Affichage + suppression (local + Worker)
renderEvents = function(){
  const filter = document.getElementById('calFilter')?.value || '*';
  const search = (document.getElementById('calSearch')?.value||'').toLowerCase();
  const list = document.getElementById('eventList');
  if(!list) return;
  list.innerHTML='';

  const sel = selectedDate; // peut être null

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

    // bouton supprimer : Worker + local
    li.querySelector('.del')?.addEventListener('click', async ()=>{
      if (ev.remoteId) {
        try{
          await fetch(`${WORKER_URL}/cal/del?id=${encodeURIComponent(ev.remoteId)}`, {
            method:'POST',
            headers:{ Authorization:'Bearer '+SECRET }
          });
        }catch(e){ /* pas bloquant */ }
      }
      const idx = state.events.indexOf(ev);
      if (idx > -1) { state.events.splice(idx,1); save(); renderEvents(); }
    });

    list.appendChild(li);
  });

  // message vide
  if (!events.length){
    const li = document.createElement('li');
    li.className = 'item';
    const msg = sel ? 'Aucun évènement ce jour' : 'Aucun évènement';
    li.innerHTML = `<div><strong>${msg}</strong>
                    <div class="who">Clique une autre date ou réinitialise les filtres</div></div>`;
    list.appendChild(li);
  }

  renderMonth(calYear,calMonth);
  updateDashboard();
};

// --- Ajout d'évènement (avec remoteId du Worker)
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

  // 1) local
  state.events.push(ev);
  save();
  renderEvents();
  eventForm.reset();

  // 2) Worker
  try{
    const r = await fetch(WORKER_CAL_ADD, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET },
      body: JSON.stringify(ev)
    });
    const data = await r.json().catch(()=>null);
    if (data && data.id) {
      const last = state.events[state.events.length - 1];
      if (last === ev) { ev.remoteId = data.id; save(); }
    }
  }catch(e){ /* silencieux si hors-ligne */ }
});

// --- Sync initial depuis le Worker pour récupérer les remoteId manquants
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

// --- init calendrier
(function initCalendar(){
  const now = new Date();
  calMonth = now.getMonth();
  calYear  = now.getFullYear();
  renderEvents();
  syncFromWorker();
})();

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

// ===== Chat + Fichiers (Cloudflare Worker) =====
const WORKER_URL = 'https://family-app.teiki5320.workers.dev'; // ← ton Worker
const SECRET = 'Partenaire85/';                // ← mets la même valeur que dans Cloudflare
const ROOM   = 'family';

const chatList   = document.getElementById('chatList');
const chatInput  = document.getElementById('chatInput');
const chatSend   = document.getElementById('chatSend');
const chatFile   = document.getElementById('chatFile');
const chatUpload = document.getElementById('chatUpload');
const chatName   = document.getElementById('chatName');
const SUB_URL = 'https://family-app.teiki5320.workers.dev/calendar.ics?token=Partenaire85/'; // ← remplace par ton CAL_TOKEN
const WORKER_CAL_ADD = `${WORKER_URL}/cal/add`;
const WORKER_CAL_LIST = `${WORKER_URL}/cal/list`;

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

  // 1) S’il y a un fichier sélectionné, on l’envoie d’abord
  if (hasFile){
    const url = await uploadFile(); // le Worker crée un message 📎 automatiquement
    // si tu veux concaténer un message texte en plus du fichier :
    if (url && text) {
      chatInput.value = ''; // on enverra juste après
      try{
        await fetch(`${WORKER_URL}/messages`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET },
          body: JSON.stringify({ room: ROOM, author, text })
        });
      }catch(e){ alert('Message après fichier non envoyé : ' + (e?.message||e)); }
    }
    setTimeout(refreshMessages, 250);
    return; // on sort : bouton "Envoyer" a servi à envoyer le fichier
  }

  // 2) Sinon, envoi d’un message texte normal
  if (!text) return;
  chatInput.value = '';
  try{
    await fetch(`${WORKER_URL}/messages`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET },
      body: JSON.stringify({ room: ROOM, author, text })
    });
    // affichage optimiste + sync
    renderMessages([{ author, text, ts: Date.now() }]);
    setTimeout(refreshMessages, 200);
  }catch(e){
    alert('Envoi message impossible : ' + (e?.message || e));
  }
}
async function uploadFile(){
  if (!chatFile?.files?.length) { alert('Choisis un fichier'); return null; }
  const f = chatFile.files[0];

  // UI lock
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
    // le Worker poste déjà un message 📎 automatiquement dans le chat
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

// ===== Calendrier mensuel =====

// Helpers & état de sélection (EN DEHORS des fonctions)
function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
let selectedDate = todayISO(); // mettre null si tu veux "tout" au démarrage

let calMonth = new Date().getMonth();
let calYear  = new Date().getFullYear();

function renderMonth(y,m){
  const grid = document.getElementById('calGrid');
  if(!grid) return;
  grid.innerHTML='';

  const first = new Date(y,m,1);
  const start = first.getDay()===0 ? 6 : first.getDay()-1; // lundi=0
  const daysInMonth = new Date(y,m+1,0).getDate();

  // label mois
  const monthLabel = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(first);
  document.getElementById('calMonthLabel').textContent = monthLabel;

  // cases vides avant le 1er
  for(let i=0;i<start;i++){ grid.appendChild(document.createElement('div')); }

  // jours du mois
  for(let d=1; d<=daysInMonth; d++){
    const cell = document.createElement('div');
    cell.className='day';
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    if (ds === todayISO())      cell.classList.add('today');
    if (ds === selectedDate)    cell.classList.add('selected');

    cell.innerHTML = `<div class="num">${d}</div>`;

    // pastilles d'évènements
    const evs = (state.events||[]).filter(ev=>ev.date===ds);
    evs.forEach(ev=>{
      const dot=document.createElement('span');
      dot.className='cal-dot cat-'+(ev.category||'Autre');
      cell.appendChild(dot);
    });

    // clic = sélection / dé-sélection du jour
    cell.addEventListener('click', ()=>{
      selectedDate = (selectedDate === ds) ? null : ds;
      renderEvents();
      renderMonth(calYear, calMonth);
    });

    grid.appendChild(cell);
  }
}

// nav mois
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

// filtre & recherche
document.getElementById('calFilter')?.addEventListener('change', renderEvents);
document.getElementById('calSearch')?.addEventListener('input', renderEvents);

// ---- Nouvelle version de renderEvents (filtre jour + catégorie + recherche)
renderEvents = function(){
  const filter = document.getElementById('calFilter')?.value || '*';
  const search = (document.getElementById('calSearch')?.value||'').toLowerCase();
  const list = document.getElementById('eventList');
  if(!list) return;
  list.innerHTML='';

  const sel = selectedDate; // jour choisi (peut être null)

  const events = (state.events||[]).filter(ev=>{
    const byDay  = !sel || ev.date === sel;
    const byCat  = (filter==='*' || ev.category===filter);
    const byText = (!search || (ev.title||'').toLowerCase().includes(search) || (ev.place||'').toLowerCase().includes(search));
    return byDay && byCat && byText;
  }).sort((a,b)=> (a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));

  events.forEach(ev=>{
    const li=document.createElement('li'); li.className='item';
    li.innerHTML=`<div><strong>${ev.title}</strong>
      <div class="who">${ev.date} ${ev.time||''} · ${ev.place||''} [${ev.category}]</div></div>`;
    list.appendChild(li);
  });
  if (!events.length){
  const li = document.createElement('li');
  li.className = 'item';
  li.innerHTML = `<div><strong>Aucun évènement ce jour</strong>
                  <div class="who">Clique une autre date ou réinitialise les filtres</div></div>`;
  list.appendChild(li);
}

  renderMonth(calYear,calMonth);
  updateDashboard();
};

// init calendrier
const now = new Date();
calMonth = now.getMonth();
calYear  = now.getFullYear();
renderEvents();

async function syncFromWorker(){
  try{
    const r = await fetch(WORKER_CAL_LIST);
    const data = await r.json();
    if (!Array.isArray(data.events)) return;
    let changed = false;

    for (const w of data.events){ // {id,title,date,time,place,category,note,ts}
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

// ===== Initial render =====
renderTasks(); renderBudget(); renderNotes(); syncFromWorker(); renderEvents(); updateDashboard();
refreshMessages(); setInterval(refreshMessages, 4000);