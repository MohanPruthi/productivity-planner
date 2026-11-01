import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Loader from './components/Loader';

// Less-used pages load on demand so the first visit downloads less JavaScript
const Plans = lazy(() => import('./pages/Plans'));
const DsaLog = lazy(() => import('./pages/DsaLog'));
const TaskHistory = lazy(() => import('./pages/TaskHistory'));
const Meds = lazy(() => import('./pages/Meds'));
const HrDirectory = lazy(() => import('./pages/HrDirectory'));
const Notes = lazy(() => import('./pages/Notes'));
const NoteDetail = lazy(() => import('./pages/NoteDetail'));
const Settings = lazy(() => import('./pages/Settings'));

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
          <Suspense fallback={<Loader />}>
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
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
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
              path="/plans" 
              element={
                <ProtectedRoute>
                  <WorkspaceProtectedRoute systemId="plans">
                    <Plans />
                  </WorkspaceProtectedRoute>
                </ProtectedRoute>
              } 
            />
            {/* The old AI and SD plans now live under Plans */}
            <Route path="/ai-plan" element={<Navigate to="/plans" replace />} />
            <Route path="/sd-plan" element={<Navigate to="/plans" replace />} />
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
          </Suspense>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
