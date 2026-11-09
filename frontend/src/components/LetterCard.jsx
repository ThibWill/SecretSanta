import { Link } from 'react-router';
import { formatDate } from '../dates.js';

/** Lettre au Père Noël. Le contenu est du texte brut, rendu comme enfant texte. */
export default function LetterCard({ name, content, updatedAt, isMe = false }) {
  if (!content) {
    return (
      <article className="letter letter-empty">
        <h2 className="letter-author">
          {name}
          {isMe && <span className="letter-me"> (toi)</span>}
        </h2>
        <p className="letter-empty-text">Pas encore de lettre, le traîneau attend !</p>
        {isMe && (
          <Link to="/ma-lettre" className="letter-edit">
            Écrire ma lettre
          </Link>
        )}
      </article>
    );
  }
  return (
    <article className="letter">
      <span className="wax-seal" aria-hidden="true">★</span>
      <h2 className="letter-author">
        {name}
        {isMe && <span className="letter-me"> (toi)</span>}
      </h2>
      {updatedAt && <p className="letter-date">modifiée le {formatDate(updatedAt)}</p>}
      <p className="letter-text">{content}</p>
      {isMe && (
        <Link to="/ma-lettre" className="letter-edit">
          Modifier
        </Link>
      )}
    </article>
  );
}
