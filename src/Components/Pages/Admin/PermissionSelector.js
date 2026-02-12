import React, { useState, useEffect } from 'react';
import styles from './PermissionSelector.module.css';

const PermissionSelector = ({ modules, permissions, selectedPermissions, onChange }) => {
  const [expandedModule, setExpandedModule] = useState(null);
  const [selectAllState, setSelectAllState] = useState({});

  // Initialize selected permissions if not provided
  useEffect(() => {
    if (!selectedPermissions && modules) {
      const initialPermissions = {};
      modules.forEach(module => {
        initialPermissions[module.code] = [];
      });
      onChange(initialPermissions);
    }
  }, [modules, selectedPermissions, onChange]);

  // Initialize select all state
  useEffect(() => {
    if (modules && selectedPermissions) {
      const newSelectAllState = {};
      modules.forEach(module => {
        const modulePerms = selectedPermissions[module.code] || [];
        const allPermissionsForModule = permissions.map(p => p.code);
        
        if (modulePerms.length === 0) {
          newSelectAllState[module.code] = 'none';
        } else if (modulePerms.length === allPermissionsForModule.length) {
          newSelectAllState[module.code] = 'all';
        } else {
          newSelectAllState[module.code] = 'some';
        }
      });
      setSelectAllState(newSelectAllState);
    }
  }, [modules, permissions, selectedPermissions]);

  const toggleModule = (moduleCode) => {
    setExpandedModule(expandedModule === moduleCode ? null : moduleCode);
  };

  const handlePermissionChange = (moduleCode, permissionCode, checked) => {
    const currentPermissions = { ...selectedPermissions };
    const modulePermissions = [...(currentPermissions[moduleCode] || [])];
    
    if (checked) {
      if (!modulePermissions.includes(permissionCode)) {
        modulePermissions.push(permissionCode);
      }
    } else {
      const index = modulePermissions.indexOf(permissionCode);
      if (index > -1) {
        modulePermissions.splice(index, 1);
      }
    }
    
    currentPermissions[moduleCode] = modulePermissions;
    onChange(currentPermissions);
  };

  const handleSelectAll = (moduleCode, selectAll) => {
    const currentPermissions = { ...selectedPermissions };
    
    if (selectAll) {
      // Select all permissions for this module
      currentPermissions[moduleCode] = permissions.map(p => p.code);
    } else {
      // Deselect all permissions for this module
      currentPermissions[moduleCode] = [];
    }
    
    onChange(currentPermissions);
  };

  const getPermissionLabel = (permissionCode) => {
    const permissionNames = {
      'view': 'View',
      'create': 'Create',
      'edit': 'Edit',
      'delete': 'Delete',
      'export': 'Export',
      'approve': 'Approve',
      'manage': 'Full Access'
    };
    return permissionNames[permissionCode] || permissionCode;
  };

  const getModuleIcon = (iconName) => {
    const icons = {
      'dashboard': '📊',
      'people': '👥',
      'business': '🏢',
      'directions_car': '🚗',
      'route': '🛣️',
      'attach_money': '💰',
      'receipt': '🧾',
      'assessment': '📈',
      'settings': '⚙️'
    };
    return icons[iconName] || '📁';
  };

  if (!modules || !permissions) {
    return <div className={styles.loading}>Loading permissions...</div>;
  }

  return (
    <div className={styles.permissionSelector}>
      <div className={styles.header}>
        <h3>Module Permissions</h3>
        <p className={styles.subtitle}>Select which modules this user can access and what actions they can perform</p>
      </div>

      <div className={styles.modulesList}>
        {modules.map(module => {
          const modulePermissions = selectedPermissions?.[module.code] || [];
          const isExpanded = expandedModule === module.code;
          
          return (
            <div key={module.id} className={`${styles.moduleCard} ${isExpanded ? styles.expanded : ''}`}>
              <div 
                className={styles.moduleHeader}
                onClick={() => toggleModule(module.code)}
              >
                <div className={styles.moduleInfo}>
                  <span className={styles.moduleIcon}>
                    {getModuleIcon(module.icon)}
                  </span>
                  <div>
                    <h4 className={styles.moduleName}>{module.name}</h4>
                    <p className={styles.moduleDescription}>{module.description}</p>
                  </div>
                </div>
                
                <div className={styles.moduleActions}>
                  <div className={styles.permissionSummary}>
                    {modulePermissions.length > 0 ? (
                      <span className={styles.permissionCount}>
                        {modulePermissions.length} permission{modulePermissions.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className={styles.noPermissions}>No access</span>
                    )}
                  </div>
                  <button className={styles.expandButton}>
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.permissionsPanel}>
                  <div className={styles.selectAllRow}>
                    <label className={styles.selectAllLabel}>
                      <input
                        type="checkbox"
                        checked={selectAllState[module.code] === 'all'}
                        ref={el => {
                          if (el) {
                            el.indeterminate = selectAllState[module.code] === 'some';
                          }
                        }}
                        onChange={(e) => handleSelectAll(module.code, e.target.checked)}
                      />
                      <span className={styles.selectAllText}>
                        {selectAllState[module.code] === 'all' ? 'Deselect All' : 'Select All'}
                      </span>
                    </label>
                  </div>

                  <div className={styles.permissionsGrid}>
                    {permissions.map(permission => {
                      const isChecked = modulePermissions.includes(permission.code);
                      
                      // Group permissions visually
                      const isCorePermission = ['view', 'create', 'edit', 'delete'].includes(permission.code);
                      const isAdvancedPermission = ['export', 'approve'].includes(permission.code);
                      const isFullAccess = permission.code === 'manage';
                      
                      let permissionClass = styles.permissionItem;
                      if (isCorePermission) permissionClass += ` ${styles.corePermission}`;
                      if (isAdvancedPermission) permissionClass += ` ${styles.advancedPermission}`;
                      if (isFullAccess) permissionClass += ` ${styles.fullAccess}`;
                      
                      return (
                        <div key={permission.id} className={permissionClass}>
                          <label className={styles.permissionLabel}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handlePermissionChange(module.code, permission.code, e.target.checked)}
                              className={styles.permissionCheckbox}
                            />
                            <span className={styles.permissionName}>
                              {getPermissionLabel(permission.code)}
                            </span>
                            {permission.description && (
                              <span className={styles.permissionDescription}>
                                {permission.description}
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  // In PermissionSelector.js, add this button to the quickActions section:
<div className={styles.quickActions}>
  <span className={styles.quickActionsLabel}>Quick Presets:</span>
  <button
    type="button"
    className={styles.quickButton}
    onClick={() => {
      const presetPermissions = ['view'];
      const newPerms = { ...selectedPermissions };
      newPerms[module.code] = presetPermissions;
      onChange(newPerms);
    }}
  >
    View Only
  </button>
  <button
    type="button"
    className={styles.quickButton}
    onClick={() => {
      const presetPermissions = ['view', 'create', 'edit'];
      const newPerms = { ...selectedPermissions };
      newPerms[module.code] = presetPermissions;
      onChange(newPerms);
    }}
  >
    Editor
  </button>
  <button
    type="button"
    className={styles.quickButton}
    onClick={() => {
      const presetPermissions = permissions.map(p => p.code);
      const newPerms = { ...selectedPermissions };
      newPerms[module.code] = presetPermissions;
      onChange(newPerms);
    }}
  >
    Full Access
  </button>
  {/* Add this new button */}
  <button
    type="button"
    className={`${styles.quickButton} ${styles.defaultButton}`}
    onClick={() => {
      // This would need to be implemented to load default permissions
      // You'll need to pass a prop to handle this
    }}
  >
    Use Default
  </button>
</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.summary}>
        <h4>Permission Summary</h4>
        <div className={styles.summaryGrid}>
          {modules.map(module => {
            const modulePermissions = selectedPermissions?.[module.code] || [];
            if (modulePermissions.length === 0) return null;
            
            return (
              <div key={module.code} className={styles.summaryItem}>
                <span className={styles.summaryModule}>{module.name}:</span>
                <span className={styles.summaryPermissions}>
                  {modulePermissions.map(p => getPermissionLabel(p)).join(', ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PermissionSelector;