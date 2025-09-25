/**
 * Enhanced response handler for mobile API calls
 * Handles JSON parsing errors and malformed responses
 */

export class ResponseHandler {
  static async parseResponse(response) {
    try {
      const contentType = response.headers.get('content-type') || '';
      
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.warn('[ResponseHandler] Non-JSON response:', text.substring(0, 200));
        
        // Try to extract JSON from HTML error pages
        if (text.includes('{') && text.includes('}')) {
          const jsonMatch = text.match(/\{.*\}/s);
          if (jsonMatch) {
            try {
              return JSON.parse(jsonMatch[0]);
            } catch (e) {
              // Fall through to default handling
            }
          }
        }
        
        return {
          success: false,
          error: 'Server returned non-JSON response',
          data: [],
          raw_response: text.substring(0, 500)
        };
      }
      
      const text = await response.text();
      
      if (!text || text.trim() === '') {
        console.warn('[ResponseHandler] Empty response body');
        return {
          success: true,
          data: [],
          message: 'Empty response'
        };
      }
      
      // Clean up common JSON issues
      let cleanedText = text.trim();
      
      // Remove HTML entities
      cleanedText = cleanedText
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      // Remove BOM if present
      if (cleanedText.charCodeAt(0) === 0xFEFF) {
        cleanedText = cleanedText.slice(1);
      }
      
      // Check for truncated JSON
      if (this.isJsonTruncated(cleanedText)) {
        console.error('[ResponseHandler] JSON appears truncated');
        console.error('[ResponseHandler] Raw text:', cleanedText);
        return {
          success: true,
          data: [],
          message: 'Response was truncated, returning empty data'
        };
      }
      
      // Try to parse JSON
      try {
        return JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('[ResponseHandler] JSON parse error:', parseError.message);
        console.error('[ResponseHandler] Raw text:', cleanedText);
        
        // Try to fix common JSON issues
        const fixedText = this.fixCommonJsonIssues(cleanedText);
        if (fixedText !== cleanedText) {
          try {
            return JSON.parse(fixedText);
          } catch (e) {
            // Still failed, continue to error handling
          }
        }
        
        // Return safe fallback
        return {
          success: true,
          data: [],
          message: 'JSON parse failed, returning empty data'
        };
      }
      
    } catch (error) {
      console.error('[ResponseHandler] Response parsing failed:', error);
      return {
        success: false,
        error: 'Failed to parse response: ' + error.message,
        data: []
      };
    }
  }
  
  static isJsonTruncated(text) {
    // Check for obvious truncation patterns
    if (text.endsWith('{"') || text.endsWith('{') || text.endsWith('[') || text.endsWith(',')) {
      return true;
    }
    
    // Count braces and brackets
    const openBraces = (text.match(/\{/g) || []).length;
    const closeBraces = (text.match(/\}/g) || []).length;
    const openBrackets = (text.match(/\[/g) || []).length;
    const closeBrackets = (text.match(/\]/g) || []).length;
    
    return openBraces !== closeBraces || openBrackets !== closeBrackets;
  }
  
  static fixCommonJsonIssues(text) {
    let fixed = text;
    
    // Remove trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix unquoted keys (basic cases)
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    // Fix single quotes to double quotes
    fixed = fixed.replace(/'/g, '"');
    
    // Remove control characters
    fixed = fixed.replace(/[\x00-\x1F\x7F]/g, '');
    
    return fixed;
  }
  
  static createSafeResponse(data = [], success = true, message = null) {
    return {
      success,
      data: Array.isArray(data) ? data : (data ? [data] : []),
      message,
      count: Array.isArray(data) ? data.length : (data ? 1 : 0)
    };
  }
  
  static handleError(error, fallbackData = []) {
    const isTimeout = error.name === 'AbortError' || 
                     error.message?.includes('timeout') ||
                     error.message?.includes('Aborted');
    
    const isNetworkError = error.message?.includes('Network request failed') ||
                          error.message?.includes('Connection') ||
                          error.message?.includes('ECONNRESET');
    
    if (isTimeout) {
      return {
        success: false,
        error: 'Request timeout. Please check your connection.',
        data: fallbackData,
        error_code: 'TIMEOUT'
      };
    }
    
    if (isNetworkError) {
      return {
        success: false,
        error: 'Network error. Please check your connection.',
        data: fallbackData,
        error_code: 'NETWORK_ERROR'
      };
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      data: fallbackData,
      error_code: 'UNKNOWN_ERROR'
    };
  }
}

export default ResponseHandler;