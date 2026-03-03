import React, { useState, useEffect } from 'react';
import { CaregiverDashboard } from './components/CaregiverDashboard';
import { PatientDashboard } from './components/PatientDashboard';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, orderBy, limit, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, LogOut, Moon, Sun, X, Activity, UserPlus, LogIn, ChevronRight, Download, Menu, FileText } from 'lucide-react';

export default function App() {
  const [role, setRole] = useState<'caregiver' | 'patient' | null>(() => localStorage.getItem('role') as any);
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('userId'));

  // Theme State
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [showPwaInstall, setShowPwaInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Extra Caregiver Signup Fields
  const [cgName, setCgName] = useState('');
  const [cgOccupation, setCgOccupation] = useState('');
  const [cgPhone, setCgPhone] = useState('');

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginMode, setLoginMode] = useState<'caregiver' | 'patient'>('caregiver');

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  // PWA & Theme Effects
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPwaInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPwaInstall(false);
      }
      setDeferredPrompt(null);
    }
  };

  const toggleTheme = () => {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    const requestNotifications = async () => {
      if ('Notification' in window && 'serviceWorker' in navigator) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted' && userId) {
          try {
            // Ensure the service worker is registered first
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              // @ts-ignore
              applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || "BOBUwVHYYd2ZwSiGvUbR_Gslwke_asatIA2YiDK0KnKwvlWpI2cpRxMqZsNCRwFWbDIIp9k-wQRqs4CIdcfRuPs"
            });
            const collName = role === 'caregiver' ? 'caregivers' : 'patients';
            await setDoc(doc(db, collName, userId), {
              pushSubscription: JSON.stringify(subscription)
            }, { merge: true });
          } catch (e) {
            console.error("Push subscription failed", e);
          }
        }
      }
    };
    if (userId) {
      requestNotifications();
    }
  }, [userId, role]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [userId]);

  const markNotificationsAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (loginMode === 'caregiver') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char (any non-alphanumeric)
        const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;

        if (isLogin) {
          const userCred = await signInWithEmailAndPassword(auth, email, password);
          setUserId(userCred.user.uid);
          setRole('caregiver');
          localStorage.setItem('userId', userCred.user.uid);
          localStorage.setItem('role', 'caregiver');
        } else {
          if (!emailRegex.test(email)) { setError("Invalid email format."); setLoading(false); return; }
          if (!passRegex.test(password)) { setError("Password must be 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char."); setLoading(false); return; }
          if (!phoneRegex.test(cgPhone)) { setError("Invalid phone format. Please use E.164 format (e.g., +1234567890)."); setLoading(false); return; }

          const userCred = await createUserWithEmailAndPassword(auth, email, password);
          await setDoc(doc(db, "caregivers", userCred.user.uid), {
            name: cgName,
            occupation: cgOccupation,
            phone: cgPhone,
            email: email,
            createdAt: new Date().toISOString()
          });

          setUserId(userCred.user.uid);
          setRole('caregiver');
          localStorage.setItem('userId', userCred.user.uid);
          localStorage.setItem('role', 'caregiver');
        }
      } else {
        const q = query(collection(db, 'patients'), where('username', '==', email), where('password', '==', password));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const patientDoc = querySnapshot.docs[0];
          setUserId(patientDoc.id);
          setRole('patient');
          localStorage.setItem('userId', patientDoc.id);
          localStorage.setItem('role', 'patient');
        } else {
          setError('Invalid patient credentials');
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    if (role === 'caregiver') {
      signOut(auth);
    }
    setRole(null);
    setUserId(null);
    setEmail('');
    setPassword('');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
  };

  if (!role || !userId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-dark-bg transition-colors duration-500 p-4 relative overflow-hidden">
        {/* Decorative background blurs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="absolute top-6 right-6 flex space-x-3"
        >
          {showPwaInstall && (
            <button onClick={handleInstallClick} className="flex items-center space-x-2 text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-full shadow-lg transition-transform hover:scale-105">
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
          )}
          <button onClick={toggleTheme} className="p-2 rounded-full glass glass-dark text-gray-700 dark:text-gray-300 hover:scale-110 transition-transform">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, type: 'spring' }}
          className="z-10 w-full max-w-md"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-2xl shadow-xl flex items-center justify-center transform rotate-3 hover:rotate-6 transition-transform">
              <Activity className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="glass glass-dark rounded-3xl p-8 shadow-2xl overflow-hidden relative">
            <div className="flex bg-gray-100/50 dark:bg-dark-surface/50 rounded-xl p-1 mb-8 backdrop-blur-sm">
              <button
                onClick={() => { setLoginMode('caregiver'); setIsLogin(true); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${loginMode === 'caregiver' ? 'bg-white dark:bg-dark-border text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Caregiver
              </button>
              <button
                onClick={() => { setLoginMode('patient'); setIsLogin(true); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${loginMode === 'patient' ? 'bg-white dark:bg-dark-border text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Patient
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={loginMode + (isLogin ? 'login' : 'signup')}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {loginMode === 'caregiver' ? 'Manage your patients seamlessly.' : 'Access your health dashboard.'}
                  </p>
                </div>

                {error && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-red-50/80 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg mb-6 text-sm text-red-700 dark:text-red-400 backdrop-blur-sm font-medium">
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                  {loginMode === 'caregiver' && !isLogin && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <input type="text" placeholder="Full Name" value={cgName} onChange={e => setCgName(e.target.value)} className="w-full bg-white/50 dark:bg-dark-surface/50 border border-gray-200 dark:border-dark-border p-3.5 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                      <input type="text" placeholder="Occupation / Role" value={cgOccupation} onChange={e => setCgOccupation(e.target.value)} className="w-full bg-white/50 dark:bg-dark-surface/50 border border-gray-200 dark:border-dark-border p-3.5 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                      <input type="tel" placeholder="Phone (e.g., +1234567890)" value={cgPhone} onChange={e => setCgPhone(e.target.value)} className="w-full bg-white/50 dark:bg-dark-surface/50 border border-gray-200 dark:border-dark-border p-3.5 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                    </motion.div>
                  )}

                  <input
                    type={loginMode === 'caregiver' ? "email" : "text"}
                    placeholder={loginMode === 'caregiver' ? "Email Address" : "Patient Username"}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white/50 dark:bg-dark-surface/50 border border-gray-200 dark:border-dark-border p-3.5 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white/50 dark:bg-dark-surface/50 border border-gray-200 dark:border-dark-border p-3.5 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    required
                  />

                  <button
                    type="submit"
                    className={`w-full text-white py-3.5 mt-2 rounded-xl font-bold flex justify-center items-center space-x-2 transition-all transform active:scale-[0.98] ${loginMode === 'caregiver' ? 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 shadow-lg shadow-brand-500/30' : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-lg shadow-green-500/30'}`}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="animate-pulse">Authenticating...</span>
                    ) : (
                      <>
                        <span>{isLogin ? 'Sign In Securely' : 'Create Account'}</span>
                        {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      </>
                    )}
                  </button>
                </form>

                {loginMode === 'caregiver' && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => { setIsLogin(!isLogin); setError(''); }}
                      className="text-brand-600 dark:text-brand-400 font-medium text-sm hover:underline"
                    >
                      {isLogin ? 'Need an account? Sign up here.' : 'Already registered? Sign in.'}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-500 font-sans text-gray-900 dark:text-gray-100">
      {/* App Shell Header */}
      <header className="fixed top-0 w-full glass dark:glass-dark z-40 px-4 py-3 sm:px-6 flex justify-between items-center border-b border-gray-200/50 dark:border-dark-border/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-xl shadow-md flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-900 to-gray-800 dark:from-white dark:to-gray-300">
            {role === 'caregiver' ? 'TransplantCare Pro' : 'My Health Portal'}
          </h1>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-4">
          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-surface text-gray-700 dark:text-gray-400 transition-colors">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button onClick={() => { setShowNotifications(true); markNotificationsAsRead(); }} className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-surface text-gray-700 dark:text-gray-400 transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-dark-bg"
              />
            )}
          </button>

          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

          <button onClick={handleLogout} className="flex items-center space-x-2 text-sm font-medium text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors">
            <span>Logout</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center space-x-3">
          <button onClick={() => { setShowNotifications(true); markNotificationsAsRead(); }} className="relative p-2 rounded-full text-gray-500 dark:text-gray-400">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <motion.span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-dark-bg" />
            )}
          </button>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-surface transition-colors">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed top-16 left-0 w-full glass glass-dark z-30 border-b border-gray-200 dark:border-dark-border shadow-lg"
          >
            <div className="p-4 flex flex-col space-y-4">
              <button onClick={toggleTheme} className="flex items-center space-x-3 w-full p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-surface text-gray-700 dark:text-gray-200 font-medium transition-colors">
                {isDark ? <Sun className="w-5 h-5 text-gray-500" /> : <Moon className="w-5 h-5 text-gray-500" />}
                <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
              </button>

              <div className="h-px bg-gray-100 dark:bg-dark-border w-full"></div>

              <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="flex items-center space-x-3 w-full p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-medium transition-colors">
                <LogOut className="w-5 h-5" />
                <span>Logout Securely</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Drawer Overlay */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowNotifications(false)}
          >
            <motion.div
              initial={{ x: '100%', boxShadow: '0 0 0 rgba(0,0,0,0)' }}
              animate={{ x: 0, boxShadow: '-25px 0 50px -12px rgba(0, 0, 0, 0.25)' }}
              exit={{ x: '100%', boxShadow: '0 0 0 rgba(0,0,0,0)' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center glass glass-dark absolute top-0 w-full z-10">
                <h2 className="font-bold text-lg flex items-center space-x-2">
                  <Bell className="w-5 h-5 text-brand-500" />
                  <span>Activity Log</span>
                </h2>
                <button onClick={() => setShowNotifications(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto h-full pt-20 p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <Bell className="w-8 h-8 opacity-20 mb-3" />
                    <p className="text-sm font-medium">All caught up!</p>
                  </div>
                ) : (
                  notifications.map((n, i) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={n.id}
                      className={`p-4 rounded-2xl relative transition-all ${!n.read ? 'bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/30' : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800'}`}
                    >
                      {!n.read && <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-brand-500 animate-pulse"></span>}
                      <div className="flex items-start space-x-4">
                        {n.senderPic ? (
                          <img src={n.senderPic} alt="avatar" className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-dark-surface shadow-sm" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 text-gray-600 dark:text-gray-300 font-bold flex items-center justify-center shadow-sm">
                            {n.senderName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 pr-4">
                          <p className={`font-semibold text-sm truncate ${!n.read ? 'text-brand-900 dark:text-gray-100' : 'text-gray-900 dark:text-gray-200'}`}>
                            {n.senderName}
                          </p>
                          <p className={`text-sm mt-0.5 leading-snug break-words ${!n.read ? 'text-brand-700 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                            {n.message}
                          </p>
                          {n.proofUrl && (
                            <div className="mt-3">
                              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center"><FileText className="w-3 h-3 mr-1" /> Attached Proof:</p>
                              <a href={n.proofUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-gray-200 dark:border-dark-border hover:opacity-90 transition-opacity focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white dark:bg-dark-surface p-1">
                                <img src={n.proofUrl} alt="Medication Proof" className="w-full h-24 object-cover rounded-lg object-top" />
                              </a>
                            </div>
                          )}
                          <p className="text-xs text-brand-500/80 dark:text-brand-400/60 mt-2 font-medium flex items-center">
                            {new Date(n.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="pt-20 pb-8 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {role === 'caregiver' ? <CaregiverDashboard caregiverId={userId} /> : <PatientDashboard patientId={userId} />}
        </motion.div>
      </main>
    </div>
  );
}
