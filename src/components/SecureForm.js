/**
 * Secure Form Component with CSRF Protection and Input Validation
 */

import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import SecurityService from '../services/securityService';
import { apiClient } from '../services/improvedApiClient';

const SecureForm = ({ 
  children, 
  onSubmit, 
  validationRules = {},
  endpoint = '',
  style = {} 
}) => {
  const [csrfToken, setCsrfToken] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCSRFToken();
  }, []);

  const fetchCSRFToken = async () => {
    try {
      const response = await apiClient.get('/csrf-token/');
      if (response.success && response.data.csrf_token) {
        setCsrfToken(response.data.csrf_token);
      }
    } catch (error) {
      console.warn('Failed to fetch CSRF token:', error);
    }
  };

  const validateField = (name, value) => {
    const rules = validationRules[name];
    if (!rules) return null;

    try {
      return SecurityService.validateInput(value, rules.type, {
        fieldName: rules.label || name,
        required: rules.required,
        minLength: rules.minLength,
        maxLength: rules.maxLength,
        pattern: rules.pattern,
        min: rules.min,
        max: rules.max
      });
    } catch (error) {
      return error.message;
    }
  };

  const handleFieldChange = (name, value) => {
    // Validate field
    const error = validateField(name, value);
    
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    for (const [fieldName, rules] of Object.entries(validationRules)) {
      const value = formData[fieldName];
      const error = validateField(fieldName, value);
      
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Validate form
      if (!validateForm()) {
        Alert.alert('Validation Error', 'Please correct the errors and try again.');
        return;
      }

      // Rate limiting check
      SecurityService.checkRateLimit(endpoint);

      // Prepare secure form data
      const secureData = {
        ...formData,
        _csrf_token: csrfToken
      };

      // Call parent submit handler
      await onSubmit(secureData);

    } catch (error) {
      SecurityService.handleSecurityError(error, 'Form submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === SecureTextInput) {
          return React.cloneElement(child, {
            onChangeText: (value) => handleFieldChange(child.props.name, value),
            value: formData[child.props.name] || '',
            error: errors[child.props.name],
            onSubmit: handleSubmit,
            isSubmitting
          });
        }
        
        if (React.isValidElement(child) && child.type === SecureSubmitButton) {
          return React.cloneElement(child, {
            onPress: handleSubmit,
            disabled: isSubmitting || Object.keys(errors).some(key => errors[key])
          });
        }
        
        return child;
      })}
    </View>
  );
};

const SecureTextInput = ({ 
  name, 
  label, 
  placeholder, 
  secureTextEntry = false,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  style = {},
  onChangeText,
  value,
  error,
  ...props 
}) => {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
          error && styles.inputError,
          style
        ]}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const SecureSubmitButton = ({ 
  title, 
  onPress, 
  disabled = false, 
  style = {},
  textStyle = {},
  children 
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.submitButton,
        disabled && styles.submitButtonDisabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {children || <Text style={[styles.submitButtonText, textStyle]}>{title}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#6B2E2B',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Export components
export default SecureForm;
export { SecureTextInput, SecureSubmitButton };