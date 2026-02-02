import React, { useState, useEffect } from 'react';
import styles from './Supplier.module.css';
import { api } from '../../Services/api';
import AdminLogin from '../../Common/Admin/AdminLogin';
import AdminNavigation from '../../Common/Admin/AdminNavigation';


const Supplier = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    vendor_code: '',
    plant: '',
    vendor_name: '',
    contact_person_number: '',
    contact_person_name: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [plants, setPlants] = useState([]);

  // Fetch plants from API
  const fetchPlants = async () => {
    try {
      const { data, error } = await api.getPlants();
      if (error) throw error;
      setPlants(data || []);
    } catch (error) {
      console.error('Error fetching plants:', error);
      alert('Failed to fetch plants');
    }
  };

  // Fetch suppliers from Supabase using your API
  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await api.supabase
        ?.from('vendor')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      alert('Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchPlants();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.vendor_code.trim()) {
      errors.vendor_code = 'Vendor Code is required';
    }
    
    if (!formData.plant.trim()) {
      errors.plant = 'Plant is required';
    }
    
    if (!formData.vendor_name.trim()) {
      errors.vendor_name = 'Vendor Name is required';
    }
    
    if (formData.contact_person_number && !/^\d{10}$/.test(formData.contact_person_number)) {
      errors.contact_person_number = 'Please enter a valid 10-digit phone number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generateVendorCode = () => {
    const selectedPlant = plants.find(p => p.name === formData.plant);
    if (!selectedPlant) return '';
    
    const plantCode = selectedPlant.code || selectedPlant.name.substring(0, 3).toUpperCase();
    const count = suppliers.filter(s => s.plant === formData.plant).length + 1;
    return `V-${plantCode}-${count.toString().padStart(4, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      const finalData = {
        ...formData,
        vendor_code: formData.vendor_code || generateVendorCode()
      };
      
      if (editingId) {
        const { error } = await api.supabase
          .from('vendor')
          .update(finalData)
          .eq('id', editingId);
        
        if (error) throw error;
        alert('Supplier updated successfully!');
      } else {
        const { error } = await api.supabase
          .from('vendor')
          .insert([finalData]);
        
        if (error) throw error;
        alert('Supplier added successfully!');
      }
      
      await fetchSuppliers();
      handleCloseModal();
      
    } catch (error) {
      console.error('Error saving supplier:', error);
      alert(error.message || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (supplier) => {
    setFormData({
      vendor_code: supplier.vendor_code,
      plant: supplier.plant,
      vendor_name: supplier.vendor_name,
      contact_person_number: supplier.contact_person_number || '',
      contact_person_name: supplier.contact_person_name || ''
    });
    setEditingId(supplier.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    
    try {
      setLoading(true);
      const { error } = await api.supabase
        .from('vendor')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      alert('Supplier deleted successfully!');
      await fetchSuppliers();
      
    } catch (error) {
      console.error('Error deleting supplier:', error);
      alert('Failed to delete supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (supplier) => {
    alert(`
Vendor Details:
---------------
Vendor Code: ${supplier.vendor_code}
Plant: ${supplier.plant}
Vendor Name: ${supplier.vendor_name}
Contact Person: ${supplier.contact_person_name || 'N/A'}
Contact Number: ${supplier.contact_person_number || 'N/A'}
Created: ${new Date(supplier.created_at).toLocaleDateString()}
    `);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({
      vendor_code: '',
      plant: '',
      vendor_name: '',
      contact_person_number: '',
      contact_person_name: ''
    });
    setFormErrors({});
    setEditingId(null);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.vendor_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.plant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.contact_person_name && supplier.contact_person_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
   <>
      <AdminNavigation />
      {/* Header - Matching the image design */}
      <div className={styles.headerSection}>
        <div className={styles.headerContent}>
          <div className={styles.headerText}>
            <h1 className={styles.pageTitle}>Supplier Management</h1>
            <p className={styles.pageSubtitle}>Manage and track all your vendors and suppliers</p>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => setShowModal(true)}
          >
            + Add Supplier
          </button>
        </div>
      </div>

      {/* Search Section */}
      <div className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <div className={styles.searchIcon}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.468 11.468L14.5714 14.5714M13.0924 7.54622C13.0924 10.6093 10.6093 13.0924 7.54622 13.0924C4.48313 13.0924 2 10.6093 2 7.54622C2 4.48313 4.48313 2 7.54622 2C10.6093 2 13.0924 4.48313 13.0924 7.54622Z" stroke="#666666" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search suppliers by name, code"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className={styles.contentSection}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading suppliers...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 20H36C38.2091 20 40 21.7909 40 24V36C40 38.2091 38.2091 40 36 40H12C9.79086 40 8 38.2091 8 36V24C8 21.7909 9.79086 20 12 20H16M32 20V16C32 12.6863 29.3137 10 26 10H22C18.6863 10 16 12.6863 16 16V20M32 20H16" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M24 30V34M24 30H22M24 30H26" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>No suppliers found</h3>
            <p className={styles.emptyDescription}>
              {searchTerm ? 'Try a different search term' : 'Start by adding your first supplier'}
            </p>
            <button
              className={styles.emptyStateButton}
              onClick={() => setShowModal(true)}
            >
              + Add Supplier
            </button>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              <div className={styles.resultsCount}>
                {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'supplier' : 'suppliers'} found
              </div>
            </div>
            <table className={styles.supplierTable}>
              <thead>
                <tr className={styles.tableHeaderRow}>
                  <th className={styles.tableHeaderCell}>Vendor Code</th>
                  <th className={styles.tableHeaderCell}>Plant</th>
                  <th className={styles.tableHeaderCell}>Vendor Name</th>
                  <th className={styles.tableHeaderCell}>Contact Person</th>
                  <th className={styles.tableHeaderCell}>Contact Number</th>
                  <th className={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className={styles.tableRow}>
                    <td className={styles.tableCell}>
                      <span className={styles.vendorCode}>{supplier.vendor_code}</span>
                    </td>
                    <td className={styles.tableCell}>
                      <span className={styles.plantBadge}>{supplier.plant}</span>
                    </td>
                    <td className={styles.tableCell}>{supplier.vendor_name}</td>
                    <td className={styles.tableCell}>
                      {supplier.contact_person_name || 'N/A'}
                    </td>
                    <td className={styles.tableCell}>
                      {supplier.contact_person_number || 'N/A'}
                    </td>
                    <td className={`${styles.tableCell} ${styles.actionsCell}`}>
                      <div className={styles.actionButtons}>
                        <button
                          className={`${styles.actionButton} ${styles.viewButton}`}
                          onClick={() => handleView(supplier)}
                        >
                          View
                        </button>
                        <button
                          className={`${styles.actionButton} ${styles.editButton}`}
                          onClick={() => handleEdit(supplier)}
                        >
                          Edit
                        </button>
                        <button
                          className={`${styles.actionButton} ${styles.deleteButton}`}
                          onClick={() => handleDelete(supplier.id)}
                        >
                          Delete
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

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingId ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <button className={styles.modalClose} onClick={handleCloseModal}>
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="vendor_code" className={styles.formLabel}>
                      Vendor Code *
                    </label>
                    <input
                      type="text"
                      id="vendor_code"
                      name="vendor_code"
                      className={styles.formInput}
                      value={formData.vendor_code}
                      onChange={handleInputChange}
                      placeholder="Enter vendor code"
                    />
                    {formErrors.vendor_code && (
                      <span className={styles.errorText}>{formErrors.vendor_code}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="plant" className={styles.formLabel}>
                      Plant *
                    </label>
                    <select
                      id="plant"
                      name="plant"
                      className={styles.formSelect}
                      value={formData.plant}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Plant</option>
                      {plants.map((plant) => (
                        <option key={plant.id} value={plant.name}>
                          {plant.name} - {plant.location}
                        </option>
                      ))}
                    </select>
                    {formErrors.plant && (
                      <span className={styles.errorText}>{formErrors.plant}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="vendor_name" className={styles.formLabel}>
                      Vendor Name *
                    </label>
                    <input
                      type="text"
                      id="vendor_name"
                      name="vendor_name"
                      className={styles.formInput}
                      value={formData.vendor_name}
                      onChange={handleInputChange}
                      placeholder="Enter vendor name"
                    />
                    {formErrors.vendor_name && (
                      <span className={styles.errorText}>{formErrors.vendor_name}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="contact_person_name" className={styles.formLabel}>
                      Contact Person Name
                    </label>
                    <input
                      type="text"
                      id="contact_person_name"
                      name="contact_person_name"
                      className={styles.formInput}
                      value={formData.contact_person_name}
                      onChange={handleInputChange}
                      placeholder="Enter contact person name"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="contact_person_number" className={styles.formLabel}>
                      Contact Number
                    </label>
                    <input
                      type="tel"
                      id="contact_person_number"
                      name="contact_person_number"
                      className={styles.formInput}
                      value={formData.contact_person_number}
                      onChange={handleInputChange}
                      placeholder="Enter 10-digit number"
                      maxLength="10"
                    />
                    {formErrors.contact_person_number && (
                      <span className={styles.errorText}>{formErrors.contact_person_number}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleCloseModal}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className={styles.spinnerSmall}></span>
                      Saving...
                    </>
                  ) : editingId ? 'Update Supplier' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
          </div>
      )}
    </>
  ); 
};

export default Supplier;