import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CustomModalService from '../services/CustomModalService';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error
    console.error('[GlobalErrorBoundary] Caught error:', error);
    console.error('[GlobalErrorBoundary] Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Don't show alert for JSON parsing errors - they're handled gracefully
    const isJsonError = error.message?.includes('JSON Parse error') || 
                       error.message?.includes('Unexpected end of input');
    
    if (!isJsonError) {
      // Show user-friendly error message for other errors
      setTimeout(() => {
        CustomModalService.showError({
          title: 'Something went wrong',
          message: 'The app encountered an unexpected error. Please try again.',
          primaryActionText: 'Restart',
          secondaryActionText: 'Continue',
          onPrimaryAction: this.handleRestart,
          onSecondaryAction: this.handleContinue,
          showSecondaryAction: true
        });
      }, 100);
    }
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleContinue = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Check if it's a JSON parsing error - don't show error screen for these
      const isJsonError = this.state.error?.message?.includes('JSON Parse error') || 
                         this.state.error?.message?.includes('Unexpected end of input');
      
      if (isJsonError) {
        // For JSON errors, just render children normally - the error is handled gracefully
        return this.props.children;
      }

      // Render fallback UI for other errors
      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              The app encountered an unexpected error. Don't worry, your data is safe.
            </Text>
            
            <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            
            {__DEV__ && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>
                  {this.state.error?.toString()}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    maxWidth: 300,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default GlobalErrorBoundary;