export const withRetry = async (apiCall, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      lastError = error;
      const errorMessage = error?.message || '';
      
      if (__DEV__) {
        console.log(`network error on attempt ${attempt}, retrying in ${baseDelay * attempt}ms:`, errorMessage);
      }
      
      // Don't retry auth errors
      if (errorMessage.includes('JWT expired') || 
          errorMessage.includes('Session expired') ||
          errorMessage.includes('401') ||
          errorMessage.includes('403')) {
        throw error;
      }
      
      // Don't retry client errors (4xx except auth)
      if (errorMessage.includes('HTTP 4') && 
          !errorMessage.includes('401') && 
          !errorMessage.includes('403')) {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
    }
  }
  
  if (__DEV__) {
    console.error(`API call failed after ${maxRetries} retries:`, lastError);
  }
  throw lastError;
};