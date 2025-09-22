import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
  MAP_DATA: '@map_cache_data',
  MAP_VERSION: '@map_cache_version',
  MAP_TIMESTAMP: '@map_cache_timestamp',
  MAP_TILES: '@map_tiles_',
  CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

/**
 * Map Cache Service
 * Handles local storage of map data for offline use and faster loading
 */
class MapCacheService {
  /**
   * Save map data to cache
   * @param {Object} data - Map data to cache
   * @returns {Promise<boolean>} Success status
   */
  async saveMapData(data) {
    try {
      console.log('[MapCache] Saving map data to cache');
      
      // Save the main map data
      await AsyncStorage.setItem(
        CACHE_KEYS.MAP_DATA, 
        JSON.stringify(data)
      );
      
      // Save timestamp
      await AsyncStorage.setItem(
        CACHE_KEYS.MAP_TIMESTAMP,
        new Date().toISOString()
      );
      
      // Calculate and save a simple version hash
      const version = this.generateDataHash(data);
      await AsyncStorage.setItem(
        CACHE_KEYS.MAP_VERSION,
        version
      );
      
      console.log('[MapCache] Map data saved successfully');
      return true;
    } catch (error) {
      console.error('[MapCache] Error saving map data:', error);
      return false;
    }
  }
  
