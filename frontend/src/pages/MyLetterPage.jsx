import { useEffect, useId, useState } from 'react';
import { useBlocker } from 'react-router';
import { api } from '../api.js';
import { formatDate } from '../dates.js';
import { useApi } from '../useApi.js';
import { PageError, PageLoading, PageTitle } from '../components/PageStatus.jsx';

const MAX = 5000;
const LEAVE_MESSAGE = "Ta lettre n'est pas enregistrée. Quitter quand même ?";

export default function MyLetterPage() {
  const { data, error, loading, reload } = useApi(api.getMyLetter);
  const [saved, setSaved] = useState(null); // dernière version enregistrée
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const textId = useId();
  const helpId = useId();

  useEffect(() => {
    if (data) {
      setSaved(data);
      setContent(data.content);
    }
  }, [data]);

  const dirty = saved !== null && content !== saved.content;

  // Rechargement ou fermeture de l'onglet.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Navigation dans l'application (barre du bas).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(LEAVE_MESSAGE)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError('');
    setJustSaved(false);
    try {
      const result = await api.saveMyLetter(content);
      setSaved(result);
      setContent(result.content);
      setJustSaved(true);
    } catch (err) {
      setSaveError(err.message); // le texte saisi est conservé
    } finally {
      setSaving(false);
    }
  }

  if (loading && !saved) return <PageLoading message="Le lutin cherche ta plume…" />;
  if (error && !saved) return <PageError error={error} onRetry={reload} />;
  if (!saved) return null;

  return (
    <div className="page">
      <PageTitle>Ma lettre</PageTitle>
      <form className="letter-form letter" onSubmit={onSubmit}>
        <span className="wax-seal" aria-hidden="true">★</span>
        <label htmlFor={textId} className="letter-author">
          Cher Père Noël…
        </label>
        <p id={helpId} className="help-text">
          Écris ici ce qui te ferait plaisir. Tout le monde pourra lire ta lettre.
        </p>
        <textarea
          id={textId}
          className="letter-input"
          aria-describedby={helpId}
          rows={12}
          maxLength={MAX}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setJustSaved(false);
          }}
        />
        <p className={content.length >= MAX ? 'counter counter-full' : 'counter'} aria-live="polite">
          {content.length} / {MAX}
        </p>

        <button type="submit" className="btn btn-primary btn-block" disabled={!dirty || saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        <div className="save-status" aria-live="polite">
          {justSaved && (
            <p className="success-text">{saved.content ? 'Lettre enregistrée ✓' : 'Ta lettre a été effacée ✓'}</p>
          )}
          {saved.updatedAt && <p className="letter-date">Dernière modification le {formatDate(saved.updatedAt)}</p>}
          {dirty && !saving && <p className="letter-date">Modifications non enregistrées</p>}
        </div>
        {saveError && (
          <p className="error-text" role="alert">
            {saveError}
          </p>
        )}
      </form>
    </div>
  );
}
