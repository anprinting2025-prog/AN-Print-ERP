import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Printer,
  Shield,
  KeyRound,
  Mail,
  Phone,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  ShoppingBag,
  Users,
  UserCheck,
} from 'lucide-react';
import { ThemeToggle } from '../components/common/ThemeToggle.tsx';

export const LoginPage: React.FC = () => {
  const { loginWithCredentials, submitSignupRequest, signInWithGoogle } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isPendingApproval, setIsPendingApproval] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Signup form
  const [signupFullName, setSignupFullName] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [signupRole, setSignupRole] = useState<'commerciale' | 'admin' | 'owner'>('commerciale');
  const [signupNotes, setSignupNotes] = useState<string>('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsPendingApproval(false);
    setLoading(true);

    try {
      const res = await loginWithCredentials(loginEmail, loginPassword);
      if (!res.success) {
        if (res.isPending) {
          setIsPendingApproval(true);
        }
        setErrorMessage(res.error || 'Connexion échouée. Veuillez vérifier vos identifiants.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la tentative de connexion.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const res = await submitSignupRequest({
        fullName: signupFullName,
        email: signupEmail,
        phone: signupPhone,
        password: signupPassword,
        role: signupRole,
        notes: signupNotes,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Échec de la soumission de la demande.');
      } else {
        setSuccessMessage(
          res.message ||
            'Votre demande d’accès commerciale a été enregistrée avec succès. Elle sera validée par le propriétaire (Abdallah).'
        );
        // Clear fields
        setSignupFullName('');
        setSignupEmail('');
        setSignupPhone('');
        setSignupPassword('');
        setSignupNotes('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la soumission de la demande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle compact />
      </div>

      {/* Background ambient decorative glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md sm:max-w-xl">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3 border border-indigo-400/30">
            <Printer className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            An Printing ERP
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Atelier d'Impression & Façonnage de Sacs — Alger, Algérie
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-[11px] font-medium text-slate-400">
            <span>Sacs Plastiques</span>
            <span>•</span>
            <span>Sacs Kraft Carton</span>
            <span>•</span>
            <span>Sacs TNT</span>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          {/* Tab Selection */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'login'
                  ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>Connexion (Sign In)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition ${
                activeTab === 'signup'
                  ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Demande d'Adhésion</span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {/* Error banner */}
            {errorMessage && (
              <div
                className={`mb-5 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  isPendingApproval
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Success banner */}
            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <div className="font-medium leading-relaxed">{successMessage}</div>
              </div>
            )}

            {/* TAB 1: LOGIN */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Adresse Email (Identifiant)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="abdallahcrypto036@gmail.com ou commercial"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-10 py-2.5 text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold text-xs sm:text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span>Se Connecter à l'Atelier</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400 font-bold">Ou</span>
                  </div>
                </div>

                {/* Google Sign-In button */}
                <button
                  type="button"
                  onClick={async () => {
                    setErrorMessage('');
                    try {
                      await signInWithGoogle();
                    } catch (err: any) {
                      setErrorMessage(err.message || 'Google Sign-In non disponible');
                    }
                  }}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continuer avec Google</span>
                </button>
              </form>
            )}

            {/* TAB 2: SIGNUP / ACCESS REQUEST */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                {/* Role selection for signup request */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rôle Souhaité / Profil Demandé
                  </label>
                  <select
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="commerciale">💼 Commercial (Ventes, Commandes &amp; Clients)</option>
                    <option value="admin">🛡️ Administrateur d'Atelier (Responsable Équipe &amp; Logistique)</option>
                    <option value="owner">👑 Copropriétaire / Associé (Master Access)</option>
                  </select>
                </div>

                <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-900">
                  <div className="font-bold flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-indigo-600" />
                    <span>
                      {signupRole === 'commerciale'
                        ? 'Accès Commercial Standard (ou avec Stock/Achats)'
                        : signupRole === 'admin'
                        ? 'Accès Administrateur d’Atelier'
                        : 'Accès Copropriétaire Associé'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-indigo-700 leading-tight">
                    {signupRole === 'commerciale'
                      ? "Le compte aura accès aux Commandes, Clients et Suivi Client (possibilité d'ajouter Stock & Achats)."
                      : signupRole === 'admin'
                      ? "Gestion complète d'atelier : Équipes, Commandes, Stock, Achats et Logistique."
                      : "Accès Master complet incluant la gestion financière, bilans et base de données."}
                  </p>
                </div>

                {/* Full name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom & Prénom
                  </label>
                  <input
                    type="text"
                    required
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                    placeholder="ex: Mohamed Commercial"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Adresse Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="commercial@anprinting.dz"
                      className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Numéro de Téléphone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      placeholder="0550 00 00 00"
                      className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mot de passe souhaité
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-300 pl-8 pr-9 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wilaya / Zone / Note (Optionnel)
                  </label>
                  <textarea
                    rows={2}
                    value={signupNotes}
                    onChange={(e) => setSignupNotes(e.target.value)}
                    placeholder="Boutiques couvertes, Wilaya (Alger, Blida, Oran...)"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span>Envoyer la Demande d'Accès Commerciale</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} An Printing ERP — Alger, Algérie</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Impression Sérigraphie & Flexographie pour Boutiques & Magasins
          </p>
        </div>
      </div>
    </div>
  );
};
