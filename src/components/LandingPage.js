import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const STEPS = [
  { number: '01', titleKey: 'howItWorksStep1Title', descKey: 'howItWorksStep1Desc', icon: '📅' },
  { number: '02', titleKey: 'howItWorksStep2Title', descKey: 'howItWorksStep2Desc', icon: '✋' },
  { number: '03', titleKey: 'howItWorksStep3Title', descKey: 'howItWorksStep3Desc', icon: '🤝' },
  { number: '04', titleKey: 'howItWorksStep4Title', descKey: 'howItWorksStep4Desc', icon: '🎉' },
];

const PROBLEMS = [
  { titleKey: 'whyProblem1Title', descKey: 'whyProblem1Desc', icon: '😩' },
  { titleKey: 'whyProblem2Title', descKey: 'whyProblem2Desc', icon: '🤷' },
  { titleKey: 'whyProblem3Title', descKey: 'whyProblem3Desc', icon: '😬' },
];

const FEATURES = [
  { titleKey: 'feature1Title', descKey: 'feature1Desc', icon: '📅' },
  { titleKey: 'feature2Title', descKey: 'feature2Desc', icon: '🧠' },
  { titleKey: 'feature3Title', descKey: 'feature3Desc', icon: '✅' },
  { titleKey: 'feature4Title', descKey: 'feature4Desc', icon: '🔍' },
  { titleKey: 'feature5Title', descKey: 'feature5Desc', icon: '💡' },
  { titleKey: 'feature6Title', descKey: 'feature6Desc', icon: '🔒' },
];

const USE_CASES = [
  { labelKey: 'useCase1', icon: '🍽️' },
  { labelKey: 'useCase2', icon: '🎬' },
  { labelKey: 'useCase3', icon: '☕' },
  { labelKey: 'useCase4', icon: '🏓' },
  { labelKey: 'useCase5', icon: '🥂' },
  { labelKey: 'useCase6', icon: '📚' },
];

const VALUE_POINTS = [
  'valuePropPoint1',
  'valuePropPoint2',
  'valuePropPoint3',
  'valuePropPoint4',
];

const VALUE_STATS = [
  { icon: '🤝', key: 'valueStat1' },
  { icon: '🎯', key: 'valueStat2' },
  { icon: '🌟', key: 'valueStat3' },
];

const FREE_FEATURES = [
  'pricingFreeFeature1',
  'pricingFreeFeature2',
  'pricingFreeFeature3',
  'pricingFreeFeature4',
];

const PRO_FEATURES = [
  'pricingProFeature1',
  'pricingProFeature2',
  'pricingProFeature3',
  'pricingProFeature4',
  'pricingProFeature5',
];

