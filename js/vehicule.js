export function init(el, core){
  const { $, state, save, todayISO, escapeHTML, addToCalendar } = core;
  state.vehicles ||= { list:[] };

  el.innerHTML = `
    <section>
      <h2>Véhicules</h2>
      <div class="addbar">
        <form id="vehicleAddForm" class="grid2">
          <input name="plate" placeholder="Immatriculation (ex: AB-123-CD)" required>
          <input name="make" placeholder="Marque (ex: Peugeot)">
          <input name="model" placeholder="Modèle (ex: 308)">
          <input name="year" type="number" placeholder="Année (ex: 2018)">
          <input name="vin" placeholder="VIN (optionnel)">
          <input name="mileage" type="number" placeholder="Kilométrage actuel">
          <button class="btn btn-primary">Ajouter</button>
        </form>
      </div>
      <div class="cards" id="vehicleList"></div>
    </section>
  `;

  const list = $('#vehicleList', el), form=$('#vehicleAddForm', el);

  form.onsubmit = (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const v = {
      id: (fd.get('plate')||'').toUpperCase().replace(/\W+/g,'-') || ('veh-'+Math.random().toString(36).slice(2,7)),
      plate: (fd.get('plate')||'').toUpperCase(),
      make: fd.get('make')||'',
      model: fd.get('model')||'',
      year: Number(fd.get('year')||'')||'',
      vin: fd.get('vin')||'',
      mileage: Number(fd.get('mileage')||'')||'',
      maintenance: []
    };
    if (!v.plate) return;
    state.vehicles.list.unshift(v); save(); form.reset(); render();
  };

  function renderMaint(v, host){
    host.innerHTML = '';
    const arr = (v.maintenance||[]).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    if (!arr.length){ host.innerHTML = `<div class="muted">Aucun entretien</div>`; return; }
    arr.forEach((m,idx)=>{
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><strong>${escapeHTML(m.date)} -- ${escapeHTML(m.title)}</strong><div class="who">${m.km?`${escapeHTML(String(m.km))} km · `:''}Prochain: ${escapeHTML(m.next||'--')}</div></div>
      <div class="spacer"></div>${m.next?`<button class="ghost sendCal">→ Calendrier</button>`:''}<button class="del">Suppr</button>`;
      row.querySelector('.sendCal')?.addEventListener('click', ()=> addToCalendar({ title:`${m.title} (${v.plate})`, date:m.next, category:'Autre' }));
      row.querySelector('.del').onclick = ()=>{ (v.maintenance||[]).splice(idx,1); save(); render(); };
      host.appendChild(row);
    });
  }

  function render(){
    list.innerHTML = '';
    const vs = state.vehicles.list||[];
    if (!vs.length){ list.innerHTML = `<div class="card"><strong>Aucun véhicule</strong><div class="muted">Ajoute via la barre.</div></div>`; return; }
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
            <button class="badge js-docs">📂 Dossier</button>
            <button class="btn btn-danger js-del">Suppr</button>
          </div>
        </div>
        <details class="box"><summary>Entretiens & rappels</summary>
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
        <details class="box"><summary>Assurance / CT</summary>
          <div class="section-body">
            <form class="grid2 set-deadlines" style="margin-top:8px">
              <input name="insurance" type="date" value="${v.insurance||''}" placeholder="Assurance (échéance)">
              <input name="inspection" type="date" value="${v.inspection||''}" placeholder="Contrôle technique">
              <button>Enregistrer</button>
            </form>
          </div>
        </details>
      `;
      card.querySelector('.js-docs').onclick = ()=>{ location.hash='#/document'; sessionStorage.setItem('docs_open_folder', `Vehicules/${v.plate || v.id}`); };
      card.querySelector('.js-del').onclick  = ()=>{ if(!confirm(`Supprimer ${v.make||''} ${v.model||''} (${v.plate||''}) ?`)) return; state.vehicles.list = vs.filter(x=>x!==v); save(); render(); };

      renderMaint(v, card.querySelector(`#maint-${v.id}`));
      card.querySelector('.add-maint').onsubmit = (e)=>{
        e.preventDefault(); const fd=new FormData(e.currentTarget);
        const m = { title:fd.get('title')||'', date:fd.get('date')||todayISO(), next:fd.get('next')||'', km:fd.get('km')||'' };
        if (!m.title) return; (v.maintenance ||= []).push(m); save(); render();
        if (m.next){ addToCalendar({ title:`${m.title} (${v.make||''} ${v.model||''} ${v.plate||''})`, date:m.next, category:'Autre' }); }
      };
      card.querySelector('.set-deadlines').onsubmit = (e)=>{
        e.preventDefault(); const fd=new FormData(e.currentTarget);
        v.insurance  = fd.get('insurance') || '';
        v.inspection = fd.get('inspection') || '';
        save();
        if (v.insurance){  addToCalendar({ title:`Assurance véhicule (${v.plate})`,  date:v.insurance, category:'Autre' }); }
        if (v.inspection){ addToCalendar({ title:`Contrôle technique (${v.plate})`, date:v.inspection, category:'Autre' }); }
        alert('Échéances enregistrées');
      };

      list.appendChild(card);
    });
  }

  render();
  return { destroy(){} };
}
export function destroy(){}