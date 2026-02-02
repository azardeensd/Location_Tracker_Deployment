import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './AdminNavigation.module.css';


const AdminNavigation = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get user data from localStorage
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
  const plantAdminData = JSON.parse(localStorage.getItem('plantAdminData') || '{}');

  // Determine which user data to use
  let userData = {};
  if (adminData.role) {
    userData = adminData;
  } else if (plantAdminData.role) {
    userData = plantAdminData;
  }

  const currentRole = userData.role;

  // Determine header title based on role
  const getHeaderTitle = () => {
    const titles = {
      'admin': '🚛 Transporter Admin',
      'plant_admin': '🏭 Plant Admin Console',
      'finance': '💰 Finance Console',
      'hr': '👥 HR Console',
      'super_admin': '👑 Super Admin'
    };
    return titles[currentRole] || 'Admin Console';
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    localStorage.removeItem('plantAdminToken');
    localStorage.removeItem('plantAdminData');
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('isPlantAdmin');
    navigate('/admin');
  };

  const getRoleDisplayName = () => {
    const roleNames = {
      'admin': 'Super Admin',
      'plant_admin': 'Plant Admin',
      'finance': 'Finance',
      'hr': 'HR',
      'super_admin': 'Super Admin'
    };
    return roleNames[currentRole] || 'User';
  };

  // Navigation menu items
  const menuItems = [
    {
      icon: '📊',
      label: 'Dashboard',
      path: '/dashboard',
      roles: ['admin', 'finance', 'hr', 'super_admin', 'plant_admin'],
      badge: null
    },
    {
      icon: '👥',
      label: 'User Management',
      path: '/admin/users',
      roles: ['admin', 'hr'],
      badge: null
    },
    {
      icon: '🏢',
      label: 'Transporter & Plants',
      path: '/admin/agencies',
      roles: ['admin'],
      badge: null
    },
    {
      icon: '🚛',
      label: 'Vehicle Management',
      path: '/vehicles',
      roles: ['admin', 'plant_admin'],
      badge: null
    },
    {
      icon: '💰',
      label: 'Rate Master',
      path: '/admin/rate-master',
      roles: ['admin'],
      badge: null
    },
    {
      icon: '🧾',
      label: 'Billing',
      path: '/admin/billing',
      roles: ['admin', 'finance'],
      badge: null
    },
    {
      icon: '📦',
      // icon: <FaBoxesStacked />,
      label: 'Supplier',
      path: '/admin/supplier',
      roles: ['admin', 'finance'],
      badge: null
    }
  ];

  // Filter menu items based on role
  const filteredMenuItems = menuItems.filter(item =>
    item.roles.includes(currentRole)
  );

  // Check if path is active
  const isActivePath = (path) => {
    return location.pathname === path;
  };

  const getUserInitials = () => {
    const name = userData.username || userData.name || userData.email || 'User';
    return name.charAt(0).toUpperCase();
  };

  // Only show navigation for admin roles
  const shouldShowNavigation = ['admin', 'finance', 'hr', 'super_admin', 'plant_admin'].includes(currentRole);

  if (!shouldShowNavigation) {
    return <div>{children}</div>;
  }

  return (
    <div className={styles.adminLayout}>
      {/* Top Header */}
      <header className={styles.adminHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerBrand}>
            <h1>{getHeaderTitle()}</h1>
            <span className={styles.headerSubtitle}>Management Console</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.userProfile}>
            <div className={styles.userAvatar}>
              {getUserInitials()}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{userData.username || userData.name || userData.email || 'User'}</span>
              <span className={`${styles.userRole} ${styles[currentRole]}`}>{getRoleDisplayName()}</span>
              {currentRole === 'plant_admin' && userData.plant_name && (
                <span className={styles.plantBadge}>🏭 {userData.plant_name}</span>
              )}
            </div>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
              <span className={styles.logoutIcon}>🚪</span>
              <span className={styles.logoutText}>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside className={styles.adminSidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarUserInfo}>
            <div className={styles.sidebarUserAvatar}>
              {getUserInitials()}
            </div>
            <div className={styles.sidebarUserDetails}>
              <h4>{userData.username || userData.name || 'User'}</h4>
              <span className={`${styles.sidebarUserRole} ${styles[currentRole]}`}>
                {getRoleDisplayName()}
              </span>
            </div>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <ul className={styles.navMenu}>
            {filteredMenuItems.map((item, index) => (
              <li key={index} className={styles.navItem}>
                <Link
                  to={item.path}
                  className={`${styles.navLink} ${isActivePath(item.path) ? styles.active : ''}`}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                  {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
                  {isActivePath(item.path) && (
                    <span className={styles.activeIndicator}></span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.systemStatus}>
            <div className={`${styles.statusIndicator} ${styles.online}`}></div>
            <span>System Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={styles.adminMain}>
        <div className={styles.pageContent}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminNavigation;