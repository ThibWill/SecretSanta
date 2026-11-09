import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useApi } from '../useApi.js';
import LetterCard from '../components/LetterCard.jsx';
import { PageError, PageLoading, PageTitle } from '../components/PageStatus.jsx';

// Confidentialité : aucune mise en avant des personnes tirées par l'utilisateur.
export default function LettersPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(api.getLetters);

  if (loading && !data) return <PageLoading message="Le lutin cherche tes lettres…" />;
  if (error && !data) return <PageError error={error} onRetry={reload} />;

  return (
    <div className="page">
      <PageTitle>Les lettres</PageTitle>
      <div className="letters">
        {data.letters.map((l) => (
          <LetterCard
            key={l.userId}
            name={l.name}
            content={l.content}
            updatedAt={l.updatedAt}
            isMe={l.userId === user.id}
          />
        ))}
      </div>
    </div>
  );
}
