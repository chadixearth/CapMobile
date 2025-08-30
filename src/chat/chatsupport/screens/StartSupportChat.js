import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={22} color={MAROON} />
    </TouchableOpacity>
  );
}

export default function StartSupportChat({ navigation }) {
  const [issue, setIssue] = useState('');

  const handleStartChat = () => {
    if (!issue.trim()) return;
    navigation.replace('SupportChatRoom', { 
      chatId: 'new', 
      issue, 
      status: 'OPEN',
      isNewChat: true
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <BackBtn onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Start New Support Chat</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Describe your issue:</Text>
        <TextInput
          style={styles.input}
          value={issue}
          onChangeText={setIssue}
          placeholder="E.g. Problem with booking, Payment issue, etc."
          placeholderTextColor="#999"
          multiline
          textAlignVertical="top"
          numberOfLines={5}
        />
        
        <TouchableOpacity 
          style={[styles.startBtn, !issue.trim() && styles.disabledBtn]} 
          onPress={handleStartChat}
          disabled={!issue.trim()}
        >
          <Text style={styles.startBtnText}>Start Chat</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff', // Changed from MAROON to white
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12,
    backgroundColor: '#f2f2f2', // Light background for the button
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222', // Changed from white to dark text
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#222',
    minHeight: 120,
    marginBottom: 24,
  },
  startBtn: {
    backgroundColor: MAROON,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  disabledBtn: {
    backgroundColor: '#ccc',
  },
  startBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});