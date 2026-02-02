import { createClient } from '@supabase/supabase-js';

// Singleton pattern to prevent multiple instances
let supabaseInstance = null;

const getSupabaseClient = () => {
  if (!supabaseInstance) {
    const supabaseUrl = 'https://qhtfjvzwiibedqinsqgl.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFodGZqdnp3aWliZWRxaW5zcWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyODM0NDIsImV4cCI6MjA3NTg1OTQ0Mn0.Gcy5xzqHL_sN_BzRNadaLVU20i2-mhomhdHpZQtp8xw';
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
};

const supabase = getSupabaseClient();

const MAPMYINDIA_API_KEY = '8b8a24aa829d919051bce41caee609af';

// CAPTCHA verification function
const verifyCaptcha = async (token) => {
  try {
    console.log('CAPTCHA token received:', token);
   
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: CAPTCHA verification bypassed');
      return true;
    }

    const response = await fetch('/api/verify-captcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json();
    return data.success === true;
   
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return false;
  }
};

// Common login logic
const commonLogin = async (credentials) => {
  try {
    console.log('🔐 Login attempt for:', credentials.username);

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', credentials.username)
      .eq('password', credentials.password)
      .eq('is_active', true)
      .single();

    if (userError) {
      console.log('❌ Database query error:', userError);
      return { data: null, error: userError };
    }

    if (!userData) {
      console.log('❌ No user found with provided credentials');
      return {
        data: null,
        error: { message: 'Invalid credentials or inactive account' }
      };
    }

    console.log('✅ User found:', userData);

    let plantName = 'N/A';
    let plantLocation = 'N/A';
    let plantId = userData.plant_id;
    let transporterName = null;

    if (userData.role === 'plant_admin' && userData.plant_id) {
      console.log('🏭 Fetching plant details for plant admin');
      const { data: plantData, error: plantError } = await supabase
        .from('plants')
        .select('name, location')
        .eq('id', userData.plant_id)
        .single();

      if (!plantError && plantData) {
        plantName = plantData.name;
        plantLocation = plantData.location;
        console.log('✅ Plant details found:', plantData);
      }
    }
    else if (userData.role === 'driver' && userData.agency_id) {
      console.log('🚚 Fetching agency details for driver');
      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .select('name, plant_id, plants(name, location)')
        .eq('id', userData.agency_id)
        .single();

      if (!agencyError && agencyData) {
        transporterName = agencyData.name;
        plantId = agencyData.plant_id;
       
        if (agencyData.plants) {
          plantName = agencyData.plants.name;
          plantLocation = agencyData.plants.location;
        }
      }
    }

    const token = btoa(JSON.stringify({
      userId: userData.id,
      username: userData.username,
      agency_id: userData.agency_id,
      plant: plantName,
      plant_location: plantLocation,
      plant_id: plantId,
      transporter_name: transporterName,
      role: userData.role,
      timestamp: Date.now()
    }));

    console.log('✅ Login successful for user:', userData.username);
   
    return {
      data: {
        success: true,
        token,
        user: {
          id: userData.id,
          username: userData.username,
          agency_id: userData.agency_id,
          plant: plantName,
          plant_location: plantLocation,
          plant_id: plantId,
          transporter_name: transporterName,
          role: userData.role
        }
      },
      error: null
    };
  } catch (error) {
    console.error('💥 Exception in commonLogin:', error);
    return { data: null, error };
  }
};

export const generateDeviceId = () => {
  const storedDeviceId = localStorage.getItem('deviceId');
  if (storedDeviceId) {
    return storedDeviceId;
  }

  const fingerprintComponents = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency || 'unknown',
    window.screen.width + 'x' + window.screen.height,
    new Date().getTimezoneOffset(),
    !!navigator.cookieEnabled,
    !!navigator.javaEnabled && navigator.javaEnabled(),
  ].join('|');

  let hash = 0;
  for (let i = 0; i < fingerprintComponents.length; i++) {
    const char = fingerprintComponents.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const deviceId = 'device_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
 
  localStorage.setItem('deviceId', deviceId);
  console.log('Generated new device ID:', deviceId);
 
  return deviceId;
};

export const getDeviceId = () => {
  return generateDeviceId();
};

export const getAddressFromCoordinates = async (lat, lng) => {
  try {
    console.log('Getting address for coordinates:', lat, lng);
   
    const response = await fetch(
      `https://apis.mapmyindia.com/advancedmaps/v1/${MAPMYINDIA_API_KEY}/rev_geocode?lat=${lat}&lng=${lng}`
    );
   
    if (response.ok) {
      const data = await response.json();
      console.log('MapMyIndia API response:', data);
     
      if (data && data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
    }
   
    return await getSimpleLocationDescription(lat, lng);
   
  } catch (error) {
    console.error('Error getting address from MapMyIndia API:', error);
    return await getSimpleLocationDescription(lat, lng);
  }
};

const getSimpleLocationDescription = async (lat, lng) => {
  const cities = [
    { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
    { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
    { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
    { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  ];
 
  let nearestCity = 'Unknown Location';
  let minDistance = Infinity;
 
  cities.forEach(city => {
    const distance = Math.sqrt(
      Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestCity = city.name;
    }
  });
 
  return `Near ${nearestCity} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
};

export const api = {
  // ========== SUPABASE CLIENT ==========
  supabase: supabase,

  // ========== SUPPLIER METHODS ==========
  getSuppliers: async () => {
    try {
      console.log('🏢 Fetching suppliers...');
      const { data, error } = await supabase
        .from('vendor')
        .select('*')
        .order('created_at', { ascending: false });
     
      if (error) {
        console.error('❌ Error fetching suppliers:', error);
        return { data: null, error };
      }
     
      console.log(`✅ Suppliers fetched successfully: ${data?.length || 0} records`);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching suppliers:', error);
      return { data: null, error };
    }
  },

  createSupplier: async (supplierData) => {
    try {
      console.log('🏢 Creating supplier:', supplierData);
      const { data, error } = await supabase
        .from('vendor')
        .insert([supplierData])
        .select()
        .single();
     
      if (error) {
        console.error('❌ Error creating supplier:', error);
        return { data: null, error };
      }
     
      console.log('✅ Supplier created successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception creating supplier:', error);
      return { data: null, error };
    }
  },

  updateSupplier: async (supplierId, supplierData) => {
    try {
      console.log('🔄 Updating supplier:', supplierId);
      const { data, error } = await supabase
        .from('vendor')
        .update(supplierData)
        .eq('id', supplierId)
        .select()
        .single();
     
      if (error) {
        console.error('❌ Error updating supplier:', error);
        return { data: null, error };
      }
     
      console.log('✅ Supplier updated successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception updating supplier:', error);
      return { data: null, error };
    }
  },

  deleteSupplier: async (supplierId) => {
    try {
      console.log('🗑️ Deleting supplier:', supplierId);
      const { data, error } = await supabase
        .from('vendor')
        .delete()
        .eq('id', supplierId);
     
      if (error) {
        console.error('❌ Error deleting supplier:', error);
        return { data: null, error };
      }
     
      console.log('✅ Supplier deleted successfully');
      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('💥 Exception deleting supplier:', error);
      return { data: null, error };
    }
  },

  // ========== DEPARTMENT METHODS ==========
  getDepartments: async () => {
    try {
      console.log('🏢 Fetching departments...');
      const { data, error } = await supabase
        .from('department')
        .select('*')
        .order('name');
     
      if (error) {
        console.error('❌ Error fetching departments:', error);
        return { data: null, error };
      }
     
      console.log(`✅ Departments fetched successfully: ${data?.length || 0} records`);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching departments:', error);
      return { data: null, error };
    }
  },

  getDepartmentById: async (departmentId) => {
    try {
      console.log('🔍 Fetching department by ID:', departmentId);
      const { data, error } = await supabase
        .from('department')
        .select('*')
        .eq('id', departmentId)
        .single();
     
      if (error) {
        console.error('❌ Error fetching department:', error);
        return { data: null, error };
      }
     
      console.log('✅ Department fetched successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching department:', error);
      return { data: null, error };
    }
  },

  getUserById: async (userId) => {
    try {
      console.log('🔍 Fetching user by ID:', userId);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('❌ Error fetching user:', userError);
        return { data: null, error: userError };
      }
      
      console.log('✅ User basic data:', {
        id: userData.id,
        username: userData.username,
        role: userData.role,
        department_id: userData.department_id
      });
      
      let departmentData = null;
      
      if (userData.department_id) {
        console.log('🔍 Fetching department for ID:', userData.department_id);
        const { data: deptData, error: deptError } = await supabase
          .from('department')
          .select('*')
          .eq('id', userData.department_id)
          .single();
          
        if (!deptError && deptData) {
          departmentData = deptData;
          console.log('✅ Department data found:', deptData);
        } else {
          console.log('⚠️ No department found for ID:', userData.department_id);
        }
      } else {
        console.log('ℹ️ User has no department_id');
      }
      
      const combinedData = {
        ...userData,
        department: departmentData,
        department_name: departmentData ? departmentData.name : null
      };
      
      console.log('🎯 Final combined user data:', {
        id: combinedData.id,
        username: combinedData.username,
        role: combinedData.role,
        department_id: combinedData.department_id,
        department: combinedData.department,
        department_name: combinedData.department_name
      });
      
      return { data: combinedData, error: null };
    } catch (error) {
      console.error('💥 Exception fetching user:', error);
      return { data: null, error };
    }
  },

  getUsers: async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          department:department_id (
            id,
            name,
            code,
            description
          ),
          agencies (
            name,
            plant_id,
            plants (
              name,
              location
            )
          )
        `)
        .order('username');

      if (error) {
        console.error('Error fetching users:', error);
        return { data: null, error };
      }
     
      return { data, error: null };
    } catch (error) {
      console.error('Exception fetching users:', error);
      return { data: null, error };
    }
  },

  createUser: async (userData) => {
    try {
      console.log('🔧 CREATE USER API CALL - START');
      console.log('Received user data:', userData);
     
      let plant_id = userData.plant_id || null;

      if (userData.role === 'plant_admin' && userData.plant_id) {
        console.log('👤 Plant Admin user - using provided plant_id:', userData.plant_id);
        plant_id = userData.plant_id;
      }
      else if (userData.agency_id && !plant_id) {
        console.log('🚚 Driver user - fetching plant_id for agency:', userData.agency_id);
       
        const { data: agency, error: agencyError } = await supabase
          .from('agencies')
          .select('plant_id')
          .eq('id', userData.agency_id)
          .single();
       
        if (agencyError) {
          console.error('❌ Error fetching agency:', agencyError);
          return { data: null, error: agencyError };
        }
       
        if (agency && agency.plant_id) {
          plant_id = agency.plant_id;
          console.log('✅ Auto-set plant_id from agency:', plant_id);
        }
      }

      const userWithPlant = {
        username: userData.username,
        password: userData.password,
        agency_id: userData.agency_id || null,
        plant_id: plant_id,
        role: userData.role || 'driver',
        department_id: userData.department_id || null,
        is_active: userData.is_active !== undefined ? userData.is_active : true,
        created_by: userData.created_by || null,
        created_at: new Date().toISOString()
      };

      console.log('📦 Final user data to insert:', userWithPlant);

      const { data, error } = await supabase
        .from('users')
        .insert([userWithPlant])
        .select(`
          *,
          department:department_id (
            id,
            name,
            code,
            description
          ),
          agencies (
            name,
            plant_id,
            plants (
              name,
              location
            )
          )
        `)
        .single();
     
      if (error) {
        console.error('❌ Error inserting user:', error);
        return { data: null, error };
      }

      console.log('✅ User created successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception creating user:', error);
      return { data: null, error };
    }
  },

  updateUser: async (userId, userData) => {
    try {
      console.log('Updating user:', userId, 'with data:', userData);
     
      let plant_id = userData.plant_id;

      if (userData.agency_id && !plant_id) {
        console.log('Fetching plant_id for updated agency:', userData.agency_id);
       
        const { data: agency, error: agencyError } = await supabase
          .from('agencies')
          .select('plant_id')
          .eq('id', userData.agency_id)
          .single();
       
        if (agencyError) {
          console.error('Error fetching agency:', agencyError);
          return { data: null, error: agencyError };
        }
       
        if (agency && agency.plant_id) {
          plant_id = agency.plant_id;
          console.log('Auto-set plant_id to:', plant_id);
        }
      }

      const updateData = { ...userData };
      if (plant_id !== undefined) {
        updateData.plant_id = plant_id;
      }

      console.log('Final update data:', updateData);

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();
     
      if (error) {
        console.error('Error updating user:', error);
        return { data: null, error };
      }
     
      console.log('User updated successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('Exception updating user:', error);
      return { data: null, error };
    }
  },

  // ========== MODULE & PERMISSION METHODS ==========
  getModules: async () => {
    try {
      console.log('📦 Fetching modules...');
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .order('sort_order');
     
      if (error) {
        console.error('❌ Error fetching modules:', error);
        return { data: null, error };
      }
     
      console.log(`✅ Modules fetched: ${data?.length || 0}`);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching modules:', error);
      return { data: null, error };
    }
  },

  getPermissions: async () => {
    try {
      console.log('🔐 Fetching permissions...');
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('name');
     
      if (error) {
        console.error('❌ Error fetching permissions:', error);
        return { data: null, error };
      }
     
      console.log(`✅ Permissions fetched: ${data?.length || 0}`);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching permissions:', error);
      return { data: null, error };
    }
  },

  getRolePermissions: async (roleId) => {
    try {
      console.log('🔍 Fetching permissions for role ID:', roleId);
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          *,
          modules (*),
          permissions (*)
        `)
        .eq('role_id', roleId);
     
      if (error) {
        console.error('❌ Error fetching role permissions:', error);
        return { data: null, error };
      }
     
      console.log(`✅ Role permissions fetched: ${data?.length || 0}`);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching role permissions:', error);
      return { data: null, error };
    }
  },

  updateRolePermissions: async (roleId, permissions) => {
    try {
      console.log('🔄 Updating permissions for role ID:', roleId);
      console.log('Permissions data:', permissions);
      
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);
     
      if (deleteError) {
        console.error('❌ Error deleting old permissions:', deleteError);
        return { data: null, error: deleteError };
      }
      
      const permissionsToInsert = [];
      
      Object.keys(permissions).forEach(moduleCode => {
        const modulePermissions = permissions[moduleCode];
        if (modulePermissions && modulePermissions.length > 0) {
          modulePermissions.forEach(permissionCode => {
            permissionsToInsert.push({
              role_id: roleId,
              module_code: moduleCode,
              permission_code: permissionCode
            });
          });
        }
      });
      
      if (permissionsToInsert.length === 0) {
        console.log('⚠️ No permissions to insert');
        return { data: { success: true, message: 'No permissions to update' }, error: null };
      }
      
      const { data, error } = await supabase
        .from('role_permissions')
        .insert(permissionsToInsert)
        .select();
     
      if (error) {
        console.error('❌ Error inserting permissions:', error);
        return { data: null, error };
      }
     
      console.log('✅ Role permissions updated successfully');
      return { data: { success: true, count: permissionsToInsert.length }, error: null };
    } catch (error) {
      console.error('💥 Exception updating role permissions:', error);
      return { data: null, error };
    }
  },

  createUserWithPermissions: async (userData, permissions) => {
    try {
      console.log('🔧 CREATE USER WITH PERMISSIONS - START');
      
      const userResponse = await api.createUser(userData);
      
      if (userResponse.error) {
        return userResponse;
      }
      
      const userId = userResponse.data.id;
      const roleCode = userData.role;
      
      console.log('✅ User created with ID:', userId);
      
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('code', roleCode)
        .single();
      
      if (roleError || !roleData) {
        console.error('❌ Error getting role ID:', roleError);
        return userResponse;
      }
      
      const roleId = roleData.id;
      
      if (permissions && Object.keys(permissions).length > 0) {
        console.log('🔧 Setting custom permissions for user role');
        await api.updateRolePermissions(roleId, permissions);
      }
      
      return userResponse;
    } catch (error) {
      console.error('💥 Exception creating user with permissions:', error);
      return { data: null, error };
    }
  },

  // ========== ROLE MANAGEMENT METHODS ==========
  getRoles: async () => {
    try {
      console.log('👥 Fetching roles...');
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');
     
      if (error) {
        console.error('❌ Error fetching roles:', error);
        return { data: null, error };
      }
     
      console.log(`✅ Roles fetched successfully: ${data?.length || 0} records`);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching roles:', error);
      return { data: null, error };
    }
  },

  getRoleById: async (roleId) => {
    try {
      console.log('🔍 Fetching role by ID:', roleId);
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single();
     
      if (error) {
        console.error('❌ Error fetching role:', error);
        return { data: null, error };
      }
     
      console.log('✅ Role fetched successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching role:', error);
      return { data: null, error };
    }
  },

  getRoleByCode: async (roleCode) => {
    try {
      console.log('🔍 Fetching role by code:', roleCode);
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('code', roleCode)
        .single();
     
      if (error) {
        console.error('❌ Error fetching role by code:', error);
        return { data: null, error };
      }
     
      console.log('✅ Role fetched successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching role by code:', error);
      return { data: null, error };
    }
  },

  createRole: async (roleData) => {
    try {
      console.log('👥 Creating role:', roleData);
      const { data, error } = await supabase
        .from('roles')
        .insert([{
          name: roleData.name,
          code: roleData.code,
          description: roleData.description,
          permissions: roleData.permissions || {},
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
     
      if (error) {
        console.error('❌ Error creating role:', error);
        return { data: null, error };
      }
     
      console.log('✅ Role created successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception creating role:', error);
      return { data: null, error };
    }
  },

  updateRole: async (roleId, roleData) => {
    try {
      console.log('🔄 Updating role:', roleId);
      const { data, error } = await supabase
        .from('roles')
        .update({
          name: roleData.name,
          code: roleData.code,
          description: roleData.description,
          permissions: roleData.permissions,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId)
        .select()
        .single();
     
      if (error) {
        console.error('❌ Error updating role:', error);
        return { data: null, error };
      }
     
      console.log('✅ Role updated successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception updating role:', error);
      return { data: null, error };
    }
  },

  deleteRole: async (roleId) => {
    try {
      console.log('🗑️ Deleting role:', roleId);
      
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('role', roleId)
        .limit(1);
      
      if (usersError) {
        console.error('Error checking role users:', usersError);
        return { data: null, error: usersError };
      }
      
      if (users && users.length > 0) {
        return {
          data: null,
          error: { message: 'Cannot delete role. It has users assigned to it.' }
        };
      }
      
      const { data, error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);
     
      if (error) {
        console.error('❌ Error deleting role:', error);
        return { data: null, error };
      }
     
      console.log('✅ Role deleted successfully');
      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('💥 Exception deleting role:', error);
      return { data: null, error };
    }
  },

  // ========== AUTHENTICATION METHODS ==========
  login: async (credentials) => {
    try {
      console.log('Driver login attempt with credentials:', {
        username: credentials.username,
        hasCaptcha: !!credentials.captchaToken
      });

      if (credentials.captchaToken) {
        console.log('Verifying CAPTCHA...');
        const captchaVerified = await verifyCaptcha(credentials.captchaToken);
       
        if (!captchaVerified) {
          console.log('CAPTCHA verification failed');
          return {
            data: null,
            error: { message: 'CAPTCHA verification failed. Please try again.' }
          };
        }
        console.log('CAPTCHA verification successful');
      } else {
        console.log('No CAPTCHA token provided');
        return {
          data: null,
          error: { message: 'CAPTCHA verification required. Please complete the CAPTCHA.' }
        };
      }

      return await commonLogin(credentials);
    } catch (error) {
      console.error('Driver login API error:', error);
      return { data: null, error };
    }
  },

  adminLogin: async (credentials) => {
    try {
      console.log('Admin login attempt with credentials:', {
        username: credentials.username
      });

      console.log('Admin login - CAPTCHA verification bypassed');
      return await commonLogin(credentials);
    } catch (error) {
      console.error('Admin login API error:', error);
      return { data: null, error };
    }
  },

  verifyToken: async (token) => {
    try {
      const decoded = JSON.parse(atob(token));
      const currentTime = Date.now();
     
      if (currentTime - decoded.timestamp > 24 * 60 * 60 * 1000) {
        return { valid: false };
      }

      return { valid: true, user: decoded };
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false };
    }
  },

  // ========== RATE MASTER METHODS ==========
  getRates: async () => {
    try {
      console.log('💰 Fetching rate master entries...');
     
      const { data, error } = await supabase
        .from('rate_master')
        .select(`
          *,
          agencies (
            name,
            code,
            plant_id,
            plants (
              name,
              location
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching rates:', error);
        return { data: null, error };
      }
     
      console.log('✅ Rates fetched successfully:', data?.length || 0);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching rates:', error);
      return { data: null, error };
    }
  },

  createRate: async (rateData) => {
    try {
      console.log('💰 Creating rate master entry:', rateData);
     
      const { data, error } = await supabase
        .from('rate_master')
        .insert([{
          type: rateData.type,
          agency_id: rateData.agency_id,
          tone: parseFloat(rateData.tone),
          min_km: rateData.min_km ? parseFloat(rateData.min_km) : null,
          max_km: rateData.max_km ? parseFloat(rateData.max_km) : null,
          rate: parseFloat(rateData.rate),
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating rate:', error);
        return { data: null, error };
      }
     
      console.log('✅ Rate created successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception creating rate:', error);
      return { data: null, error };
    }
  },

  updateRate: async (rateId, rateData) => {
    try {
      console.log('🔄 Updating rate:', rateId, 'with data:', rateData);
      
      const { data, error } = await supabase
        .from('rate_master')
        .update({
          type: rateData.type,
          agency_id: rateData.agency_id,
          tone: parseFloat(rateData.tone),
          min_km: rateData.min_km ? parseFloat(rateData.min_km) : null,
          max_km: rateData.max_km ? parseFloat(rateData.max_km) : null,
          rate: parseFloat(rateData.rate),
          updated_at: new Date().toISOString()
        })
        .eq('id', rateId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating rate:', error);
        return { data: null, error };
      }
      
      console.log('✅ Rate updated successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception updating rate:', error);
      return { data: null, error };
    }
  },

  deleteRate: async (rateId) => {
    try {
      console.log('🗑️ Deleting rate:', rateId);
      
      const { data, error } = await supabase
        .from('rate_master')
        .delete()
        .eq('id', rateId);
      
      if (error) {
        console.error('❌ Error deleting rate:', error);
        return { data: null, error };
      }
      
      console.log('✅ Rate deleted successfully');
      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('💥 Exception deleting rate:', error);
      return { data: null, error };
    }
  },

  // ========== DASHBOARD TRIPS METHODS ==========
  getAllTrips: async () => {
    try {
      console.log('🔍 Fetching all trips for admin...');
     
      const { data, error } = await supabase
        .from('Trips')
        .select(`
          *,
          plant:plants(name, location),
          vehicle:vehicles(vehicle_number, vehicle_type, capacity),
          agency:agencies(name, code)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching all trips:', error);
        return { data: [], error };
      }

      console.log('✅ All trips fetched successfully:', data?.length || 0);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception in getAllTrips:', error);
      return { data: [], error };
    }
  },

  getTripsByPlant: async (plantId) => {
    try {
      console.log('🔍 Fetching trips for plant ID:', plantId);
     
      const { data: trips, error: tripsError } = await supabase
        .from('Trips')
        .select('*')
        .eq('plant_id', plantId)
        .order('created_at', { ascending: false });

      if (tripsError) {
        console.error('❌ Error fetching trips:', tripsError);
        return { data: [], error: tripsError };
      }

      if (!trips || trips.length === 0) {
        return { data: [], error: null };
      }

      const { data: plant, error: plantError } = await supabase
        .from('plants')
        .select('id, name, location, code')
        .eq('id', plantId)
        .single();

      console.log('🏭 Plant details:', plant);

      const vehicleIds = trips.map(trip => trip.vehicle_id).filter(Boolean);
      let vehicles = [];
     
      if (vehicleIds.length > 0) {
        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('id, vehicle_number, vehicle_type, capacity')
          .in('id', vehicleIds);
       
        if (!vehiclesError) {
          vehicles = vehiclesData || [];
        }
      }

      const agencyIds = trips.map(trip => trip.agency_id).filter(Boolean);
      let agencies = [];
     
      if (agencyIds.length > 0) {
        const { data: agenciesData, error: agenciesError } = await supabase
          .from('agencies')
          .select('id, name, code')
          .in('id', agencyIds);
       
        if (!agenciesError) {
          agencies = agenciesData || [];
        }
      }

      const enrichedTrips = trips.map(trip => ({
        ...trip,
        plants: plant ? {
          id: plant.id,
          name: plant.name,
          location: plant.location,
          code: plant.code
        } : null,
        plant: plant ? plant.name : null,
        plant_name: plant ? plant.name : null,
        plant_location: plant ? plant.location : null,
        plant_data: plant,
       
        vehicle: vehicles.find(v => v.id === trip.vehicle_id) || null,
        vehicles: vehicles.find(v => v.id === trip.vehicle_id) || null,
       
        agency: agencies.find(a => a.id === trip.agency_id) || null,
        agencies: agencies.find(a => a.id === trip.agency_id) || null
      }));

      console.log('✅ Plant trips fetched and enriched:', enrichedTrips.length);
      return { data: enrichedTrips, error: null };

    } catch (error) {
      console.error('💥 Exception in getTripsByPlant:', error);
      return { data: [], error };
    }
  },

  // ========== AGENCY METHODS ==========
  getAgencies: async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select(`
          *,
          plants (
            name,
            location,
            code
          )
        `)
        .order('name');
     
      if (error) {
        console.error('Error fetching agencies:', error);
        return { data: null, error };
      }
     
      return { data, error: null };
    } catch (error) {
      console.error('Exception fetching agencies:', error);
      return { data: null, error };
    }
  },

  getAgenciesByPlant: async (plant_id) => {
    try {
      console.log('🔍 Fetching agencies for plant ID:', plant_id);
     
      const { data, error } = await supabase
        .from('agencies')
        .select(`
          *,
          plants (
            name,
            location,
            code
          )
        `)
        .eq('plant_id', plant_id)
        .order('name');
     
      if (error) {
        console.error('❌ Error fetching plant agencies:', error);
        return { data: null, error };
      }
     
      console.log('✅ Plant agencies fetched:', data?.length || 0);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Exception fetching plant agencies:', error);
      return { data: null, error };
    }
  },

  createAgency: async (agencyData) => {
    try {
      console.log('🏢 Creating agency:', agencyData);
     
      const { data, error } = await supabase
        .from('agencies')
        .insert([{
          name: agencyData.name,
          code: agencyData.code,
          email: agencyData.email,
          plant_id: agencyData.plant_id
        }])
        .select(`
          *,
          plants (
            name,
            location,
            code
          )
        `)
        .single();
     
      if (error) {
        console.error('❌ Error creating agency:', error);
        return { data: null, error };
      }
     
      console.log('✅ Agency created successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception creating agency:', error);
      return { data: null, error };
    }
  },

  updateAgency: async (agencyId, agencyData) => {
    try {
      console.log('🔄 Updating agency:', agencyId, 'with data:', agencyData);
     
      const { data, error } = await supabase
        .from('agencies')
        .update({
          name: agencyData.name,
          code: agencyData.code,
          email: agencyData.email,
          plant_id: agencyData.plant_id
        })
        .eq('id', agencyId)
        .select(`
          *,
          plants (
            name,
            location,
            code
          )
        `)
        .single();
     
      if (error) {
        console.error('❌ Error updating agency:', error);
        return { data: null, error };
      }
     
      console.log('✅ Agency updated successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception updating agency:', error);
      return { data: null, error };
    }
  },

  deleteAgency: async (agencyId) => {
    try {
      console.log('🗑️ Deleting agency:', agencyId);
     
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('agency_id', agencyId)
        .limit(1);
     
      if (vehiclesError) {
        console.error('Error checking agency vehicles:', vehiclesError);
        return { data: null, error: vehiclesError };
      }
     
      if (vehicles && vehicles.length > 0) {
        return {
          data: null,
          error: { message: 'Cannot delete agency. It has vehicles assigned to it.' }
        };
      }
     
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('agency_id', agencyId)
        .limit(1);
     
      if (usersError) {
        console.error('Error checking agency users:', usersError);
        return { data: null, error: usersError };
      }
     
      if (users && users.length > 0) {
        return {
          data: null,
          error: { message: 'Cannot delete agency. It has users assigned to it.' }
        };
      }
     
      const { data, error } = await supabase
        .from('agencies')
        .delete()
        .eq('id', agencyId);
     
      if (error) {
        console.error('❌ Error deleting agency:', error);
        return { data: null, error };
      }
     
      console.log('✅ Agency deleted successfully');
      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('💥 Exception deleting agency:', error);
      return { data: null, error };
    }
  },

  // ========== VEHICLE METHODS ==========
  getVehicles: async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          agencies (
            name,
            plant_id,
            plants (
              name,
              location
            )
          )
        `)
        .order('created_at', { ascending: false });
     
      if (error) {
        console.error('Error fetching vehicles:', error);
        return { data: null, error };
      }
     
      return { data, error: null };
    } catch (error) {
      console.error('Exception fetching vehicles:', error);
      return { data: null, error };
    }
  },

  getVehiclesByAgency: async (agencyId) => {
    try {
      console.log('🚗 Fetching vehicles for agency ID:', agencyId);
     
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          agencies (
            name,
            plant_id,
            plants (
              name,
              location
            )
          )
        `)
        .eq('agency_id', agencyId)
        .order('vehicle_number');
     
      if (error) {
        console.error('❌ Error fetching agency vehicles:', error);
        return { data: null, error };
      }
     
      console.log('✅ Agency vehicles fetched:', data?.length || 0);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Exception fetching agency vehicles:', error);
      return { data: null, error };
    }
  },

  createVehicle: async (vehicleData) => {
    try {
      console.log('🚗 CREATE VEHICLE API - START');
      console.log('Received agency_id:', vehicleData.agency_id, 'Type:', typeof vehicleData.agency_id);

      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('id, name, plant_id')
        .eq('id', vehicleData.agency_id)
        .single();

      if (agencyError) {
        console.error('❌ Agency not found:', agencyError);
        return {
          data: null,
          error: { message: 'Agency not found.' }
        };
      }

      const vehicleInsertData = {
        agency_id: vehicleData.agency_id,
        vehicle_number: vehicleData.vehicle_number,
        vehicle_type: vehicleData.vehicle_type,
        capacity: vehicleData.capacity,
        status: vehicleData.status,
        created_at: new Date().toISOString()
      };

      console.log('📦 Creating vehicle with:', vehicleInsertData);

      const { data, error } = await supabase
        .from('vehicles')
        .insert([vehicleInsertData])
        .select()
        .single();
     
      if (error) {
        console.error('❌ Error creating vehicle:', error);
        return { data: null, error };
      }

      console.log('✅ Vehicle created successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception creating vehicle:', error);
      return { data: null, error };
    }
  },

  updateVehicle: async (vehicleId, vehicleData) => {
    try {
      console.log('🔄 Updating vehicle:', vehicleId, 'with data:', vehicleData);
     
      const { data, error } = await supabase
        .from('vehicles')
        .update({
          agency_id: vehicleData.agency_id,
          vehicle_number: vehicleData.vehicle_number,
          vehicle_type: vehicleData.vehicle_type,
          capacity: vehicleData.capacity,
          status: vehicleData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', vehicleId)
        .select(`
          *,
          agencies (
            name,
            plant_id,
            plants (
              name,
              location
            )
          )
        `)
        .single();
     
      if (error) {
        console.error('❌ Error updating vehicle:', error);
        return { data: null, error };
      }
     
      console.log('✅ Vehicle updated successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception updating vehicle:', error);
      return { data: null, error };
    }
  },

  deleteVehicle: async (vehicleId) => {
    try {
      console.log('🗑️ Deleting vehicle:', vehicleId);
     
      const { data: activeTrips, error: tripsError } = await supabase
        .from('Trips')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .eq('status', 'active')
        .limit(1);
     
      if (tripsError) {
        console.error('Error checking vehicle trips:', tripsError);
        return { data: null, error: tripsError };
      }
     
      if (activeTrips && activeTrips.length > 0) {
        return {
          data: null,
          error: { message: 'Cannot delete vehicle. It has active trips.' }
        };
      }
     
      const { data, error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);
     
      if (error) {
        console.error('❌ Error deleting vehicle:', error);
        return { data: null, error };
      }
     
      console.log('✅ Vehicle deleted successfully');
      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('💥 Exception deleting vehicle:', error);
      return { data: null, error };
    }
  },

  updateVehicleStatus: async (vehicleId, status) => {
    try {
      console.log('🔄 Updating vehicle status:', { vehicleId, status });
     
      const { data, error } = await supabase
        .from('vehicles')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', vehicleId)
        .select()
        .single();
     
      if (error) {
        console.error('❌ Error updating vehicle status:', error);
        return { data: null, error };
      }
     
      console.log('✅ Vehicle status updated successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception updating vehicle status:', error);
      return { data: null, error };
    }
  },

  getVehiclesByPlantAlternative: async (plantId) => {
    try {
      console.log('🔍 Fetching vehicles for plant ID (alternative):', plantId);
     
      const { data: agencies, error: agenciesError } = await supabase
        .from('agencies')
        .select('id')
        .eq('plant_id', plantId);
     
      if (agenciesError) {
        console.error('Error fetching plant agencies:', agenciesError);
        return { data: null, error: agenciesError };
      }
     
      if (!agencies || agencies.length === 0) {
        console.log('No agencies found for plant, returning empty vehicles');
        return { data: [], error: null };
      }
     
      const agencyIds = agencies.map(agency => agency.id);
      console.log('Agency IDs for plant:', agencyIds);
     
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          *,
          agencies (
            name,
            plant_id,
            plants (
              name,
              location
            )
          )
        `)
        .in('agency_id', agencyIds)
        .order('vehicle_number');
     
      if (vehiclesError) {
        console.error('Error fetching vehicles for agencies:', vehiclesError);
        return { data: null, error: vehiclesError };
      }
     
      console.log('✅ Plant vehicles fetched (alternative):', vehicles?.length || 0);
      return { data: vehicles, error: null };
    } catch (error) {
      console.error('Exception in alternative method:', error);
      return { data: null, error };
    }
  },

  // ========== TRIP MANAGEMENT METHODS ==========
  checkDeviceActiveTrip: async (deviceId) => {
    try {
      console.log('🔍 Checking active trip for device ID:', deviceId);
      
      const { data, error } = await supabase
        .from('Trips')
        .select('*')
        .eq('device_id', deviceId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Error checking device active trip:', error);
        
        if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
          return { data: null, error: null };
        }
        
        return { data: null, error };
      }
      
      console.log('✅ Device active trip check result:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception checking device active trip:', error);
      return { data: null, error };
    }
  },

  // UPDATED START TRIP FUNCTION
  startTrip: async (tripData) => {
    try {
      const deviceId = getDeviceId();
      console.log('🚀 START TRIP - Device ID:', deviceId);
      console.log('📋 Trip data received:', JSON.stringify(tripData, null, 2));
      
      // Check if already has active trip
      const { data: activeTrip } = await api.checkDeviceActiveTrip(deviceId);
      if (activeTrip) {
        console.error('⚠️ Device already has active trip:', activeTrip.id);
        return {
          data: null,
          error: { message: 'You already have an active trip. Please end it first.' }
        };
      }
      
      // Validate required fields
      const requiredFields = ['vehicle_id', 'plant_id', 'start_lat', 'start_lng', 'vendor_code'];
      const missingFields = requiredFields.filter(field => !tripData[field]);
      
      if (missingFields.length > 0) {
        console.error('❌ Missing required fields:', missingFields);
        return {
          data: null,
          error: { message: `Missing required fields: ${missingFields.join(', ')}` }
        };
      }
      
      const currentDate = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toISOString();
      
      // Build trip data with proper data types
      const tripInsertData = {
        agency_id: tripData.agency_id || null,
        vehicle_id: parseInt(tripData.vehicle_id) || null,
        vehicle_number: tripData.vehicle_number || null,
        plant: tripData.plant || null,
        plant_id: parseInt(tripData.plant_id) || null,
        driver_name: tripData.driver_name || null,
        driver_contact: tripData.driver_contact || null,
        start_lat: parseFloat(tripData.start_lat) || 0,
        start_lng: parseFloat(tripData.start_lng) || 0,
        start_address: tripData.start_address || null,
        Start_Date: currentDate,
        start_time: currentTime,
        status: 'active',
        device_id: deviceId,
        created_at: currentTime,
        updated_at: currentTime
      };
      
      // Add vendor data
      if (tripData.vendor_code) {
        tripInsertData.vendor_code = tripData.vendor_code.toString();
      }
      if (tripData.vendor_name) {
        tripInsertData.vendor_name = tripData.vendor_name.toString();
      }
      
      console.log('📝 Inserting trip data:', tripInsertData);
      
      const { data, error } = await supabase
        .from('Trips')
        .insert([tripInsertData])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Database error:', error);
        
        if (error.code === '23505') {
          return { data: null, error: { message: 'Duplicate trip detected.' } };
        }
        if (error.code === '23503') {
          return { data: null, error: { message: 'Invalid reference (vehicle, plant, or agency not found).' } };
        }
        if (error.message.includes('violates not-null constraint')) {
          return { data: null, error: { message: 'Missing required database fields.' } };
        }
        
        return { data: null, error: { message: error.message } };
      }
      
      console.log('✅ Trip started successfully:', data);
      return { data, error: null };
      
    } catch (error) {
      console.error('💥 Exception in startTrip:', error);
      return { 
        data: null, 
        error: { 
          message: error.message || 'Unknown error occurred while starting trip' 
        } 
      };
    }
  },

  // UPDATED END TRIP FUNCTION
  endTrip: async (tripId, endData) => {
    try {
      const deviceId = getDeviceId();
      console.log('🏁 END TRIP - Trip ID:', tripId, 'Device ID:', deviceId);
      console.log('📋 End data:', endData);
      
      const { data: trip, error: verifyError } = await supabase
        .from('Trips')
        .select('*')
        .eq('id', tripId)
        .eq('device_id', deviceId)
        .single();
      
      if (verifyError) {
        return {
          data: null,
          error: { message: 'Trip not found or you are not authorized to end this trip' }
        };
      }
      
      const currentDate = new Date().toISOString().split('T')[0];
      
      const updateData = {
        end_lat: parseFloat(endData.end_lat) || 0,
        end_lng: parseFloat(endData.end_lng) || 0,
        end_address: endData.end_address || null,
        End_Date: currentDate,
        end_time: endData.end_time || new Date().toISOString(),
        distance_km: parseFloat(endData.distance_km) || 0,
        status: 'completed',
        updated_at: new Date().toISOString()
      };

      // Add end vendor data
      if (endData.end_vendor_code) {
        updateData.end_vendor_code = endData.end_vendor_code.toString();
      }
      if (endData.end_vendor_name) {
        updateData.end_vendor_name = endData.end_vendor_name.toString();
      }

      console.log('📝 Updating trip with:', updateData);

      const { data, error } = await supabase
        .from('Trips')
        .update(updateData)
        .eq('id', tripId)
        .eq('device_id', deviceId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error ending trip:', error);
        return { data: null, error };
      }

      console.log('✅ Trip ended successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception ending trip:', error);
      return { data: null, error: { message: error.message } };
    }
  },

  getActiveTrip: async () => {
    try {
      const deviceId = getDeviceId();
      console.log('🔍 Fetching active trip for device ID:', deviceId);
      
      const { data, error } = await supabase
        .from('Trips')
        .select('*')
        .eq('device_id', deviceId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Error fetching active trip:', error);
        if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
          console.log('No active trip found for this device');
          return { data: null, error: null };
        }
        return { data: null, error };
      }
      
      console.log('✅ Active trip fetched:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching active trip:', error);
      return { data: null, error };
    }
  },

  getDeviceTrips: async () => {
    try {
      const deviceId = getDeviceId();
      
      const { data, error } = await supabase
        .from('Trips')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching device trips:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Exception fetching device trips:', error);
      return { data: null, error };
    }
  },

  // ========== PLANTS API ENDPOINTS ==========
  getPlants: async () => {
    try {
      const { data, error } = await supabase
        .from('plants')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching plants:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Exception fetching plants:', error);
      return { data: null, error };
    }
  },

  createPlant: async (plantData) => {
    try {
      const { data, error } = await supabase
        .from('plants')
        .insert([{
          name: plantData.name,
          location: plantData.location,
          code: plantData.code,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating plant:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Exception creating plant:', error);
      return { data: null, error };
    }
  },

  updatePlant: async (plant_id, plantData) => {
    try {
      const { data, error } = await supabase
        .from('plants')
        .update(plantData)
        .eq('id', plant_id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating plant:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Exception updating plant:', error);
      return { data: null, error };
    }
  },

  deletePlant: async (plant_id) => {
    try {
      const { data: agencies, error: agenciesError } = await supabase
        .from('agencies')
        .select('id')
        .eq('plant_id', plant_id)
        .limit(1);
      
      if (agenciesError) {
        console.error('Error checking plant usage:', agenciesError);
        return { data: null, error: agenciesError };
      }
      
      if (agencies && agencies.length > 0) {
        return {
          data: null,
          error: { message: 'Cannot delete plant. It is being used by one or more agencies.' }
        };
      }
      
      const { data, error } = await supabase
        .from('plants')
        .delete()
        .eq('id', plant_id);
      
      if (error) {
        console.error('Error deleting plant:', error);
        return { data: null, error };
      }
      
      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('Exception deleting plant:', error);
      return { data: null, error };
    }
  },

  getPlantById: async (plant_id) => {
    try {
      const { data, error } = await supabase
        .from('plants')
        .select('*')
        .eq('id', plant_id)
        .single();

      if (error) {
        console.error('Error fetching plant:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Exception fetching plant:', error);
      return { data: null, error };
    }
  },

  getUsersByPlant: async (plantId) => {
    try {
      console.log('👥 Fetching users for plant ID:', plantId);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('plant_id', plantId)
        .order('username');

      if (error) throw error;

      const { data: roles } = await supabase.from('roles').select('*');
      const rolesMap = {};
      roles?.forEach(r => rolesMap[r.code] = r.name);

      const enriched = data.map(u => ({
        ...u,
        role_name: rolesMap[u.role] || u.role
      }));

      return { data: enriched, error: null };
    } catch (error) {
      console.error('❌ Error in getUsersByPlant:', error);
      return { data: null, error };
    }
  },

  // ========== VENDOR METHODS ==========
  getVendors: async () => {
    try {
      console.log('🏢 Fetching all vendors...');
      const { data, error } = await supabase
        .from('vendor')
        .select('*')
        .order('vendor_name');
      
      if (error) {
        console.error('❌ Error fetching vendors:', error);
        return { data: null, error };
      }
      
      console.log(`✅ Vendors fetched successfully: ${data?.length || 0} records`);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching vendors:', error);
      return { data: null, error };
    }
  },

  getVendorsByPlant: async (plantName) => {
  try {
    console.log('🔍 Fetching vendors for plant:', plantName);
    
    const { data, error } = await supabase
      .from('vendor')
      .select('*')  // This already includes all fields
      .eq('plant', plantName)
      .order('vendor_name');
    
    if (error) {
      console.error('❌ Error fetching plant vendors:', error);
      return { data: null, error };
    }
    
    console.log(`✅ Plant vendors fetched: ${data?.length || 0} records for ${plantName}`);
    
    // Debug: Check if address is included
    if (data && data.length > 0) {
      console.log('First vendor data:', {
        name: data[0].vendor_name,
        code: data[0].vendor_code,
        address: data[0].vendor_address,
        hasAddress: !!data[0].vendor_address,
        allFields: Object.keys(data[0])
      });
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('💥 Exception fetching plant vendors:', error);
    return { data: null, error };
  }
},

  getVendorsByPlantId: async (plantId) => {
  try {
    console.log('🔍 Fetching vendors for plant ID:', plantId);
    
    const { data: plant, error: plantError } = await supabase
      .from('plants')
      .select('name')
      .eq('id', plantId)
      .single();
    
    if (plantError) {
      console.error('❌ Error fetching plant name:', plantError);
      return { data: null, error: plantError };
    }
    
    const { data: vendors, error: vendorsError } = await supabase
      .from('vendor')
      .select('*')  // Include all fields
      .eq('plant', plant.name)
      .order('vendor_name');
    
    if (vendorsError) {
      console.error('❌ Error fetching plant vendors:', vendorsError);
      return { data: null, error: vendorsError };
    }
    
    console.log(`✅ Plant vendors fetched: ${vendors?.length || 0} records for ${plant.name}`);
    
    return { data: vendors, error: null };
  } catch (error) {
    console.error('💥 Exception fetching plant vendors:', error);
    return { data: null, error };
  }
},

  // ========== BILLING METHODS ==========
  getBillings: async () => {
    try {
      console.log('💰 Fetching billing data...');
      const { data, error } = await supabase
        .from('trip_billings')
        .select('*');

      if (error) {
        console.error('❌ Error fetching billings:', error);
        return { data: [], error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception fetching billings:', error);
      return { data: [], error };
    }
  },

  saveBilling: async (billingData) => {
    try {
      console.log('💾 Saving billing data:', billingData);
      
      const { data, error } = await supabase
        .from('trip_billings')
        .upsert({
          trip_id: billingData.trip_id,
          trip_type: billingData.trip_type,
          calculated_rate: billingData.calculated_rate,
          toll_fees: billingData.toll_fees,
          total_amount: billingData.total_amount,
          updated_at: new Date().toISOString()
        }, { onConflict: 'trip_id' })
        .select()
        .single();

      if (error) {
        console.error('❌ Error saving billing:', error);
        return { data: null, error };
      }
      
      console.log('✅ Billing saved successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Exception saving billing:', error);
      return { data: null, error };
    }
  },

  // ========== DEBUG METHODS ==========
  testStartTrip: async (testData) => {
    try {
      console.log('🧪 TESTING startTrip with data:', testData);
      
      const deviceId = getDeviceId();
      const currentTime = new Date().toISOString();
      
      const testTripData = {
        agency_id: testData.agency_id || 1,
        vehicle_id: testData.vehicle_id || 1,
        vehicle_number: testData.vehicle_number || 'TEST123',
        plant: testData.plant || 'Test Plant',
        plant_id: testData.plant_id || 1,
        driver_name: testData.driver_name || 'Test Driver',
        driver_contact: testData.driver_contact || '9999999999',
        start_lat: testData.start_lat || 13.0827,
        start_lng: testData.start_lng || 80.2707,
        start_address: testData.start_address || 'Test Location',
        vendor_code: testData.vendor_code || 'V001',
        vendor_name: testData.vendor_name || 'Test Vendor',
        status: 'active',
        device_id: deviceId,
        created_at: currentTime
      };
      
      console.log('🧪 Test trip data:', testTripData);
      
      const { data, error } = await supabase
        .from('Trips')
        .insert([testTripData])
        .select()
        .single();
      
      if (error) {
        console.error('🧪 Test failed:', error);
        return { 
          success: false, 
          error: error.message,
          code: error.code 
        };
      }
      
      console.log('🧪 Test successful:', data);
      return { 
        success: true, 
        data: data 
      };
    } catch (error) {
      console.error('🧪 Test exception:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  },

  testConnection: async () => {
    try {
      console.log('🔌 Testing Supabase connection...');
      const { data, error } = await supabase
        .from('Trips')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      console.log('✅ Supabase connection successful');
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      return { success: false, error: error.message };
    }
  },

  // ========== EMAIL METHODS ==========
  getPlantAdminEmails: async (plantId) => {
    try {
      console.log('📧 Fetching plant admin emails for plant ID:', plantId);
      
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('plant_id', plantId)
        .eq('role', 'plant_admin')
        .eq('is_active', true);
      
      if (error) {
        console.error('❌ Error fetching plant admin emails:', error);
        return { data: null, error };
      }
      
      const emails = data?.map(user => user.email).filter(email => email) || [];
      console.log(`✅ Found ${emails.length} plant admin emails`);
      return { data: emails, error: null };
    } catch (error) {
      console.error('💥 Exception fetching plant admin emails:', error);
      return { data: null, error };
    }
  },

  getPlantUserEmails: async (plantId) => {
    try {
      console.log('📧 Fetching plant user emails for plant ID:', plantId);
      
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('plant_id', plantId)
        .eq('is_active', true)
        .neq('role', 'plant_admin'); // Exclude plant admins
      
      if (error) {
        console.error('❌ Error fetching plant user emails:', error);
        return { data: null, error };
      }
      
      const emails = data?.map(user => user.email).filter(email => email) || [];
      console.log(`✅ Found ${emails.length} plant user emails`);
      return { data: emails, error: null };
    } catch (error) {
      console.error('💥 Exception fetching plant user emails:', error);
      return { data: null, error };
    }
  }
};

export default api;