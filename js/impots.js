// js/impots.js (version clarifiée)
// Impôts famille : années, montants, échéances (avec .ics), checklist, notes, comparatif.
// Lisibilité : résumé en tête, prochaine échéance, libellés simplifiés.

const LS_KEY = 'familyApp.impots.v2';
const TZ = 'Europe/Paris';

export function init(el, core){
  // ==== état ====
  let years = load();

  // ==== rendu de base ====
  el.innerHTML = `
    <section class="fade-in">
      <h2>Impôts</h2>

      <div class="row" style="gap:10px; margin:8px 0 12px">
        <form id="yAdd" class="addbar row" autocomplete="off" style="flex:1">
          <input name="year" type="number" placeholder="Ajouter une année (ex: ${new Date().getFullYear()})" required>
          <button class="btn" type="submit">Ajouter</button>
        </form>
        <div class="spacer"></div>
        <button id="btnIcsAll" class="ghost">Exporter .ics (toutes échéances)</button>
        <button id="btnExportJson" class="ghost">Exporter JSON</button>
        <button id="btnImportJson" class="ghost">Importer JSON</button>
        <input id="fileImport" type="file" accept="application/json" hidden>
        <button id="btnReset" class="btn-danger">Tout effacer</button>
      </div>

      <div id="yGrid" class="cards"></div>

      <div class="card" style="margin-top:14px">
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">Comparatif multi-années</h3>
            <div class="card-meta">Revenus / Impôt / Solde</div>
          </div>
          <div class="card-actions">
            <button id="toggleChart" class="ghost">Afficher le graphe</button>
          </div>
        </div>
        <div id="cmpWrap" style="margin-top:6px">
          <div id="cmpTable" class="list"></div>
          <canvas id="cmpChart" width="900" height="220" style="display:none; width:100%; max-width:100%; margin-top:10px"></canvas>
        </div>
      </div>
    </section>
  `;

  // refs
  const $ = (s)=> el.querySelector(s);
  const yGrid = $('#yGrid');
  const yAdd  = $('#yAdd');
  const btnIcsAll = $('#btnIcsAll');
  const btnExportJson = $('#btnExportJson');
  const btnImportJson = $('#btnImportJson');
  const fileImport = $('#fileImport');
  const btnReset  = $('#btnReset');
  const cmpTable = $('#cmpTable');
  const cmpChart = $('#cmpChart');
  const toggleChart = $('#toggleChart');

  // ==== persistance ====
  function load(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch { return []; }
  }
  function save(){
    localStorage.setItem(LS_KEY, JSON.stringify(years));
  }

  // ==== helpers ====
  const pad2 = (n)=> String(n).padStart(2,'0');
  const euro = (n)=> {
    const x = Number(n||0);
    return isFinite(x) ? x.toLocaleString('fr-FR',{style:'currency',currency:'EUR'}) : '--';
  };
  const clampYear = (y)=> {
    const n = Number(y)||0; if (!n) return '';
    return Math.max(2000, Math.min(2100, n));
  };

  // iCalendar
  function toICSDate(dateStr, timeStr){
    const [y,m,d] = (dateStr||'').split('-').map(Number);
    if (!y||!m||!d) return '';
    if (!timeStr) return `${y}${pad2(m)}${pad2(d)}`;
    const [hh,mm] = (timeStr||'09:00').split(':').map(Number);
    return `${y}${pad2(m)}${pad2(d)}T${pad2(hh)}${pad2(mm)}00`;
  }
  function nextHour(dateStr, timeStr){
    if (!timeStr) return null;
    const dt = new Date(`${dateStr}T${timeStr}`); dt.setHours(dt.getHours()+1);
    return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  }
  const escICS = (s)=> String(s||'').replace(/([,;])/g,'\\$1').replace(/\n/g,'\\n');
  function buildICS(items){
    const lines = [
      'BEGIN:VCALENDAR','VERSION:2.0',
      'PRODID:-//FamilyApp//Impots//FR',
      `CALSCALE:GREGORIAN`,
      `X-WR-TIMEZONE:${TZ}`,
      `METHOD:PUBLISH`,
    ];
    items.forEach(e=>{
      const uid = `imp-${(e.ts||Date.now())}-${Math.random().toString(36).slice(2)}@family`;
      const dtstart = toICSDate(e.date, e.time);
      const endT = nextHour(e.date, e.time);
      const dtend = e.time ? toICSDate(e.date, endT) : null;
      lines.push('BEGIN:VEVENT');
      if (e.time){
        lines.push(`DTSTART;TZID=${TZ}:${dtstart}`);
        lines.push(`DTEND;TZID=${TZ}:${dtend}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
      }
      lines.push(`UID:${uid}`);
      lines.push(`SUMMARY:${escICS(e.title||'Échéance')}`);
      if (e.note) lines.push(`DESCRIPTION:${escICS(e.note)}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
  function download(name, text, type='text/calendar'){
    const blob = new Blob([text], { type });
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
    URL.revokeObjectURL(a.href);
  }

  // échéances FR (indicatives)
  function stdDeadlines(y){
    const Y = String(y);
    return [
      { title:'Déclaration en ligne', date:`${Y}-05-25`, time:'12:00', note:'fin mai (indicatif)' },
      { title:'Solde de l’impôt',     date:`${Y}-09-15`, time:'12:00', note:'mi-septembre (indicatif)' },
      { title:'Acompte 1/3',          date:`${Y}-01-15` },
      { title:'Acompte 2/3',          date:`${Y}-05-15` },
      { title:'Acompte 3/3',          date:`${Y}-09-15` },
    ];
  }

  function statusBadge(s){
    const map = {
      'À préparer':'🟠 À préparer',
      'Déclaré':'🔵 Déclaré',
      'Avis reçu':'🟢 Avis reçu',
      'Soldé':'✅ Soldé'
    };
    return map[s] || '🟠 À préparer';
  }

  // ==== comparatif ====
  function renderComparatif(){
    const rows = [...years].sort((a,b)=> (b.year||0)-(a.year||0));
    cmpTable.innerHTML = '';
    if (!rows.length){
      cmpTable.innerHTML = `<div class="item"><div class="muted">Aucune année pour comparer</div></div>`;
    } else {
      const head = document.createElement('div');
      head.className = 'item';
      head.innerHTML = `
        <div style="width:80px"><strong>Année</strong></div>
        <div class="spacer"></div>
        <div style="width:140px"><strong>Revenus</strong></div>
        <div style="width:140px"><strong>Impôt</strong></div>
        <div style="width:160px"><strong>Solde</strong></div>
      `;
      cmpTable.appendChild(head);
      rows.forEach(y=>{
        const solde = (Number(y.impot||0)||0) - (Number(y.acomptes||0)||0);
        const li = document.createElement('div'); li.className='item';
        li.innerHTML = `
          <div style="width:80px"><strong>${y.year||'--'}</strong></div>
          <div class="spacer"></div>
          <div style="width:140px">${euro(y.revenus||0)}</div>
          <div style="width:140px">${euro(y.impot||0)}</div>
          <div style="width:160px">${solde>=0? 'À payer ' : 'À rembourser '}${euro(Math.abs(solde))}</div>
        `;
        cmpTable.appendChild(li);
      });
    }
  }

  // graphe (toggle)
  toggleChart.addEventListener('click', ()=>{
    const shown = cmpChart.style.display !== 'none';
    cmpChart.style.display = shown ? 'none' : 'block';
    toggleChart.textContent = shown ? 'Afficher le graphe' : 'Masquer le graphe';
    if (!shown) drawChart();
  });
  function drawChart(){
    const rows = [...years].sort((a,b)=> (b.year||0)-(a.year||0));
    const ctx = cmpChart.getContext('2d');
    ctx.clearRect(0,0,cmpChart.width, cmpChart.height);
    if (!rows.length) return;
    const dataR = rows.map(r=>Number(r.revenus||0)||0);
    const dataI = rows.map(r=>Number(r.impot||0)||0);
    const labels = rows.map(r=>String(r.year||''));
    const max = Math.max(1, ...dataR, ...dataI);
    const W=cmpChart.width, H=cmpChart.height;
    const left=40,right=10,bot=24,top=10;
    const plotW=W-left-right, plotH=H-top-bot;
    const n=rows.length, groupW=plotW/n, barW=Math.max(10, Math.min(30, groupW*0.35));
    const yVal = v => top + plotH*(1-(v/max));
    // axes
    ctx.strokeStyle='#2a2b40'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, top+plotH); ctx.lineTo(left+plotW, top+plotH); ctx.stroke();
    // grid + ticks
    ctx.fillStyle='#9aa0a6'; ctx.font='12px system-ui';
    for(let i=0;i<=4;i++){ const val=Math.round(max*i/4), y=yVal(val);
      ctx.fillText(val.toLocaleString('fr-FR'), 4, y+4);
      ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(left+plotW,y); ctx.stroke();
    }
    // bars
    for(let i=0;i<n;i++){
      const x0 = left + i*groupW + (groupW - (2*barW+6))/2;
      const rH = plotH*(dataR[i]/max);
      ctx.fillStyle='#55c2ff'; ctx.fillRect(x0, top+(plotH-rH), barW, rH);
      const iH = plotH*(dataI[i]/max);
      ctx.fillStyle='#38e1b9'; ctx.fillRect(x0+barW+6, top+(plotH-iH), barW, iH);
      ctx.fillStyle='#9aa0a6'; ctx.fillText(labels[i], left + i*groupW + groupW/2 - 10, H-6);
    }
  }

  // ==== cartes années ====
  function renderYears(){
    yGrid.innerHTML = '';
    if (!years.length){
      yGrid.innerHTML = `<div class="card"><p class="muted">Ajoute une année en haut.</p></div>`;
      return;
    }
    years.sort((a,b)=> (b.year||0)-(a.year||0));

    years.forEach((yObj)=>{
      const y = yObj.year;
      const revenus  = Number(yObj.revenus||0)||0;
      const impot    = Number(yObj.impot||0)||0;
      const acomptes = Number(yObj.acomptes||0)||0;
      const solde    = (impot - acomptes);
      const mensual  = !!yObj.mensualise;
      const statut   = yObj.status || 'À préparer';
      const echeances = Array.isArray(yObj.echeances) ? yObj.echeances : (yObj.echeances = []);

      // prochaine échéance
      const next = (()=> {
        const nowISO = new Date().toISOString().slice(0,10);
        return [...echeances]
          .filter(e => e.date)
          .sort((a,b)=> (a.date+(a.time||'')).localeCompare(b.date+(b.time||'')))
          .find(e => e.date >= nowISO) || null;
      })();

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-wrap">
            <h3 class="card-title">Année ${y}</h3>
            <div class="card-meta">${statusBadge(statut)}</div>
          </div>
          <div class="card-actions">
            <button class="del btn-danger" data-del>Suppr</button>
          </div>
        </div>

        <!-- résumé clair -->
        <div class="row" style="gap:8px; flex-wrap:wrap; margin:4px 0 10px">
          <span class="chip">Impôt: <strong>${euro(impot)}</strong></span>
          <span class="chip">Acomptes déjà prélevés: <strong>${euro(acomptes)}</strong></span>
          <span class="chip">${solde>=0 ? 'Reste à payer' : 'Remboursement'}: <strong>${euro(Math.abs(solde))}</strong></span>
          ${next ? `<span class="chip" title="${next.title}">${'Prochaine échéance'}: <strong>${next.date}${next.time? ' · '+next.time:''}</strong></span>` : ''}
        </div>

        <div class="grid2" style="gap:10px">
          <div class="box">
            <summary>Montants & statut</summary>
            <div class="section-body">
              <form class="grid2" data-money>
                <input name="revenus" type="number" step="0.01" placeholder="Revenus imposables" value="${revenus||''}">
                <input name="impot"   type="number" step="0.01" placeholder="Impôt dû" value="${impot||''}">
                <input name="acomptes" type="number" step="0.01" placeholder="Acomptes déjà prélevés (jan–sept)" value="${acomptes||''}">
                <label class="row" style="gap:8px"><input name="mensualise" type="checkbox" ${mensual?'checked':''}> Mensualisé</label>
                <label class="row" style="gap:8px">
                  <span>Statut</span>
                  <select name="status" style="min-width:160px">
                    ${['À préparer','Déclaré','Avis reçu','Soldé'].map(s=>`<option ${s===statut?'selected':''}>${s}</option>`).join('')}
                  </select>
                </label>
              </form>
              <div class="muted" style="margin-top:6px">Astuce : mets à jour "Acomptes déjà prélevés" pour voir le reste réel.</div>
            </div>
          </div>

          <div class="box">
            <summary>Échéances & rappels</summary>
            <div class="section-body">
              <div class="row" style="gap:8px; margin-bottom:8px">
                <button class="btn" data-std>+ Ajouter les échéances standard</button>
                <div class="spacer"></div>
                <button class="ghost" data-ics-year>Exporter .ics (année)</button>
                <button class="ghost" data-docs>📂 Ouvrir Dossier</button>
              </div>

              <form class="row" data-add-evt autocomplete="off" style="gap:8px; margin-bottom:8px">
                <input name="title" placeholder="Titre (ex: Déclaration en ligne)" required>
                <input name="date" type="date" required>
                <input name="time" type="time" placeholder="Heure (optionnel)">
                <input name="note" placeholder="Note (optionnel)">
                <button class="ghost">Ajouter</button>
              </form>

              <div data-evt-list class="list"></div>
            </div>
          </div>

          <div class="box">
            <summary>Checklist</summary>
            <div class="section-body">
              <div class="list" data-checklist></div>
              <form class="row" data-add-check style="gap:8px; margin-top:8px">
                <input name="label" placeholder="Ajouter un point (ex: Attestation crèche)">
                <button class="ghost">Ajouter</button>
              </form>
            </div>
          </div>

          <div class="box">
            <summary>Notes</summary>
            <div class="section-body">
              <textarea data-notes rows="4" placeholder="Notes ${y}…">${yObj.notes||''}</textarea>
              <div class="muted" style="margin-top:6px">Sauvegardé automatiquement</div>
            </div>
          </div>
        </div>
      `;

      // actions globales carte
      card.querySelector('[data-del]').addEventListener('click', ()=>{
        if (!confirm(`Supprimer l’année ${y} ?`)) return;
        years = years.filter(a => a!==yObj); save(); renderAll();
      });

      // montants & statut
      card.querySelector('[data-money]').addEventListener('input', (e)=>{
        const fd = new FormData(e.currentTarget);
        yObj.revenus    = Number(fd.get('revenus')||0)||0;
        yObj.impot      = Number(fd.get('impot')||0)||0;
        yObj.acomptes   = Number(fd.get('acomptes')||0)||0;
        yObj.mensualise = !!fd.get('mensualise');
        yObj.status     = String(fd.get('status')||'À préparer');
        save(); renderAll();
      });

      // échéances
      const evtList = card.querySelector('[data-evt-list]');
      const evtForm = card.querySelector('[data-add-evt]');
      const btnStd  = card.querySelector('[data-std]');
      const btnIcsYear = card.querySelector('[data-ics-year]');
      const btnDocs = card.querySelector('[data-docs]');

      btnDocs.addEventListener('click', ()=>{
        location.hash = '#/document';
        setTimeout(()=> alert(`Ouvre "Impots/${y}" dans Documents pour déposer tes PDFs.`), 50);
      });

      btnIcsYear.addEventListener('click', ()=>{
        if (!yObj.echeances || !yObj.echeances.length) { alert('Aucune échéance à exporter.'); return; }
        const ics = buildICS(yObj.echeances);
        download(`impots-${y}.ics`, ics, 'text/calendar');
      });

      function renderEvents(){
        evtList.innerHTML = '';
        const arr = (yObj.echeances||[]).slice().sort((a,b)=> (a.date||'').localeCompare(b.date||''));
        if (!arr.length){
          const li = document.createElement('div'); li.className='item';
          li.innerHTML = `<div class="muted">Aucune échéance -- ajoute les "standards" ou crée la tienne.</div>`;
          evtList.appendChild(li); return;
        }
        arr.forEach(e=>{
          const li = document.createElement('div'); li.className='item';
          const when = e.time ? `${e.date} · ${e.time}` : e.date;
          li.innerHTML = `
            <div>
              <strong>${core.escapeHTML(e.title||'Échéance')}</strong>
              <div class="who">${when}${e.note?` · ${core.escapeHTML(e.note)}`:''}</div>
            </div>
            <div class="spacer"></div>
            <button class="ghost" data-ics>ICS</button>
            <button class="del" data-del>Suppr</button>
          `;
          li.querySelector('[data-ics]').addEventListener('click', ()=>{
            const ics = buildICS([{...e, ts:e.ts||Date.now()}]);
            download(`impots-${y}-${(e.title||'evt').replace(/\s+/g,'_')}.ics`, ics, 'text/calendar');
          });
          li.querySelector('[data-del]').addEventListener('click', ()=>{
            const idx = (yObj.echeances||[]).indexOf(e);
            if (idx>-1) yObj.echeances.splice(idx,1);
            save(); renderAll();
          });
          evtList.appendChild(li);
        });
      }

      evtForm.addEventListener('submit', (ev)=>{
        ev.preventDefault();
        const fd = new FormData(evtForm);
        const item = {
          title:(fd.get('title')||'').trim(),
          date: (fd.get('date')||'').trim(),
          time: (fd.get('time')||'').trim(),
          note: (fd.get('note')||'').trim(),
          ts: Date.now()
        };
        if (!item.title || !item.date) return;
        (yObj.echeances ||= []).push(item);
        save(); renderAll();
      });

      btnStd.addEventListener('click', ()=>{
        const std = stdDeadlines(y);
        const have = new Set((yObj.echeances||[]).map(e=> `${e.title}|${e.date}`));
        const add = std.filter(e => !have.has(`${e.title}|${e.date}`)).map(e => ({...e, ts:Date.now()}));
        (yObj.echeances ||= []).push(...add);
        save(); renderAll();
      });

      // checklist
      const listCL = card.querySelector('[data-checklist]');
      const addCL  = card.querySelector('[data-add-check]');
      if (!Array.isArray(yObj.checklist) || !yObj.checklist.length){
        yObj.checklist = [
          { label:'Attestations salaires', done:false },
          { label:'Frais garde enfants', done:false },
          { label:'Intérêts / capitaux', done:false },
          { label:'Dons associations', done:false },
          { label:'Frais réels / km', done:false },
        ];
      }
      function renderChecklist(){
        listCL.innerHTML = '';
        yObj.checklist.forEach((c, idx)=>{
          const row = document.createElement('div'); row.className='item';
          row.innerHTML = `
            <label class="row" style="gap:8px; flex:1">
              <input type="checkbox" ${c.done?'checked':''}>
              <div>${core.escapeHTML(c.label||'')}</div>
            </label>
            <div class="spacer"></div>
            <button class="del">Suppr</button>
          `;
          row.querySelector('input').addEventListener('change', e=>{
            c.done = e.target.checked; save();
          });
          row.querySelector('.del').addEventListener('click', ()=>{
            yObj.checklist.splice(idx,1); save(); renderChecklist();
          });
          listCL.appendChild(row);
        });
      }
      addCL.addEventListener('submit', (e)=>{
        e.preventDefault();
        const fd = new FormData(addCL);
        const label = String(fd.get('label')||'').trim();
        if (!label) return;
        (yObj.checklist ||= []).push({ label, done:false });
        save(); addCL.reset(); renderChecklist();
      });

      // notes
      const notesEl = card.querySelector('[data-notes]');
      let tNotes;
      notesEl.addEventListener('input', ()=>{
        clearTimeout(tNotes);
        tNotes = setTimeout(()=>{ yObj.notes = notesEl.value; save(); }, 250);
      });

      // initial renders
      renderEvents();
      renderChecklist();

      yGrid.appendChild(card);
    });
  }

  function renderAll(){
    renderYears();
    renderComparatif();
  }

  // ==== actions globales ====
  yAdd.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(yAdd);
    const year = clampYear(fd.get('year'));
    if (!year) return;
    if (years.find(x=>x.year===year)) { alert('Cette année existe déjà.'); return; }
    years.unshift({
      year,
      status:'À préparer',
      revenus:0, impot:0, acomptes:0, mensualise:true,
      notes:'', checklist:[], echeances:[]
    });
    save(); yAdd.reset(); renderAll();
  });

  btnIcsAll.addEventListener('click', ()=>{
    const all = years.flatMap(y => (y.echeances||[]));
    if (!all.length){ alert('Aucune échéance à exporter.'); return; }
    const ics = buildICS(all);
    download(`impots-family-${new Date().toISOString().slice(0,10)}.ics`, ics);
  });

  btnExportJson.addEventListener('click', ()=>{
    download(`impots-data-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(years, null, 2), 'application/json');
  });

  btnImportJson.addEventListener('click', ()=> fileImport.click());
  fileImport.addEventListener('change', async ()=>{
    const f = fileImport.files?.[0]; if (!f) return;
    try{
      const txt = await f.text();
      const data = JSON.parse(txt);
      if (!Array.isArray(data)) throw new Error('Format JSON inattendu');
      const byYear = new Map(data.filter(x=>x && x.year).map(x => [x.year, x]));
      years = years.filter(y => !byYear.has(y.year)).concat([...byYear.values()]);
      save(); renderAll();
    }catch(e){
      alert('Import impossible : ' + (e?.message || e));
    } finally { fileImport.value=''; }
  });

  btnReset.addEventListener('click', ()=>{
    if (!years.length) return;
    if (!confirm('Supprimer toutes les données Impôts ?')) return;
    years = []; save(); renderAll();
  });

  // init
  renderAll();

  return { destroy(){} };
}