// Test script to verify map API returns images
const API_BASE_URL = 'http://192.168.101.80:8000/api'; // Update with your IP

async function testMapAPI() {
  try {
    console.log('Testing map API...');
    
    const response = await fetch(`${API_BASE_URL}/map/data/`);
    const data = await response.json();
    
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data && data.data.points) {
      console.log('\nMap Points:');
      data.data.points.forEach((point, index) => {
        console.log(`${index + 1}. ${point.name}`);
        console.log(`   - image_url: ${point.image_url || 'none'}`);
        console.log(`   - image_urls: ${JSON.stringify(point.image_urls || [])}`);
        console.log(`   - Image count: ${(point.image_urls || []).length}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMapAPI();