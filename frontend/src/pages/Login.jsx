import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiErrorMessage } from '../api/client.js';
import Alert from '../components/ui/Alert.jsx';
import { GraduationCap } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err, 'Не удалось войти. Проверьте данные.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-brand-600 flex items-center justify-center mb-4">
            <GraduationCap className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Конвейер Приема</h1>
          <p className="text-slate-500 text-sm mt-1">Диагностика образовательного партнёрства</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@school.ru" />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
