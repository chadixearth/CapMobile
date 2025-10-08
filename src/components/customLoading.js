//CUSTOM LOADING

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Modal,
  StyleSheet,
  View,
} from 'react-native';

export default function LogoLoader({
  visible = false,
  size = 200,
  logoSource = require('../../assets/TarTrack Logo_sakto.png'),
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible, pulseAnim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.centerWrap}>
          <Animated.View style={[styles.logoContainer, { opacity: pulseAnim }]}>
            <Image 
              source={logoSource}
              style={[styles.logo, { width: size, height: size }]}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -100,
  },
  logo: {},
});
