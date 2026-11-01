import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Plan from './pages/Plan';
import DsaLog from './pages/DsaLog';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TaskHistory from './pages/TaskHistory';
import Meds from './pages/Meds';
import HrDirectory from './pages/HrDirectory';
import Notes from './pages/Notes';
import NoteDetail from './pages/NoteDetail';
import Settings from './pages/Settings';
import Loader from './components/Loader';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader text="Authenticating..." fullScreen={true} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Workspace Visibility Protected Route Wrapper
const WorkspaceProtectedRoute = ({ systemId, children }) => {
  const { privacyMode, workspaceVisibility } = useAuth();
  if (privacyMode) {
    const config = workspaceVisibility?.[systemId];
    // If explicitly configured to be hidden in office mode, redirect to home
    if (config && config.showInOffice === false) {
      return <Navigate to="/" replace />;
    }
  }
  return children;
};

// Public Route Wrapper (redirects to home if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader text="Authenticating..." fullScreen={true} />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* Public Auth Routes */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="/signup" 
              element={
                <PublicRoute>
                  <Signup />
                </PublicRoute>
              } 
            />

            {/* Protected Core App Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ai-plan" 
              element={
                <ProtectedRoute>
                  <WorkspaceProtectedRoute systemId="aiPlan">
                    <Plan track="AI" />
                  </WorkspaceProtectedRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/sd-plan" 
              element={
                <ProtectedRoute>
                  <WorkspaceProtectedRoute systemId="sdPlan">
                    <Plan track="SD" />
                  </WorkspaceProtectedRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dsa-log" 
              element={
                <ProtectedRoute>
                  <WorkspaceProtectedRoute systemId="dsaLog">
                    <DsaLog />
                  </WorkspaceProtectedRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/task-history" 
              element={
                <ProtectedRoute>
                  <WorkspaceProtectedRoute systemId="taskHistory">
                    <TaskHistory />
                  </WorkspaceProtectedRoute>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meds" 
              element={
                <ProtectedRoute>
                  <WorkspaceProtectedRoute systemId="meds">
                    <Meds />
                  </WorkspaceProtectedRoute>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/hr-directory" 
              element={
                <ProtectedRoute>
                  <WorkspaceProtectedRoute systemId="hrDirectory">
                    <HrDirectory />
                  </WorkspaceProtectedRoute>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/notes" 
              element={
                <ProtectedRoute>
                  <WorkspaceProtectedRoute systemId="notes">
                    <Notes />
                  </WorkspaceProtectedRoute>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/note/:id" 
              element={
                <ProtectedRoute>
                  <WorkspaceProtectedRoute systemId="notes">
                    <NoteDetail />
                  </WorkspaceProtectedRoute>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
