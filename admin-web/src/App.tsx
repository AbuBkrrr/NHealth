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

// NEW Insurance & Donation Components
import { InsuranceSchemes } from './components/insurance/InsuranceSchemes';
import { BloodRequestList } from './components/donations/BloodRequestList';
import { CharityCampaigns } from './components/donations/CharityCampaigns'; // Create if missing
import { PatientAssistance } from './components/donations/PatientAssistance'; // optional, create if needed

// Role-based home route
function RoleBasedHome() {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  
  // Route based on role - ADMIN only
  if (user.role === 'ADMIN') return <DashboardPage />;
  
  // All other roles redirect to their specific dashboards
  return <Navigate to={`/${user.role.toLowerCase()}`} />;
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

          {/* ============================================ */}
          {/* NEW INSURANCE & DONATION PUBLIC ROUTES      */}
          {/* ============================================ */}
          <Route path="/insurance" element={<InsuranceSchemes />} />
          <Route path="/donations/blood" element={<BloodRequestList />} />
          <Route path="/donations/fund" element={<CharityCampaigns />} />
          <Route path="/donations/patient" element={<PatientAssistance />} />

          {/* Protected Patient Route */}
          <Route
            path="/patient"
            element={
              <ProtectedRoute>
                <PatientHomePage />
              </ProtectedRoute>
            }
          />

          {/* Protected Doctor Route */}
          <Route
            path="/doctor"
            element={
              <ProtectedRoute>
                <DoctorDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Nurse Route */}
          <Route
            path="/nurse"
            element={
              <ProtectedRoute>
                <NurseDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Pharmacy Route */}
          <Route
            path="/pharmacy"
            element={
              <ProtectedRoute>
                <PharmacyDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Lab Route */}
          <Route
            path="/lab"
            element={
              <ProtectedRoute>
                <LabDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Ambulance Route */}
          <Route
            path="/ambulance"
            element={
              <ProtectedRoute>
                <AmbulanceDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Layout Routes */}
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