import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import TARTRACKHeader from '../../components/TARTRACKHeader';

export default function BookScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TARTRACKHeader onNotificationPress={() => navigation.navigate('NotificationScreen')} />
      <Text style={styles.text}>Book Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