function LandingPage() {
  const { signInWithGoogle } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRTL = i18n.language === 'ar';

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
    } catch (err) {
      console.error('Error signing in:', err);
      setError(t('errorAuth'));
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  return (
    <div className={`lp${isRTL ? ' lp--rtl' : ''}`}>

      {/* ── Sticky Header ── */}
      <header className="lp-header">
        <div className="lp-header__inner">
          <a href="#lp-hero" className="lp-logo">
            🌟 <span>{t('appName')}</span>
          </a>

          <nav className="lp-nav" aria-label="main navigation">
            <a href="#lp-about" className="lp-nav__link">{t('navAbout')}</a>
            <a href="#lp-features" className="lp-nav__link">{t('navFeatures')}</a>
            <a href="#lp-pricing" className="lp-nav__link">{t('navPricing')}</a>
          </nav>

          <div className="lp-header__actions">
            <button
              className="lp-btn lp-btn--ghost lp-lang-btn"
              onClick={toggleLanguage}
              aria-label="Toggle language"
            >
              {i18n.language === 'en' ? 'عربي' : 'EN'}
            </button>
            <button
              className="lp-btn lp-btn--outline"
              onClick={handleSignIn}
              disabled={loading}
            >
              {loading ? t('loading') : t('navLogin')}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="lp-hero" className="lp-hero">
        <div className="lp-hero__content">

          <div className="lp-hero__text">
            <h1 className="lp-hero__headline">{t('heroHeadline')}</h1>
            <p className="lp-hero__subtitle">{t('heroSubtitle')}</p>

            {error && (
              <div className="lp-error" role="alert">{error}</div>
            )}

            <div className="lp-hero__cta-row">
              <button
                className="lp-btn lp-btn--primary lp-btn--lg"
                onClick={handleSignIn}
                disabled={loading}
              >
                {loading ? t('loading') : t('heroCTA')}
              </button>
              <button
                className="lp-btn lp-btn--ghost"
                onClick={handleSignIn}
                disabled={loading}
              >
                {t('heroLoginCTA')}
              </button>
            </div>
          </div>

          <div className="lp-hero__visual" aria-hidden="true">
            <div className="lp-mockup">
              <div className="lp-mockup__bar">
                <span className="lp-mockup__dot lp-mockup__dot--red" />
                <span className="lp-mockup__dot lp-mockup__dot--yellow" />
                <span className="lp-mockup__dot lp-mockup__dot--green" />
                <span className="lp-mockup__title">🌟 Gatherly</span>
              </div>
              <div className="lp-mockup__body">
                <div className="lp-mockup__card">
                  <span className="lp-mockup__card-icon">🍽️</span>
                  <div className="lp-mockup__card-info">
                    <div className="lp-mockup__card-title">Italian Dinner Night</div>
                    <div className="lp-mockup__card-meta">Fri, Dec 20 · 8 PM · 12 spots</div>
                  </div>
                  <span className="lp-mockup__badge">RSVP</span>
                </div>
                <div className="lp-mockup__card">
                  <span className="lp-mockup__card-icon">🎬</span>
                  <div className="lp-mockup__card-info">
                    <div className="lp-mockup__card-title">Movie Night at Rooftop</div>
                    <div className="lp-mockup__card-meta">Sat, Dec 21 · 7:30 PM · 8 spots</div>
                  </div>
                  <span className="lp-mockup__badge">RSVP</span>
                </div>
                <div className="lp-mockup__card">
                  <span className="lp-mockup__card-icon">☕</span>
                  <div className="lp-mockup__card-info">
                    <div className="lp-mockup__card-title">Sunday Coffee Meetup</div>
                    <div className="lp-mockup__card-meta">Sun, Dec 22 · 10 AM · 6 spots</div>
                  </div>
                  <span className="lp-mockup__badge lp-mockup__badge--booked">Booked ✓</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="lp-about" className="lp-section lp-how">
        <div className="lp-container">
          <h2 className="lp-section__title">{t('howItWorksTitle')}</h2>
          <div className="lp-steps">
            {STEPS.map((step) => (
              <div key={step.number} className="lp-step">
                <div className="lp-step__number">{step.number}</div>
                <div className="lp-step__icon">{step.icon}</div>
                <h3 className="lp-step__title">{t(step.titleKey)}</h3>
                <p className="lp-step__desc">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
          <div className="lp-ai-note">
            <span className="lp-ai-note__icon">🧠</span>
            <p>{t('howItWorksAINote')}</p>
          </div>
        </div>
      </section>

      {/* ── Why Gatherly ── */}
      <section className="lp-section lp-why">
        <div className="lp-container">
          <h2 className="lp-section__title">{t('whyGatherlyTitle')}</h2>
          <div className="lp-why__grid">
            <div className="lp-why__problems">
              {PROBLEMS.map((p) => (
                <div key={p.titleKey} className="lp-problem-card">
                  <span className="lp-problem-card__icon">{p.icon}</span>
                  <div>
                    <h3 className="lp-problem-card__title">{t(p.titleKey)}</h3>
                    <p className="lp-problem-card__desc">{t(p.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="lp-why__solution">
              <div className="lp-why__solution-badge">✅</div>
              <p className="lp-why__solution-text">{t('whySolution')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section id="lp-features" className="lp-section lp-features">
        <div className="lp-container">
          <h2 className="lp-section__title">{t('featuresTitle')}</h2>
          <div className="lp-features__grid">
            {FEATURES.map((f) => (
              <div key={f.titleKey} className="lp-feature-card">
                <div className="lp-feature-card__icon">{f.icon}</div>
                <h3 className="lp-feature-card__title">{t(f.titleKey)}</h3>
                <p className="lp-feature-card__desc">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section className="lp-section lp-usecases">
        <div className="lp-container">
          <h2 className="lp-section__title">{t('useCasesTitle')}</h2>
          <div className="lp-usecases__grid">
            {USE_CASES.map((uc) => (
              <div key={uc.labelKey} className="lp-usecase-pill">
                <span>{uc.icon}</span>
                <span>{t(uc.labelKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value Proposition ── */}
      <section className="lp-section lp-value">
        <div className="lp-container lp-value__inner">
          <div className="lp-value__text">
            <h2 className="lp-section__title lp-section__title--left">{t('valuePropTitle')}</h2>
            <p className="lp-value__desc">{t('valuePropDesc')}</p>
            <ul className="lp-value__points">
              {VALUE_POINTS.map((key) => (
                <li key={key}>
                  <span className="lp-value__check" aria-hidden="true">✓</span>
                  {t(key)}
                </li>
              ))}
            </ul>
            <button
              className="lp-btn lp-btn--primary lp-btn--lg"
              onClick={handleSignIn}
              disabled={loading}
            >
              {loading ? t('loading') : t('heroCTA')}
            </button>
          </div>
          <div className="lp-value__stats" aria-hidden="true">
            {VALUE_STATS.map((s) => (
              <div key={s.key} className="lp-stat-card">
                <span className="lp-stat-card__icon">{s.icon}</span>
                <span className="lp-stat-card__label">{t(s.key)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="lp-pricing" className="lp-section lp-pricing">
        <div className="lp-container">
          <h2 className="lp-section__title">{t('pricingTitle')}</h2>
          <div className="lp-pricing__grid">

            {/* Free plan */}
            <div className="lp-pricing-card">
              <div className="lp-pricing-card__header">
                <h3 className="lp-pricing-card__plan">{t('pricingFreeTitle')}</h3>
                <div className="lp-pricing-card__price">
                  <span className="lp-pricing-card__amount">{t('pricingFreePrice')}</span>
                  <span className="lp-pricing-card__period">/{t('pricingFreePeriod')}</span>
                </div>
                <p className="lp-pricing-card__desc">{t('pricingFreeDesc')}</p>
              </div>
              <ul className="lp-pricing-card__features">
                {FREE_FEATURES.map((key) => (
                  <li key={key}>
                    <span className="lp-pricing-card__check" aria-hidden="true">✓</span>
                    {t(key)}
                  </li>
                ))}
              </ul>
              <button
                className="lp-btn lp-btn--outline lp-btn--full"
                onClick={handleSignIn}
                disabled={loading}
              >
                {loading ? t('loading') : t('pricingFreeCTA')}
              </button>
            </div>

            {/* Pro plan */}
            <div className="lp-pricing-card lp-pricing-card--pro">
              <div className="lp-pricing-card__badge">{t('pricingProBadge')}</div>
              <div className="lp-pricing-card__header">
                <h3 className="lp-pricing-card__plan">{t('pricingProTitle')}</h3>
                <div className="lp-pricing-card__price">
                  <span className="lp-pricing-card__amount">{t('pricingProPrice')}</span>
                  <span className="lp-pricing-card__period">/{t('pricingProPeriod')}</span>
                </div>
                <p className="lp-pricing-card__desc">{t('pricingProDesc')}</p>
              </div>
              <ul className="lp-pricing-card__features">
                {PRO_FEATURES.map((key) => (
                  <li key={key}>
                    <span className="lp-pricing-card__check" aria-hidden="true">✓</span>
                    {t(key)}
                  </li>
                ))}
              </ul>
              <button
                className="lp-btn lp-btn--primary lp-btn--full"
                onClick={handleSignIn}
                disabled={loading}
              >
                {loading ? t('loading') : t('pricingProCTA')}
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer__inner">

          <div className="lp-footer__brand">
            <div className="lp-footer__logo">🌟 {t('appName')}</div>
            <p className="lp-footer__tagline">{t('footerTagline')}</p>
          </div>

          <div className="lp-footer__col">
            <h4 className="lp-footer__heading">{t('footerLinks')}</h4>
            <a href="#lp-about" className="lp-footer__link">{t('navAbout')}</a>
            <a href="#lp-features" className="lp-footer__link">{t('navFeatures')}</a>
            <a href="#lp-pricing" className="lp-footer__link">{t('navPricing')}</a>
          </div>

          <div className="lp-footer__col">
            <h4 className="lp-footer__heading">{t('footerContact')}</h4>
            <a
              href="https://wa.me/201508111337"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-footer__link lp-footer__whatsapp"
            >
              📱 {t('footerWhatsApp')}: +201508111337
            </a>
          </div>

        </div>
        <div className="lp-footer__bottom">
          <p>{t('footerCopyright')}</p>
        </div>
      </footer>

    </div>
  );
}

export default LandingPage;
