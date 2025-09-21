import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Platform,
  Animated,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ModalManager from '../services/ModalManager';

const { width } = Dimensions.get('window');
const CARD_W = Math.min(width * 0.9, 520);

const SuccessModal = ({
  visible,
  title = 'Success!',
  message = 'Operation completed successfully.',
  onClose,
  primaryAction,
  secondaryAction,
  primaryActionText = 'OK',
  secondaryActionText = 'Cancel',
  showIcon = true,
  iconName = 'checkmark-circle',
  iconColor = '#22C55E',
  iconSize = 48,                // 👈 bigger by default; customize as needed
  autoCloseMs,
  showClose = true,
  disableBackdropClose = false,
}) => {
  // register for auto-close on session expiry
  useEffect(() => {
    if (visible && onClose) {
      return ModalManager.registerModal(onClose);
    }
  }, [visible, onClose]);

  // theming
  const scheme = useColorScheme() || 'light';
  const isDark = scheme === 'dark';

  // animations
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      ]).start();
    } else {
      fade.setValue(0);
      scale.setValue(0.96);
    }
  }, [visible]);

  // auto-dismiss
  useEffect(() => {
    if (!visible || !autoCloseMs || !onClose) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [visible, autoCloseMs, onClose]);

  const handleBackdropPress = () => {
    if (!disableBackdropClose) onClose?.();
  };

  const colors = getColors(isDark);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={handleBackdropPress}>
        {/* Prevent closing when tapping inside the card */}
        <Pressable onPress={() => {}} style={{ width: '100%' }}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                width: CARD_W,
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                shadowColor: colors.shadow,
                opacity: fade,
                transform: [{ scale }],
              },
            ]}
          >
            {/* Top subtle indicator bar */}
            <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />

            {/* Close button */}
            {showClose && (
              <TouchableOpacity
                onPress={onClose}
                hitSlop={10}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.accent} />
              </TouchableOpacity>
            )}

            {/* Icon badge (scales with iconSize) */}
            {showIcon && (
              <View
                style={[
                  styles.badgeOuter,
                  {
                    backgroundColor: colors.badgeBg,
                    height: iconSize + 24,
                    width: iconSize + 24,
                    borderRadius: (iconSize + 24) / 2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.badgeInner,
                    {
                      backgroundColor: colors.badgeInnerBg,
                      height: iconSize + 12,
                      width: iconSize + 12,
                      borderRadius: (iconSize + 12) / 2,
                    },
                  ]}
                >
                  <Ionicons name={iconName} size={iconSize} color={iconColor} />
                </View>
              </View>
            )}

            {/* Text */}
            <Text style={[styles.title, { color: colors.title }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={[styles.message, { color: colors.body }]}>
              {message}
            </Text>

            {/* Actions */}
            <View style={styles.buttonRow}>
              {secondaryAction && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost, { borderColor: colors.accent }, styles.btnSpacer]}
                  onPress={secondaryAction}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnGhostText, { color: colors.accent }]}>{secondaryActionText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.accent, shadowColor: colors.shadow }]}
                onPress={primaryAction || onClose}
                activeOpacity={0.9}
              >
                <Text style={styles.btnPrimaryText}>{primaryActionText}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

function getColors(isDark) {
  // brand accent (from your dashboard palette family)
  const accent = '#6B2E2B';
  return isDark
    ? {
        overlay: 'rgba(2, 6, 23, 0.55)',
        card: 'rgba(17, 24, 39, 0.92)',            // glassy dark
        cardBorder: 'rgba(148, 163, 184, 0.14)',    // slate-300/20
        title: '#F8FAFC',
        body: 'rgba(226, 232, 240, 0.85)',
        accent,
        badgeBg: 'rgba(34,197,94,0.12)',
        badgeInnerBg: 'rgba(255,255,255,0.08)',
        shadow: '#000',
      }
    : {
        overlay: 'rgba(17, 24, 39, 0.45)',
        card: 'rgba(255,255,255,0.96)',            // glassy light
        cardBorder: 'rgba(2, 6, 23, 0.06)',         // subtle hairline
        title: '#0F172A',
        body: 'rgba(15, 23, 42, 0.7)',
        accent,
        badgeBg: 'rgba(34,197,94,0.12)',
        badgeInnerBg: 'rgba(255,255,255,0.9)',
        shadow: '#000',
      };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContainer: {
    alignSelf: 'center',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.18,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 14 },
      },
      android: {
        elevation: 12,
      },
    }),
  },
  accentBar: {
    height: 3,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    position: 'absolute',
    top: 0, left: 0, right: 0,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
    borderRadius: 999,
  },
  // base badge styles (sizes are overridden dynamically above)
  badgeOuter: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  message: {
    textAlign: 'center',
    fontSize: 15.5,
    lineHeight: 22,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSpacer: { marginRight: 12 },
  btn: {
    minWidth: 100,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999, // pill
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    ...Platform.select({
      ios: {
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 3 },
    }),
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  btnGhostText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});

export default SuccessModal;
