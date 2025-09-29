import React, { memo } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EditableField = memo(function EditableField({ value, onChangeText, placeholder, keyboardType, secureTextEntry }) {
  return (
    <View style={styles.inputRow}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#888"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
      />
      <Ionicons name="pencil-outline" size={18} color="#888" style={styles.inputIcon} />
    </View>
  );
});

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, position: 'relative' },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
    paddingRight: 36,
  },
  inputIcon: { position: 'absolute', right: 12 },
});

export default EditableField;