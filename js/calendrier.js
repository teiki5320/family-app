// js/calendrier.js
// Calendrier simple avec persistance, mini-mois, et export/ajout vers Apple/Android (ICS + Google)
const LS_KEY = 'familyApp.events.v1';
const TZ = 'Europe/Paris';

export function init(el, core){
  // ---------- état ----------
  let events = load();
  let selectedDate = core.todayISO();
  let calMonth = new Date().getMonth();
  let calYear  = new Date().getFullYear();

  // ---------- rendu ----------
  el.innerHTML = `
    <section class="fade-in">
      <h2>Calendrier</h2>

      <!-- Addbar -->
      <form id="evForm" class="addbar grid2" autocomplete="off">
        <input name="title" placeholder="Titre de l'évènement" required>
        <input name="date" type="date" value="${core.todayISO()}" required>
        <input name="time" type="time" value="09:00">
        <input name="place" placeholder="Lieu (optionnel)">
        <input name="note"  placeholder="Notes (optionnel)">
        <button class="btn" type="submit">Ajouter</button>
      </form>

      <!-- Outils -->
      <div class="row" style="margin:8px 0 12px">
        <input id="evSearch" placeholder="Rechercher… (titre/lieu)" style="flex:2">
        <div class="spacer"></div>
        <button id="btnExportICS" class="ghost">Exporter tout (.ics)</button>
        <button id="btnClear" class="btn-danger">Tout effacer</button>
      </div>

      <!-- Mini-mois -->
      <div class="card" style="margin-bottom:12px">
        <div class="row" style="margin-bottom:8px">
          <strong id="calMonthLabel" class="cal-month">Mois</strong>
          <div class="spacer"></div>
          <button id="calPrev" class="ghost">◀︎</button>
          <button id="calToday" class="ghost">Aujourd’hui</button>
          <button id="calNext" class="ghost">▶︎</button>
        </div>
        <div class="cal-grid" id="calGrid" aria-label="Calendrier mensuel"></div>
      </div>

      <!-- Résumé prochain évènement -->
      <div class="card" id="evSummary" style="margin-bottom:12px">
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">Prochain évènement</h3>
            <div class="card-meta" id="evNextMeta">--</div>
          </div>
        </div>
      </div>

      <!-- Liste filtrée -->
      <div class="cards" id="evList"></div>
    </section>
  `;

  // ---------- refs ----------
  const $  = (s)=> el.querySelector(s);
  const form      = $('#evForm');
  const list      = $('#evList');
  const searchEl  = $('#evSearch');
  const nextMeta  = $('#evNextMeta');

  // calendrier
  const calGrid   = $('#calGrid');
  const monthLbl  = $('#calMonthLabel');
  const btnPrev   = $('#calPrev');
  const btnNext   = $('#calNext');
  const btnToday  = $('#calToday');

  // outils
  const btnExport = $('#btnExportICS');
  const btnClear  = $('#btnClear');

  // ---------- helpers persistance ----------
  function load(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch { return []; }
  }
  function save(){
    localStorage.setItem(LS_KEY, JSON.stringify(events));
  }

  // ---------- helpers temps/format ----------
  const pad2 = (n)=> String(n).padStart(2,'0');

  function toICSDate(dateStr, timeStr){
    // renvoie format ICS local sans Z (utilise TZID plus bas)
    const [y,m,d] = dateStr.split('-').map(Number);
    if (!timeStr) return `${y}${pad2(m)}${pad2(d)}`;
    const [hh,mm] = (timeStr||'09:00').split(':').map(Number);
    return `${y}${pad2(m)}${pad2(d)}T${pad2(hh)}${pad2(mm)}00`;
  }

  function nextHour(dateStr, timeStr){
    if (!timeStr) return null;
    const dt = new Date(`${dateStr}T${timeStr}`);
    dt.setHours(dt.getHours()+1);
    return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  }

  function sortEvents(a,b){
    return (a.date + (a.time||'')).localeCompare(b.date + (b.time||''));
  }

  function formatHuman(e){
    const dt = new Date(e.date + 'T' + (e.time||'09:00'));
    const when = e.time
      ? dt.toLocaleString('fr-FR')
      : new Date(e.date).toLocaleDateString('fr-FR');
    return `${when}${e.place?` · ${e.place}`:''}`;
  }

  // ---------- export ICS ----------
  function buildICS(evts){
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FamilyApp//Calendrier//FR',
      `CALSCALE:GREGORIAN`,
      `X-WR-TIMEZONE:${TZ}`,
      `METHOD:PUBLISH`,
    ];

    evts.forEach(e=>{
      const uid = `fa-${e.ts || Date.now()}-${Math.random().toString(36).slice(2)}@family`;
      const dtstart = toICSDate(e.date, e.time);
      const endTime = nextHour(e.date, e.time);
      const dtend   = e.time ? toICSDate(e.date, endTime) : null;

      lines.push('BEGIN:VEVENT');
      if (e.time){
        lines.push(`DTSTART;TZID=${TZ}:${dtstart}`);
        lines.push(`DTEND;TZID=${TZ}:${dtend}`);
      }else{
        // all-day
        lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
      }
      lines.push(`UID:${uid}`);
      lines.push(`SUMMARY:${escapeICS(e.title||'')}`);
      if (e.place) lines.push(`LOCATION:${escapeICS(e.place)}`);
      if (e.note)  lines.push(`DESCRIPTION:${escapeICS(e.note)}`);
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function escapeICS(s){
    return String(s||'').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  }

  function downloadICS(filename, icsText){
    const blob = new Blob([icsText], {type:'text/calendar'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- Google Calendar link ----------
  function googleCalURL(e){
    const start = e.time
      ? toICSDate(e.date, e.time) + 'Z' // best-effort; Google accepte sans TZ si Z
      : toICSDate(e.date) + '/' + toICSDate(e.date); // all-day (start=end)
    const endT = e.time ? nextHour(e.date, e.time) : null;
    const end  = e.time ? (toICSDate(e.date, endT)+'Z') : null;

    const dates = e.time ? `${start}/${end}` : start;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: e.title || '',
      dates,
      location: e.place || '',
      details: e.note || ''
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  // ---------- mini-mois ----------
  function renderMonth(y,m){
    calGrid.innerHTML = '';
    const first = new Date(y,m,1);
    const start = first.getDay()===0 ? 6 : first.getDay()-1; // lundi=0
    const daysInMonth = new Date(y,m+1,0).getDate();
    monthLbl.textContent = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(first);

    // espaces avant le 1er
    for(let i=0;i<start;i++){ calGrid.appendChild(document.createElement('div')); }

    for(let d=1; d<=daysInMonth; d++){
      const cell = document.createElement('div');
      cell.className = 'day';
      const ds = `${y}-${pad2(m+1)}-${pad2(d)}`;
      if (ds === core.todayISO())   cell.classList.add('today');
      if (ds === selectedDate) cell.classList.add('selected');
      cell.innerHTML = `<div class="num">${d}</div>`;
      events.filter(ev=>ev.date===ds).forEach(()=> {
        const dot=document.createElement('span');
        dot.className='cal-dot';
        cell.appendChild(dot);
      });
      cell.addEventListener('click', ()=>{
        selectedDate = (selectedDate === ds) ? null : ds;
        renderList(); renderMonth(calYear, calMonth);
      });
      calGrid.appendChild(cell);
    }
  }

  btnPrev.addEventListener('click', ()=>{ if(--calMonth<0){ calMonth=11; calYear--; } renderMonth(calYear,calMonth); });
  btnNext.addEventListener('click', ()=>{ if(++calMonth>11){ calMonth=0; calYear++; } renderMonth(calYear,calMonth); });
  btnToday.addEventListener('click', ()=>{
    const now = new Date(); calMonth = now.getMonth(); calYear = now.getFullYear();
    selectedDate = core.todayISO(); renderMonth(calYear,calMonth); renderList();
  });

  // ---------- résumé ----------
  function renderSummary(){
    if (!events.length){ nextMeta.textContent = 'Aucun évènement'; return; }
    const nowISO = new Date().toISOString().slice(0,16);
    const next = [...events].sort(sortEvents).find(e => (e.date+'T'+(e.time||'00:00')) >= nowISO) || [...events].sort(sortEvents)[0];
    nextMeta.textContent = `${next.title} -- ${formatHuman(next)}`;
  }

  // ---------- liste ----------
  function renderList(){
    const q = (searchEl.value||'').toLowerCase();
    list.innerHTML = '';

    const filtered = events
      .filter(ev => !selectedDate || ev.date === selectedDate)
      .filter(ev => !q || (ev.title||'').toLowerCase().includes(q) || (ev.place||'').toLowerCase().includes(q))
      .sort(sortEvents);

    if (!filtered.length){
      list.innerHTML = `<div class="card"><p class="muted">${selectedDate ? 'Aucun évènement ce jour' : 'Aucun évènement'}</p></div>`;
      renderSummary(); return;
    }

    filtered.forEach((e, i)=>{
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">${core.escapeHTML(e.title)}</h3>
            <div class="card-meta">${formatHuman(e)}</div>
          </div>
          <div class="card-actions">
            <a class="ghost" href="${googleCalURL(e)}" target="_blank" rel="noopener">Google</a>
            <button class="ghost" data-ics>ICS</button>
            <button class="del btn-danger" data-del>Suppr</button>
          </div>
        </div>
        ${e.note ? `<div class="muted" style="margin-top:6px">${core.escapeHTML(e.note)}</div>`:''}
      `;

      // .ics pour l'évènement
      card.querySelector('[data-ics]').addEventListener('click', ()=>{
        const ics = buildICS([e]);
        downloadICS(`event-${e.date}.ics`, ics);
      });

      // suppression
      card.querySelector('[data-del]').addEventListener('click', ()=>{
        const idx = events.indexOf(e);
        if (idx>-1) { events.splice(idx,1); save(); renderAll(); }
      });

      list.appendChild(card);
    });

    renderSummary();
  }

  // ---------- ajouter ----------
  form.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const fd = new FormData(form);
    const item = {
      title: (fd.get('title')||'').trim(),
      date:  fd.get('date')  || core.todayISO(),
      time:  (fd.get('time') || '').trim(),
      place: (fd.get('place')||'').trim(),
      note:  (fd.get('note') || '').trim(),
      ts: Date.now()
    };
    if (!item.title || !item.date) return;
    events.unshift(item); save();
    form.reset();
    renderAll();
  });

  // ---------- outils globaux ----------
  btnExport.addEventListener('click', ()=>{
    if (!events.length) { alert('Aucun évènement à exporter.'); return; }
    const ics = buildICS(events);
    downloadICS(`family-calendar-${new Date().toISOString().slice(0,10)}.ics`, ics);
  });

  btnClear.addEventListener('click', ()=>{
    if (!events.length) return;
    if (!confirm('Supprimer tous les évènements ?')) return;
    events = []; save(); renderAll();
  });

  searchEl.addEventListener('input', renderList);

  // ---------- rendu global ----------
  function renderAll(){
    renderMonth(calYear, calMonth);
    renderList();
  }

  // init
  const now = new Date(); calMonth = now.getMonth(); calYear = now.getFullYear();
  renderAll();

  return { destroy(){ /* noop */ } };
}