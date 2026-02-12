import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../Services/api';
import styles from './Billing.module.css';
import AdminNavigation from '../../Common/Admin/AdminNavigation';

const Billing = () => {
  const [trips, setTrips] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plants, setPlants] = useState([]);
  const [activeTab, setActiveTab] = useState('completed');
  
  // Filter states
  const [filters, setFilters] = useState({
    transporter: '',
    vehicleNumber: '',
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(true);
  
  // Store billing form state for each trip
  const [billingStates, setBillingStates] = useState({});

  // User info for report and access control
  const [userInfo, setUserInfo] = useState({
    generatedByUser: 'System User',
    userDepartment: 'Admin',
    userId: 'N/A',
    userRole: 'Admin',
    userAgencyId: null,
    userAgencyName: ''
  });

  // 🔐 ACCESS CONTROL: Check if user can edit bills (ONLY DRIVERS)
  const canEditBills = () => {
    return userInfo.userRole === 'driver';
  };

  // 🔐 ACCESS CONTROL: Check if user can view bills (all roles except maybe guest)
  const canViewBills = () => {
    const allowedRoles = ['driver', 'admin', 'super_admin', 'plant_admin', 'finance', 'mmd'];
    return allowedRoles.includes(userInfo.userRole);
  };

  // Ref for print content
  const printRef = useRef();

  // --- HELPER: Fetch User Department ---
  const fetchUserWithDepartment = async (userId) => {
    try {
      if (!userId) return null;
      const userResponse = await api.getUserById(userId);
      if (userResponse.error) return null;
      
      const userData = userResponse.data;
      if (!userData) return null;
      
      if (userData.department_id) {
        const deptResponse = await api.getDepartmentById(userData.department_id);
        if (deptResponse.data) {
          return {
            ...userData,
            department_name: deptResponse.data.name,
            department_code: deptResponse.data.code
          };
        }
      }
      return userData;
    } catch (error) {
      console.error('Error fetching user with department:', error);
      return null;
    }
  };

  const getDepartmentName = (userData) => {
    if (!userData) return 'Admin';
    if (userData.department_name) return userData.department_name;
    if (userData.department && userData.department.name) return userData.department.name;
    
    const role = userData.role || 'admin';
    const departmentMap = {
      'super_admin': 'Administration',
      'admin': 'Administration',
      'plant_admin': 'Plant Operations',
      'driver': 'Transport Department',
      'finance': 'Finance Department',
      'mmd': 'MMD Department'
    };
    return departmentMap[role.toLowerCase()] || 'Admin';
  };

  // --- MAIN DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Get Current User from Storage
        const storedUser = JSON.parse(localStorage.getItem('adminData') || localStorage.getItem('plantAdminData') || localStorage.getItem('userData') || '{}');
        const userId = storedUser.id;
        const userRole = storedUser.role || 'guest';
        const userPlantId = storedUser.plant_id;
        const userAgencyId = storedUser.agency_id;
        const userTransporterName = storedUser.transporter_name;

        console.log("User Info from Storage:", {
          userId,
          userRole,
          userPlantId,
          userAgencyId,
          userTransporterName
        });

        // 2. Resolve User Details (Department, etc.)
        let userWithDepartment = null;
        if (userId) {
          userWithDepartment = await fetchUserWithDepartment(userId);
        }

        const finalUserObj = userWithDepartment || storedUser;
        setUserInfo({
          generatedByUser: finalUserObj.username || finalUserObj.name || 'System User',
          userDepartment: getDepartmentName(finalUserObj),
          userId: userId || 'N/A',
          userRole: userRole,
          userAgencyId: userAgencyId,
          userAgencyName: userTransporterName || finalUserObj.agency_name || 'N/A'
        });

        // 3. Fetch System Data
        const [tripsRes, ratesRes, billingRes, plantsRes, agenciesRes] = await Promise.all([
           api.getAllTrips(),
           api.getRates(),
           api.getBillings(),
           api.getPlants(),
           api.getAgencies()
        ]);

        if (tripsRes.error) throw new Error(tripsRes.error.message);
        
        setRates(ratesRes.data || []);
        setPlants(plantsRes.data || []);

        // Create Lookups
        const agenciesMap = new Map((agenciesRes.data || []).map(a => [a.id, a]));
        const plantsMap = new Map((plantsRes.data || []).map(p => [p.id, p]));

        // --- STRICT DATA ISOLATION LOGIC ---
        let rawTrips = tripsRes.data || [];
        
        // Filter based on user role
        if (userRole === 'driver') {
          // DRIVERS: Only show trips from their agency
          if (userAgencyId) {
            console.log(`🚚 Driver Isolation: Showing only trips for Agency ID: ${userAgencyId} (${userTransporterName})`);
            rawTrips = rawTrips.filter(trip => {
              // Check if trip belongs to driver's agency
              return trip.agency_id === userAgencyId;
            });
          } else {
            console.warn("Driver has no Agency ID. Hiding all data.");
            rawTrips = [];
          }
        } 
        else if (['finance', 'mmd', 'plant_admin'].includes(userRole)) {
          // Finance, MMD, Plant Admin: Show only their plant's trips (VIEW ONLY)
          if (userPlantId) {
            console.log(`🔒 Isolating Billing Data for ${userRole} at Plant ID: ${userPlantId} (VIEW ONLY)`);
            rawTrips = rawTrips.filter(trip => {
              // Check 1: Trip directly assigned to plant
              if (trip.plant_id === userPlantId) return true;
              // Check 2: Trip's agency belongs to plant
              const agency = agenciesMap.get(trip.agency_id);
              if (agency && agency.plant_id === userPlantId) return true;
              return false;
            });
          } else {
            console.warn("Restricted user has no Plant ID. Hiding all data.");
            rawTrips = [];
          }
        }
        // Admin and Super Admin can see all trips

        console.log(`Filtered trips count for ${userRole}:`, rawTrips.length);

        // 4. Enrich & Filter Completed Trips
        const completedTrips = rawTrips.filter(t => 
          t.status && t.status.toLowerCase() === 'completed'
        ).map(trip => {
          const agency = agenciesMap.get(trip.agency_id);
          if (agency && agency.plant_id) {
            const plant = plantsMap.get(agency.plant_id);
            return {
              ...trip,
              agency: { ...agency, plant: plant }
            };
          }
          return trip;
        });

        // 5. Map Billing Status
        const initialBillingStates = {};
        const billingDataMap = new Map((billingRes.data || []).map(b => [b.trip_id, b]));

        completedTrips.forEach(trip => {
          const existing = billingDataMap.get(trip.id);
          if (existing) {
            const displayTripType = existing.trip_type === 'Trip' ? 'Trip Basis' : 
                                   existing.trip_type === 'Kilometer' ? 'Kilometer Basis' : 
                                   existing.trip_type;
            
            initialBillingStates[trip.id] = {
              tripType: displayTripType,
              tollFees: existing.toll_fees,
              calculatedRate: existing.calculated_rate,
              totalAmount: existing.total_amount,
              isSaved: true,
              billNumber: existing.bill_number || `INV${new Date().getFullYear()}${String(existing.id).padStart(6, '0')}`,
              billingDate: existing.created_at || new Date().toISOString()
            };
          } else {
            initialBillingStates[trip.id] = {
              tripType: '',
              tollFees: 0,
              calculatedRate: 0,
              totalAmount: 0,
              isSaved: false,
              billNumber: '',
              billingDate: ''
            };
          }
        });

        setBillingStates(initialBillingStates);
        setTrips(completedTrips);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load billing data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- FILTERS & HELPERS ---

  // Get transporters based on user role
  const getTransporters = () => {
    if (userInfo.userRole === 'driver') {
      // Driver only sees their own transporter
      return [userInfo.userAgencyName].filter(name => name && name !== 'N/A');
    }
    
    // For other roles, get all transporters from their trips
    return [...new Set(trips
      .map(trip => trip.agency?.name)
      .filter(name => name && name !== 'N/A'))].sort();
  };

  const uniqueTransporters = getTransporters();
  const uniqueVehicleNumbers = [...new Set(trips
    .map(trip => trip.vehicle_number)
    .filter(number => number && number !== 'N/A'))].sort();

  const getFilteredTrips = (tripList) => {
    return tripList.filter(trip => {
      const matchesTransporter = !filters.transporter || 
        (trip.agency?.name && trip.agency.name.toLowerCase().includes(filters.transporter.toLowerCase()));
      
      const matchesVehicle = !filters.vehicleNumber || 
        (trip.vehicle_number && trip.vehicle_number.toLowerCase().includes(filters.vehicleNumber.toLowerCase()));
      
      const tripDate = new Date(trip.End_Date);
      const matchesStartDate = !filters.startDate || tripDate >= new Date(filters.startDate);
      
      const matchesEndDate = !filters.endDate;
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (tripDate <= endDate) return true;
        return false;
      }
      
      return matchesTransporter && matchesVehicle && matchesStartDate && matchesEndDate;
    });
  };

  const pendingBills = getFilteredTrips(trips.filter(trip => !billingStates[trip.id]?.isSaved));
  const generatedBills = getFilteredTrips(trips.filter(trip => billingStates[trip.id]?.isSaved));

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({ transporter: '', vehicleNumber: '', startDate: '', endDate: '' });
  };

  const isFilterActive = () => {
    return filters.transporter || filters.vehicleNumber || filters.startDate || filters.endDate;
  };

  // --- CALCULATION LOGIC ---

  const calculateRate = (trip, tripType) => {
    if (!tripType) return 0;

    const agencyId = trip.agency_id;
    const vehicleCapacity = parseFloat(trip.vehicle?.capacity || 0);
    const distance = parseFloat(trip.distance_km || 0);

    const rateType = tripType === 'Trip Basis' ? 'Trip' : 
                     tripType === 'Kilometer Basis' ? 'Kilometer' : 
                     tripType;

    const matchingRate = rates.find(rate => {
      const sameAgency = rate.agency_id === agencyId;
      const sameCapacity = parseFloat(rate.tone) === vehicleCapacity;
      const sameType = rate.type === rateType;
      
      if (!sameAgency || !sameCapacity || !sameType) return false;

      if (rateType === 'Trip') {
        const minKm = parseFloat(rate.min_km || 0);
        const maxKm = parseFloat(rate.max_km || Infinity);
        return distance >= minKm && distance <= maxKm;
      }

      return true;
    });

    if (!matchingRate) return 0;

    if (rateType === 'Trip') return parseFloat(matchingRate.rate);
    if (rateType === 'Kilometer') return parseFloat(matchingRate.rate) * distance;

    return 0;
  };

  // 🚫 INPUT CHANGE - Only allow if user is DRIVER
  const handleInputChange = (tripId, field, value) => {
    // 🔐 CHECK: Only drivers can edit
    if (!canEditBills()) {
      alert('⚠️ You do not have permission to edit bills. Only drivers can create/edit bills.');
      return;
    }

    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    setBillingStates(prev => {
      const currentState = prev[tripId] || {};
      const newState = { ...currentState, [field]: value };

      const type = field === 'tripType' ? value : currentState.tripType;
      const toll = field === 'tollFees' ? parseFloat(value || 0) : parseFloat(currentState.tollFees || 0);

      const calculatedRate = calculateRate(trip, type);
      const totalAmount = calculatedRate + toll;

      return {
        ...prev,
        [tripId]: {
          ...newState,
          calculatedRate,
          totalAmount,
          isSaved: false
        }
      };
    });
  };

  // 🚫 SAVE - Only allow if user is DRIVER
  const handleSave = async (tripId) => {
    // 🔐 CHECK: Only drivers can save
    if (!canEditBills()) {
      alert('⚠️ You do not have permission to save bills. Only drivers can create bills.');
      return;
    }

    const state = billingStates[tripId];
    if (!state) return;

    try {
      const dbTripType = state.tripType === 'Trip Basis' ? 'Trip' : 
                         state.tripType === 'Kilometer Basis' ? 'Kilometer' : 
                         state.tripType;

      const billingData = {
        trip_id: tripId,
        trip_type: dbTripType,
        calculated_rate: state.calculatedRate,
        toll_fees: state.tollFees,
        total_amount: state.totalAmount
      };

      const response = await api.saveBilling(billingData);
      
      if (response.error) {
        alert('Failed to save: ' + response.error.message);
      } else {
        const billId = response.data?.id || Date.now();
        const billNumber = `INV${new Date().getFullYear()}${String(billId).padStart(6, '0')}`;
        
        setBillingStates(prev => ({
          ...prev,
          [tripId]: { 
            ...prev[tripId], 
            isSaved: true,
            billNumber: billNumber,
            billingDate: new Date().toISOString()
          }
        }));
        alert('✅ Bill saved successfully!');
        setActiveTab('generated');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('❌ Error saving billing data');
    }
  };

  // --- PRINT LOGIC (All roles can view/print) ---
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow pop-ups for this site to print reports.');
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-IN');
    
    const totalCalculatedRate = generatedBills.reduce((sum, trip) => sum + (billingStates[trip.id]?.calculatedRate || 0), 0);
    const totalOtherCharges = generatedBills.reduce((sum, trip) => sum + (billingStates[trip.id]?.tollFees || 0), 0);
    const totalAmount = generatedBills.reduce((sum, trip) => sum + (billingStates[trip.id]?.totalAmount || 0), 0);

    const formatDateForPrint = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-IN') : '';
    const formatCurrencyForPrint = (amount) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
    const formatTripId = (id) => id ? '#' + String(id).slice(0, 8) : 'N/A';
    
    const getDriverName = (trip) => {
      if (trip.driver_name) return trip.driver_name;
      if (trip.driver?.full_name) return trip.driver.full_name;
      return 'N/A';
    };

    const getDriverPhone = (trip) => trip.driver?.phone || trip.driver_phone || 'N/A';

    const printHTML = `
  <html>
    <head>
      <title>Bills Generated Report - ${currentDate}</title>
      <style>
        @media print { @page { size: A4 portrait; margin: 10mm; } body { font-family: Arial, sans-serif; font-size: 10px; } }
        body { font-family: Arial, sans-serif; margin: 15px; font-size: 10px; }
        .print-header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 8px; }
        .company-name { font-size: 20px; font-weight: bold; }
        .generated-info { font-size: 9px; color: #666; margin-top: 5px; }
        .user-info-highlight { background: #f9f9f9; padding: 6px; border-radius: 4px; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9px; }
        th, td { border: 1px solid #ddd; padding: 5px; text-align: left; }
        th { background: #f2f2f2; }
        .amount { text-align: right; }
        .total-row { background: #e8f4ff; font-weight: bold; }
        .print-button { background: #4CAF50; color: white; border: none; padding: 8px 16px; cursor: pointer; margin-top: 15px; }
        .no-print { text-align: center; }
        .view-only-badge { background: #ff9800; color: white; padding: 2px 8px; border-radius: 12px; font-size: 8px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="print-header">
        <div class="company-name">Market Vehicle Bill Summary</div>
        <div class="generated-info">
          Generated on: ${new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })} at ${new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })}
          ${!canEditBills() ? '<span class="view-only-badge">VIEW ONLY</span>' : ''}
        </div>
      </div>
      
      <div class="user-info-highlight">
        <strong>Generated By:</strong> ${userInfo.generatedByUser} (${userInfo.userRole}) | 
        ${userInfo.userAgencyName !== 'N/A' ? `<strong>Transporter:</strong> ${userInfo.userAgencyName}` : ''}
      </div>
      
      <div style="margin-bottom: 10px;">
        <strong>Period:</strong> ${filters.startDate ? formatDateForPrint(filters.startDate) : 'All'} to ${filters.endDate ? formatDateForPrint(filters.endDate) : 'All'}
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Trip ID</th>
            <th>Date</th>
            <th>Vehicle</th>
            <th>Driver</th>
            <th>Dist</th>
            <th>Type</th>
            <th>Rate</th>
            <th>Other</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${generatedBills.map((trip) => {
            const state = billingStates[trip.id] || {};
            return `
              <tr>
                <td>${formatTripId(trip.id)}</td>
                <td>${formatDateForPrint(trip.End_Date)}</td>
                <td>${trip.vehicle_number}<br><small>${trip.agency?.name || ''}</small></td>
                <td>${getDriverName(trip)}</td>
                <td>${trip.distance_km} km</td>
                <td>${state.tripType || 'N/A'}</td>
                <td class="amount">₹ ${formatCurrencyForPrint(state.calculatedRate)}</td>
                <td class="amount">₹ ${formatCurrencyForPrint(state.tollFees)}</td>
                <td class="amount">₹ ${formatCurrencyForPrint(state.totalAmount)}</td>
              </tr>
            `;
          }).join('')}
          <tr class="total-row">
            <td colspan="6" style="text-align: right;"><strong>TOTAL</strong></td>
            <td class="amount">₹ ${formatCurrencyForPrint(totalCalculatedRate)}</td>
            <td class="amount">₹ ${formatCurrencyForPrint(totalOtherCharges)}</td>
            <td class="amount">₹ ${formatCurrencyForPrint(totalAmount)}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="margin-top: 15px; font-size: 9px; color: #666; border-top: 1px dashed #ccc; padding-top: 8px; text-align: center;">
        System Generated Report • ${new Date().toLocaleString('en-IN')}
      </div>
      
      <div class="no-print">
        <button class="print-button" onclick="window.print()">🖨️ Print Report</button>
      </div>
    </body>
  </html>
`;

    printWindow.document.write(printHTML);
    printWindow.document.close();
  };

  // --- FORMATTERS ---
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-IN') : 'N/A';
  const formatLocation = (address) => address ? (address.length > 30 ? address.substring(0, 30) + '...' : address) : 'N/A';
  const formatTripId = (id) => id ? '#' + String(id).slice(0, 8) : 'N/A';
  
  const getDriverName = (trip) => {
    if (trip.driver_name) return trip.driver_name;
    if (trip.driver?.full_name) return trip.driver.full_name;
    return 'N/A';
  };
  
  const getDriverPhone = (trip) => trip.driver?.phone || trip.driver?.mobile || trip.driver_phone || 'N/A';

  // --- RENDER ---
  const renderTable = () => {
    const data = activeTab === 'completed' ? pendingBills : generatedBills;
    const title = activeTab === 'completed' ? 'Completed Trips' : 'Bills Generated';
    const count = data.length;

    // Show user-specific info for drivers
    const userSpecificInfo = userInfo.userRole === 'driver' && userInfo.userAgencyName !== 'N/A' ? (
      <div className={styles.userSpecificInfo}>
        <span className={styles.userRoleBadge}>🚚 Driver</span>
        <span className={styles.transporterBadge}>📦 {userInfo.userAgencyName}</span>
      </div>
    ) : null;

    // 🔐 Show view-only badge for non-drivers
    const viewOnlyBadge = !canEditBills() && canViewBills() ? (
      <div className={styles.viewOnlyBadge}>
        <span className={styles.viewOnlyTooltip}>Only drivers can create/edit bills</span>
      </div>
    ) : null;

    return (
      <div className={styles.recentTrips}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.titleWrapper}>
              <h2>{title}</h2>
              {viewOnlyBadge}
            </div>
            {userSpecificInfo}
          </div>
          <div className={styles.headerActions}>
            <span className={styles.tripCount}>
              {count} Records
              {isFilterActive() && <span className={styles.filterActiveBadge}> (Filtered)</span>}
            </span>
            {activeTab === 'generated' && generatedBills.length > 0 && (
              <button className={styles.printReportButton} onClick={handlePrintReport} title="Print Report">
                🖨️ Print Report
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading billing data...</div>
        ) : data.length === 0 ? (
          <div className={styles.noData}>
            <p>
              {isFilterActive() 
                ? 'No records found matching your filters.' 
                : activeTab === 'completed' 
                  ? 'No pending bills to process.' 
                  : 'No bills generated yet.'}
              
              {userInfo.userRole === 'driver' && (
                <div className={styles.driverSpecificMessage}>
                  <p><strong>Note:</strong> You're viewing billing data for your transporter: <strong>{userInfo.userAgencyName}</strong></p>
                </div>
              )}
              
              {!canEditBills() && (
                <div className={styles.viewOnlyMessage}>
                  <p><strong>🔍 View Only Mode:</strong> You can view bills but cannot create or edit them.</p>
                </div>
              )}
            </p>
            {isFilterActive() && (
              <button className={styles.clearFiltersButton} onClick={clearFilters}>Clear Filters</button>
            )}
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Trip ID</th>
                  <th>Date</th>
                  <th>Vehicle & Transporter</th>
                  <th>Driver Name</th>
                  <th>From Location</th>
                  <th>To Location</th>
                  <th>Capacity</th>
                  <th>Distance</th>
                  <th>Trip Type</th>
                  <th>Rate (Calc)</th>
                  <th>Toll&Other charges</th>
                  <th>Total Amount</th>
                  {activeTab === 'completed' && canEditBills() && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((trip) => {
                  const state = billingStates[trip.id] || {};
                  return (
                    <tr key={trip.id}>
                      <td className={styles.tripId}>{formatTripId(trip.id)}</td>
                      <td>{formatDate(trip.End_Date)}</td>
                      <td>
                        <div className={styles.cellStack}>
                          <span className={styles.vehicleNum}>{trip.vehicle_number}</span>
                          <span className={styles.transporterName}>{trip.agency?.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className={styles.driverCell}>
                        <div className={styles.driverInfo}>
                          <span className={styles.driverName}>{getDriverName(trip)}</span>
                          {getDriverPhone(trip) !== 'N/A' && <span className={styles.driverPhone}>{getDriverPhone(trip)}</span>}
                        </div>
                      </td>
                      <td className={styles.locationCell} title={trip.start_address}>{formatLocation(trip.start_address)}</td>
                      <td className={styles.locationCell} title={trip.end_address}>{formatLocation(trip.end_address)}</td>
                      <td>{trip.vehicle?.capacity ? `${trip.vehicle.capacity} Ton` : 'N/A'}</td>
                      <td className={styles.distanceCell}>{trip.distance_km} km</td>
                      <td>
                        {activeTab === 'completed' && canEditBills() ? (
                          <select
                            className={styles.selectInput}
                            value={state.tripType || ''}
                            onChange={(e) => handleInputChange(trip.id, 'tripType', e.target.value)}
                          >
                            <option value="">Select Type</option>
                            <option value="Trip Basis">Trip Basis</option>
                            <option value="Kilometer Basis">Kilometer Basis</option>
                          </select>
                        ) : (
                          <span className={styles.readOnlyValue}>{state.tripType || '—'}</span>
                        )}
                      </td>
                      <td className={styles.amountCell}>
                        <span className={styles.readOnlyValue}>{formatCurrency(state.calculatedRate)}</span>
                      </td>
                      <td className={styles.amountCell}>
                        {activeTab === 'completed' && canEditBills() ? (
                          <input
                            type="number"
                            min="0"
                            className={styles.numberInput}
                            value={state.tollFees || 0}
                            onChange={(e) => handleInputChange(trip.id, 'tollFees', e.target.value)}
                            placeholder="0.00"
                          />
                        ) : (
                          <span className={styles.readOnlyValue}>{formatCurrency(state.tollFees)}</span>
                        )}
                      </td>
                      <td className={`${styles.amountCell} ${styles.totalText}`}>{formatCurrency(state.totalAmount)}</td>
                      {activeTab === 'completed' && canEditBills() && (
                        <td>
                          <div className={styles.actionButtons}>
                            <button
                              className={`${styles.saveButton} ${state.isSaved ? styles.saved : ''}`}
                              onClick={() => handleSave(trip.id)}
                              disabled={!state.tripType || state.calculatedRate === 0}
                            >
                              {state.isSaved ? '✅ Saved' : '💾 Save'}
                            </button>
                            {state.calculatedRate === 0 && state.tripType && (
                              <div className={styles.errorTooltip}>No matching rate</div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // 🔐 ACCESS CONTROL: If user doesn't have view permission, show access denied
  if (!canViewBills()) {
    return (
      <AdminNavigation>
        <div className={styles.dashboard}>
          <div className={styles.accessDenied}>
            <h2>⛔ Access Denied</h2>
            <p>You do not have permission to access the Billing module.</p>
            <p className={styles.accessDeniedHint}>Required roles: Driver, Admin, Finance, MMD, or Plant Admin</p>
            <button 
              className={styles.backButton}
              onClick={() => window.location.href = '/dashboard'}
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
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.titleContainer}>
              <h1 className={styles.title}>Billing Management</h1>
            </div>
            
            {/* Show user info badge */}
            {userInfo.userRole === 'driver' && userInfo.userAgencyName !== 'N/A' && (
              <div className={styles.userInfoBadge}>
                <span className={styles.badgeLabel}>Transporter:</span>
                <span className={styles.badgeValue}>{userInfo.userAgencyName}</span>
              </div>
            )}
          </div>

          <div className={styles.headerFilters}>
            {showFilters && (
              <>
                <div className={styles.filterGrid}>
                  {/* Hide transporter filter for drivers since they only see their own */}
                  {userInfo.userRole !== 'driver' && (
                    <div className={styles.filterGroup}>
                      <label>Transporter</label>
                      <select 
                        className={styles.filterSelect} 
                        value={filters.transporter} 
                        onChange={(e) => handleFilterChange('transporter', e.target.value)}
                      >
                        <option value="">All Transporters</option>
                        {uniqueTransporters.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
                  
                  <div className={styles.filterGroup}>
                    <label>Vehicle Number</label>
                    <select 
                      className={styles.filterSelect} 
                      value={filters.vehicleNumber} 
                      onChange={(e) => handleFilterChange('vehicleNumber', e.target.value)}
                    >
                      <option value="">All Vehicles</option>
                      {uniqueVehicleNumbers.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className={styles.filterGroup}>
                    <label>Start Date</label>
                    <input 
                      type="date" 
                      className={styles.filterInput} 
                      value={filters.startDate} 
                      onChange={(e) => handleFilterChange('startDate', e.target.value)} 
                    />
                  </div>
                  <div className={styles.filterGroup}>
                    <label>End Date</label>
                    <input 
                      type="date" 
                      className={styles.filterInput} 
                      value={filters.endDate} 
                      onChange={(e) => handleFilterChange('endDate', e.target.value)} 
                      min={filters.startDate} 
                    />
                  </div>
                </div>
                
                <div className={styles.filterActions}>
                  <button 
                    className={styles.clearFiltersButton} 
                    onClick={clearFilters} 
                    disabled={!isFilterActive()}
                  >
                    Clear All
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            ⚠️ {error}
            <button onClick={() => setError('')} className={styles.dismissError}>×</button>
          </div>
        )}

        <div className={styles.tabContainer}>
          <div className={styles.tabNavigation}>
            <button 
              className={`${styles.tabButton} ${activeTab === 'completed' ? styles.activeTab : ''}`} 
              onClick={() => setActiveTab('completed')}
            >
              📝 Completed Trips
              {trips.filter(t => !billingStates[t.id]?.isSaved).length > 0 && (
                <span className={styles.tabBadge}>{trips.filter(t => !billingStates[t.id]?.isSaved).length}</span>
              )}
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'generated' ? styles.activeTab : ''}`} 
              onClick={() => setActiveTab('generated')}
            >
              📄 Bills Generated
              {trips.filter(t => billingStates[t.id]?.isSaved).length > 0 && (
                <span className={styles.tabBadge}>{trips.filter(t => billingStates[t.id]?.isSaved).length}</span>
              )}
            </button>
          </div>
        </div>

        {renderTable()}
      </div>
    </AdminNavigation>
  );
};

export default Billing;