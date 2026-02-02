import React, { useState, useEffect } from 'react';
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

  // Get current user to check permissions
const getCurrentUser = () => {
  // First check adminData (contains all admin, finance, hr, super_admin users)
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
};
  const checkAccess = () => {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.role) return false;

  const allowedRoles = ['admin', 'plant_admin', 'finance', 'hr', 'super_admin'];
  // Convert role to lowercase to avoid "HR" vs "hr" issues
  return allowedRoles.includes(currentUser.role.toLowerCase());
};

useEffect(() => {
  console.log('=== UserManagement Component Mounted ===');
  
  // Debug: Show all localStorage
  console.log('=== LocalStorage Contents ===');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    console.log(`${key}:`, typeof value === 'string' && value.length > 100 ? 
      `${value.substring(0, 100)}...` : value);
  }
  
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
      text: `Access denied. Admin, Finance, HR, or Plant Admin privileges required. Your role: "${currentUser?.role || 'none'}"`
    });
    
    // Redirect based on user role
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
  
  // Load all data
  console.log('Loading data for user:', currentUser.username);
  loadUsers();
  loadAgencies();
  loadPlants();
  loadRoles();
  loadModules();
  loadPermissions();
  
  // Load departments for specific roles
  const rolesThatNeedDepartments = ['admin', 'plant_admin', 'finance', 'hr', 'super_admin'];
  if (rolesThatNeedDepartments.includes(currentUser.role)) {
    console.log('Loading departments for role:', currentUser.role);
    loadDepartments();
  } else {
    console.log('Skipping departments for role:', currentUser.role);
  }
}, [navigate]);

  const loadUsers = async () => {
  try {
    const currentUser = getCurrentUser();
    let response;

    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
      response = await api.getUsers();
    } else if (currentUser.plant_id) {
      // Use the new method we just added
      response = await api.getUsersByPlant(currentUser.plant_id);
    }

    if (response && !response.error) {
      setUsers(response.data || []);
    } else {
      setMessage({ type: 'error', text: 'Failed to load users' });
    }
  } catch (error) {
    console.error('Error loading users:', error);
    setMessage({ type: 'error', text: 'Error loading users' });
  }
};

  const loadAgencies = async () => {
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
      } else if (currentUser.role === 'finance' || currentUser.role === 'hr') {
        // Finance/HR users see agencies from their plant
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
  };

  const loadPlants = async () => {
    try {
      const currentUser = getCurrentUser();
      let plantsData;

      if (currentUser.role === 'plant_admin' && currentUser.plant_id) {
        // Plant admin can only see their own plant
        const response = await api.getPlantById(currentUser.plant_id);
        if (response.error) {
          console.error('Failed to load plant:', response.error);
          return;
        }
        plantsData = response.data ? [response.data] : [];
      } else if (currentUser.role === 'finance' || currentUser.role === 'hr') {
        // Finance/HR users see their assigned plant
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
        // Admin can see all plants
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
  };

  const loadDepartments = async () => {
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
  };

  const loadRoles = async () => {
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
          { id: 5, name: 'HR', code: 'hr' },
          { id: 6, name: 'Plant User', code: 'plant_user' }
        ]);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const loadModules = async () => {
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
  };

  const loadPermissions = async () => {
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
  };

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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    const newValue = type === 'checkbox' ? checked : value;
    
    setUserForm(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Clear email if role changes to non-plant roles
    if (name === 'role') {
      const selectedRole = roles.find(r => r.code === newValue);
      const isPlantRole = selectedRole ? ['plant_admin', 'plant_user'].includes(selectedRole.code) : false;
      if (!isPlantRole) {
        setUserForm(prev => ({
          ...prev,
          email: ''
        }));
      }
      // Clear department if role changes to driver
      if (selectedRole && selectedRole.code === 'driver') {
        setUserForm(prev => ({
          ...prev,
          department_id: ''
        }));
      }
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!userForm.username || !userForm.password) {
      setMessage({ type: 'error', text: 'Username and password are required' });
      return;
    }

    // Check if username already exists
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

    // Email validation for plant roles
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

    // For drivers, agency is required
    if (selectedRole.code === 'driver' && !userForm.agency_id) {
      setMessage({ type: 'error', text: 'Transporter is required for drivers' });
      return;
    }

    // PLANT IS REQUIRED FOR ALL ROLES
    if (!userForm.plant_id) {
      setMessage({ type: 'error', text: 'Plant is required for all roles' });
      return;
    }

    // Department is required for certain roles
    const needsDepartment = ['plant_admin', 'plant_user', 'super_admin', 'finance', 'hr'].includes(selectedRole.code);
    if (needsDepartment && !userForm.department_id) {
      setMessage({ type: 'error', text: 'Department is required for ' + selectedRole.name + ' role' });
      return;
    }

    // Validate plant_id exists in plants table
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
      // Prepare user data - PLANT IS ALWAYS INCLUDED
      const userData = {
        username: userForm.username.trim(),
        password: userForm.password,
        role: userForm.role,
        is_active: userForm.is_active,
        agency_id: userForm.agency_id || null,
        plant_id: userForm.plant_id, // ALWAYS include plant_id
        department_id: userForm.department_id || null,
        email: isPlantRole ? userForm.email.trim() : 'Not Applicable'
      };

      // Check if we need to use custom permissions or default ones
      let response;
      if (showPermissions && Object.keys(userPermissions).length > 0) {
        // Use createUserWithPermissions for custom permissions
        response = await api.createUserWithPermissions(userData, userPermissions);
      } else {
        // Use default permissions based on role
        response = await api.createUser(userData);
      }
      
      if (response.error) {
        console.error('API Error:', response.error);
        
        // Handle duplicate username error from backend
        if (response.error.message && response.error.message.includes('duplicate key value violates unique constraint "users_username_key"')) {
          setMessage({ type: 'error', text: 'Username already exists. Please choose a different username.' });
        } else if (response.error.message && response.error.message.includes('duplicate') && response.error.message.includes('username')) {
          setMessage({ type: 'error', text: 'Username already exists. Please choose a different username.' });
        } else {
          setMessage({ type: 'error', text: response.error.message || 'Failed to create user' });
        }
      } else {
        setMessage({ type: 'success', text: 'User created successfully!' });
        resetForm();
        setShowCreateForm(false);
        setShowPermissions(false);
        setUserPermissions({});
        loadUsers();
        
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      
      // Handle duplicate username error from catch block
      if (error.message && error.message.includes('duplicate key value violates unique constraint "users_username_key"')) {
        setMessage({ type: 'error', text: 'Username already exists. Please choose a different username.' });
      } else if (error.message && error.message.includes('duplicate') && error.message.includes('username')) {
        setMessage({ type: 'error', text: 'Username already exists. Please choose a different username.' });
      } else {
        setMessage({ type: 'error', text: 'Error creating user: ' + error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionsChange = (newPermissions) => {
    setUserPermissions(newPermissions);
  };

  const togglePermissionsSection = () => {
    const newShowPermissions = !showPermissions;
    setShowPermissions(newShowPermissions);
    
    // If showing permissions for the first time, initialize with empty permissions
    if (newShowPermissions && Object.keys(userPermissions).length === 0) {
      const defaultPerms = {};
      modules.forEach(module => {
        defaultPerms[module.code] = [];
      });
      setUserPermissions(defaultPerms);
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

  // Reset form function
  const resetForm = () => {
  const currentUser = getCurrentUser(); // Get current logged in user
  
  setUserForm({
    username: '',
    password: '',
    email: '',
    agency_id: '',
    // If current user is HR/Finance, auto-set the plant_id from their own data
    plant_id: (currentUserRoleCode === 'hr' || currentUserRoleCode === 'finance') 
               ? currentUser.plant_id 
               : '',
    department_id: '',
    role: 'driver',
    is_active: true
  });
  setUserPermissions({});
  setShowPermissions(false);
};

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

  const getAgencyPlantName = (agencyId) => {
    if (!agencyId) return 'N/A';
    const agency = agencies.find(a => a.id === agencyId);
    if (!agency || !agency.plant_id) return 'N/A';
    return getPlantName(agency.plant_id);
  };

  const getAgencyPlantLocation = (agencyId) => {
    if (!agencyId) return 'N/A';
    const agency = agencies.find(a => a.id === agencyId);
    if (!agency || !agency.plant_id) return 'N/A';
    return getPlantLocation(agency.plant_id);
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

  const currentUser = getCurrentUser();
  const currentUserRoleCode = currentUser.role;

  // Filter roles based on current user's permissions
  const getAvailableRoles = () => {
    // Super Admin can create all roles except admin
    if (currentUserRoleCode === 'admin') {
      return roles.filter(role => role.code !== 'admin');
    }
    
    // Plant Admin can create plant_user and driver roles
    if (currentUserRoleCode === 'plant_admin') {
      return roles.filter(role => ['plant_user', 'driver'].includes(role.code));
    }
    
    // Finance users can create drivers only
    if (currentUserRoleCode === 'finance') {
      return roles.filter(role => role.code === 'driver');
    }
    
    // HR users can create drivers and plant_user
    if (currentUserRoleCode === 'hr') {
      return roles.filter(role => ['driver', 'plant_user'].includes(role.code));
    }
    
    // Default: only driver role
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
    return ['plant_admin', 'plant_user', 'super_admin', 'finance', 'hr'].includes(roleCode);
  };

  // Check if a role requires plant - NOW TRUE FOR ALL ROLES
  const roleRequiresPlant = (roleCode) => {
    return true; // Plant is required for ALL roles
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
      </ AdminNavigation>
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
            disabled={currentUserRoleCode === 'finance'} // Finance can only view, not create
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

                    {/* Email Field - Only for roles that require it */}
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

                    {/* Department Selection */}
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

                    {/* Transporter Selection */}
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

                    {/* Plant Selection - FOR ALL ROLES */}
                    <div className={styles.formGroup}>
                      <label>
                        Plant *
                      </label>
                      <select
                        name="plant_id"
                        value={userForm.plant_id}
                        onChange={handleInputChange}
                        required
                        disabled={loading || currentUserRoleCode === 'finance' || currentUserRoleCode === 'hr'}
                      >
                        <option value="">Select Plant</option>
                        {plants.map(plant => (
                          <option key={plant.id} value={plant.id}>
                            {plant.location}
                          </option>
                        ))}
                      </select>
                      <small className={styles.helperText}>
                        Required for all users
                      </small>
                      {(currentUserRoleCode === 'finance' || currentUserRoleCode === 'hr') && (
                        <small className={styles.helperText}>
                          Auto-assigned to your plant
                        </small>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Module Permissions</h3>
                    <button
                      type="button"
                      className={`${styles.toggleButton} ${showPermissions ? styles.active : ''}`}
                      onClick={togglePermissionsSection}
                      disabled={currentUserRoleCode === 'finance' || currentUserRoleCode === 'hr'}
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
                        : (currentUserRoleCode === 'finance' || currentUserRoleCode === 'hr') 
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
                        <span className={`${styles.status} ${user.is_active ? styles.active : styles.inactive}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {currentUserRoleCode !== 'finance' && (
                        <td>
                          <button
                            className={`${styles.toggleBtn} ${user.is_active ? styles.deactivate : styles.activate}`}
                            onClick={() => handleToggleActive(user.id, user.is_active)}
                            disabled={currentUserRoleCode === 'hr'} // HR can't toggle status
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
    </ AdminNavigation>
  );
};

export default UserManagement;