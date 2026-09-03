import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, SuperAdminRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ErrorPage } from './pages/ErrorPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { AdminsPage } from './pages/AdminsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { PatientHomePage } from './pages/PatientHomePage';
import { DoctorDashboardPage } from './pages/DoctorDashboardPage';
import { NurseDashboardPage } from './pages/NurseDashboardPage';
import { PharmacyDashboardPage } from './pages/PharmacyDashboardPage';
import { LabDashboardPage } from './pages/LabDashboardPage';
import { AmbulanceDashboardPage } from './pages/AmbulanceDashboardPage';

// Role-based home route
function RoleBasedHome() {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  
  // Route based on role
  if (user.role === 'PATIENT') return <PatientHomePage />;
  if (user.role === 'DOCTOR') return <DoctorDashboardPage />;
  if (user.role === 'NURSE') return <NurseDashboardPage />;
  if (user.role === 'PHARMACY') return <PharmacyDashboardPage />;
  if (user.role === 'LAB') return <LabDashboardPage />;
  if (user.role === 'AMBULANCE') return <AmbulanceDashboardPage />;
  
  // Default to admin dashboard for ADMIN role
  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected Routes */}
          <Route
            path="/patient"
            element={
              <ProtectedRoute>
                <PatientHomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor"
            element={
              <ProtectedRoute>
                <DoctorDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleBasedHome />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route
              path="admins"
              element={
                <SuperAdminRoute>
                  <AdminsPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="audit-log"
              element={
                <SuperAdminRoute>
                  <AuditLogPage />
                </SuperAdminRoute>
              }
            />
          </Route>

          {/* Error Page - Catch all */}
          <Route path="*" element={<ErrorPage code={404} title="Page Not Found" message="Sorry, the page you're looking for doesn't exist." />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
