// API Configuration
const API_BASE_URL = 'http://10.196.222.213:8081/api';

export async function createBooking(bookingData) {
  try {
    console.log('Creating booking with data:', bookingData);
    
    const response = await fetch(`${API_BASE_URL}/booking/create/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error('Non-JSON response received:', responseText.substring(0, 500));
      throw new Error(`Expected JSON but received: ${contentType || 'unknown'}`);
    }
    
    const data = await response.json();
    console.log('Successfully created booking:', data);
    return data;
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
}

export async function getBookings(filters = {}) {
  try {
    console.log('Fetching bookings with filters:', filters);
    
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = `${API_BASE_URL}/booking/list/?${queryParams.toString()}`;
    console.log('Request URL:', url);
    
    const response = await fetch(url);
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('Successfully fetched bookings:', data);
    return data;
  } catch (error) {
    console.error('Error fetching bookings:', error);
    throw error;
  }
}

export async function getBooking(bookingId) {
  try {
    console.log('Fetching booking with ID:', bookingId);
    
    const response = await fetch(`${API_BASE_URL}/booking/${bookingId}/`);
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('Successfully fetched booking:', data);
    return data;
  } catch (error) {
    console.error('Error fetching booking:', error);
    throw error;
  }
}

export async function updateBookingStatus(bookingId, status) {
  try {
    console.log('Updating booking status:', { bookingId, status });
    
    const response = await fetch(`${API_BASE_URL}/booking/${bookingId}/status/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('Successfully updated booking status:', data);
    return data;
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
}

export async function cancelBooking(bookingId) {
  try {
    console.log('Cancelling booking with ID:', bookingId);
    
    const response = await fetch(`${API_BASE_URL}/booking/${bookingId}/cancel/`, {
      method: 'DELETE',
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('Successfully cancelled booking:', data);
    return data;
  } catch (error) {
    console.error('Error cancelling booking:', error);
    throw error;
  }
}
