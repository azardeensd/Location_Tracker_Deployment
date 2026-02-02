import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminRoute from './Components/Common/Admin/AdminRoute';
import PlantAdminRoute from './Components/Common/Admin/PlantAdminRoute';

// Import your page components - NO LEADING SPACES!
import AdminLogin from './Components/Common/Admin/AdminLogin';
import UserManagement from './Components/Pages/Admin/UserManagement';
import Supplier from './Components/Pages/Admin/Supplier';
import VehiclesManagement from './Components/Pages/Admin/VehiclesManagement';
import AgenciesManagement from './Components/Pages/Admin/AgenciesManagement';
import Login from './Components/Common/Driver/DriverLogin';
import DriverPage from './Components/Pages/Driver/DriverPage';
import Dashboard from './Components/Pages/Admin/Dashboard';
import RateMaster from './Components/Pages/Admin/RateMaster';
import Billing from './Components/Pages/Admin/Billing';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminLogin />} />
       
        {/* Driver Route */}
        <Route path="/driver" element={<DriverPage />} />
       
        {/* Admin Only Routes - Full Access */}
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/supplier"
          element={
            <AdminRoute>
              <Supplier />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/agencies"
          element={
            <AdminRoute>
              <AgenciesManagement />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/rate-master"
          element={
            <AdminRoute>
              <RateMaster />
            </AdminRoute>
          }
        />
       
        {/* New Billing Route */}
        <Route
          path="/admin/billing"
          element={
            <AdminRoute>
              <Billing />
            </AdminRoute>
          }
        />
       
        {/* Plant Admin & Admin Routes - Vehicles Access */}
        <Route
          path="/vehicles"
          element={
            <PlantAdminRoute>
              <VehiclesManagement />
            </PlantAdminRoute>
          }
        />

        {/* Dashboard Route - Accessible for both Admin and Plant Admin */}
        <Route
          path="/dashboard"
          element={
            <PlantAdminRoute>
              <Dashboard />
            </PlantAdminRoute>
          }
        />
       
        {/* Redirects */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/admin-login" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router>
  );
}

export default App;