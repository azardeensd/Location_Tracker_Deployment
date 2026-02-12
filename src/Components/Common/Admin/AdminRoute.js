import React from 'react';
import { Navigate } from 'react-router-dom';

const AdminRoute = ({ children, allowedRoles }) => {
  // Check all possible storage locations
  const adminDataStr = localStorage.getItem('adminData');
  const plantAdminDataStr = localStorage.getItem('plantAdminData');
  
  let user = null;
  
  if (adminDataStr) {
    try {
      user = JSON.parse(adminDataStr);
    } catch (e) {
      console.error('Error parsing adminData:', e);
    }
  }
  
  if (!user && plantAdminDataStr) {
    try {
      user = JSON.parse(plantAdminDataStr);
    } catch (e) {
      console.error('Error parsing plantAdminData:', e);
    }
  }
  
  console.log("AdminRoute Debug:");
  console.log("User found:", user);
  console.log("User role:", user?.role);
  console.log("Allowed roles:", allowedRoles);
  
  // If no user found, redirect to login
  if (!user || !user.role) {
    console.log("No user found, redirecting to login");
    return <Navigate to="/admin" replace />;
  }
  
  // SPECIAL HANDLING FOR DRIVERS: Allow access to specific routes
  if (user.role === 'driver') {
    // Define which routes drivers can access
    const driverAllowedRoutes = ['/admin/billing']; // Add more routes as needed
    
    // Check if current route is in driver's allowed routes
    const currentPath = window.location.pathname;
    if (driverAllowedRoutes.includes(currentPath)) {
      console.log(`Driver granted access to ${currentPath}`);
      return children;
    } else {
      // For other routes, redirect to driver page
      console.log(`Driver access denied for ${currentPath}, redirecting to /driver`);
      return <Navigate to="/driver" replace />;
    }
  }
  
  // If specific roles are specified, check against them
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      console.log(`User role ${user.role} not in allowed roles: ${allowedRoles.join(', ')}`);
      
      // Redirect based on role
      if (user.role === 'driver') {
        return <Navigate to="/driver" replace />;
      } else if (user.role === 'plant_admin') {
        return <Navigate to="/vehicles" replace />;
      } else {
        return <Navigate to="/dashboard" replace />;
      }
    }
    
    console.log(`Access granted for ${user.role} to this route`);
    return children;
  }
  
  // Default allowed roles (for backward compatibility)
  const defaultAdminRoles = ['admin', 'finance', 'mmd', 'super_admin'];
  
  if (defaultAdminRoles.includes(user.role)) {
    console.log("Access granted: Admin role detected");
    return children;
  }
  
  if (user.role === 'plant_admin') {
    console.log("Redirecting plant_admin to vehicles");
    return <Navigate to="/vehicles" replace />;
  }
  
  // Default redirect for other roles
  console.log(`Role ${user.role} not allowed, redirecting to login`);
  return <Navigate to="/admin" replace />;
};

// Default props for backward compatibility
AdminRoute.defaultProps = {
  allowedRoles: []
};

export default AdminRoute;