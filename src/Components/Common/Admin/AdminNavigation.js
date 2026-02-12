// import React from 'react';
// import { Link, useNavigate, useLocation } from 'react-router-dom';
// import styles from './AdminNavigation.module.css';

// const AdminNavigation = ({ children }) => {
//   const navigate = useNavigate();
//   const location = useLocation();

//   // Get user data from localStorage
//   // Consolidating logic: Always try 'adminData' first as that's where we store the main session now
//   const userData = JSON.parse(localStorage.getItem('adminData') || localStorage.getItem('plantAdminData') || '{}');
//   const currentRole = userData.role || 'guest';

//   // Determine header title based on role
//   const getHeaderTitle = () => {
//     const titles = {
//       'admin': '🚛 Super Admin Console',
//       'super_admin': '👑 Super Admin Console',
//       'plant_admin': '🏭 Plant Admin Console',
//       'finance': '💰 Finance Console',
//       'mmd': '📦 MMD Console'
//     };
//     return titles[currentRole] || 'Admin Console';
//   };

//   const handleLogout = () => {
//     localStorage.clear();
//     navigate('/admin');
//   };

//   // Navigation menu items - STRICTLY BASED ON INSTRUCTIONS
//   const menuItems = [
//     // 1. Dashboard - Plant Admin & Super Admin
//     {
//       icon: '📊',
//       label: 'Dashboard',
//       path: '/dashboard',
//       roles: ['super_admin', 'admin', 'plant_admin'], 
//     },
//     // 2. User Management - Super Admin Only
//     {
//       icon: '👥',
//       label: 'User Management',
//       path: '/admin/users',
//       roles: ['super_admin', 'admin'],
//     },
//     // 3. Transporter/Agencies - Super Admin Only
//     {
//       icon: '🏢',
//       label: 'Transporter & Plants',
//       path: '/admin/agencies',
//       roles: ['super_admin', 'admin'],
//     },
//     // 4. Vehicle Management - Plant Admin & Super Admin
//     {
//       icon: '🚛',
//       label: 'Vehicle Management',
//       path: '/vehicles',
//       roles: ['super_admin', 'admin', 'plant_admin'],
//     },
//     // 5. Rate Master - Finance & Super Admin
//     {
//       icon: '💰',
//       label: 'Rate Master',
//       path: '/admin/rate-master',
//       roles: ['super_admin', 'admin', 'finance'],
//     },
//     // 6. Billing - Finance & MMD & Super Admin
//     {
//       icon: '🧾',
//       label: 'Billing',
//       path: '/admin/billing',
//       roles: ['super_admin', 'admin', 'finance', 'mmd','driver'],
//     },
//     // 7. Supplier - MMD & Super Admin
//     {
//       icon: '📦',
//       label: 'Supplier',
//       path: '/admin/supplier',
//       roles: ['super_admin', 'admin', 'mmd'],
//     }
//   ];

//   // Filter menu items based on role
//   const filteredMenuItems = menuItems.filter(item =>
//     item.roles.includes(currentRole)
//   );

//   const isActivePath = (path) => {
//     return location.pathname === path;
//   };

//   const getUserInitials = () => {
//     const name = userData.username || userData.name || userData.email || 'User';
//     return name.charAt(0).toUpperCase();
//   };

//   const shouldShowNavigation = ['admin', 'finance', 'mmd', 'super_admin', 'plant_admin'].includes(currentRole);

//   if (!shouldShowNavigation) {
//     return <div>{children}</div>;
//   }

//   return (
//     <div className={styles.adminLayout}>
//       {/* Top Header */}
//       <header className={styles.adminHeader}>
//         <div className={styles.headerLeft}>
//           <div className={styles.headerBrand}>
//             <h1>{getHeaderTitle()}</h1>
//             <span className={styles.headerSubtitle}>{userData.plant_location ? `📍 ${userData.plant_location}` : 'Management Console'}</span>
//           </div>
//         </div>

//         <div className={styles.headerRight}>
//           <div className={styles.userProfile}>
//             <div className={styles.userAvatar}>
//               {getUserInitials()}
//             </div>
//             <div className={styles.userDetails}>
//               <span className={styles.userName}>{userData.username || 'User'}</span>
//               <span className={`${styles.userRole} ${styles[currentRole]}`}>{currentRole.replace('_', ' ').toUpperCase()}</span>
//             </div>
//           </div>

//           <div className={styles.headerActions}>
//             <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
//               <span className={styles.logoutIcon}>🚪</span>
//               <span className={styles.logoutText}>Logout</span>
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* Sidebar Navigation */}
//       <aside className={styles.adminSidebar}>
//         <div className={styles.sidebarHeader}>
//            {/* Optional Logo Area */}
//         </div>

//         <nav className={styles.sidebarNav}>
//           <ul className={styles.navMenu}>
//             {filteredMenuItems.map((item, index) => (
//               <li key={index} className={styles.navItem}>
//                 <Link
//                   to={item.path}
//                   className={`${styles.navLink} ${isActivePath(item.path) ? styles.active : ''}`}
//                 >
//                   <span className={styles.navIcon}>{item.icon}</span>
//                   <span className={styles.navLabel}>{item.label}</span>
//                   {isActivePath(item.path) && (
//                     <span className={styles.activeIndicator}></span>
//                   )}
//                 </Link>
//               </li>
//             ))}
//           </ul>
//         </nav>
//       </aside>

//       {/* Main Content Area */}
//       <main className={styles.adminMain}>
//         <div className={styles.pageContent}>
//           {children}
//         </div>
//       </main>
//     </div>
//   );
// };

// export default AdminNavigation;


import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styles from './AdminNavigation.module.css';

const AdminNavigation = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get user data from localStorage - check all possible locations
  const getStoredUser = () => {
    try {
      const adminData = localStorage.getItem('adminData');
      const userData = localStorage.getItem('userData');
      const plantAdminData = localStorage.getItem('plantAdminData');
      
      // Priority: adminData > plantAdminData > userData
      if (adminData) {
        const parsed = JSON.parse(adminData);
        return {
          ...parsed,
          role: parsed.role || 'admin',
          username: parsed.username || parsed.name || 'User',
          transporter_name: parsed.transporter_name || parsed.agency_name
        };
      }
      
      if (plantAdminData) {
        const parsed = JSON.parse(plantAdminData);
        return {
          ...parsed,
          role: parsed.role || 'plant_admin',
          username: parsed.username || parsed.name || 'User'
        };
      }
      
      if (userData) {
        const parsed = JSON.parse(userData);
        return {
          ...parsed,
          role: parsed.role || 'driver',
          username: parsed.username || parsed.name || 'User',
          transporter_name: parsed.transporter_name || parsed.agency_name
        };
      }
      
      return { role: 'guest', username: 'Guest' };
    } catch (error) {
      console.error('Error parsing user data:', error);
      return { role: 'guest', username: 'Guest' };
    }
  };

  const userData = getStoredUser();
  const currentRole = userData.role || 'guest';
  const userTransporterName = userData.transporter_name || '';

  // Determine header title based on role
  const getHeaderTitle = () => {
    const titles = {
      'admin': '🚛 Admin Console',
      'super_admin': '👑 Super Admin Console',
      'plant_admin': '🏭 Plant Admin Console',
      'finance': '💰 Finance Console',
      'mmd': '📦 MMD Console',
      'driver': '🚚 Transporter Dashboard',
    };
    return titles[currentRole] || 'Admin Console';
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/admin');
  };

  // Navigation menu items - UPDATED TO INCLUDE DRIVER
  const menuItems = [
    // 1. Dashboard - All roles
    {
      icon: '📊',
      label: 'Dashboard',
      path: '/dashboard',
      roles: ['super_admin', 'admin', 'plant_admin', 'finance', 'mmd'], 
    },
    // 2. User Management - Super Admin Only
    {
      icon: '👥',
      label: 'User Management',
      path: '/admin/users',
      roles: ['super_admin', 'admin'],
    },
    // 3. Transporter/Agencies - Super Admin Only
    {
      icon: '🏢',
      label: 'Transporter & Plants',
      path: '/admin/agencies',
      roles: ['super_admin', 'admin'],
    },
    // 4. Vehicle Management - Plant Admin & Super Admin
    {
      icon: '🚛',
      label: 'Vehicle Management',
      path: '/vehicles',
      roles: ['super_admin', 'admin', 'plant_admin'],
    },
    // 5. Rate Master - Finance & Super Admin
    {
      icon: '💰',
      label: 'Rate Master',
      path: '/admin/rate-master',
      roles: ['super_admin', 'admin', 'finance'],
    },
    // 6. Billing - Finance & MMD & Super Admin & DRIVER
    {
      icon: '🧾',
      label: 'Billing',
      path: '/admin/billing',
      roles: ['super_admin', 'admin', 'finance', 'mmd', 'driver'],
    },
    // 7. Supplier - MMD & Super Admin
    {
      icon: '📦',
      label: 'Supplier',
      path: '/admin/supplier',
      roles: ['super_admin', 'admin', 'mmd'],
    }
  ];

  // Filter menu items based on role
  const filteredMenuItems = menuItems.filter(item =>
    item.roles.includes(currentRole)
  );

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  const getUserInitials = () => {
    const name = userData.username || userData.name || userData.email || 'User';
    return name.charAt(0).toUpperCase();
  };

  const shouldShowNavigation = ['admin', 'finance', 'mmd', 'super_admin', 'plant_admin', 'driver'].includes(currentRole);

  if (!shouldShowNavigation) {
    return <div>{children}</div>;
  }

  // Get role display name
  const getRoleDisplayName = () => {
    const roleNames = {
      'super_admin': 'Super Admin',
      'admin': 'Admin',
      'plant_admin': 'Plant Admin',
      'finance': 'Finance',
      'mmd': 'MMD',
      'driver': 'Transporter'
    };
    return roleNames[currentRole] || 'User';
  };

  return (
    <div className={styles.adminLayout}>
      {/* Top Header */}
      <header className={styles.adminHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerBrand}>
            <h1>{getHeaderTitle()}</h1>
            {userTransporterName && currentRole === 'driver' && (
              <span className={styles.transporterSubtitle}>📦 {userTransporterName}</span>
            )}
            {userData.plant_location && (
              <span className={styles.headerSubtitle}>📍 {userData.plant_location}</span>
            )}
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.userProfile}>
            <div className={styles.userAvatar}>
              {getUserInitials()}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{userData.username || 'User'}</span>
              <span className={`${styles.userRole} ${styles[currentRole]}`}>
                {getRoleDisplayName()}
              </span>
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

      {/* Sidebar Navigation - Only show if there are menu items */}
      {filteredMenuItems.length > 0 && (
        <aside className={styles.adminSidebar}>
          <div className={styles.sidebarHeader}>
            {/* Optional Logo Area */}
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
                    {isActivePath(item.path) && (
                      <span className={styles.activeIndicator}></span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      )}

      {/* Main Content Area */}
      <main className={`${styles.adminMain} ${filteredMenuItems.length === 0 ? styles.noSidebar : ''}`}>
        <div className={styles.pageContent}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminNavigation;