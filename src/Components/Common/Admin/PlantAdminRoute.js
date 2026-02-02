import React from 'react';
import { Navigate } from 'react-router-dom';

const PlantAdminRoute = ({ children, allowedRoles }) => {
  // Check all possible storage locations
  const adminDataStr = localStorage.getItem('adminData');
  const plantAdminDataStr = localStorage.getItem('plantAdminData');
  
  let user = null;
  
  // First check plantAdminData (for plant_admin users)
  if (plantAdminDataStr) {
    try {
      user = JSON.parse(plantAdminDataStr);
    } catch (e) {
      console.error('Error parsing plantAdminData:', e);
    }
  }
  
  // If not found or not plant_admin, check adminData
  if ((!user || user.role !== 'plant_admin') && adminDataStr) {
    try {
      user = JSON.parse(adminDataStr);
    } catch (e) {
      console.error('Error parsing adminData:', e);
    }
  }
  
  console.log("PlantAdminRoute Debug:");
  console.log("User found:", user);
  console.log("User role:", user?.role);
  console.log("Allowed roles parameter:", allowedRoles);
  
  // If no user found, redirect to login
  if (!user || !user.role) {
    console.log("No user found, redirecting to login");
    return <Navigate to="/admin" replace />;
  }
  
  // Use provided allowedRoles or default ones
  const rolesToCheck = allowedRoles || ['plant_admin', 'admin', 'super_admin', 'finance', 'hr'];
  
  console.log("Checking if role", user.role, "is in", rolesToCheck);
  
  if (rolesToCheck.includes(user.role)) {
    console.log(`Access granted for ${user.role} to plant admin route`);
    return children;
  }
  
  console.log(`Access DENIED: ${user.role} cannot access this plant admin route`);
  
  // Redirect based on user role
  switch(user.role) {
    case 'driver':
      console.log("Redirecting driver to /driver");
      return <Navigate to="/driver" replace />;
      
    case 'plant_admin':
      // Should not happen, but just in case
      return <Navigate to="/dashboard" replace />;
      
    case 'admin':
    case 'super_admin':
    case 'finance':
    case 'hr':
      return <Navigate to="/dashboard" replace />;
      
    default:
      console.log("Redirecting to /admin");
      return <Navigate to="/admin" replace />;
  }
};

// Set default props
PlantAdminRoute.defaultProps = {
  allowedRoles: ['plant_admin', 'admin', 'super_admin', 'finance', 'hr']
};

export default PlantAdminRoute;