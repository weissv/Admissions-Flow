import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NewFamily from './pages/NewFamily.jsx';
import FamilyWorkspace from './pages/FamilyWorkspace.jsx';
import FamilyPassport from './pages/FamilyPassport.jsx';
import PublicQuestionnaire from './pages/PublicQuestionnaire.jsx';
import PublicReflection from './pages/PublicReflection.jsx';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/public/questionnaire/:token" element={<PublicQuestionnaire />} />
      <Route path="/public/reflection/:token" element={<PublicReflection />} />

      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/families/new" element={<ProtectedRoute><NewFamily /></ProtectedRoute>} />
      <Route path="/families/:id/passport" element={<ProtectedRoute><FamilyPassport /></ProtectedRoute>} />
      <Route path="/families/:id/stage/:stage" element={<ProtectedRoute><FamilyWorkspace /></ProtectedRoute>} />
      <Route path="/families/:id" element={<ProtectedRoute><FamilyWorkspace /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
