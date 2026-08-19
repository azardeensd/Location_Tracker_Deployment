import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../Services/api';
import styles from './VehiclesManagement.module.css';
import AdminNavigation from '../../Common/Admin/AdminNavigation';

const VehiclesManagement = () => {
  const [vehicles, setVehicles] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    agency_id: '',
    vehicle_number: '',
    vehicle_type: '',
    capacity: '',
    status: 'active'
  });

  // 🔥 CRITICAL: Get user plant ID for filtering
  const getUserPlantId = useCallback(() => {
    try {
      // Check localStorage for user data
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
      const plantAdminData = JSON.parse(localStorage.getItem('plantAdminData') || '{}');
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      
      // Check each possible source for plant_id
      if (adminData.plant_id) return adminData.plant_id;
      if (plantAdminData.plant_id) return plantAdminData.plant_id;
      if (userData.plant_id) return userData.plant_id;
      
      // Check for plant_id in different formats
      if (adminData.plantid) return adminData.plantid;
      if (plantAdminData.plantid) return plantAdminData.plantid;
      if (userData.plantid) return userData.plantid;
      
      return null;
    } catch (err) {
      console.error('Error getting user plant ID:', err);
      return null;
    }
  }, []);

  // Get user role
  const getUserRole = useCallback(() => {
    try {
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
      const plantAdminData = JSON.parse(localStorage.getItem('plantAdminData') || '{}');
      
      if (adminData.role) return adminData.role;
      if (plantAdminData.role) return plantAdminData.role;
      
      return 'user';
    } catch (err) {
      return 'user';
    }
  }, []);

  // 🔥 FIX: Fetch vehicles with proper filtering for plant admin
  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const userRole = getUserRole();
      const userPlantId = getUserPlantId();
      
      console.log('🔍 Fetching vehicles - Role:', userRole, 'Plant ID:', userPlantId);
      
      let vehiclesData = [];
      
      if (userRole === 'admin' || userRole === 'super_admin') {
        // Admin: Fetch all vehicles
        console.log('👑 Admin: Fetching all vehicles');
        const response = await api.getVehicles();
        if (response.error) throw new Error(response.error.message);
        vehiclesData = response.data || [];
      } 
      else if (userRole === 'plant_admin' && userPlantId) {
        // 🔥 PLANT ADMIN: Fetch ONLY vehicles from their plant
        console.log('🏭 Plant Admin: Fetching vehicles for plant ID:', userPlantId);
        
        // Step 1: Get all agencies for this plant
        const agenciesResponse = await api.getAgenciesByPlant(userPlantId);
        if (agenciesResponse.error) throw new Error(agenciesResponse.error.message);
        
        const plantAgencies = agenciesResponse.data || [];
        console.log('📋 Plant agencies found:', plantAgencies.length);
        
        if (plantAgencies.length > 0) {
          const agencyIds = plantAgencies.map(agency => agency.id);
          console.log('🔑 Agency IDs:', agencyIds);
          
          // Step 2: Get all vehicles
          const vehiclesResponse = await api.getVehicles();
          if (vehiclesResponse.error) throw new Error(vehiclesResponse.error.message);
          
          // Step 3: Filter vehicles that belong to these agencies
          vehiclesData = (vehiclesResponse.data || []).filter(vehicle => 
            agencyIds.includes(vehicle.agency_id)
          );
          
          console.log(`✅ Plant Admin: Found ${vehiclesData.length} vehicles for their plant`);
        } else {
          console.log('⚠️ No agencies found for this plant');
          vehiclesData = [];
        }
      }
      else {
        // Other roles: Fetch vehicles based on plant or show empty
        if (userPlantId) {
          const agenciesResponse = await api.getAgenciesByPlant(userPlantId);
          if (!agenciesResponse.error && agenciesResponse.data) {
            const agencyIds = agenciesResponse.data.map(a => a.id);
            const vehiclesResponse = await api.getVehicles();
            if (!vehiclesResponse.error) {
              vehiclesData = (vehiclesResponse.data || []).filter(v => 
                agencyIds.includes(v.agency_id)
              );
            }
          }
        }
      }
      
      console.log('✅ Setting vehicles:', vehiclesData.length);
      setVehicles(vehiclesData);
      
    } catch (err) {
      console.error('❌ Error fetching vehicles:', err);
      setError('Failed to fetch vehicles: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [getUserRole, getUserPlantId]);

  // 🔥 FIX: Fetch agencies with proper filtering for plant admin
  const fetchAgencies = useCallback(async () => {
    try {
      const userRole = getUserRole();
      const userPlantId = getUserPlantId();
      
      console.log('🔍 Fetching agencies - Role:', userRole, 'Plant ID:', userPlantId);
      
      let agenciesData = [];
      
      if (userRole === 'admin' || userRole === 'super_admin') {
        // Admin: Fetch all agencies
        const response = await api.getAgencies();
        if (!response.error) {
          agenciesData = response.data || [];
        }
      } 
      else if (userRole === 'plant_admin' && userPlantId) {
        // 🔥 PLANT ADMIN: Fetch ONLY agencies from their plant
        console.log('🏭 Plant Admin: Fetching agencies for plant ID:', userPlantId);
        const response = await api.getAgenciesByPlant(userPlantId);
        if (!response.error) {
          agenciesData = response.data || [];
        }
        console.log(`✅ Plant Admin: Found ${agenciesData.length} agencies for their plant`);
      }
      
      setAgencies(agenciesData);
      
    } catch (err) {
      console.error('❌ Error fetching agencies:', err);
      setError('Failed to fetch agencies: ' + err.message);
    }
  }, [getUserRole, getUserPlantId]);

  // Get current user with plant data
  const getCurrentUser = useCallback(() => {
    const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
    const plantAdminData = JSON.parse(localStorage.getItem('plantAdminData') || '{}');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    if (adminData.id) return { ...adminData, role: adminData.role || 'admin' };
    if (plantAdminData.id) return { ...plantAdminData, role: plantAdminData.role || 'plant_admin' };
    if (userData.id) return { ...userData, role: userData.role || 'user' };
    
    return {};
  }, []);

  // Check admin status
  const checkAdminStatus = useCallback(() => {
    try {
      const currentUser = getCurrentUser();
      const userIsAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
      setIsAdmin(userIsAdmin);
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  }, [getCurrentUser]);

  // Get user's plant name
  const getUserPlantName = useCallback(() => {
    try {
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
      const plantAdminData = JSON.parse(localStorage.getItem('plantAdminData') || '{}');
      
      return plantAdminData.plant_name || plantAdminData.plant || adminData.plant_name || 'Your Plant';
    } catch (err) {
      return 'Your Plant';
    }
  }, []);

  // Enhanced helper function to normalize vehicle number
  const normalizeVehicleNumber = (vehicleNumber) => {
    if (!vehicleNumber) return '';
    return vehicleNumber
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .trim();
  };

  // Helper functions
  const getAgencyName = (agencyId) => {
    const agency = agencies.find(a => a.id === agencyId);
    return agency ? agency.name : 'Unknown Agency';
  };

  const getPlantInfo = (vehicle) => {
    if (vehicle.agency && vehicle.agency.plant) {
      return `${vehicle.agency.plant.name} - ${vehicle.agency.plant.location}`;
    }
    const agency = agencies.find(a => a.id === vehicle.agency_id);
    if (agency && agency.plant) {
      return `${agency.plant.name} - ${agency.plant.location}`;
    }
    if (agency && agency.plants) {
      return `${agency.plants.name} - ${agency.plants.location}`;
    }
    return 'N/A';
  };

  // Search functionality
  const filteredVehicles = vehicles.filter(vehicle => {
    const searchLower = searchTerm.toLowerCase();
    const normalizedVehicleNumber = normalizeVehicleNumber(vehicle.vehicle_number);
    const normalizedSearchTerm = normalizeVehicleNumber(searchTerm);
    
    return (
      vehicle.vehicle_number.toLowerCase().includes(searchLower) ||
      normalizedVehicleNumber.includes(normalizedSearchTerm) ||
      vehicle.vehicle_type.toLowerCase().includes(searchLower) ||
      getAgencyName(vehicle.agency_id).toLowerCase().includes(searchLower) ||
      vehicle.capacity.toString().includes(searchLower) ||
      vehicle.status.toLowerCase().includes(searchLower) ||
      getPlantInfo(vehicle).toLowerCase().includes(searchLower)
    );
  });

  // Duplicate vehicle validation
  const isDuplicateVehicle = (formData, editingId = null) => {
    const normalizedInputNumber = normalizeVehicleNumber(formData.vehicle_number);
    
    return vehicles.some(vehicle => {
      if (editingId && vehicle.id === editingId) return false;
      const normalizedExistingNumber = normalizeVehicleNumber(vehicle.vehicle_number);
      return normalizedExistingNumber === normalizedInputNumber;
    });
  };

  // Check if user can add vehicles
  const canAddVehicles = useCallback(() => {
    const currentUser = getCurrentUser();
    return currentUser.role === 'admin' || 
           currentUser.role === 'super_admin' || 
           currentUser.role === 'plant_admin';
  }, [getCurrentUser]);

  // Fetch data on component mount
  useEffect(() => {
    checkAdminStatus();
    fetchAgencies();
    fetchVehicles();
  }, [checkAdminStatus, fetchAgencies, fetchVehicles]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'vehicle_number') {
      const formattedValue = value.replace(/\s+/g, ' ').trim();
      setFormData({
        ...formData,
        [name]: formattedValue
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    setError('');
  };

  // Handle edit vehicle
  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      agency_id: vehicle.agency_id.toString(),
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      capacity: vehicle.capacity,
      status: vehicle.status
    });
    setShowForm(true);
  };

  // Handle update vehicle
  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    
    if (!formData.agency_id || !formData.vehicle_number.trim() || 
        !formData.vehicle_type.trim() || !formData.capacity) {
      setError('Please fill all required fields');
      return;
    }

    if (isDuplicateVehicle(formData, editingVehicle?.id)) {
      const normalizedNumber = normalizeVehicleNumber(formData.vehicle_number);
      setError(`A vehicle with number "${normalizedNumber}" already exists in the system`);
      return;
    }

    const processedData = {
      ...formData,
      agency_id: Number(formData.agency_id)
    };

    const userPlantId = getUserPlantId();
    if (userPlantId) {
      const selectedAgency = agencies.find(agency => agency.id === processedData.agency_id);
      if (!selectedAgency) {
        setError('Selected agency not found');
        return;
      }
      if (selectedAgency.plant_id !== userPlantId) {
        setError('You can only update vehicles for agencies in your plant');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.updateVehicle(editingVehicle.id, processedData);
      
      if (response.error) {
        setError(response.error.message || 'Failed to update vehicle');
        return;
      }

      setSuccess('Vehicle updated successfully!');
      resetForm();
      fetchVehicles();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('❌ Error updating vehicle:', err);
      setError('Error updating vehicle: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle vehicle status
  const toggleVehicleStatus = async (vehicleId, currentStatus) => {
    if (loading) return;
    
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const confirmMessage = newStatus === 'inactive' 
      ? 'Are you sure you want to deactivate this vehicle?'
      : 'Are you sure you want to activate this vehicle?';
    
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const response = await api.updateVehicle(vehicleId, { 
        status: newStatus,
        updated_at: new Date().toISOString()
      });
      
      if (response.error) {
        if (response.error.code === '23503') {
          setError('Cannot deactivate vehicle with active trips');
          return;
        }
        throw new Error(response.error.message || 'Failed to update vehicle status');
      }
      
      setVehicles(prevVehicles => 
        prevVehicles.map(vehicle => 
          vehicle.id === vehicleId 
            ? { ...vehicle, status: newStatus }
            : vehicle
        )
      );
      
      setSuccess(`Vehicle ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      console.error('❌ Error updating vehicle status:', err);
      setError('Error updating vehicle status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    
    if (!formData.agency_id || !formData.vehicle_number.trim() || 
        !formData.vehicle_type.trim() || !formData.capacity) {
      setError('Please fill all required fields');
      return;
    }

    if (isDuplicateVehicle(formData)) {
      const normalizedNumber = normalizeVehicleNumber(formData.vehicle_number);
      setError(`A vehicle with number "${normalizedNumber}" already exists in the system`);
      return;
    }

    const processedData = {
      ...formData,
      agency_id: Number(formData.agency_id)
    };

    const userPlantId = getUserPlantId();
    if (userPlantId) {
      const selectedAgency = agencies.find(agency => agency.id === processedData.agency_id);
      if (!selectedAgency) {
        setError('Selected agency not found');
        return;
      }
      if (selectedAgency.plant_id !== userPlantId) {
        setError('You can only add vehicles for agencies in your plant');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.createVehicle(processedData);
      
      if (response.error) {
        setError(response.error.message || 'Failed to add vehicle');
        return;
      }

      setSuccess('Vehicle added successfully!');
      resetForm();
      fetchVehicles();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('❌ Error creating vehicle:', err);
      setError('Error creating vehicle: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (editingVehicle) {
      await handleUpdateVehicle(e);
    } else {
      await handleCreateVehicle(e);
    }
  };

  const resetForm = () => {
    setFormData({ 
      agency_id: '', 
      vehicle_number: '', 
      vehicle_type: '', 
      capacity: '', 
      status: 'active' 
    });
    setError('');
    setShowForm(false);
    setEditingVehicle(null);
  };

  const currentUser = getCurrentUser();
  const userRole = getUserRole();
  const userPlantId = getUserPlantId();
  const userPlantName = getUserPlantName();
  const userCanAddVehicles = canAddVehicles();

  // 🔥 PLANT BADGE: Show which plant the admin is viewing
  const plantBadge = userRole === 'plant_admin' && userPlantId && (
    <div className={styles.plantBadge}>
      <span className={styles.plantIcon}>🏭</span>
      <span className={styles.plantName}>{userPlantName}</span>
      <span className={styles.vehicleCount}>{vehicles.length} vehicles</span>
    </div>
  );

  return (
    <AdminNavigation>
      <div className={styles.vehiclesManagement}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.titleContainer}>
              <h1 className={styles.title}>Vehicles Management</h1>
              {plantBadge}
            </div>
            <div className={styles.stats}>
              <span className={styles.statItem}>
                <span className={styles.statLabel}>Total:</span>
                <span className={styles.statValue}>{vehicles.length}</span>
              </span>
              <span className={styles.statItem}>
                <span className={styles.statLabel}>Active:</span>
                <span className={`${styles.statValue} ${styles.activeStat}`}>
                  {vehicles.filter(v => v.status === 'active').length}
                </span>
              </span>
              <span className={styles.statItem}>
                <span className={styles.statLabel}>Inactive:</span>
                <span className={`${styles.statValue} ${styles.inactiveStat}`}>
                  {vehicles.filter(v => v.status === 'inactive').length}
                </span>
              </span>
            </div>
          </div>
          <div className={styles.headerActions}>
            {/* Search Bar */}
            <div className={styles.searchBox}>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Search by Vehicle Number, Transporter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  className={styles.clearSearch}
                  onClick={() => setSearchTerm('')}
                >
                  ✕
                </button>
              )}
            </div>
            
            {userCanAddVehicles && (
              <button 
                className={styles.addButton}
                onClick={() => setShowForm(true)}
                disabled={agencies.length === 0}
              >
                + Add Vehicle
              </button>
            )}
          </div>
        </div>
        
        {error && (
          <div className={styles.errorMessage}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className={styles.successMessage}>
            ✅ {success}
          </div>
        )}

        {userRole === 'plant_admin' && agencies.length === 0 && (
          <div className={styles.warningMessage}>
            ℹ️ No transporters found for {userPlantName}. Please contact administrator to add transporters.
          </div>
        )}

        {!userCanAddVehicles && (
          <div className={styles.infoMessage}>
            ℹ️ You have view-only access to vehicles.
          </div>
        )}

        {/* Search Results Info */}
        {searchTerm && (
          <div className={styles.searchInfo}>
            <p className={styles.searchResults}>
              Showing {filteredVehicles.length} of {vehicles.length} vehicles matching your search
            </p>
          </div>
        )}

        {/* Add/Edit Vehicle Form */}
        {showForm && userCanAddVehicles && (
          <div className={styles.formOverlay}>
            <div className={styles.formCard}>
              <h2>{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
              <form onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                  <label htmlFor="agency_id" className={styles.label}>
                    Transporter *
                  </label>
                  <select
                    id="agency_id"
                    name="agency_id"
                    value={formData.agency_id}
                    onChange={handleChange}
                    className={styles.select}
                    required
                    disabled={loading || agencies.length === 0}
                  >
                    <option value="">Select Transporter</option>
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.id}>
                        {agency.name}
                        {agency.plants && ` - ${agency.plants.name}`}
                      </option>
                    ))}
                  </select>
                  {agencies.length === 0 && (
                    <div className={styles.helpText}>
                      No transporters available for your plant
                    </div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="vehicle_number" className={styles.label}>
                    Vehicle Number *
                  </label>
                  <input
                    type="text"
                    id="vehicle_number"
                    name="vehicle_number"
                    value={formData.vehicle_number}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="Enter vehicle number"
                    required
                    disabled={loading || editingVehicle}
                  />
                  {editingVehicle && (
                    <div className={styles.helpText}>
                      Vehicle number cannot be edited once created
                    </div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="vehicle_type" className={styles.label}>
                    Vehicle Type *
                  </label>
                  <input
                    type="text"
                    id="vehicle_type"
                    name="vehicle_type"
                    value={formData.vehicle_type}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="e.g., Truck, Lorry, Container"
                    required
                    disabled={loading}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="capacity" className={styles.label}>
                    Capacity (tons) *
                  </label>
                  <select
                    id="capacity"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleChange}
                    className={styles.input}
                    required
                    disabled={loading}
                  >
                    <option value="">Select Capacity</option>
                    {[...Array(11)].map((_, i) => {
                      const value = 0.5 + i * 0.5;
                      return (
                        <option key={value} value={value}>
                          {value} Ton
                        </option>
                      );
                    })}
                    {[...Array(25)].map((_, i) => {
                      const value = 6 + i;
                      return (
                        <option key={value} value={value}>
                          {value} Ton
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="status" className={styles.label}>
                    Status *
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className={styles.select}
                    required
                    disabled={loading}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <div className={styles.helpText}>
                    Inactive vehicles won't be available for new trips
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button 
                    type="submit" 
                    className={styles.submitButton}
                    disabled={loading || agencies.length === 0}
                  >
                    {loading ? (editingVehicle ? 'Updating...' : 'Creating...') : (editingVehicle ? 'Update Vehicle' : 'Add Vehicle')}
                  </button>
                  
                  <button 
                    type="button" 
                    className={styles.cancelButton}
                    onClick={resetForm}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Vehicles List */}
        <div className={styles.vehiclesList}>
          {loading ? (
            <div className={styles.loading}>Loading vehicles...</div>
          ) : filteredVehicles.length === 0 ? (
            <div className={styles.noData}>
              {searchTerm 
                ? 'No vehicles found matching your search'
                : userRole === 'plant_admin' 
                  ? `No vehicles found for ${userPlantName}. Click "Add Vehicle" to add your first vehicle.`
                  : 'No vehicles found'
              }
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Vehicle Number</th>
                    <th>Transporter</th>
                    {userRole === 'admin' && <th>Plant</th>}
                    <th>Type</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className={vehicle.status === 'inactive' ? styles.inactiveRow : ''}>
                      <td className={styles.vehicleNumber}>{vehicle.vehicle_number}</td>
                      <td>{getAgencyName(vehicle.agency_id)}</td>
                      {userRole === 'admin' && (
                        <td>{getPlantInfo(vehicle)}</td>
                      )}
                      <td>{vehicle.vehicle_type}</td>
                      <td>{vehicle.capacity} tons</td>
                      <td>
                        <span className={`${styles.status} ${vehicle.status === 'active' ? styles.active : styles.inactive}`}>
                          {vehicle.status}
                        </span>
                      </td>
                      <td>{new Date(vehicle.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          {/* Edit Button - Only for admin users */}
                          {isAdmin && (
                            <button
                              className={styles.editButton}
                              onClick={() => handleEditVehicle(vehicle)}
                              disabled={loading}
                              title="Edit vehicle"
                            >
                              Edit
                            </button>
                          )}
                          
                          {/* Status Toggle Button - Available for both admin and plant admin */}
                          <button
                            className={`${styles.statusButton} ${
                              vehicle.status === 'active' ? styles.deactivateButton : styles.activateButton
                            }`}
                            onClick={() => toggleVehicleStatus(vehicle.id, vehicle.status)}
                            disabled={loading}
                            title={vehicle.status === 'active' ? 'Deactivate vehicle' : 'Activate vehicle'}
                          >
                            {vehicle.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
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

export default VehiclesManagement;
