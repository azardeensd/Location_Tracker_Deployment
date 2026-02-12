// utils/permissionUtils.js

export const PermissionUtils = {
  // Get current user with permissions
  getCurrentUser() {
    // Try adminData first
    const adminDataStr = localStorage.getItem('adminData');
    const modulePermissionsStr = localStorage.getItem('modulePermissions');
    
    if (adminDataStr) {
      try {
        const adminData = JSON.parse(adminDataStr);
        const modulePermissions = modulePermissionsStr ? JSON.parse(modulePermissionsStr) : {};
        
        if (adminData && adminData.role) {
          return {
            ...adminData,
            // Merge explicit permissions if available
            permissions: modulePermissions || adminData.permissions || {},
            isAdmin: true
          };
        }
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    
    // Try plantAdminData
    const plantAdminDataStr = localStorage.getItem('plantAdminData');
    if (plantAdminDataStr) {
      try {
        const plantAdminData = JSON.parse(plantAdminDataStr);
        if (plantAdminData && plantAdminData.role) {
          return {
            ...plantAdminData,
            permissions: plantAdminData.permissions || {},
            isAdmin: true
          };
        }
      } catch (e) {
        console.error('Error parsing plantAdminData:', e);
      }
    }
    
    return null;
  },

  // Check if user has specific permission
  hasPermission(user, module, action = null) {
    if (!user || !user.role) return false;
    
    // Super admin has all permissions
    if (user.role === 'super_admin' || user.role === 'admin') {
      return true;
    }
    
    // Check if user has explicit permissions object
    if (user.permissions) {
      // If 'all' permission exists
      if (user.permissions.all === true || user.permissions.all === 'all') {
        return true;
      }
      
      // Check module permissions
      const modulePerms = user.permissions[module];
      if (!modulePerms) return false;
      
      // If no specific action required, any permission for module is enough
      if (!action) return modulePerms.length > 0;
      
      // Check for specific action
      if (Array.isArray(modulePerms)) {
        return modulePerms.includes(action);
      }
      
      // Handle object format if needed
      if (typeof modulePerms === 'object') {
        return modulePerms[action] === true;
      }
    }
    
    return false;
  },

  // Check if user has any of the required roles
  hasRole(user, requiredRoles) {
    if (!user || !user.role) return false;
    return requiredRoles.includes(user.role);
  },

  // Get user display name
  getDisplayName(user) {
    return user.username || user.name || user.email || 'User';
  },

  // Get role display name
  getRoleDisplayName(role) {
    const roleNames = {
      'admin': 'Super Admin',
      'plant_admin': 'Plant Admin',
      'finance': 'Finance',
      'mmd': 'HR',
      'super_admin': 'Super Admin',
      'driver': 'Driver',
      'plant_user': 'Plant User'
    };
    return roleNames[role] || role;
  },

  // Get header title based on role
  getHeaderTitle(role) {
    const titles = {
      'admin': '🚛 Transporter Admin',
      'plant_admin': '🏭 Plant Admin Console',
      'finance': '💰 Finance Console',
      'mmd': '👥 HR Console',
      'super_admin': '👑 Super Admin'
    };
    return titles[role] || 'Admin Console';
  }
};