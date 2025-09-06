import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChatBubble from '../../components/ChatBubble';
import { 
  getConversationMessages, 
  sendMessage, 
  markMessagesAsRead,
  subscribeToConversationMessages,
  subscribeToMessageUpdates,
  unsubscribe,
  hasOlderMessages
} from '../../services';
import { getCurrentUser, formatMessageTime, getSmartDate } from '../../utils';