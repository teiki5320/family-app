export function init(el, core) {
  el.innerHTML = `
    <section class="fade-in">
      <h2>Accueil</h2>
      <div class="tiles">
        <a href="#/listes" class="tile">
          <div class="icon">📝</div>
          <div class="title">Listes</div>
          <div class="subtitle">Vos tâches</div>
        </a>
        <a href="#/calendrier" class="tile">
          <div class="icon">📅</div>
          <div class="title">Calendrier</div>
          <div class="subtitle">Évènements</div>
        </a>
        <a href="#/document" class="tile">
          <div class="icon">📂</div>
          <div class="title">Documents</div>
          <div class="subtitle">Fichiers</div>
        </a>
        <a href="#/impots" class="tile">
          <div class="icon">💶</div>
          <div class="title">Impôts</div>
          <div class="subtitle">Déclarations</div>
        </a>
        <a href="#/sante" class="tile">
          <div class="icon">⚕️</div>
          <div class="title">Santé</div>
          <div class="subtitle">Carnets & vaccins</div>
        </a>
        <a href="#/vehicule" class="tile">
          <div class="icon">🚗</div>
          <div class="title">Véhicules</div>
          <div class="subtitle">Fiches & rappels</div>
        </a>
        <a href="#/message" class="tile">
          <div class="icon">💬</div>
          <div class="title">Messages</div>
          <div class="subtitle">Chat familial</div>
        </a>
        <a href="#/menu" class="tile">
          <div class="icon">🍎</div>
          <div class="title">Menu</div>
          <div class="subtitle">Clic & miam du jour</div>
        </a>
      </div>
    </section>
  `;
  return { destroy(){} };
}