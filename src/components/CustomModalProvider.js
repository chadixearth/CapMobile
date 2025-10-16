// components/CustomModalProvider.js
import React, { useState, useImperativeHandle, forwardRef } from 'react';
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

const CustomModalProvider = forwardRef((props, ref) => {
  const [modalState, setModalState] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    iconName: 'checkmark-circle',
    iconColor: '#22C55E',
    primaryActionText: 'OK',
    secondaryActionText: 'Cancel',
    onPrimaryAction: null,
    onSecondaryAction: null,
    showSecondaryAction: false,
    autoCloseMs: null,
  });

  const fade = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.96)).current;

  useImperativeHandle(ref, () => ({
    showModal: (options) => {
      setModalState({
        visible: true,
        type: options.type || 'success',
        title: options.title || 'Success!',
        message: options.message || '',
        iconName: options.iconName || 'checkmark-circle',
        iconColor: options.iconColor || '#22C55E',
        primaryActionText: options.primaryActionText || 'OK',
        secondaryActionText: options.secondaryActionText || 'Cancel',
        onPrimaryAction: options.onPrimaryAction,
        onSecondaryAction: options.onSecondaryAction,
        showSecondaryAction: options.showSecondaryAction || !!options.onSecondaryAction,
        autoCloseMs: options.autoCloseMs,
      });
    },
    hideModal: () => {
      setModalState(prev => ({ ...prev, visible: false }));
    }
  }));

  const systemScheme = useColorScheme() || 'light';
  const isDark = systemScheme === 'dark';

  React.useEffect(() => {
    if (modalState.visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      ]).start();
    } else {
      fade.setValue(0);
      scale.setValue(0.96);
    }
  }, [modalState.visible]);

  React.useEffect(() => {
    if (modalState.visible && modalState.onClose) {
      return ModalManager.registerModal(modalState.onClose);
    }
  }, [modalState.visible, modalState.onClose]);

  React.useEffect(() => {
    if (!modalState.visible || !modalState.autoCloseMs) return;
    const t = setTimeout(() => {
      handleClose();
    }, modalState.autoCloseMs);
    return () => clearTimeout(t);
  }, [modalState.visible, modalState.autoCloseMs]);

  const handleClose = () => {
    setModalState(prev => ({ ...prev, visible: false }));
  };

  const handlePrimaryAction = () => {
    if (modalState.onPrimaryAction) {
      modalState.onPrimaryAction();
    }
    handleClose();
  };

  const handleSecondaryAction = () => {
    if (modalState.onSecondaryAction) {
      modalState.onSecondaryAction();
    }
    handleClose();
  };

  const colors = getColors(isDark);
  const bgCard = '#FFFFFF';
  const bgOverlay = colors.overlay;

  return (
    <Modal
      visible={modalState.visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={[styles.overlay, { backgroundColor: bgOverlay }]} onPress={handleClose}>
        <Pressable onPress={() => {}} style={{ width: '100%' }}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                width: CARD_W,
                backgroundColor: bgCard,
                borderColor: colors.cardBorder,
                shadowColor: colors.shadow,
                opacity: fade,
                transform: [{ scale }],
              },
            ]}
          >
            <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.accent} />
            </TouchableOpacity>
            
            <View
              style={[
                styles.badgeOuter,
                {
                  backgroundColor: getIconBgColor(modalState.type),
                  height: 72,
                  width: 72,
                  borderRadius: 36,
                },
              ]}
            >
              <View
                style={[
                  styles.badgeInner,
                  {
                    backgroundColor: '#FFFFFF',
                    height: 60,
                    width: 60,
                    borderRadius: 30,
                  },
                ]}
              >
                <Ionicons name={modalState.iconName} size={48} color={modalState.iconColor} />
              </View>
            </View>
            
            <Text style={[styles.title, { color: colors.title }]} numberOfLines={2}>
              {modalState.title}
            </Text>
            <Text style={[styles.message, { color: colors.body }]}>
              {modalState.message}
            </Text>

            <View style={styles.buttonRow}>
              {modalState.showSecondaryAction && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost, { borderColor: colors.accent }, styles.btnSpacer]}
                  onPress={handleSecondaryAction}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnGhostText, { color: colors.accent }]}>
                    {modalState.secondaryActionText}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.accent, shadowColor: colors.shadow }]}
                onPress={handlePrimaryAction}
                activeOpacity={0.9}
              >
                <Text style={styles.btnPrimaryText}>{modalState.primaryActionText}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

function getColors(isDark) {
  const accent = '#6B2E2B';
  return isDark
    ? {
        overlay: 'rgba(2, 6, 23, 0.55)',
        cardBorder: 'rgba(148, 163, 184, 0.14)',
        title: '#0F172A',
        body: 'rgba(15, 23, 42, 0.7)',
        accent,
        shadow: '#000',
      }
    : {
        overlay: 'rgba(17, 24, 39, 0.45)',
        cardBorder: 'rgba(2, 6, 23, 0.06)',
        title: '#0F172A',
        body: 'rgba(15, 23, 42, 0.7)',
        accent,
        shadow: '#000',
      };
}

function getIconBgColor(type) {
  switch (type) {
    case 'success': return 'rgba(34,197,94,0.12)';
    case 'error': return 'rgba(239,68,68,0.12)';
    case 'warning': return 'rgba(245,158,11,0.12)';
    case 'info': return 'rgba(59,130,246,0.12)';
    case 'confirmation': return 'rgba(245,158,11,0.12)';
    default: return 'rgba(34,197,94,0.12)';
  }
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalContainer: {
    alignSelf: 'center',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } },
      android: { elevation: 12 },
    }),
  },
  accentBar: { height: 4, borderTopLeftRadius: 18, borderTopRightRadius: 18, position: 'absolute', top: 0, left: 0, right: 0 },
  closeBtn: { position: 'absolute', top: 10, right: 10, padding: 8, borderRadius: 999 },
  badgeOuter: { alignSelf: 'center', marginTop: 6, marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  badgeInner: { alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', fontSize: 20, fontWeight: '800', letterSpacing: 0.2, marginBottom: 6, paddingHorizontal: 6 },
  message: { textAlign: 'center', fontSize: 15.5, lineHeight: 22, marginBottom: 18, paddingHorizontal: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnSpacer: { marginRight: 12 },
  btn: { minWidth: 100, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: {
    ...Platform.select({
      ios: { shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 3 },
    }),
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2, textAlign: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnGhostText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2, textAlign: 'center' },
});

export default CustomModalProvider;