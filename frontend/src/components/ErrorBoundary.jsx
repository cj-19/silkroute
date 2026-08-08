import React from 'react';

/**
 * Sans ca, une erreur JS dans n'importe quel composant demonte TOUTE
 * l'application React, laissant un ecran vide (donc noir, la couleur de
 * fond par defaut de la page) sans aucun message. On capture l'erreur pour
 * l'afficher au lieu de disparaitre en silence, et pour la journaliser
 * cote console avec assez de detail pour la diagnostiquer a distance.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary a intercepte une erreur :', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '2rem',
          background: '#0A0A0A', color: '#FFFFFF', textAlign: 'center', gap: '1rem',
        }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>Une erreur est survenue.</p>
          <p style={{ color: '#A1A1AA', maxWidth: 420 }}>
            Rechargez la page. Si le problème persiste, contactez le support en précisant
            ce que vous faisiez juste avant.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#D4AF37', color: '#0A0A0A', border: 'none',
              borderRadius: '0.375rem', padding: '0.5rem 1.5rem',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
