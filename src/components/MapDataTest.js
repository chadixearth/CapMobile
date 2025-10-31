import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { fetchMapData } from '../services/map/fetchMap';
import { apiRequest } from '../services/authService';
import { apiBaseUrl } from '../services/networkConfig';

const MapDataTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addResult = (test, success, data, error) => {
    setTestResults(prev => [...prev, {
      test,
      success,
      data,
      error,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const testDirectAPI = async () => {
    try {
      console.log('[MapDataTest] Testing direct API call...');
      const result = await apiRequest('/map/data/');
      console.log('[MapDataTest] Direct API result:', result);
      
      addResult(
        'Direct API Call (/map/data/)',
        result.success,
        result.success ? {
          points: result.data?.data?.points?.length || 0,
          roads: result.data?.data?.roads?.length || 0,
          routes: result.data?.data?.routes?.length || 0,
          zones: result.data?.data?.zones?.length || 0
        } : null,
        result.error || (result.data ? result.data.error : 'Unknown error')
      );
    } catch (error) {
      console.error('[MapDataTest] Direct API error:', error);
      addResult('Direct API Call (/map/data/)', false, null, error.message);
    }
  };

  const testFetchMapData = async () => {
    try {
      console.log('[MapDataTest] Testing fetchMapData service...');
      const result = await fetchMapData({ forceRefresh: true });
      console.log('[MapDataTest] fetchMapData result:', result);
      
      addResult(
        'fetchMapData Service',
        !result.error,
        {
          points: result.points?.length || 0,
          roads: result.roads?.length || 0,
          routes: result.routes?.length || 0,
          zones: result.zones?.length || 0,
          hasConfig: !!result.config
        },
        result.errorMessage || (result.error ? 'Service returned error flag' : null)
      );
    } catch (error) {
      console.error('[MapDataTest] fetchMapData error:', error);
      addResult('fetchMapData Service', false, null, error.message);
    }
  };

  const testConnection = async () => {
    try {
      console.log('[MapDataTest] Testing basic connection...');
      const baseUrl = apiBaseUrl();
      const response = await fetch(`${baseUrl}/map/data/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[MapDataTest] Connection response status:', response.status);
      const text = await response.text();
      console.log('[MapDataTest] Connection response preview:', text.substring(0, 200));
      
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.log('[MapDataTest] JSON parse error:', parseError.message);
      }
      
      addResult(
        `Basic Connection (${baseUrl})`,
        response.ok,
        response.ok && data ? {
          status: response.status,
          hasData: !!data.data,
          responseLength: text.length
        } : { status: response.status, responseLength: text.length },
        !response.ok ? `HTTP ${response.status}: ${response.statusText}` : null
      );
    } catch (error) {
      console.error('[MapDataTest] Connection error:', error);
      addResult('Basic Connection', false, null, error.message);
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    setTestResults([]);
    
    await testConnection();
    await testDirectAPI();
    await testFetchMapData();
    
    setLoading(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map Data API Test</Text>
      <Text style={styles.subtitle}>Backend: {apiBaseUrl()}</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={runAllTests}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Testing...' : 'Run All Tests'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={clearResults}
        >
          <Text style={styles.secondaryButtonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        {testResults.map((result, index) => (
          <View key={index} style={[styles.resultItem, result.success ? styles.successItem : styles.errorItem]}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTest}>{result.test}</Text>
              <Text style={styles.resultTime}>{result.timestamp}</Text>
            </View>
            
            <Text style={[styles.resultStatus, result.success ? styles.successText : styles.errorText]}>
              {result.success ? '✅ SUCCESS' : '❌ FAILED'}
            </Text>
            
            {result.data && (
              <View style={styles.resultData}>
                <Text style={styles.dataTitle}>Data:</Text>
                <Text style={styles.dataText}>{JSON.stringify(result.data, null, 2)}</Text>
              </View>
            )}
            
            {result.error && (
              <View style={styles.resultError}>
                <Text style={styles.errorTitle}>Error:</Text>
                <Text style={styles.errorText}>{result.error}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#6B2E2B',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6B2E2B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6B2E2B',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
  },
  resultItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  successItem: {
    borderLeftColor: '#4CAF50',
  },
  errorItem: {
    borderLeftColor: '#F44336',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTest: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  resultTime: {
    fontSize: 12,
    color: '#666',
  },
  resultStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  successText: {
    color: '#4CAF50',
  },
  errorText: {
    color: '#F44336',
  },
  resultData: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  dataTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  dataText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  resultError: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 4,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d32f2f',
    marginBottom: 4,
  },
});

export default MapDataTest;