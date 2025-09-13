export function init(el, core){
  // État local simple
  let events = [];

  el.innerHTML = `
    <section class="fade-in">
      <h2>Calendrier</h2>

      <!-- Addbar -->
      <form id="evForm" class="addbar grid2">
        <input name="title" placeholder="Titre de l'évènement" required>
        <input name="date" type="date" value="${core.todayISO()}" required>
        <input name="time" type="time" value="09:00">
        <input name="place" placeholder="Lieu (optionnel)">
        <button class="btn" type="submit">Ajouter</button>
      </form>

      <!-- Résumé -->
      <div class="card" id="evSummary" style="margin-bottom:12px">
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">Prochain évènement</h3>
            <div class="card-meta" id="evNextMeta">--</div>
          </div>
        </div>
      </div>

      <!-- Liste -->
      <div class="cards" id="evList"></div>
    </section>
  `;

  const $ = (s)=> el.querySelector(s);
  const form = $('#evForm');
  const list = $('#evList');
  const nextMeta = $('#evNextMeta');

  function sortEvents(a,b){
    return (a.date + (a.time||'')).localeCompare(b.date + (b.time||''));
  }

  function renderSummary(){
    if (!events.length){ nextMeta.textContent = 'Aucun évènement'; return; }
    const nowISO = new Date().toISOString().slice(0,16);
    const next = [...events].sort(sortEvents).find(e => (e.date+'T'+(e.time||'00:00')) >= nowISO) || [...events].sort(sortEvents)[0];
    const dt = new Date(next.date + 'T' + (next.time||'09:00'));
    nextMeta.textContent = `${next.title} -- ${dt.toLocaleString('fr-FR')}${next.place?` · ${next.place}`:''}`;
  }

  function render(){
    list.innerHTML = '';
    if (!events.length){
      list.innerHTML = `<div class="card"><p class="muted">Aucun évènement</p></div>`;
      renderSummary(); return;
    }
    events.sort(sortEvents).forEach((e, i)=>{
      const dt = (e.time ? `${e.date} · ${e.time}` : e.date);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">${core.escapeHTML(e.title)}</h3>
            <div class="card-meta">${dt}${e.place?` · ${core.escapeHTML(e.place)}`:''}</div>
          </div>
          <div class="card-actions">
            <button class="del btn-danger">Suppr</button>
          </div>
        </div>
      `;
      card.querySelector('.del').addEventListener('click', ()=>{
        events.splice(i,1); render();
      });
      list.appendChild(card);
    });
    renderSummary();
  }

  form.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const fd = new FormData(form);
    const item = {
      title: (fd.get('title')||'').trim(),
      date:  fd.get('date') || core.todayISO(),
      time:  (fd.get('time')||'').trim(),
      place: (fd.get('place')||'').trim(),
      ts: Date.now()
    };
    if (!item.title || !item.date) return;
    events.unshift(item);
    form.reset();
    render();
  });

  render();
  return { destroy(){ events=[]; } };
}