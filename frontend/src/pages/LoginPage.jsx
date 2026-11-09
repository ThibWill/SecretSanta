import { useId, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useApi } from '../useApi.js';
import { Tree } from '../components/Decorations.jsx';
import { PageError, PageLoading } from '../components/PageStatus.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const { data, error, loading, reload } = useApi(api.userNames);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const nameId = useId();
  const passwordId = useId();

  async function onSubmit(e) {
    e.preventDefault();
    if (!name || !password || sending) return;
    setSending(true);
    setLoginError('');
    try {
      await login(name, password);
      // La redirection est faite par la route /connexion dès que l'utilisateur est connu.
    } catch (err) {
      setLoginError(err.message);
      setSending(false);
    }
  }

  return (
    <main className="login-page">
      <Tree />
      {loading ? (
        <PageLoading message="Le lutin cherche la liste des invités…" />
      ) : error ? (
        <PageError error={error} onRetry={reload} />
      ) : (
        <form className="card login-card" onSubmit={onSubmit}>
          <h1 className="login-title">Secret Santa</h1>
          <p className="login-subtitle">Noël en famille 🎅</p>

          <div className="field">
            <label htmlFor={nameId}>Qui es-tu ?</label>
            <select id={nameId} value={name} onChange={(e) => setName(e.target.value)} autoComplete="username">
              <option value="">Choisis ton prénom</option>
              {data.users.map((u) => (
                <option key={u.name} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor={passwordId}>Mot de passe</label>
            <input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={!name || !password || sending}>
            {sending ? 'Connexion…' : 'Se connecter'}
          </button>

          {loginError && (
            <p className="error-text" role="alert">
              {loginError}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
