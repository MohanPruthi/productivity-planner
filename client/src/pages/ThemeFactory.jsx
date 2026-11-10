import React, { useEffect, useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { THEMES, getThemeId, applyTheme } from '../theme';
import '../styles/theme-factory.css';

// A small live preview: same markup in every card, styled by that theme's CSS
const Preview = ({ id }) => (
  <div className="tf-preview" data-theme={id} aria-hidden="true">
    <div className="tf-rail">
      <span className="tf-logo" />
      <span className="tf-ic on" />
      <span className="tf-ic" />
      <span className="tf-ic" />
      <span className="tf-ic" />
    </div>
    <div className="tf-page">
      <span className="tf-h" />
      <span className="tf-s" />
      <div className="tf-tiles">
        <span className="tf-tile tall" />
        <span className="tf-tile" />
        <span className="tf-tile" />
      </div>
    </div>
    <div className="tf-zen"><span className="tf-ring" /></div>
  </div>
);

const ThemeFactory = () => {
  const [current, setCurrent] = useState(getThemeId);

  useEffect(() => {
    const onChange = (e) => setCurrent(e.detail.id);
    window.addEventListener('ui-theme-changed', onChange);
    return () => window.removeEventListener('ui-theme-changed', onChange);
  }, []);

  const pick = (id) => {
    applyTheme(id);
    setCurrent(id);
  };

  return (
    <div className="tf-page-root">
      <header className="page-header tone-settings">
        <div className="page-header-main">
          <div className="page-header-icon"><Palette size={20} /></div>
          <div>
            <h1 className="page-header-title">Themes</h1>
            <p className="page-header-subtitle">Pick how the planner looks. Everything works the same in every theme.</p>
          </div>
        </div>
      </header>

      <section className="tf-grid" aria-label="Themes">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tf-card ${current === t.id ? 'active' : ''}`}
            aria-pressed={current === t.id}
            onClick={() => pick(t.id)}
          >
            <Preview id={t.id} />
            <span className="tf-name">
              {t.name}
              {current === t.id && <span className="tf-current"><Check size={13} strokeWidth={3} /> In use</span>}
            </span>
            <span className="tf-desc">{t.description}</span>
          </button>
        ))}
      </section>

    </div>
  );
};

export default ThemeFactory;
