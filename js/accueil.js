// Page d'accueil : hero + tuiles de navigation
export function init(el, core){
  el.innerHTML = `
    <section class="fade-in">
      <h2>Famille</h2>

      <div class="hero">
        <div class="hero-top">
          <span class="chip">INFO</span>
          <button class="ghost" onclick="location.hash='#/calendrier'">⚙︎</button>
        </div>
        <div class="hero-body">
          <h3 class="hero-title">Bienvenue 👋</h3>
          <p class="hero-sub">Accès rapide à vos listes, agenda, documents, messages…</p>
          <ul class="hero-dots"><li></li><li></li><li></li></ul>
        </div>
      </div>

      <div class="tiles">
        <a class="tile" href="#/listes">
          <div class="icon">🗂️</div>
          <div class="title">Listes</div>
          <div class="subtitle">Tâches familiales</div>
        </a>

        <a class="tile" href="#/calendrier">
          <div class="icon">📅</div>
          <div class="title">Calendrier</div>
          <div class="subtitle">Évènements & rappels</div>
        </a>

        <a class="tile" href="#/document">
          <div class="icon">📁</div>
          <div class="title">Documents</div>
          <div class="subtitle">Dossiers & fichiers</div>
        </a>

        <a class="tile" href="#/impots">
          <div class="icon">💶</div>
          <div class="title">Impôts</div>
          <div class="subtitle">Échéances & paiements</div>
        </a>

        <a class="tile" href="#/sante">
          <div class="icon">⚕️</div>
          <div class="title">Santé</div>
          <div class="subtitle">Carnets & vaccins</div>
        </a>

        <a class="tile" href="#/vehicule">
          <div class="icon">🚘</div>
          <div class="title">Véhicules</div>
          <div class="subtitle">Entretiens & CT</div>
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
export function destroy(){}  // (optionnel)