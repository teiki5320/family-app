// js/accueil.js
export function init(el, core){
  const { state, fmtEUR, todayISO } = core;

  // métriques rapides
  const tasksCount = (state.tasks||[]).filter(t=>!t.done).length;
  let sumIn=0, sumOut=0; (state.tx||[]).forEach(t=>{ if(t.type==='+') sumIn+=t.amount; else sumOut+=t.amount; });
  const balance = fmtEUR(sumIn - sumOut);

  const evs = Array.isArray(state.events)? [...state.events] : [];
  evs.sort((a,b)=> (a.date+(a.time||'00:00')).localeCompare(b.date+(b.time||'00:00')));
  const nowISO = new Date().toISOString().slice(0,16);
  const next = evs.find(e => (e.date+'T'+(e.time||'00:00')) >= nowISO);
  const nextTxt = next ? `${next.title} -- ${new Date(next.date+'T'+(next.time||'09:00')).toLocaleString('fr-FR')}` : 'Pas d’événement';

  el.innerHTML = `
    <section class="fade-in">
      <h2>Famille</h2>

      <!-- Hero / Info -->
      <div class="hero">
        <div class="hero-top">
          <span class="chip">INFO</span>
          <button class="ghost" onclick="location.hash='#/calendrier'">⚙︎</button>
        </div>
        <div class="hero-body">
          <h3 class="hero-title">Bienvenue, famille 👋</h3>
          <p class="hero-sub">Accès rapide à vos listes, agenda, budgets, documents, messages…</p>
          <ul class="hero-dots">
            <li></li><li></li><li></li>
          </ul>
        </div>
      </div>

      <!-- Tuiles -->
      <div class="tiles">
        <a class="tile" href="#/listes">
          <div class="icon">🗂️</div>
          <div class="title">Listes</div>
          <div class="subtitle">${tasksCount} élément${tasksCount>1?'s':''}</div>
        </a>

        <a class="tile" href="#/calendrier">
          <div class="icon">📅</div>
          <div class="title">Calendrier</div>
          <div class="subtitle">${nextTxt}</div>
        </a>

        <a class="tile" href="#/document">
          <div class="icon">📁</div>
          <div class="title">Documents</div>
          <div class="subtitle">Dossiers & fichiers</div>
        </a>

        <a class="tile" href="#/impots">
          <div class="icon">🐷</div>
          <div class="title">Budget</div>
          <div class="subtitle">Solde · ${balance}</div>
        </a>

        <a class="tile" href="#/message">
          <div class="icon">💬</div>
          <div class="title">Messages</div>
          <div class="subtitle">Chat familial</div>
        </a>

        <a class="tile" href="#/menu">
          <div class="icon">🍎</div>
          <div class="title">Menu</div>
          <div class="subtitle">Clic&miam du jour</div>
        </a>
      </div>
    </section>
  `;

  return { destroy(){} };
}
export function destroy(){}