import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../Services/api';
import styles from './AdminLogin.module.css';

const AdminLogin = () => {
  const [formData, setFormData] = useState({ 
    username: '', 
    password: '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New state for password visibility
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ 
      ...formData, 
      [e.target.name]: e.target.value 
    });
    setError('');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Please enter both username and password');
      return;
    }
    setLoading(true);
    try {
      const { data, error: apiError } = await api.adminLogin(formData);

      if (apiError || !data) {
        setError(apiError?.message || 'Login failed.');
        setLoading(false);
        return;
      }

      const userData = data.user || data;
      const token = data.token;
      
      console.log("Login Successful Data:", data);
      console.log("User Role:", userData.role);

      // Store user data
      const completeUserData = {
        ...userData,
        token: token,
        username: userData.username || formData.username
      };
      
      localStorage.setItem('adminData', JSON.stringify(completeUserData));
      localStorage.setItem('adminToken', token);
      
      if (userData.role === 'driver') {
        localStorage.setItem('userData', JSON.stringify(completeUserData));
        localStorage.setItem('userToken', token);
      }

      // Redirect based on role
      const role = userData.role;
      
      switch(role) {
        case 'super_admin':
        case 'admin':
          navigate('/dashboard');
          break;
        case 'plant_admin':
          navigate('/dashboard');
          break;
        case 'finance':
          navigate('/admin/billing');
          break;
        case 'mmd':
          navigate('/admin/billing');
          break;
        case 'driver':
          console.log("Driver detected, redirecting to billing...");
          navigate('/admin/billing');
          break;
        default:
          setError('Unauthorized role for Admin Portal');
          localStorage.clear();
      }

    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ username: '', password: '' });
    setError('');
    setShowPassword(false);
  };

  return (
    <div className={styles.adminLoginPage}>
      <div className={styles.adminLoginContainer}>
        <div className={styles.adminLoginCard}>
          <h1 className={styles.logo}>🔐 Admin Console</h1>
          
          <form onSubmit={handleSubmit} className={styles.loginForm}>
            {error && <div className={styles.errorMessage}>⚠️ {error}</div>}
            
            <div className={styles.formGroup}>
              <input 
                name="username" 
                value={formData.username}
                placeholder="Username" 
                onChange={handleChange} 
                className={styles.input}
                disabled={loading}
                autoComplete="username"
              />
            </div>
            
            <div className={styles.formGroup}>
              <div className={styles.passwordContainer}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  name="password" 
                  value={formData.password}
                  placeholder="Password" 
                  onChange={handleChange} 
                  className={styles.passwordInput}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button 
                  type="button"
                  className={styles.passwordToggle}
                  onClick={togglePasswordVisibility}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            
            <div className={styles.buttonGroup}>
              <button 
                type="submit" 
                className={`${styles.loginButton} ${loading ? styles.loading : ''}`}
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

            </div>
          </form>
          
          <div className={styles.footer}>
            <a href="/login" className={styles.driverLink}> Go to Driver Portal</a>
            <p className={styles.contactNote}>Contact administrator for credentials</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;