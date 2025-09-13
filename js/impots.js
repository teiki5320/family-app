export function init(el){
  // Items : { type: 'echeance' | 'paiement', label, date, amount }
  let items = [];

  const fmtEUR = (x)=> (Number(x)||0).toLocaleString('fr-FR',{ style:'currency', currency:'EUR' });

  el.innerHTML = `
    <section class="fade-in">
      <h2>Impôts</h2>

      <!-- Addbar -->
      <form id="taxForm" class="addbar grid2">
        <select name="type" required>
          <option value="echeance">Échéance</option>
          <option value="paiement">Paiement</option>
        </select>
        <input name="label" placeholder="Libellé (ex: Solde IR 2025)" required>
        <input name="date"  type="date" required>
        <input name="amount" type="number" step="0.01" placeholder="Montant (ex: 250.00)" required>
        <button class="btn" type="submit">Ajouter</button>
      </form>

      <!-- Synthèse -->
      <div class="grid2" style="margin-bottom:12px">
        <div class="card">
          <div class="card-header">
            <div class="card-title-wrap">
              <h3 class="card-title">Total Échéances</h3>
              <div id="sumDue" class="card-meta">--</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title-wrap">
              <h3 class="card-title">Total Paiements</h3>
              <div id="sumPaid" class="card-meta">--</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Liste -->
      <div id="taxList" class="cards"></div>
    </section>
  `;

  const $ = (s)=> el.querySelector(s);
  const form  = $('#taxForm');
  const list  = $('#taxList');
  const sumDueEl = $('#sumDue');
  const sumPaidEl = $('#sumPaid');

  function computeSums(){
    let due=0, paid=0;
    items.forEach(it=> {
      const v = Number(it.amount)||0;
      if (it.type === 'echeance') due += v; else paid += v;
    });
    sumDueEl.textContent  = fmtEUR(due);
    sumPaidEl.textContent = fmtEUR(paid);
  }

  function render(){
    list.innerHTML = '';
    if (!items.length){
      list.innerHTML = `<div class="card"><p class="muted">Aucune donnée pour le moment</p></div>`;
      computeSums(); return;
    }
    // tri par date
    items.sort((a,b)=> (a.date||'').localeCompare(b.date||''));

    items.forEach((it, i)=>{
      const card = document.createElement('div');
      card.className = 'card';
      const meta = `${it.date||''} · ${fmtEUR(it.amount)} · ${it.type==='echeance'?'Échéance':'Paiement'}`;
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">${it.label ? it.label.replace(/[<>&]/g,'') : '--'}</h3>
            <div class="card-meta">${meta}</div>
          </div>
          <div class="card-actions">
            <button class="del btn-danger">Suppr</button>
          </div>
        </div>
      `;
      card.querySelector('.del').addEventListener('click', ()=>{
        items.splice(i,1); render();
      });
      list.appendChild(card);
    });

    computeSums();
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const it = {
      type:  fd.get('type') || 'echeance',
      label: (fd.get('label')||'').trim(),
      date:  (fd.get('date')||'').trim(),
      amount:(fd.get('amount')||'').trim(),
      ts: Date.now()
    };
    if (!it.label || !it.date || !it.amount) return;
    items.unshift(it);
    form.reset();
    render();
  });

  render();
  return { destroy(){ items=[]; } };
}