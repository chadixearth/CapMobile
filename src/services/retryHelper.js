export const withRetry = async (apiCall, maxRetries = 2, baseDelay = 500) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      lastError = error;
      const errorMessage = error?.message || '';
      
      console.log(`Request timeout on attempt ${attempt}`);
      
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
      
      // Wait before retrying (shorter delay)
      await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
    }
  }
  
  console.error(`API call failed after ${maxRetries} retries:`, lastError?.message);
  throw lastError;
};