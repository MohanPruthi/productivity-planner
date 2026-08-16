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
                  <Plan track="AI" />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/sd-plan" 
              element={
                <ProtectedRoute>
                  <Plan track="SD" />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dsa-log" 
              element={
                <ProtectedRoute>
                  <DsaLog />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/task-history" 
              element={
                <ProtectedRoute>
                  <TaskHistory />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meds" 
              element={
                <ProtectedRoute>
                  <Meds />
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
