// services/email.js
import emailjs from '@emailjs/browser';
import supabase from './api';

// EmailJS Configuration
const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_ov3hav9',
  TEMPLATE_ID: 'template_h5y26ds', 
  PUBLIC_KEY: '5VcmvEA8sd411Zpub'
};

// Initialize EmailJS
export const initEmailJS = () => {
  emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
};

// NEW: Function to get plant admin emails
export const getPlantAdminEmails = async (plantId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('plant_id', plantId)
      .in('role', ['plant_admin', 'plant_user']) // CHANGED: Include both roles
      .eq('is_active', true)
      .not('email', 'is', null);

    if (error) {
      console.error('Error fetching plant emails:', error);
      return [];
    }

    return data.map(user => user.email).filter(email => email && email.trim() !== '');
  } catch (error) {
    console.error('Exception fetching plant emails:', error);
    return [];
  }
};
// In services/email.js - update sendTripEmail function
export const sendTripEmail = async (emailData) => {
  try {
    console.log('📧 DEBUG - Email data received:', {
      has_to_emails: !!emailData.to_emails,
      has_cc_emails: !!emailData.cc_emails,
      has_agency_email: !!emailData.agency_email,
      has_plant_admin_emails: !!emailData.plant_admin_emails
    });

    // Use to_emails and cc_emails if available, otherwise use the legacy names
    const toEmails = emailData.to_emails || emailData.agency_email || '';
    const ccEmails = emailData.cc_emails || emailData.plant_admin_emails || '';

    console.log('📧 DEBUG - Final separation:', {
      to: toEmails,
      to_count: toEmails.split(',').filter(e => e.trim()).length,
      cc: ccEmails,
      cc_count: ccEmails.split(',').filter(e => e.trim()).length
    });

    const templateParams = {
      // Use these clear variable names in your EmailJS template
      to_email: toEmails, // Should contain: transporter + plant_admin
      cc_email: ccEmails, // Should contain: plant_user ONLY
      
      // Keep legacy variables for backward compatibility
      agency_email: toEmails,
      plant_admin_emails: ccEmails,
      
      // Email content
      subject: emailData.subject,
      agency_name: emailData.agency_name,
      plant: emailData.plant,
      vehicle_number: emailData.vehicle_number,
      driver_name: emailData.driver_name,
      driver_contact: emailData.driver_contact,
      start_time: emailData.start_time,
      end_time: emailData.end_time,
      start_lat: emailData.start_lat,
      start_lng: emailData.start_lng,
      end_lat: emailData.end_lat,
      end_lng: emailData.end_lng,
      start_address: emailData.start_address,
      end_address: emailData.end_address,
      distance: emailData.distance,
      duration: emailData.duration,
      trip_id: emailData.trip_id,
      current_date: emailData.current_date
    };

    console.log('📧 Sending with params:', {
      to_count: toEmails.split(',').filter(e => e.trim()).length,
      cc_count: ccEmails.split(',').filter(e => e.trim()).length
    });

    const response = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams
    );

    console.log('✅ Email sent successfully');
    return { 
      success: true, 
      message: `Trip report sent! TO (transporter+plant_admin): ${toEmails.split(',').filter(e => e.trim()).length}, CC (plant_user): ${ccEmails.split(',').filter(e => e.trim()).length}`,
      recipients: {
        to: toEmails.split(',').filter(e => e.trim()),
        cc: ccEmails.split(',').filter(e => e.trim())
      }
    };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { 
      success: false, 
      message: `Failed to send email: ${error.text || error.message}` 
    };
  }
};

// UPDATED: Enhanced completion email function
export const sendCompletionEmail = async (tripData, agency, plantEmails = []) => {
  try {
    if (!agency) {
      return { success: false, message: 'Agency not found' };
    }

    // Calculate duration
    const startTime = new Date(tripData.start_time);
    const endTimeDate = new Date(tripData.end_time);
    const durationMs = endTimeDate - startTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const duration = `${hours}h ${minutes}m`;

    // Format dates
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    };

    const emailData = {
      agency_email: agency.email,
      plant_admin_emails: plantEmails, // This includes both plant_admin and plant_user emails
      subject: `MANUAL TRIP-MARKET VEHICLE-${tripData.vehicle_number || 'N/A'}`,
      agency_name: agency.name,
      plant: tripData.plant,
      vehicle_number: tripData.vehicle_number || 'N/A',
      driver_name: tripData.driver_name,
      driver_contact: tripData.driver_contact,
      start_time: formatDate(tripData.start_time),
      end_time: formatDate(tripData.end_time),
      start_lat: tripData.start_lat,
      start_lng: tripData.start_lng,
      end_lat: tripData.end_lat,
      end_lng: tripData.end_lng,
      start_address: tripData.start_address,
      end_address: tripData.end_address,
      distance: tripData.distance_km,
      duration: duration,
      trip_id: tripData.id.toString(),
      current_date: new Date().toLocaleDateString('en-GB')
    };

    console.log('Sending completion email to:', {
      agency: agency.email,
      plant_recipients: plantEmails.length
    });
    
    const result = await sendTripEmail(emailData);
    return result;

  } catch (error) {
    console.error('Error in sendCompletionEmail:', error);
    return { 
      success: false, 
      message: error.message 
    };
  }
};

/**
 * Format location coordinates into readable address
 */
const formatLocation = (location) => {
  if (!location || !location.lat || !location.lng) {
    return 'Location data not available';
  }
  return `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}`;
};

/**
 * Format date for better readability
 */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid date';
  }
};

// Test function to verify EmailJS configuration with new structure
export const testEmailJS = async () => {
  const testData = {
    agency_email: 'test@example.com',
    plant_admin_emails: ['admin1@example.com', 'admin2@example.com'],
    subject: 'MANUAL TRIP-MARKET VEHICLE-TEST123',
    agency_name: 'Test Agency',
    plant: 'Test Plant',
    vehicle_number: 'KA01AB1234',
    driver_name: 'Test Driver',
    driver_contact: '9876543210',
    start_time: '29/10/2024 14:30',
    end_time: '29/10/2024 16:45',
    start_lat: '12.971598',
    start_lng: '77.594566',
    end_lat: '13.082680',
    end_lng: '80.270718',
    distance: '25.5',
    duration: '2h 15m',
    trip_id: '12345',
    current_date: new Date().toLocaleDateString('en-GB')
  };

  return await sendTripEmail(testData);
};

export default { 
  initEmailJS, 
  sendTripEmail, 
  sendCompletionEmail,
  getPlantAdminEmails,
  testEmailJS 
};