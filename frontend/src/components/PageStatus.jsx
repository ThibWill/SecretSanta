/** États communs à toutes les pages : chargement et erreur. */

export function PageLoading({ message = 'Le lutin fouille dans sa hotte…' }) {
  return (
    <div className="card status-card" role="status">
      <span className="status-icon spin" aria-hidden="true">❄️</span>
      <p>{message}</p>
    </div>
  );
}

export function PageError({ error, onRetry }) {
  return (
    <div className="card status-card" role="alert">
      <span className="status-icon" aria-hidden="true">🦌</span>
      <p>Oups, un renne a trébuché.</p>
      <p className="error-text">{error?.message ?? 'Une erreur inattendue est survenue.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Titre de page posé sur un ruban rouge. */
export function PageTitle({ children }) {
  return (
    <h1 className="ribbon">
      <span>{children}</span>
    </h1>
  );
}
