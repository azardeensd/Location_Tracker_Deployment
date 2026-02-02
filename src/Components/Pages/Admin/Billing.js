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

  // User info for report - Now includes department assigned to user
  const [userInfo, setUserInfo] = useState({
    generatedByUser: 'System User',
    userDepartment: 'Admin',
    userId: 'N/A',
    userRole: 'Admin'
  });

  // Ref for print content
  const printRef = useRef();

  // Fetch user department from database
  const fetchUserWithDepartment = async (userId) => {
    try {
      if (!userId) return null;
      
      // Fetch user details including department
      const userResponse = await api.getUserById(userId);
      if (userResponse.error) {
        console.error('Error fetching user:', userResponse.error);
        return null;
      }
      
      const userData = userResponse.data;
      if (!userData) return null;
      
      // If user has department_id, fetch department details
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
  
  console.log('User data for department check:', {
    department_id: userData.department_id,
    department: userData.department,
    department_name: userData.department_name,
    role: userData.role,
    role_name: userData.role_name
  });
  
  // First check for department_name from API
  if (userData.department_name) {
    console.log('Using department_name from API:', userData.department_name);
    return userData.department_name;
  }
  
  // Check for department object
  if (userData.department && userData.department.name) {
    console.log('Using department.name:', userData.department.name);
    return userData.department.name;
  }
  
  // Fallback to role-based mapping
  const role = userData.role || 'admin';
  console.log('Falling back to role-based mapping for role:', role);
  
  const departmentMap = {
    'super_admin': 'Administration',
    'admin': 'Administration',
    'plant_admin': 'Plant Operations',
    'driver': 'Transport Department',
    'transport': 'Transport Department',
    'finance': 'Finance Department',
    'operations': 'Operations Department',
    'hr': 'Human Resources'
  };
  
  return departmentMap[role.toLowerCase()] || 'Admin';
};

  // Fetch all necessary data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. First fetch current logged-in user info
        const getCurrentUserFromStorage = () => {
          // Try localStorage first
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              return JSON.parse(storedUser);
            } catch (e) {
              console.error('Error parsing user data:', e);
            }
          }
          
          // Try sessionStorage
          const sessionUser = sessionStorage.getItem('user');
          if (sessionUser) {
            try {
              return JSON.parse(sessionUser);
            } catch (e) {
              console.error('Error parsing session user data:', e);
            }
          }
          
          return null;
        };

        const currentUserFromStorage = getCurrentUserFromStorage();
        const userId = currentUserFromStorage?.id || currentUserFromStorage?.userId;
        
        // Fetch user with department info from database
        let userWithDepartment = null;
        if (userId) {
          userWithDepartment = await fetchUserWithDepartment(userId);
        }
        
        // Set user info for report
        const userName = userWithDepartment?.username || 
                        currentUserFromStorage?.username || 
                        currentUserFromStorage?.name || 
                        'System User';
        
        const userRole = userWithDepartment?.role || 
                        currentUserFromStorage?.role || 
                        'Admin';
        
        const userDepartment = getDepartmentName(userWithDepartment || currentUserFromStorage);
        
        setUserInfo({
          generatedByUser: userName,
          userDepartment: userDepartment,
          userId: userId || 'N/A',
          userRole: userRole
        });

        // 2. Fetch all other data
        const tripsResponse = await api.getAllTrips();
        if (tripsResponse.error) throw new Error(tripsResponse.error.message);

        const ratesResponse = await api.getRates();
        if (ratesResponse.error) throw new Error(ratesResponse.error.message);

        const billingResponse = await api.getBillings();
        if (billingResponse.error) throw new Error(billingResponse.error.message);

        const plantsResponse = await api.getPlants();
        if (plantsResponse.error) throw new Error(plantsResponse.error.message);

        const agenciesResponse = await api.getAgencies();
        if (agenciesResponse.error) throw new Error(agenciesResponse.error.message);

        setRates(ratesResponse.data || []);
        setPlants(plantsResponse.data || []);
       
        // Create a map of agencies with plant data
        const agenciesMap = new Map(
          (agenciesResponse.data || []).map(agency => [agency.id, agency])
        );
        
        // Create a map of plants for quick lookup
        const plantsMap = new Map(
          (plantsResponse.data || []).map(plant => [plant.id, plant])
        );
        
        // Filter for Completed trips only and enrich with plant data
        const allTrips = tripsResponse.data || [];
        const completedTrips = allTrips.filter(t =>
          t.status && t.status.toLowerCase() === 'completed'
        ).map(trip => {
          const agency = agenciesMap.get(trip.agency_id);
          if (agency && agency.plant_id) {
            const plant = plantsMap.get(agency.plant_id);
            return {
              ...trip,
              agency: {
                ...agency,
                plant: plant
              }
            };
          }
          return trip;
        });

        // Map existing billing data to state
        const initialBillingStates = {};
        const billingDataMap = new Map(
          (billingResponse.data || []).map(b => [b.trip_id, b])
        );

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

  // Get unique transporters and vehicle numbers for filter dropdowns
  const uniqueTransporters = [...new Set(trips
    .map(trip => trip.agency?.name)
    .filter(name => name && name !== 'N/A'))].sort();

  const uniqueVehicleNumbers = [...new Set(trips
    .map(trip => trip.vehicle_number)
    .filter(number => number && number !== 'N/A'))].sort();

  // Filter trips based on active tab and filters
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
        if (tripDate <= endDate) {
          return true;
        }
        return false;
      }
      
      return matchesTransporter && matchesVehicle && matchesStartDate && matchesEndDate;
    });
  };

  // Separate trips into two categories and apply filters
  const pendingBills = getFilteredTrips(trips.filter(trip => !billingStates[trip.id]?.isSaved));
  const generatedBills = getFilteredTrips(trips.filter(trip => billingStates[trip.id]?.isSaved));

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      transporter: '',
      vehicleNumber: '',
      startDate: '',
      endDate: ''
    });
  };

  // Calculate Rate based on Transporter, Ton, Type, and Distance
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

    if (!matchingRate) {
      return 0;
    }

    let total = 0;
    if (rateType === 'Trip') {
      total = parseFloat(matchingRate.rate);
    } else if (rateType === 'Kilometer') {
      total = parseFloat(matchingRate.rate) * distance;
    }

    return total;
  };

  // Handle Input Changes
  const handleInputChange = (tripId, field, value) => {
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

  // Save Billing Data
  const handleSave = async (tripId) => {
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
        alert('Billing saved successfully!');
        
        setActiveTab('generated');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving billing data');
    }
  };

  // Print Report Function
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      alert('Please allow pop-ups for this site to print reports.');
      return;
    }

    // Get current date for report header
    const currentDate = new Date().toLocaleDateString('en-IN');
    
    // Calculate totals
    const totalCalculatedRate = generatedBills.reduce((sum, trip) => {
      return sum + (billingStates[trip.id]?.calculatedRate || 0);
    }, 0);
    
    const totalOtherCharges = generatedBills.reduce((sum, trip) => {
      return sum + (billingStates[trip.id]?.tollFees || 0);
    }, 0);
    
    const totalAmount = generatedBills.reduce((sum, trip) => {
      return sum + (billingStates[trip.id]?.totalAmount || 0);
    }, 0);

    // Helper functions for print
    const formatDateForPrint = (dateString) => {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('en-IN');
    };

    const formatCurrencyForPrint = (amount) => {
      return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount || 0);
    };

    const formatTripId = (id) => {
      if (!id) return 'N/A';
      return '#' + String(id).slice(0, 8);
    };

    const getDriverName = (trip) => {
      if (trip.driver_name) return trip.driver_name;
      if (trip.driver?.name) return trip.driver.name;
      if (trip.driver?.full_name) return trip.driver.full_name;
      if (trip.driver) return `${trip.driver.first_name || ''} ${trip.driver.last_name || ''}`.trim();
      return 'N/A';
    };

    const getDriverPhone = (trip) => {
      if (trip.driver?.phone) return trip.driver.phone;
      if (trip.driver?.mobile) return trip.driver.mobile;
      if (trip.driver_phone) return trip.driver_phone;
      return 'N/A';
    };

    // Build the print HTML
    const printHTML = `
  <html>
    <head>
      <title>Bills Generated Report - ${currentDate}</title>
      <style>
        @media print {
          @page {
            size: A4 landscape;
            margin: 15mm;
          }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            font-size: 12px;
          }
        }
        body {
          margin: 20px;
          font-family: Arial, sans-serif;
          font-size: 12px;
        }
        .print-header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        .report-title {
          font-size: 18px;
          margin: 10px 0;
          color: #666;
        }
        .report-info {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          margin-bottom: 15px;
          font-size: 11px;
          color: #555;
        }
        .info-section {
          margin-bottom: 8px;
          flex-basis: 33%;
        }
        .info-section div {
          margin-bottom: 3px;
        }
        .report-filter {
          background: #f5f5f5;
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 15px;
          font-size: 11px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          table-layout: fixed;
        }
        th {
          background: #f2f2f2;
          padding: 8px;
          border: 1px solid #ddd;
          text-align: left;
          font-weight: bold;
          word-wrap: break-word;
        }
        td {
          padding: 8px;
          border: 1px solid #ddd;
          word-wrap: break-word;
          vertical-align: top;
        }
        tr:nth-child(even) {
          background: #f9f9f9;
        }
        .total-row {
          background: #e8f4ff !important;
          font-weight: bold;
        }
        .amount {
          text-align: right;
          font-family: 'Courier New', monospace;
        }
        .print-footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
          font-size: 10px;
          color: #666;
          text-align: center;
        }
        .no-print {
          display: none;
        }
        .print-actions {
          text-align: center;
          margin: 20px 0;
        }
        .print-button {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin: 0 10px;
        }
        .back-button {
          background: #666;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        /* Specific column widths */
        th:nth-child(1), td:nth-child(1) { width: 70px; text-align: center; }
        th:nth-child(2), td:nth-child(2) { width: 80px; }
        th:nth-child(3), td:nth-child(3) { width: 140px; }
        th:nth-child(4), td:nth-child(4) { width: 120px; }
        th:nth-child(5), td:nth-child(5) { width: 130px; }
        th:nth-child(6), td:nth-child(6) { width: 130px; }
        th:nth-child(7), td:nth-child(7) { width: 70px; text-align: center; }
        th:nth-child(8), td:nth-child(8) { width: 70px; text-align: right; }
        th:nth-child(9), td:nth-child(9) { width: 100px; }
        th:nth-child(10), td:nth-child(10) { width: 90px; }
        th:nth-child(11), td:nth-child(11) { width: 100px; }
        th:nth-child(12), td:nth-child(12) { width: 100px; }
        
        .total-row td:first-child {
          text-align: right;
          padding-right: 10px;
        }
        
        .department-badge {
          display: inline-block;
          background: #e3f2fd;
          color: #1976d2;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          margin-left: 5px;
          font-weight: normal;
        }
        
        .user-info-highlight {
          background: #f0f7ff;
          padding: 5px 10px;
          border-radius: 4px;
          border-left: 4px solid #1976d2;
          margin-bottom: 10px;
        }
      </style>
    </head>
    <body>
      <div class="print-header">
        <div class="company-name">Market Vehicle Bill Summary</div>
        <div class="report-title">Bills Generated Report</div>
      </div>
      
      <!-- User Information Highlight -->
      <div class="user-info-highlight">
        <strong>Report Generated By:</strong> ${userInfo.generatedByUser} | 
        <strong>Department:</strong> ${userInfo.userDepartment} | 
        <strong>Role:</strong> ${userInfo.userRole} | 
        <strong>User ID:</strong> ${userInfo.userId}
      </div>
      
      <!-- Report Information Section -->
      <div class="report-info">
        <div class="info-section">
          <div><strong>Transporter Name:</strong> ${filters.transporter || 'All Transporters'}</div>
          <div><strong>Bill Period:</strong> ${filters.startDate ? formatDateForPrint(filters.startDate) : 'All dates'} 
            ${filters.endDate ? ` to ${formatDateForPrint(filters.endDate)}` : ''}</div>
        </div>
        <div class="info-section">
          <div><strong>Report Date:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
          <div><strong>Report Time:</strong> ${new Date().toLocaleTimeString('en-IN')}</div>
        </div>
        <div class="info-section">
          <div><strong>Total Bills:</strong> ${generatedBills.length}</div>
          <div><strong>Report Type:</strong> Bills Generated Summary</div>
        </div>
      </div>
      
      ${filters.transporter || filters.vehicleNumber || filters.startDate || filters.endDate ? `
        <div class="report-filter">
          <strong>Filters Applied:</strong>
          ${filters.transporter ? `Transporter: ${filters.transporter} | ` : ''}
          ${filters.vehicleNumber ? `Vehicle: ${filters.vehicleNumber} | ` : ''}
          ${filters.startDate ? `From: ${formatDateForPrint(filters.startDate)} | ` : ''}
          ${filters.endDate ? `To: ${formatDateForPrint(filters.endDate)}` : ''}
        </div>
      ` : ''}
      
      <table>
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
            <th>Rate (₹)</th>
            <th>Other Charges (₹)</th>
            <th>Total Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${generatedBills.map((trip) => {
            const state = billingStates[trip.id] || {};
            const tripDate = trip.End_Date ? new Date(trip.End_Date).toLocaleDateString('en-IN') : 'N/A';
            return `
              <tr>
                <td>${formatTripId(trip.id)}</td>
                <td>${tripDate}</td>
                <td>
                  <div style="font-weight: bold;">${trip.vehicle_number || 'N/A'}</div>
                  <div style="font-size: 10px; color: #666;">${trip.agency?.name || 'N/A'}</div>
                </td>
                <td>
                  <div style="font-weight: 500;">${getDriverName(trip)}</div>
                  ${getDriverPhone(trip) !== 'N/A' ? 
                    `<div style="font-size: 10px; color: #666;">${getDriverPhone(trip)}</div>` : ''}
                </td>
                <td style="font-size: 11px;">${trip.start_address || 'N/A'}</td>
                <td style="font-size: 11px;">${trip.end_address || 'N/A'}</td>
                <td style="text-align: center;">${trip.vehicle?.capacity ? `${trip.vehicle.capacity} Ton` : 'N/A'}</td>
                <td style="text-align: right;">${trip.distance_km || 0} km</td>
                <td>${state.tripType || 'N/A'}</td>
                <td class="amount">${formatCurrencyForPrint(state.calculatedRate)}</td>
                <td class="amount">${formatCurrencyForPrint(state.tollFees)}</td>
                <td class="amount">${formatCurrencyForPrint(state.totalAmount)}</td>
              </tr>
            `;
          }).join('')}
          
          <tr class="total-row">
            <td colspan="9" style="text-align: right; padding-right: 10px;"><strong>TOTALS:</strong></td>
            <td class="amount"><strong>${formatCurrencyForPrint(totalCalculatedRate)}</strong></td>
            <td class="amount"><strong>${formatCurrencyForPrint(totalOtherCharges)}</strong></td>
            <td class="amount"><strong>${formatCurrencyForPrint(totalAmount)}</strong></td>
          </tr>
        </tbody>
      </table>
      
      <div class="print-footer">
        <div>Report generated from Billing Management System</div>
        <div><strong>Responsible Department:</strong> ${userInfo.userDepartment} | <strong>Generated By:</strong> ${userInfo.generatedByUser} (${userInfo.userRole})</div>
        <div>Page 1 of 1 | Generated on: ${new Date().toLocaleString('en-IN')}</div>
      </div>
      
      <div class="print-actions no-print">
        <button class="print-button" onclick="window.print()">🖨️ Print Report</button>
        <button class="back-button" onclick="window.close()">Close</button>
      </div>
    </body>
  </html>
`;

    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }, 500);
  };

  // Format Helpers
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  // Format location address - truncate if too long
  const formatLocation = (address, maxLength = 30) => {
    if (!address || address === 'N/A') return 'N/A';
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + '...';
  };

  // Get driver name
  const getDriverName = (trip) => {
    if (trip.driver_name) return trip.driver_name;
    if (trip.driver?.name) return trip.driver.name;
    if (trip.driver?.full_name) return trip.driver.full_name;
    if (trip.driver) return `${trip.driver.first_name || ''} ${trip.driver.last_name || ''}`.trim();
    return 'N/A';
  };

  // Get driver phone number if available
  const getDriverPhone = (trip) => {
    if (trip.driver?.phone) return trip.driver.phone;
    if (trip.driver?.mobile) return trip.driver.mobile;
    if (trip.driver_phone) return trip.driver_phone;
    return 'N/A';
  };

  // Helper to safely format ID
  const formatTripId = (id) => {
    if (!id) return 'N/A';
    return '#' + String(id).slice(0, 8);
  };

  // Check if any filter is active
  const isFilterActive = () => {
    return filters.transporter || filters.vehicleNumber || filters.startDate || filters.endDate;
  };

  // Render the appropriate table based on active tab
  const renderTable = () => {
    const data = activeTab === 'completed' ? pendingBills : generatedBills;
    const title = activeTab === 'completed' ? 'Completed Trips' : 'Bills Generated';
    const count = activeTab === 'completed' ? pendingBills.length : generatedBills.length;

    return (
      <div className={styles.recentTrips}>
        <div className={styles.sectionHeader}>
          <h2>{title}</h2>
          <div className={styles.headerActions}>
            <span className={styles.tripCount}>
              {count} Records
              {isFilterActive() && <span className={styles.filterActiveBadge}> (Filtered)</span>}
            </span>
            {activeTab === 'generated' && generatedBills.length > 0 && (
              <button 
                className={styles.printReportButton}
                onClick={handlePrintReport}
                title="Print Report"
              >
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
                ? 'No records found matching your filters. Try changing your filter criteria.'
                : activeTab === 'completed' 
                  ? 'No pending bills to process. All completed trips have been billed.' 
                  : 'No bills generated yet. Save billing data from Completed Trips tab.'}
            </p>
            {isFilterActive() && (
              <button 
                className={styles.clearFiltersButton}
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : activeTab === 'generated' ? (
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
                  <th>Rate (Calculated)</th>
                  <th>Other charges</th>
                  <th>Total Amount</th>
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
                          {getDriverPhone(trip) !== 'N/A' && (
                            <span className={styles.driverPhone}>{getDriverPhone(trip)}</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.locationCell} title={trip.start_address || 'N/A'}>
                        {formatLocation(trip.start_address || 'N/A')}
                      </td>
                      <td className={styles.locationCell} title={trip.end_address || 'N/A'}>
                        {formatLocation(trip.end_address || 'N/A')}
                      </td>
                      <td>{trip.vehicle?.capacity ? `${trip.vehicle.capacity} Ton` : 'N/A'}</td>
                      <td className={styles.distanceCell}>{trip.distance_km} km</td>
                      <td>{state.tripType || 'N/A'}</td>
                      <td className={styles.amountCell}>
                        {formatCurrency(state.calculatedRate)}
                      </td>
                      <td className={styles.amountCell}>
                        {formatCurrency(state.tollFees)}
                      </td>
                      <td className={`${styles.amountCell} ${styles.totalText}`}>
                        {formatCurrency(state.totalAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Trip ID</th>
                  <th>Date</th>
                  <th>Vehicle & Transporter</th>
                  <th>Capacity</th>
                  <th>Driver Name</th>
                  <th>From Location</th>
                  <th>To Location</th>
                  <th>Distance</th>
                  <th>Trip Type</th>
                  <th>Rate (Calculated)</th>
                  <th>Other charges</th>
                  <th>Total Amount</th>
                  <th>Actions</th>
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
                      <td>{trip.vehicle?.capacity ? `${trip.vehicle.capacity} Ton` : 'N/A'}</td>
                      <td className={styles.driverCell}>
                        <div className={styles.driverInfo}>
                          <span className={styles.driverName}>{getDriverName(trip)}</span>
                          {getDriverPhone(trip) !== 'N/A' && (
                            <span className={styles.driverPhone}>{getDriverPhone(trip)}</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.locationCell} title={trip.start_address || 'N/A'}>
                        {formatLocation(trip.start_address || 'N/A')}
                      </td>
                      <td className={styles.locationCell} title={trip.end_address || 'N/A'}>
                        {formatLocation(trip.end_address || 'N/A')}
                      </td>
                      <td className={styles.distanceCell}>{trip.distance_km} km</td>
                      <td>
                        <select
                          className={styles.selectInput}
                          value={state.tripType || ''}
                          onChange={(e) => handleInputChange(trip.id, 'tripType', e.target.value)}
                        >
                          <option value="">Select Type</option>
                          <option value="Trip Basis">Trip Basis</option>
                          <option value="Kilometer Basis">Kilometer Basis</option>
                        </select>
                      </td>
                      <td className={styles.amountCell}>
                        {formatCurrency(state.calculatedRate)}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className={styles.numberInput}
                          value={state.tollFees || 0}
                          onChange={(e) => handleInputChange(trip.id, 'tollFees', e.target.value)}
                        />
                      </td>
                      <td className={`${styles.amountCell} ${styles.totalText}`}>
                        {formatCurrency(state.totalAmount)}
                      </td>
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
                            <div className={styles.errorTooltip}>
                              No matching rate found in Rate Master
                            </div>
                          )}
                        </div>
                      </td>
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

  return (
    <>
        <AdminNavigation >
        <div className={styles.dashboard}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h1 className={styles.title}>Billing Management</h1>
              <p className={styles.subtitle}>Process and manage billing for completed trips</p>
            </div>

            <div className={styles.headerFilters}>
              {showFilters && (
                <>
                  <div className={styles.filterGrid}>
                    <div className={styles.filterGroup}>
                      <label htmlFor="transporterFilter">Transporter</label>
                      <select
                        id="transporterFilter"
                        className={styles.filterSelect}
                        value={filters.transporter}
                        onChange={(e) => handleFilterChange('transporter', e.target.value)}
                      >
                        <option value="">All Transporters</option>
                        {uniqueTransporters.map(transporter => (
                          <option key={transporter} value={transporter}>
                            {transporter}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className={styles.filterGroup}>
                      <label htmlFor="vehicleFilter">Vehicle Number</label>
                      <select
                        id="vehicleFilter"
                        className={styles.filterSelect}
                        value={filters.vehicleNumber}
                        onChange={(e) => handleFilterChange('vehicleNumber', e.target.value)}
                      >
                        <option value="">All Vehicles</option>
                        {uniqueVehicleNumbers.map(vehicle => (
                          <option key={vehicle} value={vehicle}>
                            {vehicle}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className={styles.filterGroup}>
                      <label htmlFor="startDateFilter">Start Date</label>
                      <input
                        type="date"
                        id="startDateFilter"
                        className={styles.filterInput}
                        value={filters.startDate}
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      />
                    </div>
                    
                    <div className={styles.filterGroup}>
                      <label htmlFor="endDateFilter">End Date</label>
                      <input
                        type="date"
                        id="endDateFilter"
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
                    <div className={styles.filterStats}>
                      <span className={styles.totalCount}>
                        Total: {trips.filter(t => activeTab === 'completed' 
                          ? !billingStates[t.id]?.isSaved 
                          : billingStates[t.id]?.isSaved).length}
                      </span>
                      <span className={styles.filteredCount}>
                        Showing: {activeTab === 'completed' ? pendingBills.length : generatedBills.length}
                      </span>
                    </div>
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
                  <span className={styles.tabBadge}>
                    {trips.filter(t => !billingStates[t.id]?.isSaved).length}
                  </span>
                )}
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === 'generated' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('generated')}
              >
                📄 Bills Generated
                {trips.filter(t => billingStates[t.id]?.isSaved).length > 0 && (
                  <span className={styles.tabBadge}>
                    {trips.filter(t => billingStates[t.id]?.isSaved).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {renderTable()}
        </div>
      </ AdminNavigation>
    </>
  );
};

export default Billing;

// import React, { useState, useEffect, useRef } from 'react';
// import api from '../services/api';
// import styles from './Billing.module.css';
// import AdminNavigation from '../AdminNavigation';

// const Billing = () => {
//   const [trips, setTrips] = useState([]);
//   const [rates, setRates] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [plants, setPlants] = useState([]);
//   const [activeTab, setActiveTab] = useState('completed');
  
//   // Filter states
//   const [filters, setFilters] = useState({
//     transporter: '',
//     vehicleNumber: '',
//     startDate: '',
//     endDate: ''
//   });
//   const [showFilters, setShowFilters] = useState(true);
  
//   // Store billing form state for each trip
//   const [billingStates, setBillingStates] = useState({});

//   // User info for report - Now includes department assigned to user
//   const [userInfo, setUserInfo] = useState({
//     generatedByUser: 'System User',
//     userDepartment: 'Admin',
//     userId: 'N/A',
//     userRole: 'Admin'
//   });

//   // Ref for print content
//   const printRef = useRef();

//   // Fetch user department from database
//   const fetchUserWithDepartment = async (userId) => {
//     try {
//       if (!userId) return null;
      
//       // Fetch user details including department
//       const userResponse = await api.getUserById(userId);
//       if (userResponse.error) {
//         console.error('Error fetching user:', userResponse.error);
//         return null;
//       }
      
//       const userData = userResponse.data;
//       if (!userData) return null;
      
//       console.log('User Data from getUserById:', userData);
      
//       // If user has department_id, fetch department details
//       if (userData.department_id) {
//         console.log('Fetching department details for ID:', userData.department_id);
//         const deptResponse = await api.getDepartmentById(userData.department_id);
//         console.log('Department response:', deptResponse);
        
//         if (deptResponse.data) {
//           return {
//             ...userData,
//             department_name: deptResponse.data.name,
//             department_code: deptResponse.data.code,
//             // Also set department field for compatibility
//             department: deptResponse.data.name
//           };
//         } else {
//           console.log('No department data found for ID:', userData.department_id);
//         }
//       } else {
//         console.log('No department_id found in user data');
//       }
      
//       // Return user data as-is (might have department field directly)
//       return userData;
      
//     } catch (error) {
//       console.error('Error fetching user with department:', error);
//       return null;
//     }
//   };

//   // Get department name from user data - UPDATED FUNCTION
//   const getDepartmentName = (userData) => {
//     if (!userData) {
//       console.log('No user data provided to getDepartmentName');
//       return 'Admin';
//     }
    
//     console.log('Getting department name for user:', {
//       id: userData.id,
//       username: userData.username,
//       role: userData.role,
//       department_id: userData.department_id,
//       department_name: userData.department_name,
//       department: userData.department,
//       fullData: userData
//     });
    
//     // Priority: Check all possible department field names
//     if (userData.department_name) {
//       console.log('Using department_name:', userData.department_name);
//       return userData.department_name;
//     }
    
//     if (userData.department) {
//       console.log('Using department:', userData.department);
//       return userData.department;
//     }
    
//     // Check if department is an object with name property
//     if (userData.department_obj && userData.department_obj.name) {
//       console.log('Using department_obj.name:', userData.department_obj.name);
//       return userData.department_obj.name;
//     }
    
//     // Check for joined department data
//     if (userData.departments && userData.departments.name) {
//       console.log('Using departments.name:', userData.departments.name);
//       return userData.departments.name;
//     }
    
//     // Check if the API returns department_details
//     if (userData.department_details && userData.department_details.name) {
//       console.log('Using department_details.name:', userData.department_details.name);
//       return userData.department_details.name;
//     }
    
//     // If user has department_id but no department name found
//     if (userData.department_id) {
//       console.log('User has department_id but no department name found:', userData.department_id);
      
//       // Try to fetch department name directly
//       const fetchDeptName = async () => {
//         try {
//           const deptResponse = await api.getDepartmentById(userData.department_id);
//           if (deptResponse.data && deptResponse.data.name) {
//             console.log('Fetched department name:', deptResponse.data.name);
//             return deptResponse.data.name;
//           }
//         } catch (error) {
//           console.error('Error fetching department:', error);
//         }
//         return null;
//       };
      
//       // Note: This is async, so we can't return from here directly
//       // For now, we'll fall back to role-based mapping
//     }
    
//     // FALLBACK: Role-based mapping (only if no department found)
//     console.log('No department found, falling back to role-based mapping');
//     const role = userData.role || 'admin';
//     console.log('User role for mapping:', role);
    
//     const departmentMap = {
//       'admin': 'Administration',
//       'super_admin': 'Administration',
//       'plant_admin': 'Plant Operations',
//       'driver': 'Transport Department',
//       'transport': 'Transport Department',
//       'finance': 'Finance Department',
//       'operations': 'Operations Department',
//       'hr': 'Human Resources'
//     };
    
//     const mappedDept = departmentMap[role.toLowerCase()] || 'Admin';
//     console.log('Mapped department:', mappedDept);
    
//     return mappedDept;
//   };

//   // Fetch all necessary data
//   useEffect(() => {
//     const fetchData = async () => {
//       setLoading(true);
//       try {
//         // 1. First fetch current logged-in user info
//         const getCurrentUserFromStorage = () => {
//           // Try localStorage first
//           const storedUser = localStorage.getItem('user');
//           if (storedUser) {
//             try {
//               return JSON.parse(storedUser);
//             } catch (e) {
//               console.error('Error parsing user data:', e);
//             }
//           }
          
//           // Try sessionStorage
//           const sessionUser = sessionStorage.getItem('user');
//           if (sessionUser) {
//             try {
//               return JSON.parse(sessionUser);
//             } catch (e) {
//               console.error('Error parsing session user data:', e);
//             }
//           }
          
//           return null;
//         };

//         const currentUserFromStorage = getCurrentUserFromStorage();
//         console.log('Current user from storage:', currentUserFromStorage);
        
//         const userId = currentUserFromStorage?.id || currentUserFromStorage?.userId;
//         console.log('User ID:', userId);
        
//         // Fetch user with department info from database
//         let userWithDepartment = null;
//         if (userId) {
//           console.log('Fetching user with department for ID:', userId);
//           userWithDepartment = await fetchUserWithDepartment(userId);
//           console.log('User with department data:', userWithDepartment);
//         }
        
//         // Set user info for report
//         const userName = userWithDepartment?.username || 
//                         currentUserFromStorage?.username || 
//                         currentUserFromStorage?.name || 
//                         'System User';
        
//         const userRole = userWithDepartment?.role || 
//                         currentUserFromStorage?.role || 
//                         'Admin';
        
//         console.log('Before getDepartmentName call');
//         const userDepartment = getDepartmentName(userWithDepartment || currentUserFromStorage);
//         console.log('User department determined:', userDepartment);
        
//         setUserInfo({
//           generatedByUser: userName,
//           userDepartment: userDepartment,
//           userId: userId || 'N/A',
//           userRole: userRole
//         });

//         console.log('User info set:', {
//           generatedByUser: userName,
//           userDepartment: userDepartment,
//           userId: userId || 'N/A',
//           userRole: userRole
//         });

//         // 2. Fetch all other data
//         const tripsResponse = await api.getAllTrips();
//         if (tripsResponse.error) throw new Error(tripsResponse.error.message);

//         const ratesResponse = await api.getRates();
//         if (ratesResponse.error) throw new Error(ratesResponse.error.message);

//         const billingResponse = await api.getBillings();
//         if (billingResponse.error) throw new Error(billingResponse.error.message);

//         const plantsResponse = await api.getPlants();
//         if (plantsResponse.error) throw new Error(plantsResponse.error.message);

//         const agenciesResponse = await api.getAgencies();
//         if (agenciesResponse.error) throw new Error(agenciesResponse.error.message);

//         setRates(ratesResponse.data || []);
//         setPlants(plantsResponse.data || []);
       
//         // Create a map of agencies with plant data
//         const agenciesMap = new Map(
//           (agenciesResponse.data || []).map(agency => [agency.id, agency])
//         );
        
//         // Create a map of plants for quick lookup
//         const plantsMap = new Map(
//           (plantsResponse.data || []).map(plant => [plant.id, plant])
//         );
        
//         // Filter for Completed trips only and enrich with plant data
//         const allTrips = tripsResponse.data || [];
//         const completedTrips = allTrips.filter(t =>
//           t.status && t.status.toLowerCase() === 'completed'
//         ).map(trip => {
//           const agency = agenciesMap.get(trip.agency_id);
//           if (agency && agency.plant_id) {
//             const plant = plantsMap.get(agency.plant_id);
//             return {
//               ...trip,
//               agency: {
//                 ...agency,
//                 plant: plant
//               }
//             };
//           }
//           return trip;
//         });

//         // Map existing billing data to state
//         const initialBillingStates = {};
//         const billingDataMap = new Map(
//           (billingResponse.data || []).map(b => [b.trip_id, b])
//         );

//         completedTrips.forEach(trip => {
//           const existing = billingDataMap.get(trip.id);
//           if (existing) {
//             const displayTripType = existing.trip_type === 'Trip' ? 'Trip Basis' : 
//                                    existing.trip_type === 'Kilometer' ? 'Kilometer Basis' : 
//                                    existing.trip_type;
            
//             initialBillingStates[trip.id] = {
//               tripType: displayTripType,
//               tollFees: existing.toll_fees,
//               calculatedRate: existing.calculated_rate,
//               totalAmount: existing.total_amount,
//               isSaved: true,
//               billNumber: existing.bill_number || `INV${new Date().getFullYear()}${String(existing.id).padStart(6, '0')}`,
//               billingDate: existing.created_at || new Date().toISOString()
//             };
//           } else {
//             initialBillingStates[trip.id] = {
//               tripType: '',
//               tollFees: 0,
//               calculatedRate: 0,
//               totalAmount: 0,
//               isSaved: false,
//               billNumber: '',
//               billingDate: ''
//             };
//           }
//         });

//         setBillingStates(initialBillingStates);
//         setTrips(completedTrips);

//       } catch (err) {
//         console.error('Error fetching data:', err);
//         setError(err.message || 'Failed to load billing data');
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, []);

//   // Get unique transporters and vehicle numbers for filter dropdowns
//   const uniqueTransporters = [...new Set(trips
//     .map(trip => trip.agency?.name)
//     .filter(name => name && name !== 'N/A'))].sort();

//   const uniqueVehicleNumbers = [...new Set(trips
//     .map(trip => trip.vehicle_number)
//     .filter(number => number && number !== 'N/A'))].sort();

//   // Filter trips based on active tab and filters
//   const getFilteredTrips = (tripList) => {
//     return tripList.filter(trip => {
//       const matchesTransporter = !filters.transporter || 
//         (trip.agency?.name && trip.agency.name.toLowerCase().includes(filters.transporter.toLowerCase()));
      
//       const matchesVehicle = !filters.vehicleNumber || 
//         (trip.vehicle_number && trip.vehicle_number.toLowerCase().includes(filters.vehicleNumber.toLowerCase()));
      
//       const tripDate = new Date(trip.End_Date);
//       const matchesStartDate = !filters.startDate || tripDate >= new Date(filters.startDate);
      
//       const matchesEndDate = !filters.endDate;
//       if (filters.endDate) {
//         const endDate = new Date(filters.endDate);
//         endDate.setHours(23, 59, 59, 999);
//         if (tripDate <= endDate) {
//           return true;
//         }
//         return false;
//       }
      
//       return matchesTransporter && matchesVehicle && matchesStartDate && matchesEndDate;
//     });
//   };

//   // Separate trips into two categories and apply filters
//   const pendingBills = getFilteredTrips(trips.filter(trip => !billingStates[trip.id]?.isSaved));
//   const generatedBills = getFilteredTrips(trips.filter(trip => billingStates[trip.id]?.isSaved));

//   // Handle filter changes
//   const handleFilterChange = (field, value) => {
//     setFilters(prev => ({
//       ...prev,
//       [field]: value
//     }));
//   };

//   // Clear all filters
//   const clearFilters = () => {
//     setFilters({
//       transporter: '',
//       vehicleNumber: '',
//       startDate: '',
//       endDate: ''
//     });
//   };

//   // Calculate Rate based on Transporter, Ton, Type, and Distance
//   const calculateRate = (trip, tripType) => {
//     if (!tripType) return 0;

//     const agencyId = trip.agency_id;
//     const vehicleCapacity = parseFloat(trip.vehicle?.capacity || 0);
//     const distance = parseFloat(trip.distance_km || 0);

//     const rateType = tripType === 'Trip Basis' ? 'Trip' : 
//                      tripType === 'Kilometer Basis' ? 'Kilometer' : 
//                      tripType;

//     const matchingRate = rates.find(rate => {
//       const sameAgency = rate.agency_id === agencyId;
//       const sameCapacity = parseFloat(rate.tone) === vehicleCapacity;
//       const sameType = rate.type === rateType;
      
//       if (!sameAgency || !sameCapacity || !sameType) return false;

//       if (rateType === 'Trip') {
//         const minKm = parseFloat(rate.min_km || 0);
//         const maxKm = parseFloat(rate.max_km || Infinity);
//         return distance >= minKm && distance <= maxKm;
//       }

//       return true;
//     });

//     if (!matchingRate) {
//       return 0;
//     }

//     let total = 0;
//     if (rateType === 'Trip') {
//       total = parseFloat(matchingRate.rate);
//     } else if (rateType === 'Kilometer') {
//       total = parseFloat(matchingRate.rate) * distance;
//     }

//     return total;
//   };

//   // Handle Input Changes
//   const handleInputChange = (tripId, field, value) => {
//     const trip = trips.find(t => t.id === tripId);
//     if (!trip) return;

//     setBillingStates(prev => {
//       const currentState = prev[tripId] || {};
//       const newState = { ...currentState, [field]: value };

//       const type = field === 'tripType' ? value : currentState.tripType;
//       const toll = field === 'tollFees' ? parseFloat(value || 0) : parseFloat(currentState.tollFees || 0);

//       const calculatedRate = calculateRate(trip, type);
//       const totalAmount = calculatedRate + toll;

//       return {
//         ...prev,
//         [tripId]: {
//           ...newState,
//           calculatedRate,
//           totalAmount,
//           isSaved: false
//         }
//       };
//     });
//   };

//   // Save Billing Data
//   const handleSave = async (tripId) => {
//     const state = billingStates[tripId];
//     if (!state) return;

//     try {
//       const dbTripType = state.tripType === 'Trip Basis' ? 'Trip' : 
//                          state.tripType === 'Kilometer Basis' ? 'Kilometer' : 
//                          state.tripType;

//       const billingData = {
//         trip_id: tripId,
//         trip_type: dbTripType,
//         calculated_rate: state.calculatedRate,
//         toll_fees: state.tollFees,
//         total_amount: state.totalAmount
//       };

//       const response = await api.saveBilling(billingData);
     
//       if (response.error) {
//         alert('Failed to save: ' + response.error.message);
//       } else {
//         const billId = response.data?.id || Date.now();
//         const billNumber = `INV${new Date().getFullYear()}${String(billId).padStart(6, '0')}`;
        
//         setBillingStates(prev => ({
//           ...prev,
//           [tripId]: { 
//             ...prev[tripId], 
//             isSaved: true,
//             billNumber: billNumber,
//             billingDate: new Date().toISOString()
//           }
//         }));
//         alert('Billing saved successfully!');
        
//         setActiveTab('generated');
//       }
//     } catch (err) {
//       console.error('Save error:', err);
//       alert('Error saving billing data');
//     }
//   };

//   // Print Report Function
//   const handlePrintReport = () => {
//     const printWindow = window.open('', '_blank', 'width=800,height=600');
    
//     if (!printWindow) {
//       alert('Please allow pop-ups for this site to print reports.');
//       return;
//     }

//     // Get current date for report header
//     const currentDate = new Date().toLocaleDateString('en-IN');
    
//     // Calculate totals
//     const totalCalculatedRate = generatedBills.reduce((sum, trip) => {
//       return sum + (billingStates[trip.id]?.calculatedRate || 0);
//     }, 0);
    
//     const totalOtherCharges = generatedBills.reduce((sum, trip) => {
//       return sum + (billingStates[trip.id]?.tollFees || 0);
//     }, 0);
    
//     const totalAmount = generatedBills.reduce((sum, trip) => {
//       return sum + (billingStates[trip.id]?.totalAmount || 0);
//     }, 0);

//     // Helper functions for print
//     const formatDateForPrint = (dateString) => {
//       if (!dateString) return '';
//       return new Date(dateString).toLocaleDateString('en-IN');
//     };

//     const formatCurrencyForPrint = (amount) => {
//       return new Intl.NumberFormat('en-IN', {
//         minimumFractionDigits: 2,
//         maximumFractionDigits: 2
//       }).format(amount || 0);
//     };

//     const formatTripId = (id) => {
//       if (!id) return 'N/A';
//       return '#' + String(id).slice(0, 8);
//     };

//     const getDriverName = (trip) => {
//       if (trip.driver_name) return trip.driver_name;
//       if (trip.driver?.name) return trip.driver.name;
//       if (trip.driver?.full_name) return trip.driver.full_name;
//       if (trip.driver) return `${trip.driver.first_name || ''} ${trip.driver.last_name || ''}`.trim();
//       return 'N/A';
//     };

//     const getDriverPhone = (trip) => {
//       if (trip.driver?.phone) return trip.driver.phone;
//       if (trip.driver?.mobile) return trip.driver.mobile;
//       if (trip.driver_phone) return trip.driver_phone;
//       return 'N/A';
//     };

//     // Build the print HTML
//     const printHTML = `
//   <html>
//     <head>
//       <title>Bills Generated Report - ${currentDate}</title>
//       <style>
//         @media print {
//           @page {
//             size: A4 landscape;
//             margin: 15mm;
//           }
//           body {
//             margin: 0;
//             font-family: Arial, sans-serif;
//             font-size: 12px;
//           }
//         }
//         body {
//           margin: 20px;
//           font-family: Arial, sans-serif;
//           font-size: 12px;
//         }
//         .print-header {
//           text-align: center;
//           margin-bottom: 20px;
//           border-bottom: 2px solid #333;
//           padding-bottom: 10px;
//         }
//         .company-name {
//           font-size: 24px;
//           font-weight: bold;
//           color: #333;
//         }
//         .report-title {
//           font-size: 18px;
//           margin: 10px 0;
//           color: #666;
//         }
//         .report-info {
//           display: flex;
//           flex-wrap: wrap;
//           justify-content: space-between;
//           margin-bottom: 15px;
//           font-size: 11px;
//           color: #555;
//         }
//         .info-section {
//           margin-bottom: 8px;
//           flex-basis: 33%;
//         }
//         .info-section div {
//           margin-bottom: 3px;
//         }
//         .report-filter {
//           background: #f5f5f5;
//           padding: 10px;
//           border-radius: 5px;
//           margin-bottom: 15px;
//           font-size: 11px;
//         }
//         table {
//           width: 100%;
//           border-collapse: collapse;
//           margin-top: 10px;
//           table-layout: fixed;
//         }
//         th {
//           background: #f2f2f2;
//           padding: 8px;
//           border: 1px solid #ddd;
//           text-align: left;
//           font-weight: bold;
//           word-wrap: break-word;
//         }
//         td {
//           padding: 8px;
//           border: 1px solid #ddd;
//           word-wrap: break-word;
//           vertical-align: top;
//         }
//         tr:nth-child(even) {
//           background: #f9f9f9;
//         }
//         .total-row {
//           background: #e8f4ff !important;
//           font-weight: bold;
//         }
//         .amount {
//           text-align: right;
//           font-family: 'Courier New', monospace;
//         }
//         .print-footer {
//           margin-top: 30px;
//           padding-top: 10px;
//           border-top: 1px solid #ddd;
//           font-size: 10px;
//           color: #666;
//           text-align: center;
//         }
//         .no-print {
//           display: none;
//         }
//         .print-actions {
//           text-align: center;
//           margin: 20px 0;
//         }
//         .print-button {
//           background: #4CAF50;
//           color: white;
//           border: none;
//           padding: 10px 20px;
//           border-radius: 4px;
//           cursor: pointer;
//           margin: 0 10px;
//         }
//         .back-button {
//           background: #666;
//           color: white;
//           border: none;
//           padding: 10px 20px;
//           border-radius: 4px;
//           cursor: pointer;
//         }
        
//         /* Specific column widths */
//         th:nth-child(1), td:nth-child(1) { width: 70px; text-align: center; }
//         th:nth-child(2), td:nth-child(2) { width: 80px; }
//         th:nth-child(3), td:nth-child(3) { width: 140px; }
//         th:nth-child(4), td:nth-child(4) { width: 120px; }
//         th:nth-child(5), td:nth-child(5) { width: 130px; }
//         th:nth-child(6), td:nth-child(6) { width: 130px; }
//         th:nth-child(7), td:nth-child(7) { width: 70px; text-align: center; }
//         th:nth-child(8), td:nth-child(8) { width: 70px; text-align: right; }
//         th:nth-child(9), td:nth-child(9) { width: 100px; }
//         th:nth-child(10), td:nth-child(10) { width: 90px; }
//         th:nth-child(11), td:nth-child(11) { width: 100px; }
//         th:nth-child(12), td:nth-child(12) { width: 100px; }
        
//         .total-row td:first-child {
//           text-align: right;
//           padding-right: 10px;
//         }
        
//         .department-badge {
//           display: inline-block;
//           background: #e3f2fd;
//           color: #1976d2;
//           padding: 2px 6px;
//           border-radius: 3px;
//           font-size: 10px;
//           margin-left: 5px;
//           font-weight: normal;
//         }
        
//         .user-info-highlight {
//           background: #f0f7ff;
//           padding: 5px 10px;
//           border-radius: 4px;
//           border-left: 4px solid #1976d2;
//           margin-bottom: 10px;
//         }
//       </style>
//     </head>
//     <body>
//       <div class="print-header">
//         <div class="company-name">Market Vehicle Bill Summary</div>
//         <div class="report-title">Bills Generated Report</div>
//       </div>
      
//       <!-- User Information Highlight -->
//       <div class="user-info-highlight">
//         <strong>Report Generated By:</strong> ${userInfo.generatedByUser} | 
//         <strong>Department:</strong> ${userInfo.userDepartment} | 
//         <strong>Role:</strong> ${userInfo.userRole} | 
//         <strong>User ID:</strong> ${userInfo.userId}
//       </div>
      
//       <!-- Report Information Section -->
//       <div class="report-info">
//         <div class="info-section">
//           <div><strong>Transporter Name:</strong> ${filters.transporter || 'All Transporters'}</div>
//           <div><strong>Bill Period:</strong> ${filters.startDate ? formatDateForPrint(filters.startDate) : 'All dates'} 
//             ${filters.endDate ? ` to ${formatDateForPrint(filters.endDate)}` : ''}</div>
//         </div>
//         <div class="info-section">
//           <div><strong>Report Date:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
//           <div><strong>Report Time:</strong> ${new Date().toLocaleTimeString('en-IN')}</div>
//         </div>
//         <div class="info-section">
//           <div><strong>Total Bills:</strong> ${generatedBills.length}</div>
//           <div><strong>Report Type:</strong> Bills Generated Summary</div>
//         </div>
//       </div>
      
//       ${filters.transporter || filters.vehicleNumber || filters.startDate || filters.endDate ? `
//         <div class="report-filter">
//           <strong>Filters Applied:</strong>
//           ${filters.transporter ? `Transporter: ${filters.transporter} | ` : ''}
//           ${filters.vehicleNumber ? `Vehicle: ${filters.vehicleNumber} | ` : ''}
//           ${filters.startDate ? `From: ${formatDateForPrint(filters.startDate)} | ` : ''}
//           ${filters.endDate ? `To: ${formatDateForPrint(filters.endDate)}` : ''}
//         </div>
//       ` : ''}
      
//       <table>
//         <thead>
//           <tr>
//             <th>Trip ID</th>
//             <th>Date</th>
//             <th>Vehicle & Transporter</th>
//             <th>Driver Name</th>
//             <th>From Location</th>
//             <th>To Location</th>
//             <th>Capacity</th>
//             <th>Distance</th>
//             <th>Trip Type</th>
//             <th>Rate (₹)</th>
//             <th>Other Charges (₹)</th>
//             <th>Total Amount (₹)</th>
//           </tr>
//         </thead>
//         <tbody>
//           ${generatedBills.map((trip) => {
//             const state = billingStates[trip.id] || {};
//             const tripDate = trip.End_Date ? new Date(trip.End_Date).toLocaleDateString('en-IN') : 'N/A';
//             return `
//               <tr>
//                 <td>${formatTripId(trip.id)}</td>
//                 <td>${tripDate}</td>
//                 <td>
//                   <div style="font-weight: bold;">${trip.vehicle_number || 'N/A'}</div>
//                   <div style="font-size: 10px; color: #666;">${trip.agency?.name || 'N/A'}</div>
//                 </td>
//                 <td>
//                   <div style="font-weight: 500;">${getDriverName(trip)}</div>
//                   ${getDriverPhone(trip) !== 'N/A' ? 
//                     `<div style="font-size: 10px; color: #666;">${getDriverPhone(trip)}</div>` : ''}
//                 </td>
//                 <td style="font-size: 11px;">${trip.start_address || 'N/A'}</td>
//                 <td style="font-size: 11px;">${trip.end_address || 'N/A'}</td>
//                 <td style="text-align: center;">${trip.vehicle?.capacity ? `${trip.vehicle.capacity} Ton` : 'N/A'}</td>
//                 <td style="text-align: right;">${trip.distance_km || 0} km</td>
//                 <td>${state.tripType || 'N/A'}</td>
//                 <td class="amount">${formatCurrencyForPrint(state.calculatedRate)}</td>
//                 <td class="amount">${formatCurrencyForPrint(state.tollFees)}</td>
//                 <td class="amount">${formatCurrencyForPrint(state.totalAmount)}</td>
//               </tr>
//             `;
//           }).join('')}
          
//           <tr class="total-row">
//             <td colspan="9" style="text-align: right; padding-right: 10px;"><strong>TOTALS:</strong></td>
//             <td class="amount"><strong>${formatCurrencyForPrint(totalCalculatedRate)}</strong></td>
//             <td class="amount"><strong>${formatCurrencyForPrint(totalOtherCharges)}</strong></td>
//             <td class="amount"><strong>${formatCurrencyForPrint(totalAmount)}</strong></td>
//           </tr>
//         </tbody>
//       </table>
      
//       <div class="print-footer">
//         <div>Report generated from Billing Management System</div>
//         <div><strong>Responsible Department:</strong> ${userInfo.userDepartment} | <strong>Generated By:</strong> ${userInfo.generatedByUser} (${userInfo.userRole})</div>
//         <div>Page 1 of 1 | Generated on: ${new Date().toLocaleString('en-IN')}</div>
//       </div>
      
//       <div class="print-actions no-print">
//         <button class="print-button" onclick="window.print()">🖨️ Print Report</button>
//         <button class="back-button" onclick="window.close()">Close</button>
//       </div>
//     </body>
//   </html>
// `;

//     printWindow.document.write(printHTML);
//     printWindow.document.close();
    
//     // Wait for content to load then print
//     setTimeout(() => {
//       printWindow.focus();
//       setTimeout(() => {
//         printWindow.print();
//       }, 500);
//     }, 500);
//   };

//   // Format Helpers
//   const formatCurrency = (amount) => {
//     return new Intl.NumberFormat('en-IN', {
//       style: 'currency',
//       currency: 'INR'
//     }).format(amount || 0);
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return 'N/A';
//     return new Date(dateString).toLocaleDateString('en-IN');
//   };

//   // Format location address - truncate if too long
//   const formatLocation = (address, maxLength = 30) => {
//     if (!address || address === 'N/A') return 'N/A';
//     if (address.length <= maxLength) return address;
//     return address.substring(0, maxLength) + '...';
//   };

//   // Get driver name
//   const getDriverName = (trip) => {
//     if (trip.driver_name) return trip.driver_name;
//     if (trip.driver?.name) return trip.driver.name;
//     if (trip.driver?.full_name) return trip.driver.full_name;
//     if (trip.driver) return `${trip.driver.first_name || ''} ${trip.driver.last_name || ''}`.trim();
//     return 'N/A';
//   };

//   // Get driver phone number if available
//   const getDriverPhone = (trip) => {
//     if (trip.driver?.phone) return trip.driver.phone;
//     if (trip.driver?.mobile) return trip.driver.mobile;
//     if (trip.driver_phone) return trip.driver_phone;
//     return 'N/A';
//   };

//   // Helper to safely format ID
//   const formatTripId = (id) => {
//     if (!id) return 'N/A';
//     return '#' + String(id).slice(0, 8);
//   };

//   // Check if any filter is active
//   const isFilterActive = () => {
//     return filters.transporter || filters.vehicleNumber || filters.startDate || filters.endDate;
//   };

//   // Render the appropriate table based on active tab
//   const renderTable = () => {
//     const data = activeTab === 'completed' ? pendingBills : generatedBills;
//     const title = activeTab === 'completed' ? 'Completed Trips' : 'Bills Generated';
//     const count = activeTab === 'completed' ? pendingBills.length : generatedBills.length;

//     return (
//       <div className={styles.recentTrips}>
//         <div className={styles.sectionHeader}>
//           <h2>{title}</h2>
//           <div className={styles.headerActions}>
//             <span className={styles.tripCount}>
//               {count} Records
//               {isFilterActive() && <span className={styles.filterActiveBadge}> (Filtered)</span>}
//             </span>
//             {activeTab === 'generated' && generatedBills.length > 0 && (
//               <button 
//                 className={styles.printReportButton}
//                 onClick={handlePrintReport}
//                 title="Print Report"
//               >
//                 🖨️ Print Report
//               </button>
//             )}
//           </div>
//         </div>

//         {loading ? (
//           <div className={styles.loading}>Loading billing data...</div>
//         ) : data.length === 0 ? (
//           <div className={styles.noData}>
//             <p>
//               {isFilterActive() 
//                 ? 'No records found matching your filters. Try changing your filter criteria.'
//                 : activeTab === 'completed' 
//                   ? 'No pending bills to process. All completed trips have been billed.' 
//                   : 'No bills generated yet. Save billing data from Completed Trips tab.'}
//             </p>
//             {isFilterActive() && (
//               <button 
//                 className={styles.clearFiltersButton}
//                 onClick={clearFilters}
//               >
//                 Clear Filters
//               </button>
//             )}
//           </div>
//         ) : activeTab === 'generated' ? (
//           <div className={styles.tableContainer}>
//             <table className={styles.table}>
//               <thead>
//                 <tr>
//                   <th>Trip ID</th>
//                   <th>Date</th>
//                   <th>Vehicle & Transporter</th>
//                   <th>Driver Name</th>
//                   <th>From Location</th>
//                   <th>To Location</th>
//                   <th>Capacity</th>
//                   <th>Distance</th>
//                   <th>Trip Type</th>
//                   <th>Rate (Calculated)</th>
//                   <th>Other charges</th>
//                   <th>Total Amount</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {data.map((trip) => {
//                   const state = billingStates[trip.id] || {};
//                   return (
//                     <tr key={trip.id}>                                            
//                       <td className={styles.tripId}>{formatTripId(trip.id)}</td>
//                       <td>{formatDate(trip.End_Date)}</td>
//                       <td>
//                         <div className={styles.cellStack}>
//                           <span className={styles.vehicleNum}>{trip.vehicle_number}</span>
//                           <span className={styles.transporterName}>{trip.agency?.name || 'N/A'}</span>
//                         </div>
//                       </td>
//                       <td className={styles.driverCell}>
//                         <div className={styles.driverInfo}>
//                           <span className={styles.driverName}>{getDriverName(trip)}</span>
//                           {getDriverPhone(trip) !== 'N/A' && (
//                             <span className={styles.driverPhone}>{getDriverPhone(trip)}</span>
//                           )}
//                         </div>
//                       </td>
//                       <td className={styles.locationCell} title={trip.start_address || 'N/A'}>
//                         {formatLocation(trip.start_address || 'N/A')}
//                       </td>
//                       <td className={styles.locationCell} title={trip.end_address || 'N/A'}>
//                         {formatLocation(trip.end_address || 'N/A')}
//                       </td>
//                       <td>{trip.vehicle?.capacity ? `${trip.vehicle.capacity} Ton` : 'N/A'}</td>
//                       <td className={styles.distanceCell}>{trip.distance_km} km</td>
//                       <td>{state.tripType || 'N/A'}</td>
//                       <td className={styles.amountCell}>
//                         {formatCurrency(state.calculatedRate)}
//                       </td>
//                       <td className={styles.amountCell}>
//                         {formatCurrency(state.tollFees)}
//                       </td>
//                       <td className={`${styles.amountCell} ${styles.totalText}`}>
//                         {formatCurrency(state.totalAmount)}
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         ) : (
//           <div className={styles.tableContainer}>
//             <table className={styles.table}>
//               <thead>
//                 <tr>
//                   <th>Trip ID</th>
//                   <th>Date</th>
//                   <th>Vehicle & Transporter</th>
//                   <th>Capacity</th>
//                   <th>Driver Name</th>
//                   <th>From Location</th>
//                   <th>To Location</th>
//                   <th>Distance</th>
//                   <th>Trip Type</th>
//                   <th>Rate (Calculated)</th>
//                   <th>Other charges</th>
//                   <th>Total Amount</th>
//                   <th>Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {data.map((trip) => {
//                   const state = billingStates[trip.id] || {};
//                   return (
//                     <tr key={trip.id}>
//                       <td className={styles.tripId}>{formatTripId(trip.id)}</td>
//                       <td>{formatDate(trip.End_Date)}</td>
//                       <td>
//                         <div className={styles.cellStack}>
//                           <span className={styles.vehicleNum}>{trip.vehicle_number}</span>
//                           <span className={styles.transporterName}>{trip.agency?.name || 'N/A'}</span>
//                         </div>
//                       </td>
//                       <td>{trip.vehicle?.capacity ? `${trip.vehicle.capacity} Ton` : 'N/A'}</td>
//                       <td className={styles.driverCell}>
//                         <div className={styles.driverInfo}>
//                           <span className={styles.driverName}>{getDriverName(trip)}</span>
//                           {getDriverPhone(trip) !== 'N/A' && (
//                             <span className={styles.driverPhone}>{getDriverPhone(trip)}</span>
//                           )}
//                         </div>
//                       </td>
//                       <td className={styles.locationCell} title={trip.start_address || 'N/A'}>
//                         {formatLocation(trip.start_address || 'N/A')}
//                       </td>
//                       <td className={styles.locationCell} title={trip.end_address || 'N/A'}>
//                         {formatLocation(trip.end_address || 'N/A')}
//                       </td>
//                       <td className={styles.distanceCell}>{trip.distance_km} km</td>
//                       <td>
//                         <select
//                           className={styles.selectInput}
//                           value={state.tripType || ''}
//                           onChange={(e) => handleInputChange(trip.id, 'tripType', e.target.value)}
//                         >
//                           <option value="">Select Type</option>
//                           <option value="Trip Basis">Trip Basis</option>
//                           <option value="Kilometer Basis">Kilometer Basis</option>
//                         </select>
//                       </td>
//                       <td className={styles.amountCell}>
//                         {formatCurrency(state.calculatedRate)}
//                       </td>
//                       <td>
//                         <input
//                           type="number"
//                           min="0"
//                           className={styles.numberInput}
//                           value={state.tollFees || 0}
//                           onChange={(e) => handleInputChange(trip.id, 'tollFees', e.target.value)}
//                         />
//                       </td>
//                       <td className={`${styles.amountCell} ${styles.totalText}`}>
//                         {formatCurrency(state.totalAmount)}
//                       </td>
//                       <td>
//                         <div className={styles.actionButtons}>
//                           <button
//                             className={`${styles.saveButton} ${state.isSaved ? styles.saved : ''}`}
//                             onClick={() => handleSave(trip.id)}
//                             disabled={!state.tripType || state.calculatedRate === 0}
//                           >
//                             {state.isSaved ? '✅ Saved' : '💾 Save'}
//                           </button>
                          
//                           {state.calculatedRate === 0 && state.tripType && (
//                             <div className={styles.errorTooltip}>
//                               No matching rate found in Rate Master
//                             </div>
//                           )}
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>
//     );
//   };

//   return (
//     <>
//       <div className={styles.adminContainer}>
//         <AdminNavigation />
//         <div className={styles.dashboard}>
//           <div className={styles.header}>
//             <div className={styles.headerLeft}>
//               <h1 className={styles.title}>Billing Management</h1>
//               <p className={styles.subtitle}>Process and manage billing for completed trips</p>
//             </div>

//             <div className={styles.headerFilters}>
//               {showFilters && (
//                 <>
//                   <div className={styles.filterGrid}>
//                     <div className={styles.filterGroup}>
//                       <label htmlFor="transporterFilter">Transporter</label>
//                       <select
//                         id="transporterFilter"
//                         className={styles.filterSelect}
//                         value={filters.transporter}
//                         onChange={(e) => handleFilterChange('transporter', e.target.value)}
//                       >
//                         <option value="">All Transporters</option>
//                         {uniqueTransporters.map(transporter => (
//                           <option key={transporter} value={transporter}>
//                             {transporter}
//                           </option>
//                         ))}
//                       </select>
//                     </div>
                    
//                     <div className={styles.filterGroup}>
//                       <label htmlFor="vehicleFilter">Vehicle Number</label>
//                       <select
//                         id="vehicleFilter"
//                         className={styles.filterSelect}
//                         value={filters.vehicleNumber}
//                         onChange={(e) => handleFilterChange('vehicleNumber', e.target.value)}
//                       >
//                         <option value="">All Vehicles</option>
//                         {uniqueVehicleNumbers.map(vehicle => (
//                           <option key={vehicle} value={vehicle}>
//                             {vehicle}
//                           </option>
//                         ))}
//                       </select>
//                     </div>
                    
//                     <div className={styles.filterGroup}>
//                       <label htmlFor="startDateFilter">Start Date</label>
//                       <input
//                         type="date"
//                         id="startDateFilter"
//                         className={styles.filterInput}
//                         value={filters.startDate}
//                         onChange={(e) => handleFilterChange('startDate', e.target.value)}
//                       />
//                     </div>
                    
//                     <div className={styles.filterGroup}>
//                       <label htmlFor="endDateFilter">End Date</label>
//                       <input
//                         type="date"
//                         id="endDateFilter"
//                         className={styles.filterInput}
//                         value={filters.endDate}
//                         onChange={(e) => handleFilterChange('endDate', e.target.value)}
//                         min={filters.startDate}
//                       />
//                     </div>
//                   </div>
                  
//                   <div className={styles.filterActions}>
//                     <button 
//                       className={styles.clearFiltersButton}
//                       onClick={clearFilters}
//                       disabled={!isFilterActive()}
//                     >
//                       Clear All
//                     </button>
//                     <div className={styles.filterStats}>
//                       <span className={styles.totalCount}>
//                         Total: {trips.filter(t => activeTab === 'completed' 
//                           ? !billingStates[t.id]?.isSaved 
//                           : billingStates[t.id]?.isSaved).length}
//                       </span>
//                       <span className={styles.filteredCount}>
//                         Showing: {activeTab === 'completed' ? pendingBills.length : generatedBills.length}
//                       </span>
//                     </div>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>

//           {error && (
//             <div className={styles.errorMessage}>
//               ⚠️ {error}
//               <button onClick={() => setError('')} className={styles.dismissError}>×</button>
//             </div>
//           )}

//           <div className={styles.tabContainer}>
//             <div className={styles.tabNavigation}>
//               <button
//                 className={`${styles.tabButton} ${activeTab === 'completed' ? styles.activeTab : ''}`}
//                 onClick={() => setActiveTab('completed')}
//               >
//                 📝 Completed Trips
//                 {trips.filter(t => !billingStates[t.id]?.isSaved).length > 0 && (
//                   <span className={styles.tabBadge}>
//                     {trips.filter(t => !billingStates[t.id]?.isSaved).length}
//                   </span>
//                 )}
//               </button>
//               <button
//                 className={`${styles.tabButton} ${activeTab === 'generated' ? styles.activeTab : ''}`}
//                 onClick={() => setActiveTab('generated')}
//               >
//                 📄 Bills Generated
//                 {trips.filter(t => billingStates[t.id]?.isSaved).length > 0 && (
//                   <span className={styles.tabBadge}>
//                     {trips.filter(t => billingStates[t.id]?.isSaved).length}
//                   </span>
//                 )}
//               </button>
//             </div>
//           </div>

//           {renderTable()}
//         </div>
//       </div>
//     </>
//   );
// };

// export default Billing;