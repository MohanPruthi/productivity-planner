import React from 'react';
import Sidebar from './Sidebar';
import TimeLogger from './TimeLogger';
import MedReminder from './MedReminder';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
      <TimeLogger />
      <MedReminder />
    </div>
  );
};

export default Layout;
