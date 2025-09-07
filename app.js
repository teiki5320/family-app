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
function escapeHTML(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function linkify(t){ return escapeHTML(t).replace(/https?:\/\/\S+/g, m => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`); }

// ===== Onglets (ignore le lien externe "Menu") =====
$$('.tab').forEach(btn=>{
  if (btn.id === 'menuTab') return;
  btn.addEventListener('click', ()=>{
    $$('.tab').forEach(b=>b.classList.remove('active'));
    $$('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const panel = $('#'+btn.dataset.tab);
    if (panel) panel.classList.add('active');
  });
});
function goToTab(id){
  const tab = document.querySelector(`.tab[data-tab="${id}"]`);
  if (!tab) return;
  tab.click();
}

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

// ===== Dashboard: tuiles =====
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
      <div><strong>${escapeHTML(t.label)}</strong>
      <div class="who">${new Date(t.ts).toLocaleDateString('fr-FR')}</div></div>
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

// ===== Chat + Fichiers (Cloudflare Worker) =====
const WORKER_URL = 'https://family-app.teiki5320.workers.dev'; // ← ton Worker
const SECRET = 'Partenaire85/';                                // ← mets la même valeur que dans Cloudflare
const ROOM   = 'family';

// URLs calendrier côté Worker
const SUB_URL         = `${WORKER_URL}/calendar.ics?token=Partenaire85/`; // abonnement Apple/Google (info)
const WORKER_CAL_ADD  = `${WORKER_URL}/cal/add`;
const WORKER_CAL_LIST = `${WORKER_URL}/cal/list`;

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
  if (chatList) chatList.scrollTop = chatList.scrollHeight;
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

// ===== CALENDRIER (local + synchro Worker/ICS) =====
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
  const grid = $('#calGrid'); if(!grid) return;
  grid.innerHTML='';

  const first = new Date(y,m,1);
  const start = first.getDay()===0 ? 6 : first.getDay()-1; // lundi=0
  const daysInMonth = new Date(y,m+1,0).getDate();

  const monthLabel = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(first);
  $('#calMonthLabel') && ($('#calMonthLabel').textContent = monthLabel);

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

$('#calPrev')?.addEventListener('click', ()=>{
  if(--calMonth<0){ calMonth=11; calYear--; }
  renderMonth(calYear,calMonth);
});
$('#calNext')?.addEventListener('click', ()=>{
  if(++calMonth>11){ calMonth=0; calYear++; }
  renderMonth(calYear,calMonth);
});
$('#calToday')?.addEventListener('click', ()=>{
  const now = new Date();
  calMonth = now.getMonth();
  calYear  = now.getFullYear();
  selectedDate = todayISO();
  renderMonth(calYear, calMonth);
  renderEvents();
});

// Remise à zéro des filtres quand on va sur l’onglet calendrier
document.querySelector('.tab[data-tab="calendar"]')?.addEventListener('click', ()=>{
  selectedDate = null;
  const f = $('#calFilter');  if (f) f.value = '*';
  const s = $('#calSearch');  if (s) s.value = '';
  renderEvents();
});

$('#calFilter')?.addEventListener('change', renderEvents);
$('#calSearch')?.addEventListener('input', renderEvents);

function renderEvents(){
  const filter = $('#calFilter')?.value || '*';
  const search = ($('#calSearch')?.value||'').toLowerCase();
  const list = $('#eventList'); if(!list) return;
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
        <strong>${escapeHTML(ev.title)}</strong>
        <div class="who">${escapeHTML(when)}${ev.place?` · ${escapeHTML(ev.place)}`:''} [${escapeHTML(ev.category||'Autre')}]</div>
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
        }catch(_e){ /* non bloquant */ }
      }
      const idx = state.events.indexOf(ev);
      if (idx > -1) { state.events.splice(idx,1); save(); renderEvents(); }
    });

    list.appendChild(li);
  });

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
}

eventForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const title = (eventTitle.value||'').trim();
  if(!title || !eventDate.value) return;

  const ev = {
    title,
    date: eventDate.value,
    time: eventTime?.value || '09:00',
    place: ($('#eventPlace')?.value || ''),
    category: ($('#eventCategory')?.value || 'Autre'),
    note: ($('#eventNote')?.value || '')
  };

  state.events.push(ev);
  save();
  renderEvents();
  eventForm.reset();

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
  }catch(_e){}
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
  }catch(_e){}
}

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

// ===== Init =====
(function init(){
  renderTasks(); renderBudget(); renderNotes(); updateDashboard();
  const now = new Date(); calMonth = now.getMonth(); calYear = now.getFullYear();
  renderEvents(); syncFromWorker();
})();

// ===== MÉTÉO (Open-Meteo) =====
// Exemple: latitude/longitude de Maché (Vendée)
const LAT = 46.747;
const LON = -1.721;

// Sélecteurs
const wxTile   = document.getElementById('wxTile');
const wxEmoji  = document.getElementById('wxEmoji');
const wxTemp   = document.getElementById('wxTemp');
const wxDesc   = document.getElementById('wxDesc');
const wxPlace  = document.getElementById('wxPlace');
const wxDaily  = document.getElementById('wxDaily');

// Codes météo → Emoji + texte
function codeToWeather(code){
  const map = {
    0:["☀️","Ciel dégagé"], 1:["🌤️","Peu nuageux"], 2:["⛅","Partiellement nuageux"], 3:["☁️","Couvert"],
    45:["🌫️","Brouillard"], 48:["🌫️","Brouillard givrant"],
    51:["🌦️","Bruine légère"], 53:["🌦️","Bruine"], 55:["🌦️","Bruine forte"],
    61:["🌧️","Pluie légère"], 63:["🌧️","Pluie"], 65:["🌧️","Pluie forte"],
    71:["🌨️","Neige légère"], 73:["🌨️","Neige"], 75:["❄️","Neige forte"],
    95:["⛈️","Orage"], 96:["⛈️","Orage avec grêle"], 99:["⛈️","Orage fort grêle"]
  };
  return map[code] || ["❔","Indéfini"];
}

async function loadWeather(){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Europe%2FParis`;
    const r = await fetch(url);
    if(!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();

    // météo actuelle
    const cur = data.current;
    const [emo,txt] = codeToWeather(cur.weathercode);
    if(wxEmoji) wxEmoji.textContent = emo;
    if(wxTemp)  wxTemp.textContent  = `${Math.round(cur.temperature_2m)}°C`;
    if(wxDesc)  wxDesc.textContent  = txt;
    if(wxTile)  wxTile.textContent  = `${Math.round(cur.temperature_2m)}°C · ${txt}`;
    if(wxPlace) wxPlace.textContent = "Maché, Vendée";

    // prévisions quotidiennes
    if(wxDaily){
      wxDaily.innerHTML = '';
      data.daily.time.forEach((d,i)=>{
        const [emo2,txt2] = codeToWeather(data.daily.weathercode[i]);
        const li = document.createElement('li');
        li.className='item';
        li.innerHTML = `<div><strong>${new Date(d).toLocaleDateString('fr-FR',{weekday:'short', day:'2-digit', month:'2-digit'})}</strong>
                        <div class="who">${txt2}</div></div>
                        <div class="spacer"></div>
                        <div>${emo2} ${Math.round(data.daily.temperature_2m_min[i])}° / ${Math.round(data.daily.temperature_2m_max[i])}°</div>`;
        wxDaily.appendChild(li);
      });
    }

  }catch(e){
    console.error("Météo:",e);
    if(wxTile) wxTile.textContent="Météo indisponible";
    if(wxDesc) wxDesc.textContent="Erreur";
  }
}

// Chargement initial + refresh toutes les 2h
loadWeather();
setInterval(loadWeather, 2*60*60*1000);