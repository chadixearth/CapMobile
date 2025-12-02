import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import OneTimeModal from '../components/OneTimeModal';

const OneTimeModalExample = () => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTip, setShowTip] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => setShowWelcome(true)}
      >
        <Text style={styles.buttonText}>Show Welcome (Once)</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => setShowTip(true)}
      >
        <Text style={styles.buttonText}>Show Tip (Once)</Text>
      </TouchableOpacity>

      <OneTimeModal
        popupId="welcome_message"
        modalType="success"
        visible={showWelcome}
        onClose={() => setShowWelcome(false)}
        title="Welcome!"
        message="This message will only appear once. Click OK and you won't see it again."
        primaryActionText="OK"
      />

      <OneTimeModal
        popupId="daily_tip"
        modalType="info"
        visible={showTip}
        onClose={() => setShowTip(false)}
        title="Pro Tip"
        message="This tip will only show once per device."
        primaryActionText="Got it"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  button: {
    backgroundColor: '#6B2E2B',
    padding: 16,
    borderRadius: 8,
    marginVertical: 10,
    width: '80%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default OneTimeModalExample;