  /**
   * Load cached map data
   * @returns {Promise<Object|null>} Cached map data or null
   */
  async loadCachedMapData() {
    try {
      console.log('[MapCache] Loading cached map data');
      
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.MAP_DATA);
      const timestamp = await AsyncStorage.getItem(CACHE_KEYS.MAP_TIMESTAMP);
      
      if (!cachedData) {
        console.log('[MapCache] No cached data found');
        return null;
      }
      
      // Check if cache is expired
      if (timestamp) {
        const cacheAge = Date.now() - new Date(timestamp).getTime();
        if (cacheAge > CACHE_KEYS.CACHE_EXPIRY) {
          console.log('[MapCache] Cache expired, will refresh');
          // Don't delete, just mark as stale
        }
      }
      
      const data = JSON.parse(cachedData);
      console.log('[MapCache] Loaded cached data:', {
        points: data.points?.length || 0,
        roads: data.roads?.length || 0,
        timestamp: timestamp
      });
      
      return data;
    } catch (error) {
      console.error('[MapCache] Error loading cached data:', error);
      return null;
    }
  }
  
  /**
   * Check if cached data needs update
   * @param {Object} newData - New data to compare
   * @returns {Promise<boolean>} True if update needed
   */
  async needsUpdate(newData) {
    try {
      const cachedVersion = await AsyncStorage.getItem(CACHE_KEYS.MAP_VERSION);
      const newVersion = this.generateDataHash(newData);
      
      console.log('[MapCache] Version check:', {
        cached: cachedVersion,
        new: newVersion,
        match: cachedVersion === newVersion
      });
      
      if (!cachedVersion || cachedVersion !== newVersion) {
        console.log('[MapCache] Update needed - version mismatch');
        return true;
      }
      
      // Check timestamp
      const timestamp = await AsyncStorage.getItem(CACHE_KEYS.MAP_TIMESTAMP);
      if (timestamp) {
        const cacheAge = Date.now() - new Date(timestamp).getTime();
        if (cacheAge > CACHE_KEYS.CACHE_EXPIRY) {
          console.log('[MapCache] Update needed - cache expired');
          return true;
        }
      }
      
      console.log('[MapCache] No update needed');
      return false;
    } catch (error) {
      console.error('[MapCache] Error checking update status:', error);
      return true;
    }
  }
  
  /**
   * Get cache metadata
   * @returns {Promise<Object>} Cache information
   */
  async getCacheInfo() {
    try {
      const timestamp = await AsyncStorage.getItem(CACHE_KEYS.MAP_TIMESTAMP);
      const version = await AsyncStorage.getItem(CACHE_KEYS.MAP_VERSION);
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.MAP_DATA);
      
      let dataSize = 0;
      let itemCounts = {};
      
      if (cachedData) {
        dataSize = cachedData.length;
        const data = JSON.parse(cachedData);
        itemCounts = {
          points: data.points?.length || 0,
          roads: data.roads?.length || 0,
          routes: data.routes?.length || 0,
          zones: data.zones?.length || 0
        };
      }
      
      return {
        timestamp,
        version,
        dataSize,
        itemCounts,
        isExpired: timestamp ? 
          (Date.now() - new Date(timestamp).getTime() > CACHE_KEYS.CACHE_EXPIRY) : 
          true
      };
    } catch (error) {
      console.error('[MapCache] Error getting cache info:', error);
      return null;
    }
  }
  
  /**
   * Clear all cached map data
   * @returns {Promise<boolean>} Success status
   */
  async clearCache() {
    try {
      console.log('[MapCache] Clearing all cached data');
      
      await AsyncStorage.multiRemove([
        CACHE_KEYS.MAP_DATA,
        CACHE_KEYS.MAP_VERSION,
        CACHE_KEYS.MAP_TIMESTAMP
      ]);
      
      // Clear tile cache
      const keys = await AsyncStorage.getAllKeys();
      const tileKeys = keys.filter(key => key.startsWith(CACHE_KEYS.MAP_TILES));
      if (tileKeys.length > 0) {
        await AsyncStorage.multiRemove(tileKeys);
      }
      
      console.log('[MapCache] Cache cleared successfully');
      return true;
    } catch (error) {
      console.error('[MapCache] Error clearing cache:', error);
      return false;
    }
  }
  
  /**
   * Save a map tile for offline use
   * @param {number} z - Zoom level
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @param {string} tileData - Base64 encoded tile image
   */
  async saveTile(z, x, y, tileData) {
    try {
      const key = `${CACHE_KEYS.MAP_TILES}${z}_${x}_${y}`;
      await AsyncStorage.setItem(key, tileData);
      return true;
    } catch (error) {
      console.error('[MapCache] Error saving tile:', error);
      return false;
    }
  }
  
  /**
   * Load a cached map tile
   * @param {number} z - Zoom level
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @returns {Promise<string|null>} Cached tile data or null
   */
  async loadTile(z, x, y) {
    try {
      const key = `${CACHE_KEYS.MAP_TILES}${z}_${x}_${y}`;
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('[MapCache] Error loading tile:', error);
      return null;
    }
  }
  
  /**
   * Prefetch map tiles for an area
   * @param {Object} bounds - Map bounds to prefetch
   * @param {number} minZoom - Minimum zoom level
   * @param {number} maxZoom - Maximum zoom level
   */
  async prefetchArea(bounds, minZoom = 10, maxZoom = 15) {
    console.log('[MapCache] Prefetching tiles for area:', bounds);
    
    // This would need actual tile fetching implementation
    // For now, it's a placeholder for the tile prefetching logic
    
    return {
      success: true,
      message: 'Tile prefetching initiated'
    };
  }
  
  /**
   * Generate a simple hash for data versioning
   * @private
   */
  generateDataHash(data) {
    if (!data) return '';
    
    // Create a simple hash based on data counts and last items
    const counts = {
      points: data.points?.length || 0,
      roads: data.roads?.length || 0,
      routes: data.routes?.length || 0,
      zones: data.zones?.length || 0
    };
    
    // Include last item IDs for change detection
    const lastIds = {
      point: data.points?.[data.points.length - 1]?.id || '',
      road: data.roads?.[data.roads.length - 1]?.id || '',
      route: data.routes?.[data.routes.length - 1]?.id || '',
      zone: data.zones?.[data.zones.length - 1]?.id || ''
    };
    
    // Include image URLs for change detection
    const imageHashes = data.points?.map(point => {
      const urls = point.image_urls || [];
      return `${point.id}:${urls.length}:${urls.join(',')}`;
    }) || [];
    
    return JSON.stringify({ counts, lastIds, imageHashes });
  }
  
  /**
   * Get storage size used by map cache
   * @returns {Promise<Object>} Storage size information
   */
  async getStorageSize() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const mapKeys = keys.filter(key => 
        key.startsWith('@map_cache') || 
        key.startsWith(CACHE_KEYS.MAP_TILES)
      );
      
      let totalSize = 0;
      let tileCount = 0;
      
      for (const key of mapKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
          if (key.startsWith(CACHE_KEYS.MAP_TILES)) {
            tileCount++;
          }
        }
      }
      
      return {
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        tileCount,
        keyCount: mapKeys.length
      };
    } catch (error) {
      console.error('[MapCache] Error calculating storage size:', error);
      return null;
    }
  }
}

// Export singleton instance
export default new MapCacheService();

// Export cache keys for external use
export { CACHE_KEYS };
