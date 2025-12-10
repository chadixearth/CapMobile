// Connection Test Utility
import { apiBaseUrl } from './networkConfig';

export async function testBackendConnection() {
  const tests = [
    { name: 'Health Check', url: `${apiBaseUrl().replace('/api', '')}/health/` },
    { name: 'API Root', url: `${apiBaseUrl()}/` },
    { name: 'Location Endpoint', url: `${apiBaseUrl()}/location/update/` }
  ];

  console.log('\n=== Backend Connection Test ===');
  console.log(`Testing connection to: ${apiBaseUrl()}\n`);

  const results = [];

  for (const test of tests) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const startTime = Date.now();
      const response = await fetch(test.url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Connection': 'close',
          'Cache-Control': 'no-cache'
        }
      });
      const duration = Date.now() - startTime;

      clearTimeout(timeoutId);

      const result = {
        name: test.name,
        url: test.url,
        status: response.status,
        duration: `${duration}ms`,
        success: response.status < 500
      };

      results.push(result);
      console.log(`✓ ${test.name}: ${response.status} (${duration}ms)`);
    } catch (error) {
      const result = {
        name: test.name,
        url: test.url,
        error: error.message,
        success: false
      };
      results.push(result);
      console.log(`✗ ${test.name}: ${error.message}`);
    }
  }

  console.log('\n=== Test Summary ===');
  const successCount = results.filter(r => r.success).length;
  console.log(`Passed: ${successCount}/${tests.length}`);
  
  if (successCount === 0) {
    console.log('\n⚠️  Backend is not accessible. Please check:');
    console.log('1. Django server is running: python manage.py runserver 0.0.0.0:8000');
    console.log('2. IP address is correct: ' + apiBaseUrl());
    console.log('3. Firewall allows port 8000');
    console.log('4. Both devices are on the same network');
  }

  return results;
}

export async function quickPing() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${apiBaseUrl().replace('/api', '')}/health/`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return { success: response.ok, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
