// src/components/Dashboard.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../Services/api';
import styles from './Dashboard.module.css';
import AdminNavigation from '../../Common/Admin/AdminNavigation';

const Dashboard = () => {
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalTrips: 0,
    completedTrips: 0,
    pendingTrips: 0,
    inProgressTrips: 0,
    totalDistance: 0
  });
  const [currentUser, setCurrentUser] = useState({});
  const tableRef = useRef();

  // Date filter states
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [filterActive, setFilterActive] = useState(false);
  
  // Status filter state
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'completed', 'pending', 'inProgress'
  
  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('all'); // 'all', 'plant', 'vehicle', 'transporter'
  const [searchActive, setSearchActive] = useState(false);

  // Get current user with plant data
  const getCurrentUser = () => {
    try {
      // Check adminData first as it contains admin, super_admin, mmd, and finance
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
      if (adminData && adminData.role) {
        return adminData;
      }

      // Fallback to plantAdminData
      const plantAdminData = JSON.parse(localStorage.getItem('plantAdminData') || '{}');
      if (plantAdminData && plantAdminData.role) {
        return plantAdminData;
      }
      
      return {};
    } catch (error) {
      console.error('Error getting current user:', error);
      return {};
    }
  };

  const getUserPlantId = useCallback(() => {
    const user = getCurrentUser();
    
    if (user.role === 'admin' || user.role === 'super_admin') {
      return null; // Admin can see all
    }
    
    // For transporter/agency users (with agency_id)
    if (user.agency_id) {
      return 'agency_user'; // Special flag for agency users
    }
    
    return user.plant_id || user.plantid;
  }, []);

  // Get user's plant name
  const getUserPlantName = () => {
    const user = getCurrentUser();
    if (user.role === 'admin') return 'All Plants';
    return user.plant_name || user.plant?.name || user.plant || 'Your Plant';
  };

  // Fetch trips function
  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const user = getCurrentUser();
      const userPlantId = getUserPlantId();
      const agencyId = user.agency_id;
      
      console.log('🔄 Fetching trips for user:', {
        role: user.role,
        plantId: userPlantId,
        agencyId: agencyId
      });

      let response;
      
      if (userPlantId === 'agency_user' && agencyId) {
        // This is a transporter/agency user - fetch only their trips
        console.log('👤 Agency user detected, fetching agency-specific trips');
        response = await api.getTripsByAgency(agencyId);
      } else if (userPlantId) {
        // Plant admin - fetch trips for specific plant
        response = await api.getTripsByPlant(userPlantId);
      } else {
        // Admin - fetch all trips
        response = await api.getAllTrips();
      }

      console.log('✅ Trips response:', response);

      if (response.error) {
        setError(response.error.message || 'Failed to fetch trips');
        return;
      }

      const tripsData = response.data || [];
      console.log('📊 Raw trips data:', tripsData);
      setTrips(tripsData);
      
      // Apply any active filters when fetching new data
      applyAllFilters(tripsData);

    } catch (err) {
      console.error('❌ Error fetching trips:', err);
      setError('Error fetching trips: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [getUserPlantId]);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    fetchTrips();
  }, [fetchTrips]);

  // Apply search filter
  const applySearchFilter = (tripsData) => {
    if (!searchTerm.trim()) {
      return tripsData;
    }

    const term = searchTerm.toLowerCase().trim();
    
    return tripsData.filter(trip => {
      switch (searchType) {
        case 'plant':
          const plantName = trip.plant?.name || trip.plant_name || trip.plant || '';
          return plantName.toLowerCase().includes(term);
        
        case 'vehicle':
          const vehicleNumber = trip.vehicle?.vehicle_number || trip.vehicle_number || '';
          return vehicleNumber.toLowerCase().includes(term);
        
        case 'transporter':
          const transporterName = getTransporterName(trip).toLowerCase();
          return transporterName.includes(term);
        
        case 'all':
        default:
          // Search in all fields
          const plant = (trip.plant?.name || trip.plant_name || trip.plant || '').toLowerCase();
          const vehicle = (trip.vehicle?.vehicle_number || trip.vehicle_number || '').toLowerCase();
          const transporter = getTransporterName(trip).toLowerCase();
          const vendor = getVendorName(trip).toLowerCase();
          const driver = (trip.driver_name || '').toLowerCase();
          const tripId = (trip.id || '').toString().toLowerCase();
          
          return plant.includes(term) || 
                 vehicle.includes(term) || 
                 transporter.includes(term) ||
                 vendor.includes(term) ||
                 driver.includes(term) ||
                 tripId.includes(term);
      }
    });
  };

  // Apply all filters (status, date, and search)
  const applyAllFilters = (tripsData) => {
    let filtered = [...tripsData];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(trip => {
        const statusLower = (trip.status || '').toLowerCase();
        
        switch (statusFilter) {
          case 'completed':
            return statusLower === 'completed';
          case 'pending':
            return statusLower === 'pending';
          case 'inProgress':
            return statusLower === 'active' || 
                   statusLower === 'in_progress' || 
                   statusLower === 'in progress';
          default:
            return true;
        }
      });
    }

    // Apply date filter
    if (dateFilter.startDate || dateFilter.endDate) {
      filtered = filtered.filter(trip => {
        const tripDate = trip.Start_Date || trip.created_at?.split('T')[0];
        if (!tripDate) return false;

        const tripDateObj = new Date(tripDate);
        
        if (dateFilter.startDate && dateFilter.endDate) {
          const startDateObj = new Date(dateFilter.startDate);
          const endDateObj = new Date(dateFilter.endDate);
          return tripDateObj >= startDateObj && tripDateObj <= endDateObj;
        } else if (dateFilter.startDate) {
          const startDateObj = new Date(dateFilter.startDate);
          return tripDateObj >= startDateObj;
        } else if (dateFilter.endDate) {
          const endDateObj = new Date(dateFilter.endDate);
          return tripDateObj <= endDateObj;
        }
        
        return true;
      });
    }

    // Apply search filter
    filtered = applySearchFilter(filtered);

    setFilteredTrips(filtered);
    
    // Calculate statistics based on filtered trips
    calculateStats(filtered);
    
    // Update filter active state
    const isAnyFilterActive = 
      statusFilter !== 'all' || 
      dateFilter.startDate || 
      dateFilter.endDate ||
      searchTerm.trim() !== '';
    
    setFilterActive(isAnyFilterActive);
    setSearchActive(searchTerm.trim() !== '');
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Apply all filters with new search term
    applyAllFilters(trips);
  };

  // Handle search type change
  const handleSearchTypeChange = (type) => {
    setSearchType(type);
    // Re-apply filters with new search type
    if (searchTerm.trim()) {
      applyAllFilters(trips);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchType('all');
    applyAllFilters(trips);
  };

  // Handle status filter click
  const handleStatusFilterClick = (statusType) => {
    const newStatusFilter = statusFilter === statusType ? 'all' : statusType;
    setStatusFilter(newStatusFilter);
    applyAllFilters(trips);
  };

  // Apply date filter
  const applyDateFilter = () => {
    applyAllFilters(trips);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter('all');
    setDateFilter({
      startDate: '',
      endDate: ''
    });
    setSearchTerm('');
    setSearchType('all');
    setFilteredTrips(trips);
    setFilterActive(false);
    setSearchActive(false);
    calculateStats(trips);
  };

  // Clear date filter only
  const clearDateFilter = () => {
    setDateFilter({
      startDate: '',
      endDate: ''
    });
    applyAllFilters(trips);
  };

  // Calculate dashboard statistics
  const calculateStats = (tripsData) => {
    const totalTrips = tripsData.length;
    const completedTrips = tripsData.filter(trip => 
      trip.status === 'completed' || trip.status === 'Completed'
    ).length;
    const pendingTrips = tripsData.filter(trip => 
      trip.status === 'pending' || trip.status === 'Pending'
    ).length;
    const inProgressTrips = tripsData.filter(trip => 
      trip.status === 'active' || trip.status === 'in_progress' || trip.status === 'In Progress'
    ).length;
    
    const totalDistance = tripsData.reduce((sum, trip) => {
      return sum + (parseFloat(trip.distance_km) || 0);
    }, 0);

    setStats({
      totalTrips,
      completedTrips,
      pendingTrips,
      inProgressTrips,
      totalDistance: Math.round(totalDistance * 100) / 100
    });
  };

  // Format Trip ID
  const formatTripId = (id) => {
    if (!id) return 'N/A';
    const idString = String(id);
    if (idString.length > 8) {
      return `#${idString.slice(-8)}`;
    }
    return `#${idString}`;
  };

  // Format date and time combined
  const formatDateTime = (dateString, timeString) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') {
      return <div className={styles.dateTimeCell}>N/A</div>;
    }

    try {
      let date;
      const cleanDate = dateString.trim();
      
      // Handle date
      if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = cleanDate.split('-');
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(cleanDate);
      }

      if (isNaN(date.getTime())) {
        return <div className={styles.dateTimeCell}>N/A</div>;
      }

      // Format date
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      // If time is provided, format it too
      let formattedTime = 'N/A';
      if (timeString && timeString !== 'null' && timeString !== 'undefined') {
        const cleanTime = timeString.trim();
        formattedTime = formatTime(cleanTime);
      }

      return (
        <div className={styles.dateTimeCell}>
          <div className={styles.datePart}>{formattedDate}</div>
          <div className={styles.timePart}>{formattedTime}</div>
        </div>
      );
    } catch (error) {
      return <div className={styles.dateTimeCell}>N/A</div>;
    }
  };

  // Format time helper function
  const formatTime = (timeString) => {
    if (!timeString || timeString === 'null' || timeString === 'undefined') {
      return 'N/A';
    }

    let time;
    const cleanTime = timeString.trim();
    
    try {
      // Check if it's a full datetime string
      if (cleanTime.includes('T') || cleanTime.includes(' ')) {
        time = new Date(cleanTime);
      } else if (cleanTime.match(/^\d{1,2}:\d{2}/)) {
        const [hours, minutes, seconds] = cleanTime.split(':');
        const today = new Date();
        today.setHours(parseInt(hours), parseInt(minutes), seconds ? parseInt(seconds) : 0);
        time = today;
      } else {
        return cleanTime; // Return as is if can't parse
      }

      if (!time || isNaN(time.getTime())) {
        return cleanTime;
      }

      return time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return cleanTime;
    }
  };

  // Get transporter name
  const getTransporterName = (trip) => {
    return trip.agencies?.name || 
           trip.agency?.name || 
           trip.transporter_name || 
           'N/A';
  };

  // Get vendor name
  const getVendorName = (trip) => {
    return trip.vendor?.name || 
           trip.vendor_name || 
           trip.vendorName || 
           'N/A';
  };

  // Get end vendor name
  const getEndVendorName = (trip) => {
    return trip.end_vendor?.name || 
           trip.end_vendor_name || 
           trip.endVendorName || 
           (trip.status === 'completed' ? trip.vendor?.name || 'N/A' : 'N/A');
  };

  // Get start location
  const getStartLocation = (trip) => {
    return trip.start_address || 
           (trip.start_lat && trip.start_lng ? 
            `Lat: ${trip.start_lat}, Lng: ${trip.start_lng}` : 'N/A');
  };

  // Get end location
  const getEndLocation = (trip) => {
    if (trip.status === 'completed' || trip.status === 'Completed') {
      return trip.end_address || 
             (trip.end_lat && trip.end_lng ? 
              `Lat: ${trip.end_lat}, Lng: ${trip.end_lng}` : 'N/A');
    }
    return 'In Progress';
  };

  // Get distance
  const getDistance = (trip) => {
    return trip.distance_km ? `${trip.distance_km} km` : 'N/A';
  };

  // Get status badge class
  const getStatusClass = (status) => {
    if (!status) return styles.statusDefault;
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'completed':
        return styles.statusCompleted;
      case 'active':
      case 'in_progress':
      case 'in progress':
        return styles.statusInProgress;
      case 'pending':
        return styles.statusPending;
      default:
        return styles.statusDefault;
    }
  };

  // Get display status
  const getDisplayStatus = (status) => {
    if (!status) return 'Unknown';
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'active':
        return 'In Progress';
      case 'in_progress':
        return 'In Progress';
      default:
        return status.replace('_', ' ');
    }
  };

  // Sort trips
  const getSortedTrips = () => {
    return [...filteredTrips].sort((a, b) => {
      const statusA = getDisplayStatus(a.status).toLowerCase();
      const statusB = getDisplayStatus(b.status).toLowerCase();
      const priority = {
        'in progress': 1,
        'completed': 2
      };
      const priorityA = priority[statusA] || 3;
      const priorityB = priority[statusB] || 3;
      return priorityA - priorityB;
    });
  };

  // Print functionality
  const handlePrint = () => {
    const sortedTrips = getSortedTrips();
    const printContent = tableRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    
    const filterInfo = filterActive ? 
      `Filter: ${statusFilter !== 'all' ? statusFilter : 'All Statuses'} | Date Range: ${dateFilter.startDate || 'Any'} to ${dateFilter.endDate || 'Any'}` : 
      'All Trips';
    
    document.body.innerHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trips Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .print-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .print-header h1 { margin: 0; color: #333; }
          .print-header p { margin: 5px 0; color: #666; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .print-table th, .print-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .print-table th { background-color: #f5f5f5; font-weight: bold; }
          .print-footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>Trips Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <p>Plant: ${getUserPlantName()}</p>
          <p>${filterInfo}</p>
        </div>
        ${printContent}
        <div class="print-footer">
          <p>Total Trips: ${stats.totalTrips} | Completed: ${stats.completedTrips} | Pending: ${stats.pendingTrips} | In Progress: ${stats.inProgressTrips}</p>
        </div>
      </body>
      </html>
    `;
    
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  // Export to CSV
  const handleExportCSV = () => {
    const sortedTrips = getSortedTrips();
    const headers = [
      'Trip ID',
      'Plant',
      'Vehicle',
      'Transporter',
      'Vendor',
      'End Vendor',
      'Driver',
      'Start Location',
      'End Location',
      'Start Date & Time',
      'End Date & Time',
      'Distance (km)',
      'Status'
    ];

    const csvData = sortedTrips.map(trip => [
      trip.id || 'N/A',
      trip.plant?.name || trip.plant_name || trip.plant || 'N/A',
      trip.vehicle?.vehicle_number || trip.vehicle_number || 'N/A',
      getTransporterName(trip),
      getVendorName(trip),
      getEndVendorName(trip),
      trip.driver_name || 'N/A',
      getStartLocation(trip),
      getEndLocation(trip),
      `${trip.Start_Date || 'N/A'} ${formatTime(trip.start_time)}`,
      `${trip.End_Date || 'N/A'} ${formatTime(trip.end_time)}`,
      trip.distance_km || '0',
      getDisplayStatus(trip.status)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    const statusInfo = statusFilter !== 'all' ? `_${statusFilter}` : '_all_statuses';
    const dateInfo = filterActive ? 
      `_${dateFilter.startDate || 'all'}_to_${dateFilter.endDate || 'all'}` : 
      '_all_dates';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trips-report${statusInfo}${dateInfo}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const userPlantName = getUserPlantName();
  const isAdmin = currentUser.role === 'admin';
  const sortedTrips = getSortedTrips();

  return (
    <AdminNavigation>
      <div className={styles.dashboard}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Trips Dashboard</h1>
            <p className={styles.subtitle}>
              {isAdmin ? 'All Plants' : `${userPlantName}`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button 
              className={styles.refreshButton}
              onClick={fetchTrips}
              disabled={loading}
            >
              🔄 {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button 
              className={styles.printButton}
              onClick={handlePrint}
              disabled={sortedTrips.length === 0}
            >
              🖨️ Print
            </button>
            <button 
              className={styles.exportButton}
              onClick={handleExportCSV}
              disabled={sortedTrips.length === 0}
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            ⚠️ {error}
            <button onClick={() => setError('')} className={styles.dismissError}>×</button>
          </div>
        )}

        {/* Stats and Filter Row */}
        <div className={styles.statsFilterRow}>
          {/* Stats Cards - Left Side */}
          <div className={styles.statsContainer}>
            <div className={styles.statsGrid}>
              <div 
                className={`${styles.statCard} ${statusFilter === 'all' ? styles.statCardActive : ''}`}
                onClick={() => handleStatusFilterClick('all')}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.statIcon}>📊</div>
                <div className={styles.statInfo}>
                  <h3 className={styles.statNumber}>{stats.totalTrips}</h3>
                  <p className={styles.statLabel}>Total Trips</p>
                </div>
              </div>

              <div 
                className={`${styles.statCard} ${statusFilter === 'completed' ? styles.statCardActive : ''}`}
                onClick={() => handleStatusFilterClick('completed')}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.statIcon}>✅</div>
                <div className={styles.statInfo}>
                  <h3 className={styles.statNumber}>{stats.completedTrips}</h3>
                  <p className={styles.statLabel}>Completed</p>
                </div>
              </div>

              <div 
                className={`${styles.statCard} ${statusFilter === 'inProgress' ? styles.statCardActive : ''}`}
                onClick={() => handleStatusFilterClick('inProgress')}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.statIcon}>⏳</div>
                <div className={styles.statInfo}>
                  <h3 className={styles.statNumber}>{stats.inProgressTrips}</h3>
                  <p className={styles.statLabel}>In Progress</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters - Right Side */}
          <div className={styles.filterContainer}>
            {/* Search Bar */}
            <div className={styles.searchBarContainer}>
              <div className={styles.searchBar}>
                <div className={styles.searchIcon}>🔍</div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder={`Search ${searchType === 'all' ? 'trips' : searchType}...`}
                  className={styles.searchInput}
                />
                {searchTerm && (
                  <button 
                    className={styles.clearSearchButton}
                    onClick={handleClearSearch}
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <div className={styles.searchTypeSelector}>
                <div className={styles.searchTypeButtons}>
                  <button
                    className={`${styles.searchTypeButton} ${searchType === 'all' ? styles.activeSearchType : ''}`}
                    onClick={() => handleSearchTypeChange('all')}
                  >
                    All
                  </button>
                  {isAdmin && (
                    <button
                      className={`${styles.searchTypeButton} ${searchType === 'plant' ? styles.activeSearchType : ''}`}
                      onClick={() => handleSearchTypeChange('plant')}
                    >
                      Plant
                    </button>
                  )}
                  <button
                    className={`${styles.searchTypeButton} ${searchType === 'vehicle' ? styles.activeSearchType : ''}`}
                    onClick={() => handleSearchTypeChange('vehicle')}
                  >
                    Vehicle
                  </button>
                  <button
                    className={`${styles.searchTypeButton} ${searchType === 'transporter' ? styles.activeSearchType : ''}`}
                    onClick={() => handleSearchTypeChange('transporter')}
                  >
                    Transporter
                  </button>
                </div>
              </div>
            </div>

            {/* Date Filter */}
            <div className={styles.dateFilters}>
              <div className={styles.dateInputGroup}>
                <label>From Date:</label>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter(prev => ({
                    ...prev,
                    startDate: e.target.value
                  }))}
                  className={styles.dateInput}
                />
              </div>
              <div className={styles.dateInputGroup}>
                <label>To Date:</label>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter(prev => ({
                    ...prev,
                    endDate: e.target.value
                  }))}
                  className={styles.dateInput}
                />
              </div>
              <div className={styles.filterActions}>
                <button
                  className={styles.applyFilterButton}
                  onClick={applyDateFilter}
                  disabled={loading}
                >
                  🔍 Apply Date Filter
                </button>
                {(filterActive) && (
                  <button
                    className={styles.clearFilterButton}
                    onClick={clearAllFilters}
                  >
                    🗑️ Clear All
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Information Row */}
        {(filterActive) && (
          <div className={styles.filterInfoRow}>
            <div className={styles.filterInfo}>
              <span className={styles.filterInfoLabel}>Active Filters:</span>
              <div className={styles.activeFilters}>
                {statusFilter !== 'all' && (
                  <span className={styles.activeFilterTag}>
                    Status: <strong>{statusFilter}</strong>
                    <button 
                      onClick={() => handleStatusFilterClick(statusFilter)}
                      className={styles.removeFilterButton}
                    >
                      ✕
                    </button>
                  </span>
                )}
                {searchActive && (
                  <span className={styles.activeFilterTag}>
                    Search: <strong>"{searchTerm}"</strong> in {searchType}
                    <button 
                      onClick={handleClearSearch}
                      className={styles.removeFilterButton}
                    >
                      ✕
                    </button>
                  </span>
                )}
                {(dateFilter.startDate || dateFilter.endDate) && (
                  <span className={styles.activeFilterTag}>
                    Date: <strong>{dateFilter.startDate || 'Any'}</strong> to <strong>{dateFilter.endDate || 'Any'}</strong>
                    <button 
                      onClick={clearDateFilter}
                      className={styles.removeFilterButton}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
              <span className={styles.resultCount}>
                Showing <strong>{filteredTrips.length}</strong> of <strong>{trips.length}</strong> trips
              </span>
            </div>
          </div>
        )}

        {/* Recent Trips Table */}
        <div className={styles.recentTrips}>
          <div className={styles.sectionHeader}>
            <h2>Recent Trips</h2>
            <span className={styles.tripCount}>
              Showing {sortedTrips.length} trips
            </span>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading trips...</div>
          ) : sortedTrips.length === 0 ? (
            <div className={styles.noData}>
              <p>No trips found</p>
              {filterActive ? (
                <p className={styles.helperText}>
                  No trips match your filters. Try adjusting the filters or{' '}
                  <button 
                    onClick={clearAllFilters}
                    className={styles.clearFilterLink}
                  >
                    clear all filters
                  </button>
                </p>
              ) : (
                isAdmin && (
                  <p className={styles.helperText}>
                    Trips will appear here once they are created
                  </p>
                )
              )}
            </div>
          ) : (
            <div className={styles.tableContainer} ref={tableRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Trip ID</th>
                    {isAdmin && <th>Plant</th>}
                    <th>Vehicle</th>
                    <th>Transporter</th>
                    <th>Vendor</th>
                    <th>End Vendor</th>
                    <th>Driver</th>
                    <th>Start Location</th>
                    <th>End Location</th>
                    <th>Start Date & Time</th>
                    <th>End Date & Time</th>
                    <th>Distance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTrips.map((trip) => (
                    <tr key={trip.id}>
                      <td className={styles.tripId}>
                        {formatTripId(trip.id)}
                      </td>
                      {isAdmin && (
                        <td>
                          {trip.plant?.name || trip.plant_name || trip.plant || 'N/A'}
                        </td>
                      )}
                      <td>
                        {trip.vehicle?.vehicle_number || trip.vehicle_number || 'N/A'}
                      </td>
                      <td>{getTransporterName(trip)}</td>
                      <td>{getVendorName(trip)}</td>
                      <td>{getEndVendorName(trip)}</td>
                      <td>{trip.driver_name || 'N/A'}</td>
                      <td className={styles.locationCell}>{getStartLocation(trip)}</td>
                      <td className={styles.locationCell}>{getEndLocation(trip)}</td>
                      <td>
                        {formatDateTime(trip.Start_Date, trip.start_time)}
                      </td>
                      <td>
                        {formatDateTime(trip.End_Date, trip.end_time)}
                      </td>
                      <td className={styles.distanceCell}>{getDistance(trip)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(trip.status)}`}>
                          {getDisplayStatus(trip.status)}
                        </span>
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

export default Dashboard;