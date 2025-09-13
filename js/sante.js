export function init(el, core){
  const { $, state, save, todayISO, escapeHTML, addToCalendar } = core;
  state.health ||= { persons:[] };

  el.innerHTML = `
    <section>
      <h2>Santé</h2>
      <div class="addbar">
        <form id="healthAddForm" class="grid2">
          <input name="name" placeholder="Prénom" required>
          <input name="blood" placeholder="Groupe sanguin (ex: O+)">
          <input name="allergies" placeholder="Allergies (séparées par ,)">
          <input name="conditions" placeholder="Maladies chroniques (séparées par ,)">
          <input name="doctor" placeholder="Médecin traitant">
          <input name="emergency" placeholder="Contact d’urgence (nom · tel)">
          <button class="btn btn-primary">Ajouter</button>
        </form>
      </div>
      <div class="cards" id="healthPeople"></div>
    </section>
  `;

  const list = $('#healthPeople', el);
  const form = $('#healthAddForm', el);

  form.onsubmit = (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const p = {
      id: (fd.get('name')||'').toLowerCase().replace(/\s+/g,'-') || crypto.randomUUID().slice(0,8),
      name: fd.get('name')||'',
      blood: fd.get('blood')||'',
      allergies: (fd.get('allergies')||'').split(',').map(s=>s.trim()).filter(Boolean),
      conditions: (fd.get('conditions')||'').split(',').map(s=>s.trim()).filter(Boolean),
      doctor: fd.get('doctor')||'',
      emergency: fd.get('emergency')||'',
      vaccines:[], meds:[], records:[]
    };
    if (!p.name) return;
    state.health.persons.unshift(p); save(); form.reset(); render();
  };

  function renderVaccinsList(p, host){
    host.innerHTML = '';
    const list = p.vaccines||[];
    if (!list.length){ host.innerHTML = `<div class="muted">Aucun vaccin</div>`; return; }
    list.forEach((v,idx)=>{
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><strong>${escapeHTML(v.name)}</strong><div class="who">Dernière: ${escapeHTML(v.last||'--')} · Prochaine: ${escapeHTML(v.next||'--')}</div></div>
      <div class="spacer"></div>${v.next?`<button class="ghost sendCal">→ Calendrier</button>`:''}<button class="del">Suppr</button>`;
      row.querySelector('.sendCal')?.addEventListener('click', ()=> addToCalendar({ title:`Rappel vaccin ${v.name} (${p.name})`, date:v.next, category:'Santé' }));
      row.querySelector('.del').onclick = ()=>{ (p.vaccines||=[]).splice(idx,1); save(); render(); };
      host.appendChild(row);
    });
  }
  function renderMedsList(p, host){
    host.innerHTML = '';
    const list = p.meds||[];
    if (!list.length){ host.innerHTML = `<div class="muted">Aucun traitement</div>`; return; }
    list.forEach((m,idx)=>{
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><strong>${escapeHTML(m.name)}</strong><div class="who">${escapeHTML(m.dose||'--')} · ${escapeHTML(m.freq||'--')} · ${escapeHTML(m.start||'--')} → ${escapeHTML(m.end||'--')}</div></div>
      <div class="spacer"></div><button class="del">Suppr</button>`;
      row.querySelector('.del').onclick = ()=>{ (p.meds||[]).splice(idx,1); save(); render(); };
      host.appendChild(row);
    });
  }
  function renderRecords(p, host){
    host.innerHTML = '';
    const list = (p.records||[]).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    if (!list.length){ host.innerHTML = `<div class="muted">Aucune entrée</div>`; return; }
    list.forEach((r,idx)=>{
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><strong>${escapeHTML(r.date)} -- ${escapeHTML(r.type||'')}</strong><div class="who">${escapeHTML(r.title||'')} · ${escapeHTML(r.note||'')}</div></div>
      <div class="spacer"></div><button class="del">Suppr</button>`;
      row.querySelector('.del').onclick = ()=>{ (p.records||[]).splice(idx,1); save(); render(); };
      host.appendChild(row);
    });
  }

  function render(){
    list.innerHTML = '';
    const persons = state.health.persons||[];
    if (!persons.length){
      list.innerHTML = `<div class="card"><strong>Aucune personne</strong><div class="muted">Ajoute via la barre.</div></div>`; return;
    }
    persons.forEach(p=>{
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">${escapeHTML(p.name||'--')}</h3>
            <div class="card-meta">${escapeHTML(p.blood||'--')}${(p.allergies&&p.allergies.length)?' · ⚠︎ Allergies':''}</div>
          </div>
          <div class="card-actions">
            <button class="badge js-docs">📂 Dossier</button>
            <button class="btn btn-danger js-del">Suppr</button>
          </div>
        </div>
        <details class="box"><summary>Infos clés</summary>
          <div class="section-body">
            <div class="meta">Médecin : ${escapeHTML(p.doctor||'--')} · Urgence : ${escapeHTML(p.emergency||'--')}</div>
            <div class="meta">Maladies : ${escapeHTML((p.conditions||[]).join(', ')||'--')}</div>
            <div class="meta">Allergies : ${escapeHTML((p.allergies||[]).join(', ')||'--')}</div>
          </div>
        </details>
        <details class="box"><summary>Vaccins</summary>
          <div class="section-body">
            <div id="vaccins-${p.id}"></div>
            <form class="row add-vaccin" style="margin-top:8px">
              <input name="name" placeholder="Nom vaccin (ex: DTP)">
              <input name="last" type="date" placeholder="Dernière dose">
              <input name="next" type="date" placeholder="Prochaine dose">
              <button>Ajouter</button>
            </form>
          </div>
        </details>
        <details class="box"><summary>Traitements</summary>
          <div class="section-body">
            <div id="meds-${p.id}"></div>
            <form class="grid2 add-med" style="margin-top:8px">
              <input name="name" placeholder="Nom (ex: Ventoline)">
              <input name="dose" placeholder="Dose">
              <input name="freq" placeholder="Fréquence">
              <input name="start" type="date" placeholder="Début">
              <input name="end" type="date" placeholder="Fin (optionnel)">
              <button>Ajouter</button>
            </form>
          </div>
        </details>
        <details class="box"><summary>Carnet médical</summary>
          <div class="section-body">
            <div id="records-${p.id}"></div>
            <form class="grid2 add-record" style="margin-top:8px">
              <input name="date" type="date" value="${todayISO()}">
              <input name="type" placeholder="Type (Consultation, Analyse, …)">
              <input name="title" placeholder="Titre">
              <input name="note" placeholder="Note">
              <button>Ajouter</button>
            </form>
          </div>
        </details>
      `;
      card.querySelector('.js-docs').onclick = ()=>{ location.hash='#/document'; sessionStorage.setItem('docs_open_folder', `Sante/${p.name}`); };
      card.querySelector('.js-del').onclick  = ()=>{ if(!confirm(`Supprimer ${p.name} ?`)) return; state.health.persons = persons.filter(x=>x!==p); save(); render(); };

      // hooks
      const vacHost = card.querySelector(`#vaccins-${p.id}`);
      const medHost = card.querySelector(`#meds-${p.id}`);
      const recHost = card.querySelector(`#records-${p.id}`);

      card.querySelector('.add-vaccin').onsubmit = (e)=>{
        e.preventDefault(); const fd=new FormData(e.currentTarget);
        const name=fd.get('name')||'', last=fd.get('last')||'', next=fd.get('next')||'';
        if(!name) return; (p.vaccines ||= []).push({ name, last, next }); save(); render();
        if (next) addToCalendar({ title:`Rappel vaccin ${name} (${p.name})`, date: next, category:'Santé' });
      };
      card.querySelector('.add-med').onsubmit = (e)=>{
        e.preventDefault(); const fd=new FormData(e.currentTarget);
        const m = { name:fd.get('name')||'', dose:fd.get('dose')||'', freq:fd.get('freq')||'', start:fd.get('start')||'', end:fd.get('end')||'' };
        if(!m.name) return; (p.meds ||= []).push(m); save(); render();
      };
      card.querySelector('.add-record').onsubmit = (e)=>{
        e.preventDefault(); const fd=new FormData(e.currentTarget);
        const r = { date:fd.get('date')||todayISO(), type:fd.get('type')||'', title:fd.get('title')||'', note:fd.get('note')||'' };
        (p.records ||= []).push(r); save(); render();
      };

      renderVaccinsList(p, vacHost);
      renderMedsList(p, medHost);
      renderRecords(p, recHost);
      list.appendChild(card);
    });
  }

  render();
  return { destroy(){} };
}
export function destroy(){}