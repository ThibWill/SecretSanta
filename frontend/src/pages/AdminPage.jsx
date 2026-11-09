import { useId, useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../useApi.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { PageError, PageLoading, PageTitle } from '../components/PageStatus.jsx';

const mark = (ok, yes, no) => (
  <span role="img" aria-label={ok ? yes : no}>
    {ok ? '✅' : '⏳'}
  </span>
);

export default function AdminPage() {
  const { data, setData, error, loading, reload } = useApi(api.adminStatus);
  const [resetLetters, setResetLetters] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const checkboxId = useId();

  async function doReset() {
    setResetting(true);
    setResetError('');
    setResetMessage('');
    try {
      const status = await api.adminReset(resetLetters);
      setData(status);
      setResetMessage(resetLetters ? 'Tirage et lettres réinitialisés' : 'Tirage réinitialisé');
      setResetLetters(false);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetting(false);
      setConfirmOpen(false);
    }
  }

  if (loading && !data) return <PageLoading message="Le lutin fait l'inventaire…" />;
  if (error && !data) return <PageError error={error} onRetry={reload} />;

  return (
    <div className="page">
      <PageTitle>Administration</PageTitle>

      <section className="card admin-card">
        <p className="admin-summary">
          <strong>{data.drawnCount}</strong> tirage{data.drawnCount > 1 ? 's' : ''} effectué
          {data.drawnCount > 1 ? 's' : ''} sur <strong>{data.total}</strong>
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Prénom</th>
              <th scope="col">A tiré</th>
              <th scope="col">A écrit sa lettre</th>
            </tr>
          </thead>
          <tbody>
            {data.participants.map((p) => (
              <tr key={p.name}>
                <th scope="row">{p.name}</th>
                <td>{mark(p.hasDrawn, 'Oui', 'Pas encore')}</td>
                <td>{mark(p.hasLetter, 'Oui', 'Pas encore')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn-secondary btn-block" onClick={reload} disabled={loading}>
          {loading ? 'Actualisation…' : 'Actualiser'}
        </button>
        {error && (
          <p className="error-text" role="alert">
            {error.message}
          </p>
        )}
      </section>

      <section className="danger-zone">
        <h2>Zone dangereuse</h2>
        <div className="checkbox-field">
          <input
            id={checkboxId}
            type="checkbox"
            checked={resetLetters}
            onChange={(e) => setResetLetters(e.target.checked)}
          />
          <label htmlFor={checkboxId}>Effacer aussi les lettres</label>
        </div>
        <button
          type="button"
          className="btn btn-danger btn-block"
          onClick={() => {
            setResetMessage('');
            setConfirmOpen(true);
          }}
        >
          Réinitialiser le tirage
        </button>
        <div aria-live="polite">{resetMessage && <p className="success-text">{resetMessage}</p>}</div>
        {resetError && (
          <p className="error-text" role="alert">
            {resetError}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        danger
        title="Réinitialiser le tirage ?"
        message={`Tous les tirages seront effacés et chacun devra retirer.${
          resetLetters ? ' Toutes les lettres seront aussi effacées.' : ''
        } Cette action est irréversible.`}
        confirmLabel={resetting ? 'Réinitialisation…' : 'Réinitialiser'}
        busy={resetting}
        onConfirm={doReset}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
