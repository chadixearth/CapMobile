import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const TARTRACKHeader = ({ onNotificationPress }) => (
  <SafeAreaView edges={["top"]} style={styles.safeArea}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconBtn} onPress={onNotificationPress}>
        <Ionicons name="notifications-outline" size={26} color="#6B2E2B" />
      </TouchableOpacity>
      <Text style={styles.title}>TARTRACK</Text>
      <View style={{ width: 32 }} />
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  iconBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7B3F00',
    letterSpacing: 2,
    textAlign: 'center',
  },
});

export default TARTRACKHeader; 