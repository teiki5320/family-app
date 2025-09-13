// Page Véhicules : fiches + entretiens + échéances
// Version simple en mémoire (pas de persistance pour l’instant)
export function init(el, core){
  let vehicles = [];

  el.innerHTML = `
    <section class="fade-in">
      <h2>Véhicules</h2>

      <!-- Addbar : ajouter un véhicule -->
      <form id="vehAdd" class="addbar grid2">
        <input name="plate" placeholder="Immat (ex: AB-123-CD)" required>
        <input name="make"  placeholder="Marque (ex: Peugeot)">
        <input name="model" placeholder="Modèle (ex: 308)">
        <input name="year"  type="number" placeholder="Année">
        <input name="mileage" type="number" placeholder="Km actuel">
        <button class="btn" type="submit">Ajouter</button>
      </form>

      <!-- Liste des véhicules -->
      <div id="vehList" class="cards"></div>
    </section>
  `;

  const $ = (s)=> el.querySelector(s);
  const list = $('#vehList');
  const form = $('#vehAdd');

  function renderMaint(v, host){
    host.innerHTML = '';
    const list = (v.maintenance||[]).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    if (!list.length){ host.innerHTML = `<div class="muted">Aucun entretien</div>`; return; }
    list.forEach((m, idx)=>{
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <div>
          <strong>${m.date || '--'} -- ${core.escapeHTML(m.title||'')}</strong>
          <div class="who">${m.km?`${m.km} km · `:''}Prochain: ${m.next||'--'}</div>
        </div>
        <div class="spacer"></div>
        <button class="del btn-danger">Suppr</button>
      `;
      row.querySelector('.del').addEventListener('click', ()=>{
        v.maintenance.splice(idx,1); render();
      });
      host.appendChild(row);
    });
  }

  function render(){
    list.innerHTML = '';
    if (!vehicles.length){
      list.innerHTML = `<div class="card"><p class="muted">Aucun véhicule -- ajoute-en un ci-dessus.</p></div>`;
      return;
    }

    vehicles.forEach((v, i)=>{
      const card = document.createElement('div');
      card.className = 'card';
      const subtitle = `${core.escapeHTML(v.plate||'')} · ${v.year||'--'} · ${v.mileage?`${v.mileage} km`:'--'}`;
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">${core.escapeHTML(v.make||'--')} ${core.escapeHTML(v.model||'')}</h3>
            <div class="card-meta">${subtitle}</div>
          </div>
          <div class="card-actions">
            <button class="btn-danger del-veh">Suppr</button>
          </div>
        </div>

        <div class="box">
          <summary>Entretiens & rappels</summary>
          <div class="section-body">
            <div id="maint-${v.id}"></div>
            <form class="grid2 add-maint" style="margin-top:8px">
              <input name="title" placeholder="Intitulé (ex: Vidange)">
              <input name="date"  type="date" value="${core.todayISO()}">
              <input name="next"  type="date" placeholder="Prochain (optionnel)">
              <input name="km"    type="number" placeholder="Km (optionnel)">
              <button class="btn">Ajouter</button>
            </form>
          </div>
        </div>

        <div class="box">
          <summary>Échéances</summary>
          <div class="section-body">
            <form class="grid2 set-deadlines" style="margin-top:8px">
              <input name="insurance"  type="date" value="${v.insurance||''}"  placeholder="Assurance (échéance)">
              <input name="inspection" type="date" value="${v.inspection||''}" placeholder="Contrôle technique">
              <button class="btn">Enregistrer</button>
            </form>
            <div class="muted" style="margin-top:6px">
              Assurance: ${v.insurance||'--'} · CT: ${v.inspection||'--'}
            </div>
          </div>
        </div>
      `;

      // actions haut de carte
      card.querySelector('.del-veh').addEventListener('click', ()=>{
        if (!confirm(`Supprimer ${v.make||''} ${v.model||''} (${v.plate||''}) ?`)) return;
        vehicles.splice(i,1); render();
      });

      // liste des maintenances
      const maintHost = card.querySelector(`#maint-${v.id}`);
      renderMaint(v, maintHost);

      // form add-maint
      card.querySelector('.add-maint').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const m = {
          title:(fd.get('title')||'').trim(),
          date: (fd.get('date')||core.todayISO()).trim(),
          next: (fd.get('next')||'').trim(),
          km:   (fd.get('km')||'').trim()
        };
        if (!m.title) return;
        (v.maintenance ||= []).push(m);
        render();
      });

      // form set-deadlines
      card.querySelector('.set-deadlines').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        v.insurance  = (fd.get('insurance')||'').trim();
        v.inspection = (fd.get('inspection')||'').trim();
        render();
        alert('Échéances enregistrées');
      });

      list.appendChild(card);
    });
  }

  // addbar : ajouter un véhicule
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const v = {
      id: (fd.get('plate')||'').toUpperCase().replace(/\W+/g,'-') || ('veh-'+Math.random().toString(36).slice(2,7)),
      plate: (fd.get('plate')||'').toUpperCase().trim(),
      make:  (fd.get('make')||'').trim(),
      model: (fd.get('model')||'').trim(),
      year: Number(fd.get('year')||'') || '',
      mileage: Number(fd.get('mileage')||'') || '',
      maintenance: [],
      insurance: '', inspection: ''
    };
    if (!v.plate) return;
    vehicles.unshift(v);
    form.reset();
    render();
  });

  render();
  return { destroy(){ vehicles=[]; } };
}