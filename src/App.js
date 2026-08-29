import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import AdminRoute from './Components/Common/Admin/AdminRoute';
import PlantAdminRoute from './Components/Common/Admin/PlantAdminRoute';

// Import your page components
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
      <Analytics />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminLogin />} />
        
        {/* Driver Route (Separate Login) */}
        <Route path="/driver" element={<DriverPage />} />
        
        {/* --- SUPER ADMIN ONLY ROUTES --- */}
        <Route
          path="/admin/users"
          element={
            <AdminRoute allowedRoles={['super_admin', 'admin']}>
              <UserManagement />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/agencies"
          element={
            <AdminRoute allowedRoles={['super_admin', 'admin']}>
              <AgenciesManagement />
            </AdminRoute>
          }
        />

        {/* --- MMD ROUTES (Billing & Supplier) --- */}
        <Route
          path="/admin/supplier"
          element={
            // MMD can access Supplier + Super Admin
            <AdminRoute allowedRoles={['super_admin', 'admin', 'mmd']}>
              <Supplier />
            </AdminRoute>
          }
        />

        {/* --- FINANCE ROUTES (Billing & RateMaster) --- */}
        <Route
          path="/admin/rate-master"
          element={
            // Finance can access RateMaster + Super Admin
            <AdminRoute allowedRoles={['super_admin', 'admin', 'finance']}>
              <RateMaster />
            </AdminRoute>
          }
        />
        
        {/* --- SHARED ROUTES (Finance & MMD & Super Admin) --- */}
        <Route
  path="/admin/billing"
  element={
    <AdminRoute allowedRoles={['super_admin', 'admin', 'finance', 'mmd', 'driver']}>
      <Billing />
    </AdminRoute>
  }
/>
        
        {/* --- PLANT ADMIN ROUTES (Dashboard & Vehicles) --- */}
        <Route
          path="/vehicles"
          element={
            // Plant Admin + Super Admin
            <AdminRoute allowedRoles={['super_admin', 'admin', 'plant_admin']}>
              <VehiclesManagement />
            </AdminRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            // Plant Admin + Super Admin
            <AdminRoute allowedRoles={['super_admin', 'admin', 'plant_admin']}>
              <Dashboard />
            </AdminRoute>
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