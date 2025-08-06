// services/tourPackageService.js
const API_BASE_URL = 'http://127.0.0.1:8000/api/tourpackage/';

export const tourPackageService = {
  // Get all tour packages
  async getAllPackages() {
    try {
      const response = await fetch(`${API_BASE_URL}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch packages');
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      throw error;
    }
  },

  // Get a specific tour package by ID
  async getPackageById(packageId) {
    try {
      const response = await fetch(`${API_BASE_URL}${packageId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Package not found');
      }
    } catch (error) {
      console.error('Error fetching package:', error);
      throw error;
    }
  },
};