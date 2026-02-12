import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../Services/api';
import styles from './UserManagement.module.css';
import AdminNavigation from '../../Common/Admin/AdminNavigation';
import PermissionSelector from './PermissionSelector';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [plants, setPlants] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [userPermissions, setUserPermissions] = useState({});
  const [showPermissions, setShowPermissions] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);
  const navigate = useNavigate();

  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    email: '',
    agency_id: '',
    plant_id: '',
    department_id: '',
    role: 'driver',
    is_active: true
  });

  // Module definitions with department mapping - UPDATED WITH YOUR MODULES
  const availableModules = [
    // Dashboard Module (Common to all departments)
    { id: 'dashboard', name: 'Dashboard', department: 'common' },
    
    // User Management Module (Admin only)
    { id: 'user_management', name: 'User Management', department: 'admin' },
    
    // Transporter & Plants Module (MMD & Admin)
    { id: 'transporter_plants', name: 'Transporter & Plants', department: 'mmd' },
    
    // Vehicle Management Module (MMD & Admin)
    { id: 'vehicle_management', name: 'Vehicle Management', department: 'mmd' },
    
    // Rate Master Module (Finance & Admin)
    { id: 'rate_master', name: 'Rate Master', department: 'finance' },
    
    // Billing Module (Finance & Admin)
    { id: 'billing', name: 'Billing', department: 'finance' },
    
    // Supplier Module (MMD, Finance & Admin)
    { id: 'supplier', name: 'Supplier', department: 'mmd' },
    
    // User Profile (Common to all)
    { id: 'user_profile', name: 'User Profile', department: 'common' }
  ];

  // Get current user to check permissions - wrapped in useCallback
  const getCurrentUser = useCallback(() => {
    // First check adminData (contains all admin, finance, mmd, super_admin users)
    const adminDataStr = localStorage.getItem('adminData');
    if (adminDataStr) {
      try {
        const adminData = JSON.parse(adminDataStr);
        if (adminData && adminData.role) {
          console.log('Found user in adminData:', adminData.role, adminData.username);
          return adminData;
        }
      } catch (e) {
        console.error('Error parsing adminData:', e);
      }
    }
    
    // Then check plantAdminData
    const plantAdminDataStr = localStorage.getItem('plantAdminData');
    if (plantAdminDataStr) {
      try {
        const plantAdminData = JSON.parse(plantAdminDataStr);
        if (plantAdminData && plantAdminData.role) {
          console.log('Found user in plantAdminData:', plantAdminData.role, plantAdminData.username);
          return plantAdminData;
        }
      } catch (e) {
        console.error('Error parsing plantAdminData:', e);
      }
    }
    
    console.log('No user data found in localStorage');
    return {};
  }, []);

  // Check access - wrapped in useCallback
  const checkAccess = useCallback(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.role) return false;

    const allowedRoles = ['admin', 'plant_admin', 'finance', 'mmd', 'super_admin'];
    // Convert role to lowercase to avoid "MMD" vs "mmd" issues
    return allowedRoles.includes(currentUser.role.toLowerCase());
  }, [getCurrentUser]);

  // Load functions - all wrapped in useCallback with proper dependencies

  const loadUsers = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      let response;

      if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
        response = await api.getUsers();
      } else if (currentUser.plant_id) {
        response = await api.getUsersByPlant(currentUser.plant_id);
      }

      if (response && !response.error) {
        // Parse modules from string to array if needed
        const usersWithParsedModules = (response.data || []).map(user => ({
          ...user,
          modules: typeof user.modules === 'string' 
            ? JSON.parse(user.modules || '[]')
            : user.modules || []
        }));
        setUsers(usersWithParsedModules);
      } else {
        setMessage({ type: 'error', text: 'Failed to load users' });
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setMessage({ type: 'error', text: 'Error loading users' });
    }
  }, [getCurrentUser]);

  const loadAgencies = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      let agenciesData;

      if (currentUser.role === 'plant_admin' && currentUser.plant_id) {
        const response = await api.getAgenciesByPlant(currentUser.plant_id);
        if (response.error) {
          setMessage({ type: 'error', text: 'Failed to load agencies' });
          return;
        }
        agenciesData = response.data || [];
      } else if (currentUser.role === 'finance' || currentUser.role === 'mmd') {
        if (currentUser.plant_id) {
          const response = await api.getAgenciesByPlant(currentUser.plant_id);
          if (response.error) {
            setMessage({ type: 'error', text: 'Failed to load agencies' });
            return;
          }
          agenciesData = response.data || [];
        } else {
          agenciesData = [];
        }
      } else {
        const response = await api.getAgencies();
        if (response.error) {
          setMessage({ type: 'error', text: 'Failed to load agencies' });
          return;
        }
        agenciesData = response.data || [];
      }

      setAgencies(agenciesData);
    } catch (error) {
      console.error('Error loading agencies:', error);
      setMessage({ type: 'error', text: 'Error loading agencies' });
    }
  }, [getCurrentUser]);

  const loadPlants = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      let plantsData;

      if (currentUser.role === 'plant_admin' && currentUser.plant_id) {
        const response = await api.getPlantById(currentUser.plant_id);
        if (response.error) {
          console.error('Failed to load plant:', response.error);
          return;
        }
        plantsData = response.data ? [response.data] : [];
      } else if (currentUser.role === 'finance' || currentUser.role === 'mmd') {
        if (currentUser.plant_id) {
          const response = await api.getPlantById(currentUser.plant_id);
          if (response.error) {
            console.error('Failed to load plant:', response.error);
            return;
          }
          plantsData = response.data ? [response.data] : [];
        } else {
          plantsData = [];
        }
      } else {
        const response = await api.getPlants();
        if (response.error) {
          console.error('Failed to load plants:', response.error);
          return;
        }
        plantsData = response.data || [];
      }

      setPlants(plantsData);
    } catch (error) {
      console.error('Error loading plants:', error);
      setMessage({ type: 'error', text: 'Error loading plants' });
    }
  }, [getCurrentUser]);

  const loadDepartments = useCallback(async () => {
    try {
      const { data, error } = await api.getDepartments();
      if (!error && data) {
        setDepartments(data);
      } else {
        console.error('Failed to load departments:', error);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const { data, error } = await api.getRoles();
      if (!error && data) {
        setRoles(data);
      } else {
        console.error('Failed to load roles:', error);
        // Fallback to default roles if API fails
        setRoles([
          { id: 1, name: 'Driver', code: 'driver' },
          { id: 2, name: 'Plant Admin', code: 'plant_admin' },
          { id: 3, name: 'Super Admin', code: 'super_admin' },
          { id: 4, name: 'Finance', code: 'finance' },
          { id: 5, name: 'MMD', code: 'mmd' },
          { id: 6, name: 'Plant User', code: 'plant_user' }
        ]);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  }, []);

  const loadModules = useCallback(async () => {
    try {
      const { data, error } = await api.getModules();
      if (!error && data) {
        setModules(data);
      } else {
        console.error('Failed to load modules:', error);
      }
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    try {
      const { data, error } = await api.getPermissions();
      if (!error && data) {
        setPermissions(data);
      } else {
        console.error('Failed to load permissions:', error);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  }, []);

  // Helper function to validate Gmail
  const validateGmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return emailRegex.test(email);
  };

  // Check if username already exists
  const checkUsernameExists = (username) => {
    return users.some(user => 
      user.username.toLowerCase() === username.toLowerCase().trim()
    );
  };

  // Reset form function
  const resetForm = useCallback(() => {
    const currentUser = getCurrentUser();
    setUserForm({
      username: '',
      password: '',
      email: '',
      agency_id: '',
      plant_id: (currentUser?.role === 'mmd' || currentUser?.role === 'finance') 
                 ? currentUser.plant_id 
                 : '',
      department_id: '',
      role: 'driver',
      is_active: true
    });
    setUserPermissions({});
    setShowPermissions(false);
  }, [getCurrentUser]);

  // Main useEffect with all dependencies
  useEffect(() => {
    console.log('=== UserManagement Component Mounted ===');
    
    const currentUser = getCurrentUser();
    console.log('=== Current User ===');
    console.log('Full user object:', currentUser);
    console.log('User role:', currentUser?.role);
    console.log('User ID:', currentUser?.id);
    console.log('Username:', currentUser?.username);
    
    const hasPermission = checkAccess();
    console.log('=== Access Check Result ===');
    console.log('Has permission to access UserManagement:', hasPermission);
    
    if (!hasPermission) {
      console.log('Access DENIED for UserManagement');
      setHasAccess(false);
      setMessage({ 
        type: 'error', 
        text: `Access denied. Admin, Finance, MMD, or Plant Admin privileges required. Your role: "${currentUser?.role || 'none'}"`
      });
      
      setTimeout(() => {
        if (!currentUser || !currentUser.role) {
          console.log('No user found, redirecting to /admin');
          navigate('/admin');
        } else if (currentUser.role === 'driver') {
          console.log('Driver role, redirecting to /driver');
          navigate('/driver');
        } else if (currentUser.role === 'plant_admin') {
          console.log('Plant admin role, redirecting to /dashboard');
          navigate('/dashboard');
        } else {
          console.log('Redirecting to /dashboard');
          navigate('/dashboard');
        }
      }, 3000);
      return;
    }

    if (!currentUser || (!currentUser.role && !currentUser.id)) {
      console.log('No valid user found, redirecting to /admin');
      navigate('/admin');
      return;
    }

    console.log('Access GRANTED for UserManagement');
    setHasAccess(true);
    
    console.log('Loading data for user:', currentUser.username);
    loadUsers();
    loadAgencies();
    loadPlants();
    loadRoles();
    loadModules();
    loadPermissions();
    
    const rolesThatNeedDepartments = ['admin', 'plant_admin', 'finance', 'mmd', 'super_admin'];
    if (rolesThatNeedDepartments.includes(currentUser.role)) {
      console.log('Loading departments for role:', currentUser.role);
      loadDepartments();
    } else {
      console.log('Skipping departments for role:', currentUser.role);
    }
  }, [
    navigate, 
    getCurrentUser, 
    checkAccess, 
    loadUsers, 
    loadAgencies, 
    loadPlants, 
    loadRoles, 
    loadModules, 
    loadPermissions, 
    loadDepartments
  ]);

  const handleInputChange = (e) => {
  const { name, value, type, checked } = e.target;
  
  const newValue = type === 'checkbox' ? checked : value;
  
  setUserForm(prev => {
    const updatedForm = {
      ...prev,
      [name]: newValue
    };
    
    // Special handling for role changes
    if (name === 'role') {
      const selectedRole = roles.find(r => r.code === newValue);
      const isPlantRole = selectedRole ? ['plant_admin', 'plant_user'].includes(selectedRole.code) : false;
      
      // Reset email for non-plant roles
      if (!isPlantRole) {
        updatedForm.email = '';
      }
      
      // Reset department for driver role
      if (selectedRole && selectedRole.code === 'driver') {
        updatedForm.department_id = '';
      }
    }
    
    // Auto-assign plant_id when agency is selected - MOVED INSIDE setUserForm
    if (name === 'agency_id' && newValue) {
      const selectedAgency = agencies.find(agency => agency.id === newValue);
      if (selectedAgency && selectedAgency.plant_id) {
        console.log('✅ Auto-assigning plant from agency:', {
          agency: selectedAgency.name,
          plant_id: selectedAgency.plant_id,
          plant_name: plants.find(p => p.id === selectedAgency.plant_id)?.name || 'Unknown'
        });
        updatedForm.plant_id = selectedAgency.plant_id;
      } else {
        console.warn('⚠️ No plant_id found for selected agency');
      }
    }
    
    // Clear agency_id if role is plant_admin and plant is manually selected
    if (name === 'plant_id' && updatedForm.role === 'plant_admin' && newValue) {
      updatedForm.agency_id = ''; // Clear agency for plant admin
    }
    
    return updatedForm;
  });
};

  // Module selection handler
  const handleModuleToggle = (moduleId) => {
    const currentModules = userPermissions[userForm.role] || [];
    const index = currentModules.indexOf(moduleId);
    
    let updatedModules;
    if (index === -1) {
      // Add module
      updatedModules = [...currentModules, moduleId];
    } else {
      // Remove module
      updatedModules = currentModules.filter(id => id !== moduleId);
    }
    
    setUserPermissions(prev => ({
      ...prev,
      [userForm.role]: updatedModules
    }));
  };

  const getDepartmentFromRole = (role) => {
    switch(role) {
      case 'finance': return 'finance';
      case 'mmd': return 'mmd';
      case 'plant_admin': return 'mmd'; // Default for plant admin
      default: return 'common';
    }
  };

  // Filter modules based on current user's role
  const getFilteredModules = () => {
    const currentUser = getCurrentUser();
    const department = getDepartmentFromRole(currentUser.role);
    
    return availableModules.filter(module => {
      if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
        return true; // Admin can see all modules
      }
      
      // For MMD and Plant Admin, show MMD modules + common modules
      if (department === 'mmd') {
        return module.department === 'common' || module.department === 'mmd';
      }
      
      // For Finance, show Finance modules + common modules + supplier module
      if (department === 'finance') {
        return module.department === 'common' || module.department === 'finance' || module.id === 'supplier';
      }
      
      return module.department === 'common';
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!userForm.username || !userForm.password) {
      setMessage({ type: 'error', text: 'Username and password are required' });
      return;
    }

    const usernameExists = checkUsernameExists(userForm.username);
    if (usernameExists) {
      setMessage({ type: 'error', text: 'Username already exists. Please choose a different username.' });
      return;
    }

    const selectedRole = roles.find(r => r.code === userForm.role);
    if (!selectedRole) {
      setMessage({ type: 'error', text: 'Invalid role selected' });
      return;
    }

    const isPlantRole = ['plant_admin', 'plant_user'].includes(selectedRole.code);
    if (isPlantRole) {
      if (!userForm.email) {
        setMessage({ type: 'error', text: 'Gmail is required for Plant Admin and Plant User roles' });
        return;
      }
      if (!validateGmail(userForm.email)) {
        setMessage({ type: 'error', text: 'Please enter a valid Gmail address (example@gmail.com)' });
        return;
      }
    }

    if (selectedRole.code === 'driver' && !userForm.agency_id) {
      setMessage({ type: 'error', text: 'Transporter is required for drivers' });
      return;
    }

    if (!userForm.plant_id) {
      setMessage({ type: 'error', text: 'Plant is required for all roles' });
      return;
    }

    const needsDepartment = ['plant_admin', 'plant_user', 'super_admin', 'finance', 'mmd'].includes(selectedRole.code);
    if (needsDepartment && !userForm.department_id) {
      setMessage({ type: 'error', text: 'Department is required for ' + selectedRole.name + ' role' });
      return;
    }

    // Module validation for non-driver roles
    if (!['driver', 'plant_user'].includes(selectedRole.code)) {
      const userModules = userPermissions[userForm.role] || [];
      if (userModules.length === 0) {
        setMessage({ type: 'error', text: 'Please select at least one module for this role' });
        return;
      }
    }

    if (userForm.plant_id) {
      const selectedPlant = plants.find(plant => plant.id === userForm.plant_id);
      
      if (!selectedPlant) {
        setMessage({ type: 'error', text: `Selected plant does not exist. Available plants: ${plants.map(p => p.name).join(', ')}` });
        return;
      }
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Get modules for this user
      const userModules = userPermissions[userForm.role] || [];
      const userData = {
        username: userForm.username.trim(),
        password: userForm.password,
        role: userForm.role,
        is_active: userForm.is_active,
        agency_id: userForm.agency_id || null,
        plant_id: userForm.plant_id,
        department_id: userForm.department_id || null,
        email: isPlantRole ? userForm.email.trim() : 'Not Applicable',
        modules: JSON.stringify(userModules) // Store modules as JSON string
      };

      // Debug logging
      console.log('=== CREATE USER DEBUG ===');
      console.log('Basic user data:', userData);
      console.log('Selected modules:', userModules);
      console.log('Show custom permissions:', showPermissions);
      console.log('User permissions object:', userPermissions);
      
      // Check if we have actual custom permissions
      let hasValidCustomPermissions = false;
      let permissionSummary = {};
      
      if (showPermissions && userPermissions && Object.keys(userPermissions).length > 0) {
        Object.keys(userPermissions).forEach(roleCode => {
          const perms = userPermissions[roleCode];
          if (perms && perms.length > 0) {
            hasValidCustomPermissions = true;
            permissionSummary[roleCode] = perms;
          }
        });
      }
      
      console.log('Has valid custom permissions:', hasValidCustomPermissions);
      console.log('Permission summary:', permissionSummary);
      
      let response;
      if (hasValidCustomPermissions) {
        console.log('🎯 Creating user WITH custom permissions');
        console.log('Permissions being sent:', permissionSummary);
        
        response = await api.createUserWithPermissions(userData, permissionSummary);
        
        // Log the response
        console.log('API Response for createUserWithPermissions:', response);
        
        if (response.customRoleInfo) {
          console.log('✅ Custom role created successfully:');
          console.log('- Role Code:', response.customRoleInfo.code);
          console.log('- Permissions Count:', response.customRoleInfo.permissionsCount);
          console.log('- Modules Count:', response.customRoleInfo.modulesCount);
        }
      } else {
        console.log('🎯 Creating user WITHOUT custom permissions');
        response = await api.createUser(userData);
        console.log('API Response for createUser:', response);
      }
      
      if (response.error) {
        console.error('❌ API Error:', response.error);
        
        if (response.error.message && response.error.message.includes('duplicate')) {
          setMessage({ type: 'error', text: 'Username already exists. Please choose a different username.' });
        } else {
          setMessage({ type: 'error', text: response.error.message || 'Failed to create user' });
        }
      } else {
        const successMsg = hasValidCustomPermissions 
          ? 'User created successfully with custom permissions!' 
          : 'User created successfully!';
        
        setMessage({ type: 'success', text: successMsg });
        
        if (hasValidCustomPermissions && response.customRoleInfo) {
          // Show additional info about custom role
          setTimeout(() => {
            setMessage({ 
              type: 'info', 
              text: `Custom role "${response.customRoleInfo.name}" created with ${response.customRoleInfo.permissionsCount} permissions` 
            });
          }, 3000);
        }
        
        resetForm();
        setShowCreateForm(false);
        setShowPermissions(false);
        setUserPermissions({});
        loadUsers();
        
        setTimeout(() => setMessage({ type: '', text: '' }), 6000);
      }
    } catch (error) {
      console.error('💥 Exception creating user:', error);
      setMessage({ type: 'error', text: 'Error creating user: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionsChange = (newPermissions) => {
    setUserPermissions(newPermissions);
  };

  const togglePermissionsSection = async () => {
    const newShowPermissions = !showPermissions;
    setShowPermissions(newShowPermissions);
    
    if (newShowPermissions && Object.keys(userPermissions).length === 0) {
      // Load default permissions for the selected role
      if (userForm.role) {
        try {
          console.log('🔍 Loading default permissions for role:', userForm.role);
          const { data: defaultPerms } = await api.getDefaultRolePermissions(userForm.role);
          
          if (defaultPerms && Object.keys(defaultPerms).length > 0) {
            console.log('✅ Loaded default permissions:', defaultPerms);
            setUserPermissions(defaultPerms);
          } else {
            // Initialize with empty permissions
            const defaultPerms = {};
            modules.forEach(module => {
              defaultPerms[module.code] = [];
            });
            setUserPermissions(defaultPerms);
            console.log('ℹ️ No default permissions found, using empty permissions');
          }
        } catch (error) {
          console.error('❌ Error loading default permissions:', error);
          // Initialize with empty permissions as fallback
          const defaultPerms = {};
          modules.forEach(module => {
            defaultPerms[module.code] = [];
          });
          setUserPermissions(defaultPerms);
        }
      } else {
        // Initialize with empty permissions
        const defaultPerms = {};
        modules.forEach(module => {
          defaultPerms[module.code] = [];
        });
        setUserPermissions(defaultPerms);
      }
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      const { error } = await api.updateUser(userId, {
        is_active: !currentStatus
      });

      if (error) {
        setMessage({ type: 'error', text: 'Failed to update user' });
      } else {
        setMessage({ type: 'success', text: 'User updated successfully!' });
        loadUsers();
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setMessage({ type: 'error', text: 'Error updating user' });
    }
  };

  // Helper functions
  const getAgencyName = (agencyId) => {
    if (!agencyId) return 'N/A';
    const agency = agencies.find(a => a.id === agencyId);
    return agency ? agency.name : 'N/A';
  };

  const getPlantName = (plantId) => {
    if (!plantId) return 'N/A';
    const plant = plants.find(p => p.id === plantId);
    return plant ? plant.name : 'N/A';
  };

  const getPlantLocation = (plantId) => {
    if (!plantId) return 'N/A';
    const plant = plants.find(p => p.id === plantId);
    return plant ? plant.location : 'N/A';
  };

  const getDepartmentName = (departmentId) => {
    if (!departmentId) return 'N/A';
    const dept = departments.find(d => d.id === departmentId);
    return dept ? dept.name : 'N/A';
  };

  const getRoleName = (roleCode) => {
    if (!roleCode) return 'N/A';
    const role = roles.find(r => r.code === roleCode);
    return role ? role.name : roleCode;
  };

  const getModuleNames = (moduleIds) => {
    if (!moduleIds || moduleIds.length === 0) return 'No modules';
    return moduleIds
      .map(id => availableModules.find(m => m.id === id)?.name)
      .filter(name => name)
      .join(', ');
  };

  const currentUser = getCurrentUser();
  const currentUserRoleCode = currentUser.role;

  // Filter roles based on current user's permissions
  const getAvailableRoles = () => {
    if (currentUserRoleCode === 'admin') {
      return roles.filter(role => role.code !== 'admin');
    }
    
    if (currentUserRoleCode === 'plant_admin') {
      return roles.filter(role => ['plant_user', 'driver'].includes(role.code));
    }
    
    if (currentUserRoleCode === 'finance') {
      return roles.filter(role => role.code === 'driver');
    }
    
    if (currentUserRoleCode === 'mmd') {
      return roles.filter(role => ['driver', 'plant_user'].includes(role.code));
    }
    
    return roles.filter(role => role.code === 'driver');
  };

  // Check if a role requires email
  const roleRequiresEmail = (roleCode) => {
    return ['plant_admin', 'plant_user'].includes(roleCode);
  };

  // Check if a role requires transporter
  const roleRequiresTransporter = (roleCode) => {
    return roleCode === 'driver';
  };

  // Check if a role requires department
  const roleRequiresDepartment = (roleCode) => {
    return ['plant_admin', 'plant_user', 'super_admin', 'finance', 'mmd'].includes(roleCode);
  };

  // Check if a role requires module selection
  const roleRequiresModules = (roleCode) => {
    return !['driver', 'plant_user'].includes(roleCode);
  };

  // Get module access description based on role
  const getModuleAccessDescription = () => {
    const currentUser = getCurrentUser();
    const department = getDepartmentFromRole(currentUser.role);
    
    if (department === 'mmd') {
      return 'MMD users can access: Dashboard, Transporter & Plants, Vehicle Management, Supplier, and User Profile modules';
    } else if (department === 'finance') {
      return 'Finance users can access: Dashboard, Rate Master, Billing, Supplier, and User Profile modules';
    } else if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
      return 'Admin users can access all modules';
    }
    
    return 'Select modules that this user can access';
  };

  if (!hasAccess) {
    return (
      <AdminNavigation>
        <div className={styles.userManagement}>
          <div className={styles.accessDenied}>
            <h2>Access Denied</h2>
            <p>{message.text}</p>
            <button 
              className={styles.backBtn}
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </AdminNavigation>
    );
  }

  return (
    <AdminNavigation>
      <div className={styles.userManagement}>
        <div className={styles.header}>
          <h1>User Management</h1>
          <button 
            className={styles.createBtn}
            onClick={() => {resetForm();
              setShowCreateForm(true);
            }}
            disabled={currentUserRoleCode === 'finance'}
          >
            + Add New User
          </button>
          {currentUserRoleCode === 'finance' && (
            <small className={styles.viewOnlyText}>View Only - Cannot create users</small>
          )}
        </div>

        {message.text && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}

        {/* Create User Form */}
        {showCreateForm && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className={styles.modalHeader}>
                <h2>Create New User</h2>
                <button 
                  className={styles.closeBtn}
                  onClick={() => {
                    resetForm();
                    setShowCreateForm(false);
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUser} className={styles.form}>
                <div className={styles.formSection}>
                  <h3 className={styles.sectionTitle}>Basic Information</h3>
                  
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>Username *</label>
                      <input
                        type="text"
                        name="username"
                        value={userForm.username}
                        onChange={handleInputChange}
                        placeholder="Enter unique username"
                        required
                        disabled={loading}
                        className={checkUsernameExists(userForm.username.trim()) ? styles.errorInput : ''}
                      />
                      {checkUsernameExists(userForm.username.trim()) && (
                        <small className={styles.errorText}>
                          Username already exists. Please choose a different one.
                        </small>
                      )}
                    </div>

                    <div className={styles.formGroup}>
                      <label>Password *</label>
                      <input
                        type="password"
                        name="password"
                        value={userForm.password}
                        onChange={handleInputChange}
                        placeholder="Enter password"
                        required
                        disabled={loading}
                      />
                    </div>

                    {roleRequiresEmail(userForm.role) && (
                      <div className={styles.formGroup}>
                        <label>Gmail *</label>
                        <input
                          type="email"
                          name="email"
                          value={userForm.email}
                          onChange={handleInputChange}
                          placeholder="example@gmail.com"
                          required={roleRequiresEmail(userForm.role)}
                          disabled={loading}
                        />
                        <small className={styles.helperText}>
                          Only Gmail addresses are allowed for Plant roles
                        </small>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.formSection}>
                  <h3 className={styles.sectionTitle}>Role & Assignment</h3>
                  
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>Role *</label>
                      <select
                        name="role"
                        value={userForm.role}
                        onChange={handleInputChange}
                        required
                        disabled={loading}
                      >
                        <option value="">Select Role</option>
                        {getAvailableRoles().map(role => (
                          <option key={role.code} value={role.code}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {roleRequiresDepartment(userForm.role) && (
                      <div className={styles.formGroup}>
                        <label>Department *</label>
                        <select
                          name="department_id"
                          value={userForm.department_id}
                          onChange={handleInputChange}
                          required={roleRequiresDepartment(userForm.role)}
                          disabled={loading}
                        >
                          <option value="">Select Department</option>
                          {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                        <small className={styles.helperText}>
                          Required for {getRoleName(userForm.role)} role
                        </small>
                      </div>
                    )}

                    <div className={styles.formGroup}>
                      <label>
                        Transporter {roleRequiresTransporter(userForm.role) && '*'}
                      </label>
                      <select
                        name="agency_id"
                        value={userForm.agency_id}
                        onChange={handleInputChange}
                        required={roleRequiresTransporter(userForm.role)}
                        disabled={loading || !roleRequiresTransporter(userForm.role)}
                      >
                        <option value="">Select Transporter</option>
                        {agencies.map(agency => (
                          <option key={agency.id} value={agency.id}>
                            {agency.name}
                          </option>
                        ))}
                      </select>
                      {roleRequiresTransporter(userForm.role) && (
                        <small className={styles.helperText}>
                          Required for drivers
                        </small>
                      )}
                    </div>

                    <div className={styles.formGroup}>
  <label>
    Plant *
  </label>
  <select
    name="plant_id"
    value={userForm.plant_id}
    onChange={handleInputChange}
    required
    disabled={
      loading || 
      currentUserRoleCode === 'finance' || 
      currentUserRoleCode === 'mmd' ||
      (userForm.role === 'driver' && userForm.agency_id) // Disable when auto-assigned from agency
    }
                      >
                         <option value="">Select Plant</option>
    {plants.map(plant => (
      <option key={plant.id} value={plant.id}>
        {plant.name} - {plant.location}
      </option>
    ))}
  </select>
  <small className={styles.helperText}>
    {userForm.role === 'driver' && userForm.agency_id ? (
      <span className={styles.autoAssigned}>
        Auto-assigned from selected transporter
      </span>
    ) : (
      'Required for all users'
    )}
  </small>
  {(currentUserRoleCode === 'finance' || currentUserRoleCode === 'mmd') && (
    <small className={styles.helperText}>
      Auto-assigned to your plant
    </small>
  )}
</div>
                  </div>
                </div>

                {/* Module Selection Section */}
                {roleRequiresModules(userForm.role) && (
                  <div className={styles.formSection}>
                    <h3 className={styles.sectionTitle}>Module Access *</h3>
                    <div className={styles.moduleSelection}>
                      <div className={styles.moduleInfo}>
                        <p className={styles.infoText}>
                          {getModuleAccessDescription()}
                        </p>
                      </div>
                      <div className={styles.modulesGrid}>
                        {getFilteredModules().map(module => {
                          const isSelected = (userPermissions[userForm.role] || []).includes(module.id);
                          return (
                            <div key={module.id} className={styles.moduleCheckbox}>
                              <input
                                type="checkbox"
                                id={`module-${module.id}`}
                                checked={isSelected}
                                onChange={() => handleModuleToggle(module.id)}
                                disabled={loading}
                              />
                              <label htmlFor={`module-${module.id}`}>
                                {module.name}
                                <span className={styles.moduleDept}>
                                  ({module.department === 'common' ? 'All Departments' : module.department.toUpperCase()})
                                </span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      {(userPermissions[userForm.role] || []).length > 0 && (
                        <small className={styles.helperText}>
                          Selected modules: {(userPermissions[userForm.role] || []).length}
                        </small>
                      )}
                      <small className={styles.helperText}>
                        Select modules that this user can access. At least one module is required.
                      </small>
                    </div>
                  </div>
                )}

                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Advanced Permissions</h3>
                    <button
                      type="button"
                      className={`${styles.toggleButton} ${showPermissions ? styles.active : ''}`}
                      onClick={togglePermissionsSection}
                      disabled={currentUserRoleCode === 'finance' || currentUserRoleCode === 'mmd'}
                    >
                      {showPermissions ? 'Hide Custom Permissions' : 'Set Custom Permissions'}
                      <span className={styles.toggleIcon}>
                        {showPermissions ? '▲' : '▼'}
                      </span>
                    </button>
                  </div>
                  
                  <div className={styles.permissionsInfo}>
                    <p className={styles.infoText}>
                      {showPermissions 
                        ? 'Customize module access for this user. If not set, default permissions for the selected role will be used.'
                        : (currentUserRoleCode === 'finance' || currentUserRoleCode === 'mmd') 
                          ? 'Permission customization is not available for your role.'
                          : 'Click "Set Custom Permissions" to customize module access for this user.'}
                    </p>
                  </div>

                  {showPermissions && modules.length > 0 && permissions.length > 0 && (
                    <PermissionSelector
                      modules={modules}
                      permissions={permissions}
                      selectedPermissions={userPermissions}
                      onChange={handlePermissionsChange}
                    />
                  )}
                </div>

                <div className={styles.formSection}>
                  <div className={styles.formGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={userForm.is_active}
                        onChange={handleInputChange}
                        disabled={loading}
                      />
                      <span className={styles.checkboxText}>Active User</span>
                    </label>
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button 
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => {
                      resetForm();
                      setShowCreateForm(false);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className={styles.submitBtn}
                    disabled={loading || checkUsernameExists(userForm.username.trim())}
                  >
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className={styles.usersList}>
          <h2>Existing Users</h2>
          {users.length === 0 ? (
            <p className={styles.noUsers}>No users found</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.usersTable}>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Plant Code</th>
                    <th>Plant Name</th>
                    <th>Transporter</th>
                    <th>Role</th>
                    <th>Modules</th>
                    <th>Status</th>
                    {currentUserRoleCode !== 'finance' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>
                        <span className={styles.username}>
                          {user.username || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.email}>
                          {user.email || 'N/A'}
                        </span>
                      </td>
                      <td>
                        {user.department_name || getDepartmentName(user.department_id) || 'N/A'}
                      </td>
                      <td>
                        {getPlantName(user.plant_id)}
                      </td>
                      <td>
                        {getPlantLocation(user.plant_id)}
                      </td>
                      <td>{getAgencyName(user.agency_id)}</td>
                      <td>
                        <span className={`${styles.role} ${styles[user.role]}`}>
                          {user.role_name || getRoleName(user.role) || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.modules}>
                          {getModuleNames(user.modules)}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.status} ${user.is_active ? styles.active : styles.inactive}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {currentUserRoleCode !== 'finance' && (
                        <td>
                          <button
                            className={`${styles.toggleBtn} ${user.is_active ? styles.deactivate : styles.activate}`}
                            onClick={() => handleToggleActive(user.id, user.is_active)}
                            disabled={currentUserRoleCode === 'mmd'}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminNavigation>
  );
};

export default UserManagement;