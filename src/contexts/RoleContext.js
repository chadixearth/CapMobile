import React, { createContext, useState, useCallback } from 'react';

export const RoleContext = createContext();

export const RoleProvider = ({ children }) => {
  const [activeRole, setActiveRole] = useState(null);

  const switchActiveRole = useCallback((newRole) => {
    setActiveRole(newRole);
  }, []);

  return (
    <RoleContext.Provider value={{ activeRole, switchActiveRole }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useActiveRole = () => {
  const context = React.useContext(RoleContext);
  if (!context) {
    throw new Error('useActiveRole must be used within RoleProvider');
  }
  return context;
};
