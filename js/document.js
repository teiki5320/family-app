export function init(el){
  // Démo locale : on gère une petite liste de "fichiers" (nom + URL)
  let files = [];

  el.innerHTML = `
    <section class="fade-in">
      <h2>Documents</h2>

      <!-- Addbar -->
      <form id="docForm" class="addbar grid2">
        <input name="name" placeholder="Nom du fichier (ex: Contrat.pdf)" required>
        <input name="url"  placeholder="URL (ex: https://...)" required>
        <button class="btn" type="submit">Ajouter</button>
      </form>

      <!-- Grille de fichiers -->
      <div class="file-grid" id="docGrid"></div>
    </section>
  `;

  const $ = (s)=> el.querySelector(s);
  const form = $('#docForm');
  const grid = $('#docGrid');

  function render(){
    grid.innerHTML = '';
    if (!files.length){
      grid.innerHTML = `<div class="card"><p class="muted">Aucun document</p></div>`;
      return;
    }
    files.forEach((f, i)=>{
      const card = document.createElement('div');
      card.className = 'file-card';
      const isImg = /\.(png|jpe?g|gif|webp|avif)$/i.test(f.url||'');
      const isPdf = /\.pdf(\?|$)/i.test(f.url||'');
      card.innerHTML = `
        ${isImg ? `<img class="thumb" src="${f.url}" alt="${f.name}">`
                 : `<div class="thumb" style="display:flex;align-items:center;justify-content:center;font-size:36px">${isPdf?'📄':'📦'}</div>`}
        <div class="name" title="${f.name}">${f.name}</div>
        <div class="meta">${new Date(f.ts).toLocaleString('fr-FR')}</div>
        <div class="file-actions">
          <a class="ghost" href="${f.url}" target="_blank" rel="noopener">Ouvrir</a>
          <button class="del btn-danger">Suppr</button>
        </div>
      `;
      card.querySelector('.del').addEventListener('click', ()=>{ files.splice(i,1); render(); });
      grid.appendChild(card);
    });
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const name = (fd.get('name')||'').trim();
    const url  = (fd.get('url')||'').trim();
    if (!name || !url) return;
    files.unshift({ name, url, ts: Date.now() });
    form.reset();
    render();
  });

  render();
  return { destroy(){ files=[]; } };
}