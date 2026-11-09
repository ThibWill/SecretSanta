import { useRef, useState } from 'react';
import { api } from '../api.js';
import { formatDate } from '../dates.js';
import { useApi } from '../useApi.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Bow, Confetti } from '../components/Decorations.jsx';
import { PageError, PageLoading, PageTitle } from '../components/PageStatus.jsx';

/** Étiquette cadeau d'une personne tirée, avec sa lettre. */
function GiftTag({ receiver, delay }) {
  const { name, letter } = receiver;
  return (
    <article className="gift-tag" style={{ '--delay': `${delay}s` }}>
      <span className="tag-hole" aria-hidden="true" />
      <p className="tag-to">Pour</p>
      <h2 className="tag-name">{name}</h2>
      {letter ? (
        <div className="tag-letter">
          <p className="letter-date">Sa lettre, modifiée le {formatDate(letter.updatedAt)} :</p>
          <p className="letter-text">{letter.content}</p>
        </div>
      ) : (
        <p className="tag-no-letter">
          <em>{name}</em> n'a pas encore écrit sa lettre.
        </p>
      )}
    </article>
  );
}

export default function HomePage() {
  const { data, setData, error, loading, reload } = useApi(api.getDraw);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawError, setDrawError] = useState(null);
  const [justDrawn, setJustDrawn] = useState(false);
  const inFlight = useRef(false); // garde anti double-clic, synchrone

  async function doDraw() {
    if (inFlight.current) return;
    inFlight.current = true;
    setDrawing(true);
    setDrawError(null);
    try {
      const result = await api.draw();
      setConfirmOpen(false);
      setData(result);
      setJustDrawn(true);
    } catch (err) {
      setConfirmOpen(false);
      if (err.code === 'ALREADY_DRAWN') await reload();
      else setDrawError(err);
    } finally {
      inFlight.current = false;
      setDrawing(false);
    }
  }

  if (loading && !data) return <PageLoading message="Le lutin vérifie ta hotte…" />;
  if (error && !data) return <PageError error={error} onRetry={reload} />;

  if (!data.hasDrawn) {
    return (
      <div className="page">
        <PageTitle>Mon tirage</PageTitle>
        <section className="card draw-intro">
          <p>
            Tu vas tirer au sort <strong>2 personnes</strong> à qui offrir un cadeau. Le tirage est définitif.
          </p>
          <p className="warning">Assure-toi que personne ne regarde ton écran 👀</p>
        </section>

        <button type="button" className="gift-button" onClick={() => setConfirmOpen(true)} disabled={drawing}>
          <Bow />
          <span className="gift-box">
            <span className="gift-label">🎁 Tirer au sort</span>
          </span>
        </button>

        {drawError && (
          <div className="card status-card" role="alert">
            <p className="error-text">{drawError.message}</p>
          </div>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title="Prêt·e ?"
          message="Le tirage ne pourra pas être refait."
          cancelLabel="Annuler"
          confirmLabel={drawing ? 'Tirage…' : "C'est parti"}
          busy={drawing}
          onConfirm={doDraw}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageTitle>Tu offres un cadeau à :</PageTitle>
      <div className={justDrawn ? 'tags reveal' : 'tags'}>
        {justDrawn && (
          <div className="gift-opening" aria-hidden="true">
            <div className="opening-lid">
              <Bow className="bow bow-small" />
            </div>
            <div className="opening-body" />
            <Confetti />
          </div>
        )}
        {data.receivers.map((r, i) => (
          <GiftTag key={r.id} receiver={r} delay={0.9 + i * 1} />
        ))}
      </div>
    </div>
  );
}
