export async function fetchExampleData() {
  try {
    // Replace with your actual Django REST API endpoint
    const response = await fetch('http://YOUR_DJANGO_API_URL/api/example/');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
} 