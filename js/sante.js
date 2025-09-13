// Page Santé : personnes + (vaccins / traitements / carnet)
// Version simple en mémoire (pas de persistance pour l’instant)
export function init(el, core){
  let persons = [];

  el.innerHTML = `
    <section class="fade-in">
      <h2>Santé</h2>

      <!-- Addbar : ajouter une personne -->
      <form id="healthAdd" class="addbar grid2">
        <input name="name" placeholder="Prénom" required>
        <input name="blood" placeholder="Groupe sanguin (ex: O+)">
        <input name="doctor" placeholder="Médecin traitant">
        <input name="emergency" placeholder="Urgence (nom · tel)">
        <button class="btn" type="submit">Ajouter</button>
      </form>

      <!-- Liste des personnes -->
      <div id="people" class="cards"></div>
    </section>
  `;

  const $ = (s)=> el.querySelector(s);
  const people = $('#people');
  const form = $('#healthAdd');

  function renderVaccinsList(p, host){
    host.innerHTML = '';
    const list = p.vaccines || [];
    if (!list.length){ host.innerHTML = `<div class="muted">Aucun vaccin</div>`; return; }
    list.forEach((v, idx)=>{
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <div>
          <strong>${core.escapeHTML(v.name)}</strong>
          <div class="who">Dernière: ${v.last || '--'} · Prochaine: ${v.next || '--'}</div>
        </div>
        <div class="spacer"></div>
        <button class="del btn-danger">Suppr</button>
      `;
      row.querySelector('.del').addEventListener('click', ()=>{
        p.vaccines.splice(idx,1); render();
      });
      host.appendChild(row);
    });
  }

  function renderMedsList(p, host){
    host.innerHTML = '';
    const list = p.meds || [];
    if (!list.length){ host.innerHTML = `<div class="muted">Aucun traitement</div>`; return; }
    list.forEach((m, idx)=>{
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <div>
          <strong>${core.escapeHTML(m.name)}</strong>
          <div class="who">${core.escapeHTML(m.dose||'--')} · ${core.escapeHTML(m.freq||'--')} · ${m.start||'--'} → ${m.end||'--'}</div>
        </div>
        <div class="spacer"></div>
        <button class="del btn-danger">Suppr</button>
      `;
      row.querySelector('.del').addEventListener('click', ()=>{
        p.meds.splice(idx,1); render();
      });
      host.appendChild(row);
    });
  }

  function renderRecords(p, host){
    host.innerHTML = '';
    const list = (p.records||[]).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    if (!list.length){ host.innerHTML = `<div class="muted">Aucune entrée</div>`; return; }
    list.forEach((r, idx)=>{
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <div>
          <strong>${r.date || '--'} -- ${core.escapeHTML(r.type||'')}</strong>
          <div class="who">${core.escapeHTML(r.title||'')} · ${core.escapeHTML(r.note||'')}</div>
        </div>
        <div class="spacer"></div>
        <button class="del btn-danger">Suppr</button>
      `;
      row.querySelector('.del').addEventListener('click', ()=>{
        p.records.splice(idx,1); render();
      });
      host.appendChild(row);
    });
  }

  function render(){
    people.innerHTML = '';
    if (!persons.length){
      people.innerHTML = `<div class="card"><p class="muted">Aucune personne -- ajoute quelqu’un ci-dessus.</p></div>`;
      return;
    }

    persons.forEach((p, i)=>{
      const card = document.createElement('div');
      card.className = 'card';
      const warn = (p.allergies && p.allergies.length) ? ' · ⚠︎ Allergies' : '';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">${core.escapeHTML(p.name||'--')}</h3>
            <div class="card-meta">${core.escapeHTML(p.blood||'--')}${warn}</div>
          </div>
          <div class="card-actions">
            <button class="btn-danger del-person">Suppr</button>
          </div>
        </div>

        <div class="box">
          <summary>Infos clés</summary>
          <div class="section-body">
            <div class="muted">Médecin : ${core.escapeHTML(p.doctor||'--')} · Urgence : ${core.escapeHTML(p.emergency||'--')}</div>
            <div class="muted">Maladies : ${(p.conditions||[]).join(', ')||'--'}</div>
            <div class="muted">Allergies : ${(p.allergies||[]).join(', ')||'--'}</div>
          </div>
        </div>

        <div class="box">
          <summary>Vaccins</summary>
          <div class="section-body">
            <div id="vacc-${p.id}"></div>
            <form class="row add-vaccin" style="margin-top:8px">
              <input name="name" placeholder="Nom (ex: DTP)">
              <input name="last" type="date" placeholder="Dernière dose">
              <input name="next" type="date" placeholder="Prochaine dose">
              <button class="btn">Ajouter</button>
            </form>
          </div>
        </div>

        <div class="box">
          <summary>Traitements</summary>
          <div class="section-body">
            <div id="meds-${p.id}"></div>
            <form class="grid2 add-med" style="margin-top:8px">
              <input name="name" placeholder="Nom (ex: Ventoline)">
              <input name="dose" placeholder="Dose (ex: 2 bouffées)">
              <input name="freq" placeholder="Fréquence (ex: si besoin)">
              <input name="start" type="date" placeholder="Début">
              <input name="end" type="date" placeholder="Fin (optionnel)">
              <button class="btn">Ajouter</button>
            </form>
          </div>
        </div>

        <div class="box">
          <summary>Carnet médical</summary>
          <div class="section-body">
            <div id="rec-${p.id}"></div>
            <form class="grid2 add-record" style="margin-top:8px">
              <input name="date" type="date" value="${core.todayISO()}">
              <input name="type" placeholder="Type (Consultation, Analyse, …)">
              <input name="title" placeholder="Titre (ex: Pédiatre)">
              <input name="note" placeholder="Note">
              <button class="btn">Ajouter</button>
            </form>
          </div>
        </div>
      `;

      // actions haut de carte
      card.querySelector('.del-person').addEventListener('click', ()=>{
        if (!confirm(`Supprimer ${p.name} ?`)) return;
        persons.splice(i,1); render();
      });

      // sous-listes
      const vaccHost = card.querySelector(`#vacc-${p.id}`);
      const medsHost = card.querySelector(`#meds-${p.id}`);
      const recHost  = card.querySelector(`#rec-${p.id}`);
      renderVaccinsList(p, vaccHost);
      renderMedsList(p, medsHost);
      renderRecords(p, recHost);

      // formulaires internes
      card.querySelector('.add-vaccin').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = { name:(fd.get('name')||'').trim(), last:(fd.get('last')||'').trim(), next:(fd.get('next')||'').trim() };
        if (!v.name) return;
        (p.vaccines ||= []).push(v);
        render();
      });

      card.querySelector('.add-med').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const m = { name:(fd.get('name')||'').trim(), dose:(fd.get('dose')||'').trim(), freq:(fd.get('freq')||'').trim(), start:(fd.get('start')||'').trim(), end:(fd.get('end')||'').trim() };
        if (!m.name) return;
        (p.meds ||= []).push(m);
        render();
      });

      card.querySelector('.add-record').addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const r = { date:(fd.get('date')||core.todayISO()), type:(fd.get('type')||'').trim(), title:(fd.get('title')||'').trim(), note:(fd.get('note')||'').trim() };
        (p.records ||= []).push(r);
        render();
      });

      people.appendChild(card);
    });
  }

  // addbar : ajouter une personne
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const p = {
      id: (fd.get('name')||'').toLowerCase().replace(/\s+/g,'-') || ('p-'+Math.random().toString(36).slice(2,7)),
      name: (fd.get('name')||'').trim(),
      blood: (fd.get('blood')||'').trim(),
      doctor: (fd.get('doctor')||'').trim(),
      emergency: (fd.get('emergency')||'').trim(),
      allergies: [],
      conditions: [],
      vaccines: [], meds: [], records: []
    };
    if (!p.name) return;
    persons.unshift(p);
    form.reset();
    render();
  });

  render();
  return { destroy(){ persons=[]; } };
}