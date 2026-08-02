import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, X, Globe, User, LogOut, LayoutDashboard, ShoppingBag, Shield, Sun, Moon, MessageCircle } from 'lucide-react';

// Ordre de rotation du bouton de theme. La classe correspondante est posee sur
// <html> ; 'light' n'a pas de surcharge dediee dans App.css au-dela de html.light.
const THEMES = ['light', 'dark', 'whatsapp'];
const THEME_LABELS = { light: 'Mode clair', dark: 'Mode sombre', whatsapp: 'Mode WhatsApp' };
const THEME_ICONS = { light: Sun, dark: Moon, whatsapp: MessageCircle };

export const Navbar = () => {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Themes : persistes dans localStorage, appliques via une classe sur <html>
  // (voir App.css). CLAIR par defaut. Le bouton fait tourner les trois themes.
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('silkroute_theme');
    return THEMES.includes(saved) ? saved : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach(t => root.classList.toggle(t, t === theme));
    // `dark` pilote les composants shadcn (tailwind darkMode: ["class"]) : sans
    // cela, dialogues et menus resteraient sombres sur un theme clair.
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('silkroute_theme', theme);
  }, [theme]);

  const cycleTheme = () => setTheme(prev => THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length]);
  const nextThemeLabel = THEME_LABELS[THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]];

  // Get clean language code (fr or en)
  const currentLang = i18n.language?.substring(0, 2).toLowerCase() || 'fr';

  const toggleLanguage = () => {
    const newLang = currentLang === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
            <div className="w-10 h-10 bg-[#D4AF37] rounded-md flex items-center justify-center">
              <span className="font-['Bebas_Neue'] text-[#0A0A0A] text-xl">SR</span>
            </div>
            <span className="font-['Bebas_Neue'] text-2xl text-white tracking-tight">SilkRoute</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/groupages"
              className="text-[#A1A1AA] hover:text-white transition-colors"
              data-testid="nav-groupages"
            >
              {t('nav.groupages')}
            </Link>

            <Link
              to="/faq"
              className="text-[#A1A1AA] hover:text-white transition-colors"
              data-testid="nav-faq"
            >
              FAQ
            </Link>

            {isAuthenticated && (
              <Link 
                to="/dashboard" 
                className="text-[#A1A1AA] hover:text-white transition-colors"
                data-testid="nav-dashboard"
              >
                {t('nav.dashboard')}
              </Link>
            )}
            
            {isAdmin && (
              <Link 
                to="/admin" 
                className="text-[#D4AF37] hover:text-[#B3922E] transition-colors"
                data-testid="nav-admin"
              >
                {t('nav.admin')}
              </Link>
            )}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle — min 44px de cote pour respecter les zones tactiles mobiles.
                L'icone montre le theme ACTUEL ; l'infobulle annonce le suivant. */}
            <button
              onClick={cycleTheme}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md border border-[#2A2A2A] hover:border-[#D4AF37] transition-colors"
              title={`${THEME_LABELS[theme]} — cliquer pour : ${nextThemeLabel}`}
              aria-label={`Thème actuel : ${THEME_LABELS[theme]}. Passer au ${nextThemeLabel}.`}
              data-testid="theme-toggle"
            >
              {React.createElement(THEME_ICONS[theme], { className: 'w-4 h-4 text-[#A1A1AA]' })}
            </button>

            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center justify-center gap-2 px-3 min-h-[44px] rounded-md border border-[#2A2A2A] hover:border-[#D4AF37] transition-colors"
              aria-label={currentLang === 'fr' ? 'Switch to English' : 'Passer en français'}
              data-testid="language-toggle"
            >
              <Globe className="w-4 h-4 text-[#A1A1AA]" />
              <span className="text-sm font-medium uppercase">{currentLang}</span>
            </button>

            {/* Auth Buttons */}
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-3">
                <Link
                  to="/settings"
                  className="flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-white transition-colors"
                  data-testid="nav-settings"
                  title="Mon compte"
                >
                  <User className="w-4 h-4" />
                  {user?.name}
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-md hover:bg-[#1A1A1A] transition-colors"
                  data-testid="logout-btn"
                >
                  <LogOut className="w-5 h-5 text-[#A1A1AA]" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link 
                  to="/login"
                  className="text-[#A1A1AA] hover:text-white transition-colors"
                  data-testid="nav-login"
                >
                  {t('nav.login')}
                </Link>
                <Link 
                  to="/register"
                  className="btn-gold px-4 py-2 rounded-md"
                  data-testid="nav-register"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Menu className="w-6 h-6 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0A0A0A] border-t border-[#2A2A2A]" data-testid="mobile-menu">
          <div className="px-4 py-4 space-y-3">
            <Link 
              to="/groupages"
              className="block py-2 text-[#A1A1AA] hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ShoppingBag className="w-5 h-5 inline mr-3" />
              {t('nav.groupages')}
            </Link>
            
            {isAuthenticated && (
              <Link 
                to="/dashboard"
                className="block py-2 text-[#A1A1AA] hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="w-5 h-5 inline mr-3" />
                {t('nav.dashboard')}
              </Link>
            )}
            
            {isAdmin && (
              <Link 
                to="/admin"
                className="block py-2 text-[#D4AF37]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Shield className="w-5 h-5 inline mr-3" />
                {t('nav.admin')}
              </Link>
            )}

            <div className="border-t border-[#2A2A2A] pt-3 mt-3">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/settings"
                    className="block py-2 text-[#A1A1AA] hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="w-5 h-5 inline mr-3" />
                    {t('nav.myAccount', 'Mon compte')}
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 py-2 text-[#EF4444]"
                  >
                    <LogOut className="w-5 h-5" />
                    {t('nav.logout')}
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <Link 
                    to="/login"
                    className="block py-2 text-center border border-[#2A2A2A] rounded-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.login')}
                  </Link>
                  <Link 
                    to="/register"
                    className="block py-2 text-center btn-gold rounded-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('nav.register')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0A0A0A] border-t border-[#2A2A2A] py-8 mt-auto" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#D4AF37] rounded-md flex items-center justify-center">
              <span className="font-['Bebas_Neue'] text-[#0A0A0A] text-sm">SR</span>
            </div>
            <span className="text-[#A1A1AA] text-sm">
              © {currentYear} SilkRoute. {t('footer.rights')}.
            </span>
          </div>
          
          {/* Liens du footer : py-3 garantit une hauteur de touche >= 44px sur mobile */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 text-sm">
            <Link to="/faq" className="text-[#A1A1AA] hover:text-white transition-colors py-3 px-2 inline-flex items-center justify-center min-w-[44px]">
              FAQ
            </Link>
            <Link to="/terms" className="text-[#A1A1AA] hover:text-white transition-colors py-3 px-2 inline-flex items-center justify-center min-w-[44px]">
              {t('footer.terms')}
            </Link>
            <Link to="/privacy" className="text-[#A1A1AA] hover:text-white transition-colors py-3 px-2 inline-flex items-center justify-center min-w-[44px]">
              {t('footer.privacy')}
            </Link>
            <Link to="/contact" className="text-[#A1A1AA] hover:text-white transition-colors py-3 px-2 inline-flex items-center justify-center min-w-[44px]">
              {t('footer.contact')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export const Layout = ({ children, showFooter = true }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
};

export default Layout;
