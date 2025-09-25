import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const MAROON = '#6B2E2B';

export default function LogoLoader({
  visible = false,
  message = 'Loading…',
  size = 120,
  // Update the path below to where your file actually lives:
  // e.g. require('../../../assets/TarTrack Logo_sakto.png')
  logoSource = require('../../assets/TarTrack Logo_sakto.png'),
  glowColor = MAROON,
  textColor = '#1F1F1F',
  blockTouch = true, // if false, use pointerEvents="none" to let touches pass through
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  // animations
  useEffect(() => {
    if (!visible) return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const ringWave = (val, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    pulseLoop.start();
    const r1 = ringWave(ring1, 0);
    const r2 = ringWave(ring2, 600); // offset for a continuous ripple
    r1.start();
    r2.start();

    return () => {
      pulseLoop.stop();
      r1.stop();
      r2.stop();
      pulse.stopAnimation();
      ring1.stopAnimation();
      ring2.stopAnimation();
    };
  }, [visible, pulse, ring1, ring2]);

  const logoScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const ringCommon = useMemo(
    () => ({
      width: size + 16,
      height: size + 16,
      borderRadius: (size + 16) / 2,
      borderWidth: 2,
      borderColor: glowColor,
      position: 'absolute',
      opacity: 0.6,
    }),
    [size, glowColor]
  );

  const ring1Style = {
    transform: [
      {
        scale: ring1.interpolate({
          inputRange: [0, 1],
          outputRange: [1.05, 1.8],
        }),
      },
    ],
    opacity: ring1.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 0],
    }),
  };

  const ring2Style = {
    transform: [
      {
        scale: ring2.interpolate({
          inputRange: [0, 1],
          outputRange: [1.05, 1.8],
        }),
      },
    ],
    opacity: ring2.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 0],
    }),
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      statusBarTranslucent
    >
      <View
        style={styles.overlay}
        pointerEvents={blockTouch ? 'auto' : 'none'}
      >
        <View style={styles.centerWrap}>
          {/* expanding glow rings */}
          <Animated.View style={[ringCommon, ring1Style]} pointerEvents="none" />
          <Animated.View style={[ringCommon, ring2Style]} pointerEvents="none" />

          {/* logo with soft pulse */}
          <Animated.View
            style={[
              {
                width: size,
                height: size,
                transform: [{ scale: logoScale }],
              },
              styles.logoShadow,
            ]}
            pointerEvents="none"
          >
            <Image
              source={logoSource}
              style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
            />
          </Animated.View>

          {message ? (
            <Text style={[styles.msg, { color: textColor }]}>{message}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent', // fully transparent backdrop
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  msg: {
    marginTop: 14,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  // soft shadow behind the logo (iOS only; Android gets elevation)
  logoShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
