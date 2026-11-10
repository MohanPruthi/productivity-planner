import React from 'react';

// Shared page title row: module icon, title, one-line subtitle, actions on the right.
// `tone` picks the module color, which is used only on the icon tile.
const PageHeader = ({ icon: Icon, tone = 'default', title, subtitle, actions }) => (
  <header className={`page-header tone-${tone}`}>
    <div className="page-header-main">
      {Icon && (
        <div className="page-header-icon">
          <Icon size={20} />
        </div>
      )}
      <div>
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </header>
);

export default PageHeader;
