import { Navigate } from 'react-router';
import { homePath, useAuth } from '../AuthContext.jsx';

/** Exige une session ; `role` = "participant" ou "admin" restreint davantage. */
export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/connexion" replace />;
  if (role === 'participant' && !user.isParticipant) return <Navigate to={homePath(user)} replace />;
  if (role === 'admin' && !user.isAdmin) return <Navigate to={homePath(user)} replace />;
  return children;
}
