import { useEffect } from 'react';
import LocationService from '../services/locationService';
import { getSession } from '../services/authService';

const DriverNotificationFilter = ({ children }) => {
  useEffect(() => {
    const checkLocationStatus = async () => {
      try {
        const session = await getSession();
        if (session?.user?.role === 'driver' || session?.user?.role === 'driver-owner') {
          const status = await LocationService.getLocationSharingStatus(session.user.id);
          
          if (!status.isActive) {
            console.log('[DriverNotificationFilter] Location sharing inactive - notifications filtered');
          }
        }
      } catch (error) {
        console.error('Error checking driver location status:', error);
      }
    };

    checkLocationStatus();
    const interval = setInterval(checkLocationStatus, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return children;
};

export default DriverNotificationFilter;