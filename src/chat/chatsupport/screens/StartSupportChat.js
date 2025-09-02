import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createConversation } from '../../services';

const MAROON = '#6B2E2B';

function BackBtn({ onPress }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="arrow-back" size={22} color={MAROON} />
    </TouchableOpacity>
  );
}

export default function StartSupportChat({ navigation }) {
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleStartChat = async () => {
    if (!subject.trim()) return;
    
    try {
      setLoading(true);
      
      // Important: Pass the subject text directly, not as a JSON object
      const conversation = await createConversation(subject.trim());
      
      if (conversation?.id) {
        navigation.replace('SupportChatRoom', {
          conversationId: conversation.id,
          subject: subject.trim(), // Pass the plain text subject
          status: 'open' // Explicitly set status to open
        });
      }
    } catch (err) {
      console.error('Error starting chat:', err);
      alert('Failed to create conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            value={subject}
            onChangeText={setSubject}
            placeholder="E.g. Problem with booking, Payment issue, etc."
            placeholderTextColor="#999"
            multiline
            textAlignVertical="top"
            numberOfLines={5}
          />
          
          <TouchableOpacity 
            style={[styles.startBtn, (!subject.trim() || loading) && styles.disabledBtn]} 
            onPress={handleStartChat}
            disabled={!subject.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.startBtnText}>Start Chat</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    padding: 24,
    paddingBottom: 32
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
    paddingBottom: 36, // Extra padding at the bottom
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
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 24, // Extra space at the bottom
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