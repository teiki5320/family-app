export function init(el, core){
  const { $, $$, state, save, todayISO, pad, escapeHTML } = core;
  state.events ||= [];

  el.innerHTML = `
    <section>
      <h2>Calendrier</h2>
      <div class="addbar">
        <form id="eventForm" class="grid2">
          <input id="eventTitle" placeholder="Titre" required>
          <input id="eventDate" type="date" value="${todayISO()}" required>
          <input id="eventTime" type="time" value="09:00">
          <input id="eventPlace" placeholder="Lieu">
          <select id="eventCategory">
            <option>Autre</option><option>Santé</option><option>École</option><option>Budget</option>
          </select>
          <input id="eventNote" placeholder="Note">
          <button class="btn btn-primary">Ajouter</button>
        </form>
      </div>

      <div class="row" style="gap:12px;align-items:flex-end">
        <div>
          <div class="cal-month" id="calMonthLabel"></div>
          <div class="row" style="gap:6px;margin-top:6px">
            <button id="calPrev" class="btn">◀</button>
            <button id="calToday" class="btn">Aujourd'hui</button>
            <button id="calNext" class="btn">▶</button>
          </div>
        </div>
        <div class="spacer"></div>
        <select id="calFilter"><option value="*">Toutes catégories</option><option>Autre</option><option>Santé</option><option>École</option><option>Budget</option></select>
        <input id="calSearch" placeholder="Rechercher...">
      </div>

      <div class="cal-grid" id="calGrid"></div>
      <ul class="list" id="eventList" style="margin-top:10px"></ul>
    </section>
  `;

  const grid = $('#calGrid', el), monthLbl = $('#calMonthLabel', el), list=$('#eventList', el);
  const form=$('#eventForm', el), title=$('#eventTitle', el), date=$('#eventDate', el), time=$('#eventTime', el);
  const place=$('#eventPlace', el), cat=$('#eventCategory', el), note=$('#eventNote', el);
  const filter=$('#calFilter', el), search=$('#calSearch', el);

  let selectedDate = todayISO();
  let calMonth = new Date().getMonth();
  let calYear  = new Date().getFullYear();

  function renderMonth(y,m){
    grid.innerHTML='';
    const first = new Date(y,m,1);
    const start = first.getDay()===0 ? 6 : first.getDay()-1;
    const daysInMonth = new Date(y,m+1,0).getDate();
    monthLbl.textContent = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(first);
    for(let i=0;i<start;i++) grid.appendChild(document.createElement('div'));
    for(let d=1; d<=daysInMonth; d++){
      const cell = document.createElement('div'); cell.className='day';
      const ds = `${y}-${pad(m+1)}-${pad(d)}`;
      if (ds === todayISO())   cell.classList.add('today');
      if (ds === selectedDate) cell.classList.add('selected');
      cell.innerHTML = `<div class="num">${d}</div>`;
      (state.events||[]).filter(ev=>ev.date===ds).forEach(()=> {
        const dot=document.createElement('span'); dot.className='cal-dot'; cell.appendChild(dot);
      });
      cell.onclick = ()=>{ selectedDate = (selectedDate === ds) ? null : ds; renderEvents(); renderMonth(calYear, calMonth); };
      grid.appendChild(cell);
    }
  }

  function renderEvents(){
    const f = filter.value || '*';
    const q = (search.value||'').toLowerCase();
    list.innerHTML='';
    const sel = selectedDate;
    const events = (state.events||[]).filter(ev=>{
      const byDay  = !sel || ev.date === sel;
      const byCat  = (f==='*' || ev.category===f);
      const byText = (!q || (ev.title||'').toLowerCase().includes(q) || (ev.place||'').toLowerCase().includes(q));
      return byDay && byCat && byText;
    }).sort((a,b)=> (a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));

    if (!events.length){
      const li = document.createElement('li'); li.className='item';
      li.innerHTML = `<div><strong>Aucun évènement</strong><div class="who">Essaie un autre jour / filtre</div></div>`;
      list.appendChild(li);
    } else {
      events.forEach(ev=>{
        const li = document.createElement('li'); li.className='item';
        const when = `${ev.date} ${ev.time||''}`.trim();
        li.innerHTML = `
          <div><strong>${escapeHTML(ev.title)}</strong>
            <div class="who">${escapeHTML(when)}${ev.place?` · ${escapeHTML(ev.place)}`:''} [${escapeHTML(ev.category||'Autre')}]</div>
          </div>
          <div class="spacer"></div>
          <button class="del">Suppr</button>`;
        li.querySelector('.del').onclick = ()=>{
          const idx = state.events.indexOf(ev);
          if (idx>-1) { state.events.splice(idx,1); save(); renderEvents(); renderMonth(calYear, calMonth); }
        };
        list.appendChild(li);
      });
    }
  }

  $('#calPrev', el).onclick = ()=>{ if(--calMonth<0){ calMonth=11; calYear--; } renderMonth(calYear,calMonth); };
  $('#calNext', el).onclick = ()=>{ if(++calMonth>11){ calMonth=0; calYear++; } renderMonth(calYear,calMonth); };
  $('#calToday', el).onclick= ()=>{ const n=new Date(); calMonth=n.getMonth(); calYear=n.getFullYear(); selectedDate=todayISO(); renderMonth(calYear,calMonth); renderEvents(); };
  filter.onchange = renderEvents; search.oninput = renderEvents;

  form.onsubmit = (e)=>{ e.preventDefault();
    const ev = { title:title.value.trim(), date: date.value, time: time.value||'09:00', place: (place.value||''), category: (cat.value||'Autre'), note: (note.value||'') };
    if(!ev.title || !ev.date) return;
    state.events.push(ev); save(); form.reset(); date.value = todayISO(); renderEvents(); renderMonth(calYear, calMonth);
  };

  renderMonth(calYear, calMonth); renderEvents();
  return { destroy(){ } };
}
export function destroy(){}