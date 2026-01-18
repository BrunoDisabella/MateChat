import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { MessageSquare, Lock, Mail, Loader2, UserPlus, LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        // Lógica de Registro
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        if (data.user && data.session === null) {
            setMessage('¡Registro exitoso! Por favor revisa tu email para confirmar tu cuenta antes de iniciar sesión.');
            setIsSignUp(false); // Volver al login
        } else {
             // Si el auto-confirm está activado en Supabase
             setMessage('¡Cuenta creada! Iniciando sesión...');
        }

      } else {
        // Lógica de Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#d1d7db] p-4 font-sans">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden relative">
        {/* Header Decorativo */}
        <div className="h-32 bg-[#00a884] w-full absolute top-0 left-0 z-0"></div>
        
        <div className="relative z-10 px-8 pt-8 pb-8">
            <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <MessageSquare className="w-10 h-10 text-[#00a884]" fill="#00a884" color="white" />
            </div>
            
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
                {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </h1>
            <p className="text-center text-gray-500 mb-8 text-sm">
                {isSignUp 
                    ? 'Regístrate para gestionar tu WhatsApp' 
                    : 'Bienvenido de nuevo a MateChat'}
            </p>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md mb-6 text-sm border border-red-200 animate-in fade-in slide-in-from-top-2">
                {error}
                </div>
            )}

            {message && (
                <div className="bg-green-50 text-green-700 p-3 rounded-md mb-6 text-sm border border-green-200 animate-in fade-in slide-in-from-top-2">
                {message}
                </div>
            )}
          
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884]/50 focus:border-[#00a884] outline-none transition-all bg-gray-50 focus:bg-white"
                  placeholder="nombre@ejemplo.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884]/50 focus:border-[#00a884] outline-none transition-all bg-gray-50 focus:bg-white"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
              {isSignUp && <p className="text-xs text-gray-400 mt-1">Mínimo 6 caracteres</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-bold py-3 px-4 rounded-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                  isSignUp ? (
                      <>Crear Cuenta <UserPlus className="w-5 h-5" /></>
                  ) : (
                      <>Entrar <LogIn className="w-5 h-5" /></>
                  )
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-600">
                  {isSignUp ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}
              </p>
              <button
                onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                    setMessage(null);
                }}
                className="mt-2 text-[#00a884] font-semibold hover:text-[#008f6f] transition-colors hover:underline"
              >
                  {isSignUp ? 'Inicia Sesión aquí' : 'Regístrate aquí'}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};