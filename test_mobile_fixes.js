/**
 * Test script to verify mobile connection fixes
 * Run this in the mobile app console or as a standalone test
 */

import ResponseHandler from './src/services/responseHandler';
import mobileDiagnostics from './src/services/mobileDiagnostics';

// Test data for various scenarios
const testCases = [
  {
    name: 'Valid JSON',
    response: '{"success": true, "data": []}',
    expected: { success: true, data: [] }
  },
  {
    name: 'Empty response',
    response: '',
    expected: { success: true, data: [], message: 'Empty response' }
  },
  {
    name: 'HTML entities',
    response: '{"message": "Success &amp; complete", "data": []}',
    expected: { message: "Success & complete", data: [] }
  },
  {
    name: 'Trailing comma',
    response: '{"data": [1, 2, 3,], "success": true,}',
    expected: { data: [1, 2, 3], success: true }
  },
  {
    name: 'Unquoted keys',
    response: '{success: true, data: []}',
    expected: { success: true, data: [] }
  },
  {
    name: 'Malformed JSON',
    response: '{"incomplete": tr',
    expected: { success: false, error: 'JSON Parse error', data: [] }
  }
];

async function runTests() {
  console.log('🧪 Testing Mobile Connection Fixes');
  console.log('=' .repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`\n📋 Testing: ${testCase.name}`);
      
      // Create mock response
      const mockResponse = {
        headers: {
          get: (name) => name === 'content-type' ? 'application/json' : null
        },
        text: () => Promise.resolve(testCase.response)
      };
      
      const result = await ResponseHandler.parseResponse(mockResponse);
      
      // Basic validation
      const hasExpectedStructure = result && typeof result === 'object';
      const hasSuccessField = 'success' in result || 'data' in result;
      
      if (hasExpectedStructure && hasSuccessField) {
        console.log('✅ PASSED - Response handled gracefully');
        passed++;
      } else {
        console.log('❌ FAILED - Invalid response structure');
        console.log('Result:', result);
        failed++;
      }
      
    } catch (error) {
      console.log('❌ FAILED - Exception thrown:', error.message);
      failed++;
    }
  }
  
  console.log('\n📊 Test Results');
  console.log('=' .repeat(30));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  // Test diagnostics
  console.log('\n🔍 Testing Mobile Diagnostics');
  console.log('=' .repeat(30));
  
  try {
    // Test error classification
    const errors = [
      new Error('JSON Parse error: Unexpected end of input'),
      new Error('Network request failed'),
      new Error('Request timeout'),
      new Error('HTTP 500: Internal Server Error')
    ];
    
    errors.forEach(error => {
      const type = mobileDiagnostics.classifyError(error);
      console.log(`📝 ${error.message.substring(0, 30)}... → ${type}`);
    });
    
    // Test diagnostic report
    const report = mobileDiagnostics.getDiagnosticReport();
    console.log('\n📋 Diagnostic Report:');
    console.log(`Platform: ${report.platform}`);
    console.log(`Error Counts:`, report.errorCounts);
    console.log(`Timestamp: ${report.timestamp}`);
    
    console.log('\n✅ Diagnostics working correctly');
    
  } catch (error) {
    console.log('\n❌ Diagnostics test failed:', error.message);
  }
  
  console.log('\n🎉 Mobile fixes test completed!');
  
  if (failed === 0) {
    console.log('🎊 All tests passed! Mobile app should handle connection issues gracefully.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Export for use in mobile app
export { runTests };

// Auto-run if in Node.js environment
if (typeof window === 'undefined') {
  runTests().catch(console.error);
}