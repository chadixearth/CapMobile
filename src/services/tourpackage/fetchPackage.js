import { apiRequest } from '../authService';

export const tourPackageService = {
  async getAllPackages() {
    try {
      const result = await apiRequest('/tourpackage/?include_details=true');
      
      if (!result.success) {
        return [];
      }
      
      const data = result.data;
      let packages = [];
      
      if (data && data.success && data.data) {
        packages = Array.isArray(data.data) ? data.data : [data.data];
      } else if (Array.isArray(data)) {
        packages = data;
      } else if (data && data.results && Array.isArray(data.results)) {
        packages = data.results;
      } else {
        return [];
      }
      
      return packages.map(pkg => ({
        ...pkg,
        start_time: pkg.start_time || '09:00',
        destination_lat: pkg.destination_lat || pkg.dropoff_lat,
        destination_lng: pkg.destination_lng || pkg.dropoff_lng,
        status: pkg.status || (pkg.is_active ? 'active' : 'inactive'),
        // Use existing review data from API response
        reviews: pkg.reviews || [],
        reviews_count: pkg.reviews_count || (pkg.reviews ? pkg.reviews.length : 0),
        average_rating: pkg.average_rating || 0
      }));
    } catch (error) {
      console.error('Error fetching packages:', error);
      return [];
    }
  },

  async getPackageById(packageId) {
    try {
      const result = await apiRequest(`/tourpackage/${packageId}/`);
      
      if (!result.success) {
        throw new Error('Package not found');
      }
      
      const data = result.data;
      let packageData;
      
      if (data.success && data.data) {
        packageData = data.data;
      } else if (data.id) {
        packageData = data;
      } else {
        throw new Error('Package not found');
      }
      
      return {
        ...packageData,
        // Add missing fields that mobile expects
        start_time: packageData.start_time || '09:00',
        destination_lat: packageData.destination_lat || packageData.dropoff_lat,
        destination_lng: packageData.destination_lng || packageData.dropoff_lng,
        status: packageData.status || (packageData.is_active ? 'active' : 'inactive'),
        // Keep original review data from API
        reviews: packageData.reviews || [],
        reviews_count: packageData.reviews_count || packageData.review_count || (packageData.reviews ? packageData.reviews.length : 0),
        average_rating: packageData.average_rating || packageData.avg_rating || 0
      };
    } catch (error) {
      throw error;
    }
  },
};