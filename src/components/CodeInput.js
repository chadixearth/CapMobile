import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text } from 'react-native';

const MAROON = '#6B2E2B';
const LIGHT_GRAY = '#F5F5F5';
const BORDER_GRAY = '#E0E0E0';
const ACTIVE_BORDER = '#6B2E2B';

export default function CodeInput({ 
  value = '', 
  onChangeText, 
  length = 6, 
  autoFocus = false,
  editable = true 
}) {
  const [focusedIndex, setFocusedIndex] = useState(autoFocus ? 0 : -1);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChangeText = (text, index) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '');
    
    if (digit.length > 1) {
      // Handle paste - distribute digits across inputs
      const digits = digit.slice(0, length).split('');
      const newValue = value.split('');
      
      digits.forEach((d, i) => {
        if (index + i < length) {
          newValue[index + i] = d;
        }
      });
      
      const finalValue = newValue.join('').slice(0, length);
      onChangeText(finalValue);
      
      // Focus next empty input or last input
      const nextIndex = Math.min(index + digits.length, length - 1);
      if (inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex].focus();
      }
    } else {
      // Single digit input
      const newValue = value.split('');
      newValue[index] = digit;
      
      const finalValue = newValue.join('').slice(0, length);
      onChangeText(finalValue);
      
      // Auto-focus next input if digit entered
      if (digit && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // If current input is empty, focus previous and clear it
        inputRefs.current[index - 1]?.focus();
        const newValue = value.split('');
        newValue[index - 1] = '';
        onChangeText(newValue.join(''));
      } else {
        // Clear current input
        const newValue = value.split('');
        newValue[index] = '';
        onChangeText(newValue.join(''));
      }
    }
  };

  const handleFocus = (index) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(-1);
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }, (_, index) => (
        <View key={index} style={styles.inputContainer}>
          <TextInput
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.input,
              focusedIndex === index && styles.inputFocused,
              value[index] && styles.inputFilled
            ]}
            value={value[index] || ''}
            onChangeText={(text) => handleChangeText(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            onFocus={() => handleFocus(index)}
            onBlur={handleBlur}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            editable={editable}
            textAlign="center"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  inputContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  input: {
    height: 56,
    borderWidth: 2,
    borderColor: BORDER_GRAY,
    borderRadius: 12,
    backgroundColor: LIGHT_GRAY,
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inputFocused: {
    borderColor: ACTIVE_BORDER,
    backgroundColor: '#fff',
    elevation: 3,
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  inputFilled: {
    borderColor: MAROON,
    backgroundColor: '#fff',
    color: MAROON,
  },
});