export function render() {
  return `
    <section class="panel">
      <h2>Bienvenue 👋</h2>
      <p>Accès rapide à vos listes, calendrier, documents, etc.</p>

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
        <a href="#/documents" class="tile">
          <div class="icon">📂</div>
          <div class="title">Documents</div>
          <div class="subtitle">Fichiers</div>
        </a>
      </div>
    </section>
  `;
}