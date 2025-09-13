export function init(el, core){
  const { $, state, save, fmtEUR, todayISO, escapeHTML, addToCalendar } = core;
  state.impots ||= { items:[] };

  el.innerHTML = `
    <section>
      <h2>Impôts</h2>
      <div class="addbar">
        <form id="impAdd" class="grid2">
          <select name="type" required>
            <option value="" disabled selected>Type d'impôt</option>
            <option>Impôt sur le revenu</option><option>Foncier</option><option>Habitation</option>
            <option>TVA</option><option>IS</option><option>Autre</option>
          </select>
          <input name="annee" type="number" placeholder="Année (ex: 2025)" required>
          <input name="montant" type="number" step="0.01" placeholder="Montant (€)" required>
          <input name="echeance" type="date" value="${todayISO()}" required>
          <input name="note" placeholder="Note (optionnel)">
          <button class="btn btn-primary" type="submit">Ajouter</button>
        </form>
      </div>
      <div class="row" style="margin:8px 0 4px">
        <div class="spacer"></div>
        <label class="chip"><input type="checkbox" id="showPaid"> Afficher les payés</label>
      </div>
      <div class="cards" id="impList"></div>
    </section>
  `;

  const form = $('#impAdd', el), list = $('#impList', el), showPaid = $('#showPaid', el);

  form.onsubmit = (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const item = {
      id: 'imp-'+Math.random().toString(36).slice(2,8),
      type: (fd.get('type')||'').trim(),
      annee: Number(fd.get('annee')||''),
      montant: Number(fd.get('montant')||0),
      echeance: fd.get('echeance') || todayISO(),
      paye: false,
      note: (fd.get('note')||'').trim()
    };
    if (!item.type || !item.annee || !item.echeance) return;
    state.impots.items.unshift(item); save(); form.reset(); render();
    addToCalendar({ title:`${item.type} ${item.annee}`, date:item.echeance, category:'Budget' });
  };
  showPaid.onchange = render;

  function render(){
    list.innerHTML = '';
    const items = (state.impots.items||[])
      .filter(x => showPaid.checked ? true : !x.paye)
      .sort((a,b)=> (a.echeance||'').localeCompare(b.echeance||''));
    if (!items.length){
      list.innerHTML = `<div class="card"><strong>Aucune entrée</strong><div class="muted">Ajoute une ligne via la barre.</div></div>`;
      return;
    }
    items.forEach(it=>{
      const card = document.createElement('div'); card.className = 'card';
      const due = new Date(it.echeance);
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">${escapeHTML(it.type)} ${escapeHTML(String(it.annee||''))}</h3>
            <div class="card-meta">Échéance : ${due.toLocaleDateString('fr-FR')} · ${fmtEUR(it.montant)}</div>
            ${it.note ? `<div class="card-meta">Note : ${escapeHTML(it.note)}</div>` : ``}
            ${it.paye ? `<div class="card-meta" style="color:var(--ok)">✅ Payé</div>` : ``}
          </div>
          <div class="card-actions">
            <button class="badge js-cal">🗓️ Rappel</button>
            <button class="badge js-docs">📂 Dossier</button>
            ${it.paye ? `<button class="btn js-unpay">Marquer non payé</button>` : `<button class="btn btn-primary js-pay">Marquer payé</button>`}
            <button class="btn btn-danger js-del">Suppr</button>
          </div>
        </div>`;
      card.querySelector('.js-cal').onclick = ()=> addToCalendar({ title:`${it.type} ${it.annee}`, date: it.echeance, category:'Budget' });
      card.querySelector('.js-docs').onclick = ()=>{
        location.hash = '#/document';
        sessionStorage.setItem('docs_open_folder', `Impots/${it.annee}-${it.type.replace(/\s+/g,'_')}`);
      };
      card.querySelector('.js-pay')?.addEventListener('click', ()=>{ it.paye=true; save(); render(); });
      card.querySelector('.js-unpay')?.addEventListener('click', ()=>{ it.paye=false; save(); render(); });
      card.querySelector('.js-del').onclick = ()=>{
        if(!confirm(`Supprimer ${it.type} ${it.annee} ?`)) return;
        state.impots.items = state.impots.items.filter(x=> x!==it); save(); render();
      };
      list.appendChild(card);
    });
  }
  render();
  return { destroy(){} };
}
export function destroy(){}