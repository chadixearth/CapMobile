import { apiRequest } from '../authService';

export const tourPackageService = {
  async getAllPackages() {
    try {
      const result = await apiRequest('/tourpackage/');
      
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
        reviews: [],
        reviews_count: 0,
        average_rating: 0
      }));
    } catch (error) {
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
        reviews: [],
        reviews_count: 0,
        average_rating: 0
      };
    } catch (error) {
      throw error;
    }
  },
};