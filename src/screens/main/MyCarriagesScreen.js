import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import TartanillaCarriagesScreen from './TartanillaCarriagesScreen';
import DriverCarriageAssignmentsScreen from './DriverCarriageAssignmentsScreen';

export default function MyCarriagesScreen({ navigation }) {
  const { user } = useAuth();
  
  // Route drivers to assignment screen, owners to carriage management
  if (user?.role === 'driver' || user?.role === 'driver-owner') {
    return <DriverCarriageAssignmentsScreen navigation={navigation} />;
  }
  
  return <TartanillaCarriagesScreen navigation={navigation} />;
}