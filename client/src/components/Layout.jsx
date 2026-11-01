import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TimeLogger from './TimeLogger';
import MedReminder from './MedReminder';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {/* Keyed on the route so each page plays its entrance animation */}
        <div key={location.pathname} className="page-enter">
          {children}
        </div>
      </main>
      <TimeLogger />
      <MedReminder />
    </div>
  );
};

export default Layout;
