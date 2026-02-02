import React, { useState, useEffect } from 'react';
import { api } from '../../Services/api';
import styles from './RateMaster.module.css';
import AdminNavigation from '../../Common/Admin/AdminNavigation';

const RateMaster = () => {
  const [agencies, setAgencies] = useState([]);
  const [plants, setPlants] = useState([]);
  const [filteredAgencies, setFilteredAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddRateModal, setShowAddRateModal] = useState(false);
  const [rates, setRates] = useState([]);
  const [isLoadingRates, setIsLoadingRates] = useState(true);
  
  // NEW: Track which rate is being edited
  const [editingRateId, setEditingRateId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    plant_id: '',
    type: 'Trip',
    agency_id: '',
    tone: '0.5',
    min_km: '',
    max_km: '',
    rate: ''
  });

  // Tonnage Options
  const tones = [];
  for (let i = 0.5; i <= 5.5; i += 0.5) tones.push(i);
  for (let i = 6; i <= 30; i += 1) tones.push(i);

  // Fetch Plants, Agencies and Rates on Mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch plants
      const { data: plantsData, error: plantsError } = await api.getPlants();
      if (plantsError) {
        setError('Failed to fetch plants');
      } else {
        setPlants(plantsData || []);
      }

      // Fetch agencies
      const { data: agenciesData, error: agenciesError } = await api.getAgencies();
      if (agenciesError) {
        setError('Failed to fetch agencies');
      } else {
        setAgencies(agenciesData || []);
      }

      // Fetch existing rates
      await fetchRates();
    } catch (err) {
      setError('Error fetching data');
      setIsLoadingRates(false);
    }
  };

  const fetchRates = async () => {
    setIsLoadingRates(true);
    try {
      const { data, error } = await api.getRates();
      if (error) {
        setError('Failed to fetch rates');
      } else {
        setRates(data || []);
      }
    } catch (err) {
      setError('Error fetching rates');
    } finally {
      setIsLoadingRates(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newFormData = { ...prev, [name]: value };
      
      // If plant is changed, reset agency and filter agencies
      if (name === 'plant_id') {
        newFormData.agency_id = '';
        // Filter agencies based on selected plant
        if (value) {
          const filtered = agencies.filter(agency => agency.plant_id === value);
          setFilteredAgencies(filtered);
        } else {
          setFilteredAgencies([]);
        }
      }
      
      return newFormData;
    });
    
    setError('');
    setSuccess('');
  };

  const handleTypeSelect = (type) => {
    setFormData(prev => ({
      ...prev,
      type: type,
      min_km: '',
      max_km: '',
      rate: ''
    }));
  };

  const validateForm = () => {
    if (!formData.plant_id) return 'Please select a Plant';
    if (!formData.agency_id) return 'Please select a Transporter';
    if (!formData.tone) return 'Please select a Tonnage';
    if (!formData.rate) return 'Please enter a Rate';

    if (formData.type === 'Trip') {
      if (!formData.min_km || !formData.max_km) {
        return 'Please enter both From and To KM ranges';
      }
      if (Number(formData.min_km) >= Number(formData.max_km)) {
        return 'To KM must be greater than From KM';
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      let response;
      
      // Check if we're editing an existing rate
      if (editingRateId) {
        // UPDATE existing rate
        console.log('🔄 Updating existing rate:', editingRateId);
        response = await api.updateRate(editingRateId, formData);
      } else {
        // CREATE new rate
        console.log('➕ Creating new rate');
        response = await api.createRate(formData);
      }

      const { data, error } = response;

      if (error) {
        setError(error.message || 'Failed to save rate');
      } else {
        setSuccess(editingRateId ? 'Rate updated successfully!' : 'Rate saved successfully!');
        // Refresh rates list
        await fetchRates();
        // Reset form and close modal
        resetForm();
        setShowAddRateModal(false);
        // Auto-clear success message
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      plant_id: '',
      type: 'Trip',
      agency_id: '',
      tone: '0.5',
      min_km: '',
      max_km: '',
      rate: ''
    });
    setFilteredAgencies([]);
    setEditingRateId(null); // Reset editing state
    setError('');
  };

  const openAddRateModal = () => {
    resetForm();
    setShowAddRateModal(true);
  };

  const closeAddRateModal = () => {
    setShowAddRateModal(false);
    resetForm();
  };

  // Helper function to get agency name by ID
  const getAgencyName = (agencyId) => {
    const agency = agencies.find(ag => ag.id === agencyId);
    return agency ? `${agency.name} (${agency.code})` : 'Unknown Agency';
  };

  // Helper function to get plant name by ID
  const getPlantName = (plantId) => {
    const plant = plants.find(p => p.id === plantId);
    return plant ? `${plant.name} (${plant.location})` : 'Unknown Plant';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get agencies to display in dropdown (filtered or all)
  const getAgenciesForDropdown = () => {
    if (formData.plant_id && filteredAgencies.length > 0) {
      return filteredAgencies;
    }
    return agencies;
  };

  // Handle delete rate
  const handleDeleteRate = async (rateId) => {
    if (window.confirm('Are you sure you want to delete this rate?')) {
      try {
        const { error } = await api.deleteRate(rateId);
        if (error) {
          setError('Failed to delete rate');
        } else {
          setSuccess('Rate deleted successfully!');
          await fetchRates();
          setTimeout(() => setSuccess(''), 3000);
        }
      } catch (err) {
        setError('Error deleting rate');
      }
    }
  };

  // Handle edit rate - open modal with existing data
  const handleEditRate = (rate) => {
    console.log('✏️ Editing rate:', rate.id);
    
    // Set the rate ID we're editing
    setEditingRateId(rate.id);
    
    setFormData({
      plant_id: rate.agencies?.plant_id || rate.plant_id || '',
      type: rate.type,
      agency_id: rate.agency_id,
      tone: rate.tone.toString(),
      min_km: rate.min_km || '',
      max_km: rate.max_km || '',
      rate: rate.rate
    });
    
    // Filter agencies for the selected plant
    if (rate.agencies?.plant_id) {
      const filtered = agencies.filter(agency => agency.plant_id === rate.agencies.plant_id);
      setFilteredAgencies(filtered);
    }
    
    setShowAddRateModal(true);
    setSuccess('');
    setError('');
  };

  return (
      <AdminNavigation>
     
      <div className={styles.rateMasterContainer}>
        {/* Header Section with Add Button */}
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <h1 className={styles.title}>Rate Master Management</h1>
            <button 
              className={styles.addButton}
              onClick={openAddRateModal}
            >
              + Add New Rate
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {error && !showAddRateModal && <div className={styles.errorMessage}>⚠️ {error}</div>}
        {success && !showAddRateModal && <div className={styles.successMessage}>✅ {success}</div>}

        {/* Rates Table Section */}
        <div className={styles.ratesTableSection}>
          <div className={styles.sectionHeader}>
            {/* <h2>Existing Rates</h2> */}
            {/* <p className={styles.helperText}>{rates.length} rate(s) configured</p> */}
          </div>

          {isLoadingRates ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading rates...</p>
            </div>
          ) : rates.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📊</div>
              <h3>No Rates Found</h3>
              <p>Click "Add New Rate" to create your first rate configuration</p>
              <button 
                className={styles.emptyStateButton}
                onClick={openAddRateModal}
              >
                + Add Your First Rate
              </button>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.ratesTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Plant</th>
                    <th>Transporter</th>
                    <th>Type</th>
                    <th>Tonnage</th>
                    <th>KM Range</th>
                    <th>Rate</th>
                    <th>Created Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.id}>
                      <td className={styles.idCell}>
                        <span className={styles.idBadge}>#{rate.id}</span>
                      </td>
                      <td className={styles.plantCell}>
                        {rate.agencies?.plants?.name || getPlantName(rate.agencies?.plant_id) || 'N/A'}
                      </td>
                      <td className={styles.agencyCell}>
                        {getAgencyName(rate.agency_id)}
                      </td>
                      <td className={styles.typeCell}>
                        <span className={`${styles.typeBadge} ${rate.type === 'Trip' ? styles.tripBadge : styles.kmBadge}`}>
                          {rate.type === 'Trip' ? '🚩 Trip Basis' : '🪧 KM Basis'}
                        </span>
                      </td>
                      <td className={styles.toneCell}>
                        <span className={styles.toneBadge}>
                          {rate.tone} Ton
                        </span>
                      </td>
                      <td className={styles.rangeCell}>
                        {rate.type === 'Trip' && rate.min_km && rate.max_km ? (
                          <div className={styles.rangeDisplay}>
                            <span className={styles.rangeFrom}>{rate.min_km}</span>
                            <span className={styles.rangeSeparator}>-</span>
                            <span className={styles.rangeTo}>{rate.max_km}</span>
                            <span className={styles.rangeUnit}> KM</span>
                          </div>
                        ) : (
                          <span className={styles.noRange}>N/A</span>
                        )}
                      </td>
                      <td className={styles.rateCell}>
                        <div className={styles.rateAmount}>
                          <span className={styles.currencySymbol}>₹</span>
                          <span className={styles.rateValue}>{rate.rate}</span>
                          <span className={styles.rateUnit}>
                            {rate.type === 'Trip' ? '/trip' : '/km'}
                          </span>
                        </div>
                      </td>
                      <td className={styles.dateCell}>
                        {formatDate(rate.created_at)}
                      </td>
                      <td className={styles.actionsCell}>
                        <div className={styles.actionButtons}>
                          <button 
                            className={styles.editBtn}
                            onClick={() => handleEditRate(rate)}
                            title="Edit Rate"
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteRate(rate.id)}
                            title="Delete Rate"
                          >
                            🗑️ Delete
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

        {/* Add Rate Modal */}
        {showAddRateModal && (
          <div className={styles.modalOverlay} onClick={closeAddRateModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>{editingRateId ? 'Edit Rate Configuration' : 'Add New Rate Configuration'}</h2>
                <button className={styles.modalClose} onClick={closeAddRateModal}>
                  ×
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.formCard}>
                  <div className={styles.formHeader}>
                    {editingRateId && (
                      <div className={styles.editNotice}>
                        ✏️ Editing Rate ID: #{editingRateId}
                      </div>
                    )}
                  </div>

                  {error && <div className={styles.errorMessage}>⚠️ {error}</div>}
                  {success && <div className={styles.successMessage}>✅ {success}</div>}

                  <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Plant Selection */}
                    <div className={styles.formGroup}>
                      <label htmlFor="plant_id" className={styles.label}>Plant *</label>
                      <select
                        id="plant_id"
                        name="plant_id"
                        value={formData.plant_id}
                        onChange={handleInputChange}
                        className={styles.select}
                        required
                      >
                        <option value="">Select Plant</option>
                        {plants.map((plant) => (
                          <option key={plant.id} value={plant.id}>
                            {plant.name} ({plant.location}) - {plant.code}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Type Selection */}
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Type</label>
                      <div className={styles.radioGroup}>
                        <button
                          type="button"
                          className={`${styles.typeButton} ${formData.type === 'Trip' ? styles.activeType : ''}`}
                          onClick={() => handleTypeSelect('Trip')}
                        >
                          🚩 Trip Basis
                        </button>
                        <button
                          type="button"
                          className={`${styles.typeButton} ${formData.type === 'Kilometer' ? styles.activeType : ''}`}
                          onClick={() => handleTypeSelect('Kilometer')}
                        >
                          🪧 Kilometer Basis
                        </button>
                      </div>
                    </div>

                    {/* Transporter Dropdown */}
                    <div className={styles.formGroup}>
                      <label htmlFor="agency_id" className={styles.label}>Transporter *</label>
                      <select
                        id="agency_id"
                        name="agency_id"
                        value={formData.agency_id}
                        onChange={handleInputChange}
                        className={styles.select}
                        required
                        disabled={!formData.plant_id}
                      >
                        <option value="">
                          {formData.plant_id ? 'Select Transporter' : 'Select a plant first'}
                        </option>
                        {getAgenciesForDropdown().map((agency) => (
                          <option key={agency.id} value={agency.id}>
                            {agency.name} ({agency.code})
                          </option>
                        ))}
                      </select>
                      {!formData.plant_id && (
                        <p className={styles.helperText} style={{ fontSize: '12px', marginTop: '5px', color: '#718096' }}>
                          Select a plant to see available transporters
                        </p>
                      )}
                      {formData.plant_id && filteredAgencies.length === 0 && (
                        <p className={styles.helperText} style={{ fontSize: '12px', marginTop: '5px', color: '#e53e3e' }}>
                          No transporters found for this plant
                        </p>
                      )}
                    </div>

                    {/* Tonnage Dropdown */}
                    <div className={styles.formGroup}>
                      <label htmlFor="tone" className={styles.label}>Tonnage *</label>
                      <select
                        id="tone"
                        name="tone"
                        value={formData.tone}
                        onChange={handleInputChange}
                        className={styles.select}
                        required
                      >
                        {tones.map((tone) => (
                          <option key={tone} value={tone}>
                            {tone} Ton
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Conditional Fields based on Type */}
                    {formData.type === 'Trip' && (
                      <>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>KM Range *</label>
                          <div className={styles.rangeInputs}>
                            <div className={styles.inputWrapper}>
                              <input
                                type="number"
                                name="min_km"
                                value={formData.min_km}
                                onChange={handleInputChange}
                                placeholder="From KM"
                                className={styles.input}
                                required
                                min="0"
                              />
                              <span className={styles.inputSuffix}>KM</span>
                            </div>
                            <span className={styles.separator}>—</span>
                            <div className={styles.inputWrapper}>
                              <input
                                type="number"
                                name="max_km"
                                value={formData.max_km}
                                onChange={handleInputChange}
                                placeholder="To KM"
                                className={styles.input}
                                required
                                min="1"
                              />
                              <span className={styles.inputSuffix}>KM</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.formGroup}>
                          <label htmlFor="rate" className={styles.label}>Rate per Trip *</label>
                          <div className={styles.inputWrapper}>
                            <span className={styles.currencySymbol}>₹</span>
                            <input
                              type="number"
                              id="rate"
                              name="rate"
                              value={formData.rate}
                              onChange={handleInputChange}
                              placeholder="Enter amount"
                              className={`${styles.input} ${styles.hasSymbol}`}
                              required
                              min="1"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {formData.type === 'Kilometer' && (
                      <div className={styles.formGroup}>
                        <label htmlFor="rate" className={styles.label}>Rate per KM *</label>
                        <div className={styles.inputWrapper}>
                          <span className={styles.currencySymbol}>₹</span>
                          <input
                            type="number"
                            id="rate"
                            name="rate"
                            value={formData.rate}
                            onChange={handleInputChange}
                            placeholder="Enter amount per KM"
                            className={`${styles.input} ${styles.hasSymbol}`}
                            required
                            min="1"
                          />
                        </div>
                      </div>
                    )}

                    {/* Modal Footer Buttons */}
                    <div className={styles.modalFooter}>
                      <button
                        type="button"
                        className={styles.cancelButton}
                        onClick={closeAddRateModal}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={loading}
                      >
                        {loading ? 'Saving...' : editingRateId ? '💾 Update Rate' : '💾 Save Rate'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ AdminNavigation>
  );
};

export default RateMaster;