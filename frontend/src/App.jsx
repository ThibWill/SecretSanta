import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';
import { AuthProvider, homePath, useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { Snow } from './components/Decorations.jsx';
import { PageError, PageLoading } from './components/PageStatus.jsx';
import LoginPage from './pages/LoginPage.jsx';
import HomePage from './pages/HomePage.jsx';
import MyLetterPage from './pages/MyLetterPage.jsx';
import LettersPage from './pages/LettersPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to={homePath(user)} replace /> : children;
}

const router = createBrowserRouter([
  {
    path: '/connexion',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <ProtectedRoute role="participant"><HomePage /></ProtectedRoute> },
      { path: '/ma-lettre', element: <ProtectedRoute role="participant"><MyLetterPage /></ProtectedRoute> },
      { path: '/lettres', element: <LettersPage /> },
      { path: '/admin', element: <ProtectedRoute role="admin"><AdminPage /></ProtectedRoute> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function Root() {
  const { user, bootError, checkSession } = useAuth();
  if (user === undefined) {
    return (
      <main className="boot">
        {bootError ? (
          <PageError error={bootError} onRetry={checkSession} />
        ) : (
          <PageLoading message="Le lutin prépare la fête…" />
        )}
      </main>
    );
  }
  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Snow />
      <Root />
    </AuthProvider>
  );
}
