import React, { useState, useEffect } from 'react';
import { api, getAddressFromCoordinates, getDeviceId } from '../../Services/api';
import styles from './DriverPage.module.css';
import { sendTripEmail, initEmailJS } from '../../Services/email';
import DriverHeader from '../../Common/Driver/DriverHeader';

const DriverPage = () => {
  const [agencies, setAgencies] = useState([]);
  const [filteredAgencies, setFilteredAgencies] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [endVendors, setEndVendors] = useState([]);
  const [showStartPopup, setShowStartPopup] = useState(false);
  const [showEndPopup, setShowEndPopup] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [loading, setLoading] = useState(false);

  const [startForm, setStartForm] = useState({
    plant: '',
    plant_id: '',
    agency_id: '',
    vehicle_id: '',
    vendor_code: '',
    driver_name: '',
    driver_contact: '',
    start_lat: '',
    start_lng: '',
    start_address: ''
  });

  const [endForm, setEndForm] = useState({
    vendor_code: '',
    end_lat: '',
    end_lng: '',
    end_address: ''
  });

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedEndVendor, setSelectedEndVendor] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await loadUserData();
      await loadAgenciesAndPlants();
      await checkActiveTrip();
      initEmailJS();
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  };

  const checkActiveTrip = async () => {
    try {
      const { data, error } = await api.getActiveTrip();
      if (!error && data) {
        setActiveTrip(data);
      } else {
        setActiveTrip(null);
      }
    } catch (error) {
      console.error('Error checking active trip:', error);
    }
  };

  const loadVendorsForPlant = async (plantName, plantId) => {
    try {
      if (!plantName || plantName.trim() === '') {
        setVendors([]);
        setStartForm(prev => ({ ...prev, vendor_code: '' }));
        setSelectedVendor(null);
        return;
      }

      const { data, error } = await api.getVendorsByPlant(plantName);
      
      if (error || !data) {
        if (plantId) {
          const { data: vendorData, error: vendorError } = await api.getVendorsByPlantId(plantId);
          if (!vendorError && vendorData) {
            setVendors(vendorData);
          } else {
            setVendors([]);
          }
        } else {
          setVendors([]);
        }
      } else {
        setVendors(data);
      }

      setStartForm(prev => ({ ...prev, vendor_code: '' }));
      setSelectedVendor(null);
      
    } catch (error) {
      console.error('Error loading vendors:', error);
      setVendors([]);
    }
  };

 const loadVendorsForEndTrip = async () => {
  try {
    if (!activeTrip || !activeTrip.plant) {
      setEndVendors([]);
      setEndForm(prev => ({ ...prev, vendor_code: '' }));
      setSelectedEndVendor(null);
      return;
    }

    const { data: vendorsByName, error: nameError } = await api.getVendorsByPlant(activeTrip.plant);
    
    if (!nameError && vendorsByName && vendorsByName.length > 0) {
      // 🔍 FILTER OUT THE PICKUP VENDOR FROM THE END TRIP VENDOR LIST
      const filteredVendors = vendorsByName.filter(
        vendor => vendor.vendor_code !== activeTrip.vendor_code
      );
      setEndVendors(filteredVendors);
    } else {
      if (activeTrip.plant_id) {
        const { data: vendorsById, error: idError } = await api.getVendorsByPlantId(activeTrip.plant_id);
        
        if (!idError && vendorsById) {
          // 🔍 FILTER OUT THE PICKUP VENDOR FROM THE END TRIP VENDOR LIST
          const filteredVendors = vendorsById.filter(
            vendor => vendor.vendor_code !== activeTrip.vendor_code
          );
          setEndVendors(filteredVendors);
        } else {
          setEndVendors([]);
        }
      } else {
        setEndVendors([]);
      }
    }
    
    setEndForm(prev => ({ ...prev, vendor_code: '' }));
    setSelectedEndVendor(null);
    
  } catch (error) {
    console.error('Error loading vendors for end trip:', error);
    setEndVendors([]);
  }
};

  const loadUserData = () => {
    return new Promise((resolve) => {
      const userDataString = localStorage.getItem('userData');
      if (userDataString) {
        try {
          const user = JSON.parse(userDataString);
          
          setStartForm(prev => {
            const newForm = {
              ...prev,
              plant: user.plant || '',
              agency_id: user.agency_id ? user.agency_id.toString() : ''
            };
            
            if (JSON.stringify(prev) === JSON.stringify(newForm)) {
              return prev;
            }
            return newForm;
          });
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
      resolve();
    });
  };

  const loadAgenciesAndPlants = async () => {
    try {
      const { data, error } = await api.getAgencies();
      if (!error && data) {
        setAgencies(data);
        
        const userDataString = localStorage.getItem('userData');
        const currentUser = userDataString ? JSON.parse(userDataString) : null;
        
        if (currentUser && currentUser.agency_id) {
          const userAgency = data.find(agency => agency.id === currentUser.agency_id);
          
          if (userAgency) {
            setFilteredAgencies([userAgency]);
            
            await loadVehicles(userAgency.id);
            
            const plantId = userAgency.plant_id;
            const plantName = userAgency.plants?.name || currentUser.plant || '';
            
            setStartForm(prev => {
              const newForm = {
                ...prev,
                plant: plantName,
                plant_id: plantId,
                agency_id: userAgency.id.toString()
              };
              
              if (JSON.stringify(prev) === JSON.stringify(newForm)) {
                return prev;
              }
              return newForm;
            });

            await loadVendorsForPlant(plantName, plantId);
          }
        }
      }
    } catch (error) {
      console.error('Error loading agencies and plants:', error);
    }
  };

  const loadVehicles = async (agencyId) => {
    try {
      if (!agencyId) {
        setVehicles([]);
        return;
      }
      
      const { data, error } = await api.getVehiclesByAgency(agencyId);
      if (!error && data) {
        const activeVehicles = data.filter(vehicle => vehicle.status === 'active');
        setVehicles(activeVehicles);
      } else {
        setVehicles([]);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
      setVehicles([]);
    }
  };

  const getCurrentLocation = async (type) => {
    setLoading(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      const address = await getAddressFromCoordinates(latitude, longitude);
      
      if (type === 'start') {
        setStartForm(prev => ({
          ...prev,
          start_lat: latitude.toFixed(6),
          start_lng: longitude.toFixed(6),
          start_address: address
        }));
      } else {
        setEndForm(prev => ({
          ...prev,
          end_lat: latitude.toFixed(6),
          end_lng: longitude.toFixed(6),
          end_address: address
        }));
      }
    } catch (error) {
      console.error('Error getting location:', error);
      alert('Error getting location. Please try again or check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (startLat, startLng, endLat, endLng) => {
    const R = 6371;
    const dLat = (endLat - startLat) * Math.PI / 180;
    const dLng = (endLng - startLng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(2);
  };

  const handleStartTrip = async (e) => {
    e.preventDefault();
    
    if (startForm.driver_contact.length !== 10) {
      alert('Please enter a valid 10-digit contact number');
      return;
    }
    
    if (!/^[A-Za-z\s]+$/.test(startForm.driver_name.trim())) {
      alert('Please enter a valid driver name (letters and spaces only)');
      return;
    }

    if (!startForm.vendor_code) {
      alert('Please select a vendor');
      return;
    }

    if (!startForm.start_lat || !startForm.start_lng) {
      alert('Please get your current location first');
      return;
    }

    if (!startForm.vehicle_id) {
      alert('Please select a vehicle');
      return;
    }

    setLoading(true);

    try {
      const selectedVehicle = vehicles.find(v => v.id === parseInt(startForm.vehicle_id));
      const vendorName = selectedVendor ? selectedVendor.vendor_name : '';
      
      const tripData = {
        agency_id: startForm.agency_id,
        vehicle_id: startForm.vehicle_id,
        vehicle_number: selectedVehicle?.vehicle_number || '',
        plant: startForm.plant || '',
        plant_id: startForm.plant_id || '',
        driver_name: startForm.driver_name.trim(),
        driver_contact: startForm.driver_contact,
        start_lat: startForm.start_lat,
        start_lng: startForm.start_lng,
        start_address: startForm.start_address || 'Location not specified',
        vendor_code: startForm.vendor_code,
        vendor_name: vendorName
      };

      const { data, error } = await api.startTrip(tripData);
      
      if (!error && data) {
        setActiveTrip(data);
        setShowStartPopup(false);
        
        setStartForm({ 
          plant: startForm.plant || '',
          plant_id: startForm.plant_id || '',
          agency_id: startForm.agency_id || '',
          vehicle_id: '',
          vendor_code: '',
          driver_name: '', 
          driver_contact: '', 
          start_lat: '', 
          start_lng: '',
          start_address: '' 
        });
        setSelectedVendor(null);
        
        alert('Trip started successfully!');
      } else {
        alert(`Error starting trip: ${error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Error starting trip: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndTrip = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    // First, get the plant ID from multiple possible sources
    const plantId = activeTrip?.plant_id || startForm.plant_id || '';

    // Validate based on destination type
    if (endForm.destinationType === 'supplier' && !endForm.vendor_code) {
      alert('Please select a delivery vendor');
      setLoading(false);
      return;
    }

    if (endForm.destinationType === 'plant' && !plantId) {
      alert('Plant information is missing. Please try refreshing the page.');
      setLoading(false);
      return;
    }

    if (!endForm.end_lat || !endForm.end_lng) {
      alert('Please get your current location first');
      setLoading(false);
      return;
    }

    const endTime = new Date().toISOString();
    const distance = calculateDistance(
      activeTrip.start_lat,
      activeTrip.start_lng,
      parseFloat(endForm.end_lat),
      parseFloat(endForm.end_lng)
    );

    let vendorCode = '';
    let vendorName = '';

    // Set values based on destination type
    if (endForm.destinationType === 'supplier') {
      const selectedEndVendor = endVendors.find(v => v.vendor_code === endForm.vendor_code);
      
      if (!selectedEndVendor) {
        alert('Selected delivery vendor not found. Please select a valid vendor.');
        setLoading(false);
        return;
      }
      
      vendorCode = selectedEndVendor.vendor_code;
      vendorName = selectedEndVendor.vendor_name;
    } else if (endForm.destinationType === 'plant') {
      // For plant destination, use plant info
      vendorCode = `PLANT_${plantId}`;
      vendorName = activeTrip.plant || startForm.plant || 'Plant';
    }

    const endData = {
      end_lat: parseFloat(endForm.end_lat),
      end_lng: parseFloat(endForm.end_lng),
      end_address: endForm.end_address,
      end_time: endTime,
      distance_km: parseFloat(distance),
      end_vendor_code: vendorCode,
      end_vendor_name: vendorName,
      destination_type: endForm.destinationType,
      plant_id: plantId, // Use the plantId we extracted
      status: 'completed'
    };

    const { data, error } = await api.endTrip(activeTrip.id, endData);
    
    if (!error && data) {
      const emailResult = await sendCompletionEmailToAll(data, distance, endTime);
      
      setActiveTrip(null);
      setShowEndPopup(false);
      setEndForm({ 
        vendor_code: '',
        end_lat: '', 
        end_lng: '', 
        end_address: '',
        destinationType: '',
        end_vendor_code: '',
        end_vendor_name: ''
      });
      setSelectedEndVendor(null);
      setEndVendors([]);
      
      if (emailResult.success) {
        const recipientCount = emailResult.recipients ? emailResult.recipients.length : 1;
        alert(`Trip completed! Distance: ${distance} km\nEmail notification has been sent to ${recipientCount} recipients successfully.`);
      } else {
        alert(`Trip completed! Distance: ${distance} km\nBut email failed to send: ${emailResult.message}`);
      }
    } else {
      alert('Error ending trip: ' + error?.message);
    }
  } catch (error) {
    alert('Error ending trip: ' + error.message);
  } finally {
    setLoading(false);
  }
};

  const handleShowEndPopup = async () => {
  setLoading(true);
  try {
    setEndForm({ 
      vendor_code: '', 
      end_lat: '', 
      end_lng: '', 
      end_address: '',
      destinationType: '',
      end_vendor_code: '',
      end_vendor_name: ''
    });
    setSelectedEndVendor(null);
    
    await loadVendorsForEndTrip();
    setShowEndPopup(true);
  } catch (error) {
    console.error('Error loading vendors for end trip:', error);
    alert('Error loading vendors. Please try again.');
  } finally {
    setLoading(false);
  }
};

  const handleVendorChange = (vendorCode) => {
    const vendor = vendors.find(v => v.vendor_code === vendorCode);
    setStartForm(prev => ({ ...prev, vendor_code: vendorCode }));
    // Convert vendor details to uppercase
  const updatedVendor = vendor ? {
    ...vendor,
    vendor_name: vendor.vendor_name ? vendor.vendor_name.toUpperCase() : '',
    vendor_address: vendor.vendor_address ? vendor.vendor_address.toUpperCase() : 'ADDRESS NOT AVAILABLE'
  } : null;
    setSelectedVendor(updatedVendor);
  };

  const handleEndVendorChange = (vendorCode) => {
  const vendor = endVendors.find(v => v.vendor_code === vendorCode);
  // Convert vendor details to uppercase
  const updatedVendor = vendor ? {
    ...vendor,
    vendor_name: vendor.vendor_name ? vendor.vendor_name.toUpperCase() : '',
    vendor_address: vendor.vendor_address ? vendor.vendor_address.toUpperCase() : 'ADDRESS NOT AVAILABLE'
  } : null;
  
  setEndForm(prev => ({ 
    ...prev, 
    vendor_code: vendorCode,
    end_vendor_code: vendorCode,
    end_vendor_name: updatedVendor ? updatedVendor.vendor_name : ''
  }));
  setSelectedEndVendor(updatedVendor);
};

  const sendCompletionEmailToAll = async (tripData, distance, endTime) => {
    try {
      const agency = agencies.find(a => a.id === tripData.agency_id);
      
      if (!agency) {
        return { success: false, message: 'Agency not found' };
      }

      let plantAdminEmails = [];
      if (tripData.plant_id) {
        const { data: emails, error: emailError } = await api.getPlantAdminEmails(tripData.plant_id);
        if (!emailError && emails) {
          plantAdminEmails = emails;
        }
      }

      let plantUserEmails = [];
      if (tripData.plant_id) {
        const { data: emails, error: emailError } = await api.getPlantUserEmails(tripData.plant_id);
        if (!emailError && emails) {
          plantUserEmails = emails;
        }
      }

      const startTime = new Date(tripData.start_time);
      const endTimeDate = new Date(endTime);
      const durationMs = endTimeDate - startTime;
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const duration = `${hours}h ${minutes}m`;

      const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-GB', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      };

      const toEmails = [
        agency.email,
        ...plantAdminEmails
      ].filter(email => email && email.trim() !== '').join(',');

      const ccEmails = plantUserEmails.join(',');

      const emailData = {
        to_emails: toEmails,
        cc_emails: ccEmails,
        agency_email: toEmails,
        plant_admin_emails: ccEmails,
        
        subject: `MANUAL TRIP-MARKET VEHICLE-${tripData.vehicle_number || 'N/A'}`,
        agency_name: agency.name,
        plant: tripData.plant,
        vehicle_number: tripData.vehicle_number || 'N/A',
        driver_name: tripData.driver_name,
        driver_contact: tripData.driver_contact,
        start_time: formatDate(tripData.start_time),
        end_time: formatDate(endTime),
        start_lat: tripData.start_lat,
        start_lng: tripData.start_lng,
        end_lat: tripData.end_lat,
        end_lng: tripData.end_lng,
        start_address: tripData.start_address,
        end_address: tripData.end_address,
        distance: distance,
        duration: duration,
        trip_id: tripData.id.toString(),
        current_date: new Date().toLocaleDateString('en-GB')
      };
      
      const result = await sendTripEmail(emailData);
      return result;

    } catch (error) {
      console.error('Error in sendCompletionEmailToAll:', error);
      return { 
        success: false, 
        message: error.message 
      };
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <DriverHeader />
      <div className={styles.driverPage}>
        <div className={styles.container}>
          <div className={styles.statusCard}>
            <h2 className={styles.statusTitle}>
              {activeTrip ? '🚗 Trip in Progress' : '✅ Ready to Start'}
            </h2>
            
            {activeTrip ? (
              <div className={styles.activeTripDetails}>
                <div className={styles.statusLine}>
                  <span className={styles.label}>Plant :</span>
                  <span className={styles.value}>{activeTrip.plant}</span>
                </div>
                <div className={styles.statusLine}>
                  <span className={styles.label}>Transporter :</span>
                  <span className={styles.value}>
                    {agencies.find(a => a.id === activeTrip.agency_id)?.name}
                  </span>
                </div>
                <div className={styles.statusLine}>
                  <span className={styles.label}>Vehicle No :</span>
                  <span className={styles.value}>{activeTrip.vehicle_number}</span>
                </div>
                <div className={styles.statusLine}>
                  <span className={styles.label}>Driver :</span>
                  <span className={styles.value}>{activeTrip.driver_name}</span>
                </div>
                <div className={styles.statusLine}>
                  <span className={styles.label}>Start Date & Time :</span>
                  <span className={styles.value}>
                    {new Date(activeTrip.start_time).toLocaleString()}
                  </span>
                </div>
                <div className={styles.statusLine}>
                  <span className={styles.label}>Start Location :</span>
                  <span className={styles.value}>{activeTrip.start_address}</span>
                </div>
                {activeTrip.vendor_name && (
                  <div className={styles.statusLine}>
                    <span className={styles.label}>Pickup Vendor :</span>
                    <span className={styles.value}>
                      {activeTrip.vendor_name} ({activeTrip.vendor_code})
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className={styles.statusText}>
                {/* Empty state text if needed */}
              </p>
            )}
          </div>

          <div className={styles.controls}>
            {!activeTrip ? (
              <button 
                className={`${styles.btn} ${styles.startBtn}`}
                onClick={() => setShowStartPopup(true)}
                disabled={loading}
              >
                🚗 Start Trip
              </button>
            ) : (
              <button 
                className={`${styles.btn} ${styles.endBtn}`}
                onClick={handleShowEndPopup}
                disabled={loading}
              >
                🏁 End Trip
              </button>
            )}
          </div>

          {/* Start Trip Popup */}
          {showStartPopup && (
            <div className={styles.popupOverlay}>
              <div className={styles.popup}>
                <div className={styles.popupHeader}>
                  <h3>Start New Trip</h3>
                  <button 
                    className={styles.closeBtn}
                    onClick={() => {
                      setShowStartPopup(false);
                      setVehicles([]);
                      setVendors([]);
                      setSelectedVendor(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                <form onSubmit={handleStartTrip} className={styles.form}>
                  <div className={styles.formGroup}>
  
  <div className={styles.formGroup}>
  <label>Plant & Transporter</label>
  <input 
    type="text"
    value={`${startForm.plant} & ${filteredAgencies.find(a => a.id === parseInt(startForm.agency_id))?.name || ''}`}
    readOnly
    className={styles.readonlyInput}
    placeholder="Plant / Transporter will be auto-filled"
  />
</div>
</div>
                  <div className={styles.formGroup}>
                    {/* <label>Vehicle Number *</label> */}
                    <select 
                      value={startForm.vehicle_id}
                      onChange={(e) => setStartForm(prev => ({...prev, vehicle_id: e.target.value}))}
                      required
                      disabled={!startForm.agency_id || vehicles.length === 0}
                    >
                      <option value="">Select Vehicle</option>
                      {vehicles.map(vehicle => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.vehicle_number}
                        </option>
                      ))}
                    </select>
                    {startForm.agency_id && vehicles.length === 0 && (
                      <p className={styles.noData}>No active vehicles found for your agency</p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
  {/* <label>Select Pickup Vendor *</label> */}
  <select 
    value={startForm.vendor_code}
    onChange={(e) => handleVendorChange(e.target.value)}
    required
    disabled={!startForm.plant || vendors.length === 0}
  >
    <option value="">Select Pickup Vendor</option>
    {vendors.length === 0 && startForm.plant ? (
      <option value="" disabled>No vendors found for {startForm.plant}</option>
    ) :vendors.map(vendor => (
  <option key={vendor.vendor_code} value={vendor.vendor_code}>
    {vendor.vendor_name.toUpperCase()} - {vendor.vendor_address ? vendor.vendor_address.toUpperCase() : 'ADDRESS NOT AVAILABLE'}
  </option>
))}
  </select>

                    
                    {/* {selectedVendor && (
                      <div className={styles.vendorDetails}>
                        <p><strong>Vendor Code:</strong> {selectedVendor.vendor_code}</p>
                        <p><strong>Vendor Name:</strong> {selectedVendor.vendor_name}</p>
                        {selectedVendor.contact_person_name && (
                          <p><strong>Contact Person:</strong> {selectedVendor.contact_person_name}</p>
                        )}
                        {selectedVendor.contact_person_number && (
                          <p><strong>Contact Number:</strong> {selectedVendor.contact_person_number}</p>
                        )}
                      </div>
                    )} */}
                  </div>

                  <div className={styles.formGroup}>
                    {/* <label>Driver Name *</label> */}
                    <input 
                      type="text"
                      value={startForm.driver_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^[A-Za-z\s]*$/.test(value)) {
                          setStartForm(prev => ({...prev, driver_name: value}));
                        }
                      }}
                      placeholder="Enter driver name"
                      required
                      pattern="[A-Za-z\s]+"
                      title="Please enter only letters and spaces"
                    />
                    {startForm.driver_name && !/^[A-Za-z\s]+$/.test(startForm.driver_name) && (
                      <p className={styles.errorText}>Only letters and spaces are allowed</p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    {/* <label>Contact Number *</label> */}
                    <input 
                      type="tel"
                      value={startForm.driver_contact}
                      onChange={(e) => {
                        let value = e.target.value;
                        value = value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setStartForm(prev => ({...prev, driver_contact: value}));
                        }
                      }}
                      placeholder="Enter mobile number"
                      required
                      maxLength="10"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    {/* <label>Start Location *</label> */}
                    <button 
                      type="button"
                      className={styles.locationBtn}
                      onClick={() => getCurrentLocation('start')}
                      disabled={loading}
                    >
                      📍 Get Current Location
                    </button>
                    
                    <div className={styles.coordinatesDisplay}>
                      <div className={styles.coordinateField}>
                        <span className={styles.coordinateLabel}>Address:</span>
                        <textarea 
                          value={startForm.start_address}
                          readOnly
                          className={styles.addressInput}
                          placeholder="Address will appear here after getting location"
                          rows="3"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.formActions}>
                    <button 
                      type="submit"
                      className={styles.submitBtn}
                      disabled={loading || 
                        !startForm.start_lat || 
                        !startForm.start_lng || 
                        startForm.driver_contact.length !== 10 || 
                        !startForm.vehicle_id ||
                        !startForm.vendor_code}
                    >
                      {loading ? 'Starting...' : 'Start Trip'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* End Trip Popup */}
          {/* End Trip Popup */}
{showEndPopup && activeTrip && (
  <div className={styles.popupOverlay}>
    <div className={styles.popup}>
      <div className={styles.popupHeader}>
        <h3>End Trip</h3>
        <button 
          className={styles.closeBtn}
          onClick={() => {
            setShowEndPopup(false);
            setEndVendors([]);
            setSelectedEndVendor(null);
          }}
        >
          ✕
        </button>
      </div>

      <div className={styles.TripInfo}>
        <div className={styles.combinedLine}>
          <div className={styles.statusItem}>
            <span className={styles.label}>Plant :</span>
            <span className={styles.value}>{activeTrip.plant}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.label}>Transporter :</span>
            <span className={styles.value}>
              {agencies.find(a => a.id === activeTrip.agency_id)?.name}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.label}>Vehicle No :</span>
            <span className={styles.value}>{activeTrip.vehicle_number}</span>
          </div>
        </div>
        <div className={styles.statusLine}>
          <span className={styles.label}>Driver :</span>
          <span className={styles.value}>{activeTrip.driver_name}</span>
        </div>
        <div className={styles.statusLine}>
          <span className={styles.label}>Start Date & Time :</span>
          <span className={styles.value}>
            {new Date(activeTrip.start_time).toLocaleString()}
          </span>
        </div>
        <div className={styles.statusLine}>
          <span className={styles.label}>Start Location :</span>
          <span className={styles.value}>{activeTrip.start_address}</span>
        </div>
        {activeTrip.vendor_name && (
          <div className={styles.statusLine}>
            <span className={styles.label}>Pickup Vendor :</span>
            <span className={styles.value}>
              {activeTrip.vendor_name} ({activeTrip.vendor_code})
            </span>
          </div>
        )}
      </div>
      
      <form onSubmit={handleEndTrip} className={styles.form}>
        {/* Destination Type Radio Buttons - Single Line */}
<div className={styles.formGroup}>
  {/* <label className={styles.radioGroupLabel}>Delivery Destination *</label> */}
  <div className={styles.radioGroup}>
    <label className={styles.radioLabel}>
      <input
        type="radio"
        name="destinationType"
        value="plant"
        checked={endForm.destinationType === 'plant'}
        onChange={(e) => setEndForm(prev => ({ 
          ...prev, 
          destinationType: e.target.value,
          vendor_code: '', // Clear vendor code when selecting plant
          end_vendor_code: '', // Clear end vendor code
          end_vendor_name: '' // Clear end vendor name
        }))}
        disabled={loading}
      />
      <span className={styles.radioText}>Plant</span>
    </label>
    <label className={styles.radioLabel}>
      <input
        type="radio"
        name="destinationType"
        value="supplier"
        checked={endForm.destinationType === 'supplier'}
        onChange={(e) => setEndForm(prev => ({ 
          ...prev, 
          destinationType: e.target.value 
        }))}
        disabled={loading}
      />
      <span className={styles.radioText}>Supplier</span>
    </label>
  </div>
</div>
        {/* Inside End Trip Popup form - Supplier dropdown */}
{endForm.destinationType === 'supplier' && (
  <div className={styles.formGroup}>
    <label>Select Delivery Supplier *</label>
    <select 
      value={endForm.vendor_code}
      onChange={(e) => handleEndVendorChange(e.target.value)}
      required
      disabled={loading || endVendors.length === 0}
      className={!endForm.vendor_code ? styles.requiredField : ''}
    >
      <option value="">Select Delivery Supplier</option>
      {loading ? (
        <option value="" disabled>Loading vendors...</option>
      ) : endVendors.length === 0 ? (
        <option value="" disabled>
          {activeTrip?.vendor_code 
            ? `No other vendors found for ${activeTrip.plant} (${activeTrip.vendor_name} is your pickup vendor)`
            : `No vendors found for ${activeTrip.plant}`}
        </option>
      ) :
        endVendors.map(vendor => (
          <option key={vendor.vendor_code} value={vendor.vendor_code}>
            {vendor.vendor_name.toUpperCase()} - {vendor.vendor_address ? vendor.vendor_address.toUpperCase() : 'ADDRESS NOT AVAILABLE'}
          </option>
        ))}
    </select>
    
    {!loading && endVendors.length === 0 && activeTrip.plant && (
      <p className={styles.noData}>
        {activeTrip?.vendor_code 
          ? `Only ${activeTrip.vendor_name} is available as pickup vendor. No other vendors found for ${activeTrip.plant}.`
          : `No vendors found for ${activeTrip.plant} plant`}
      </p>
    )}
  </div>
)}

        {/* Location Section */}
        <div className={styles.formGroup}>
          {/* <label>Delivery Location *</label> */}
          <div className={styles.coordinatesDisplay}>
            <div className={styles.coordinateField}>
              {/* <span className={styles.coordinateLabel}>Address:</span> */}
              <textarea 
                value={endForm.end_address}
                readOnly
                className={styles.addressInput}
                placeholder="Address will appear here after getting location"
                rows="3"
              />
            </div>
          </div>
          <button 
            type="button"
            className={styles.locationBtn}
            onClick={() => getCurrentLocation('end')}
            disabled={loading}
          >
            📍 Get Current Location
          </button>
        </div>

        <div className={styles.formActions}>
          
          <button 
            type="submit"
            className={styles.submitBtn}
            disabled={loading || 
              !endForm.end_lat || 
              !endForm.end_lng || 
              !endForm.destinationType ||
              (endForm.destinationType === 'supplier' && !endForm.vendor_code)}
          >
            {loading ? 'Ending...' : 'End Trip'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
        </div>
      </div>
    </div>
  );
};

export default DriverPage;
