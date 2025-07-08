//Refactored Simkl Plugin - Main Entry Point Code 

import { Plugin, Notice } from 'obsidian';
import { SimklSettingTab } from './settings';
import { SimklProcessor } from './processor';
import { SimklAuth } from './auth';
import { SimklCache } from './cache';
import { SimklApi } from './api';
import { DEFAULT_SETTINGS } from './constants';

export default class SimklPlugin extends Plugin {
  constructor(app, manifest) {
    super(app, manifest);
    this.cache = new SimklCache();
    this.api = new SimklApi();
    this.auth = new SimklAuth(this);
    this.processor = new SimklProcessor(this);
  }

  async onload() {
    console.log('Loading Simkl Plugin');
    
    // Load settings
    await this.loadSettings();
    
    // Initialize components with settings
    this.api.init(this.settings);
    this.auth.init(this.settings);
    this.processor.init(this.settings);
    
    // Register processors
    this.registerMarkdownCodeBlockProcessor('simkl', this.processor.processCodeBlock.bind(this.processor));
    this.registerMarkdownPostProcessor(this.processor.processInlineLinks.bind(this.processor));
    
    // Add commands
    this.addCommand({
      id: 'simkl-authenticate',
      name: 'Authenticate with Simkl',
      callback: () => this.auth.authenticate()
    });
    
    this.addCommand({
      id: 'simkl-clear-cache',
      name: 'Clear Simkl Cache',
      callback: () => {
        this.cache.clear();
        new Notice('Simkl cache cleared');
      }
    });
    
    this.addCommand({
      id: 'simkl-test-connection',
      name: 'Test Simkl Connection',
      callback: () => this.testConnection()
    });
    
    // Settings tab
    this.addSettingTab(new SimklSettingTab(this.app, this));
    
    // Status bar
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar('Ready');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Notify components of settings change
    this.api.updateSettings(this.settings);
    this.auth.updateSettings(this.settings);
    this.processor.updateSettings(this.settings);
  }

  async testConnection() {
    try {
      this.updateStatusBar('Testing...');
      
      // Test with a simple search query
      const result = await this.api.searchMedia('tv', 'breaking bad');
      
      if (result && result.length > 0) {
        new Notice('✅ Connection successful!');
        this.updateStatusBar('Connected');
      } else {
        new Notice('⚠️ Connected but no results found');
        this.updateStatusBar('Ready');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      new Notice(`❌ Connection failed: ${error.message}`);
      this.updateStatusBar('Error');
    }
  }

  updateStatusBar(status) {
    if (this.statusBarItem) {
      this.statusBarItem.setText(`Simkl: ${status}`);
    }
  }

  getApi() {
    return this.api;
  }

  getCache() {
    return this.cache;
  }

  getAuth() {
    return this.auth;
  }

  onunload() {
    console.log('Unloading Simkl Plugin');
    this.cache.clear();
  }
}
// Simkl Plugin Constants

// API Configuration
export const SIMKL_API_BASE = 'https://api.simkl.com';

export const SIMKL_ENDPOINTS = {
  SEARCH: (type, query) => `/search/${type}?q=${encodeURIComponent(query)}`,
  ITEM_DETAILS: (type, id) => `/${type}/${id}`,
  USER_STATS: (userId) => `/users/${userId}/stats`,
  USER_LIST: (userId, mediaType, listType) => `/users/${userId}/list/${mediaType}/${listType}`,
  SYNC_ALL: '/sync/all-items',
  OAUTH_PIN: '/oauth/pin',
  OAUTH_TOKEN: (userCode) => `/oauth/pin/${userCode}`
};

export const SIMKL_MEDIA_TYPES = {
  TV: 'tv',
  MOVIE: 'movie',
  ANIME: 'anime'
};

export const SIMKL_LIST_TYPES = {
  WATCHING: 'watching',
  COMPLETED: 'completed',
  PLAN_TO_WATCH: 'plantowatch',
  HOLD: 'hold',
  DROPPED: 'dropped'
};

export const SIMKL_LAYOUTS = {
  CARD: 'card',
  TABLE: 'table',
  COMPACT: 'compact'
};

// Default plugin settings
export const DEFAULT_SETTINGS = {
  // API Configuration
  clientId: '',
  accessToken: '',
  userId: '',
  
  // Display Settings
  defaultLayout: SIMKL_LAYOUTS.CARD,
  showCoverImages: true,
  showRatings: true,
  showProgress: true,
  showGenres: true,
  showYear: true,
  showStatus: true,
  maxItems: 50,
  
  // Advanced Settings
  debugMode: false,
  requestTimeout: 15000,
  maxRetries: 3,
  cacheTimeout: 300000, // 5 minutes
  
  // UI Settings
  cardWidth: 200,
  imageHeight: 300,
  enableAnimations: true
};

// Configuration validation
export const REQUIRED_FIELDS = {
  PUBLIC: ['clientId'],
  AUTHENTICATED: ['clientId', 'accessToken']
};

// Error messages
export const ERROR_MESSAGES = {
  NO_CLIENT_ID: 'Client ID is required. Please configure it in plugin settings.',
  NO_ACCESS_TOKEN: 'Access token is required for this operation. Please authenticate first.',
  NO_USER_ID: 'User ID is required for this operation.',
  INVALID_MEDIA_TYPE: 'Invalid media type. Must be: tv, movie, or anime.',
  INVALID_LIST_TYPE: 'Invalid list type. Must be: watching, completed, plantowatch, hold, or dropped.',
  INVALID_LAYOUT: 'Invalid layout. Must be: card, table, or compact.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  API_ERROR: 'API error occurred. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  RATE_LIMITED: 'Rate limited. Please wait before making more requests.',
  NOT_FOUND: 'Requested item not found.',
  UNAUTHORIZED: 'Unauthorized. Please check your credentials.',
  FORBIDDEN: 'Access forbidden. Please check your permissions.'
};

// CSS Classes
export const CSS_CLASSES = {
  CONTAINER: 'simkl-container',
  CARD: 'simkl-card',
  CARD_GRID: 'simkl-card-grid',
  TABLE: 'simkl-table',
  COMPACT: 'simkl-compact',
  LOADING: 'simkl-loading',
  ERROR: 'simkl-error',
  EMPTY: 'simkl-empty',
  COVER: 'simkl-cover',
  TITLE: 'simkl-title',
  DETAILS: 'simkl-details',
  GENRES: 'simkl-genres',
  GENRE_TAG: 'simkl-genre-tag',
  PROGRESS: 'simkl-progress',
  RATING: 'simkl-rating',
  STATUS: 'simkl-status',
  ATTRIBUTION: 'simkl-attribution'
};

// Input parsing patterns
export const PARSE_PATTERNS = {
  INLINE_LINK: /simkl:([^\/\s]+)(?:\/([^\/\s]+))?(?:\/([^\/\s]+))?/,
  CONFIG_LINE: /^([^:]+):\s*(.+)$/
};

// Cache keys
export const CACHE_KEYS = {
  SEARCH: (type, query) => `search:${type}:${query}`,
  ITEM: (type, id) => `item:${type}:${id}`,
  USER_LIST: (userId, mediaType, listType) => `list:${userId}:${mediaType}:${listType}`,
  USER_STATS: (userId) => `stats:${userId}`,
  SYNC_ALL: 'sync:all'
};
// Simkl API Layer
import { 
  SIMKL_API_BASE, 
  SIMKL_ENDPOINTS, 
  ERROR_MESSAGES,
  SIMKL_MEDIA_TYPES,
  SIMKL_LIST_TYPES 
} from './constants';

export class SimklApi {
  constructor() {
    this.settings = null;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitDelay = 1000; // 1 second between requests
  }

  init(settings) {
    this.settings = settings;
  }

  updateSettings(settings) {
    this.settings = settings;
  }

  /**
   * Search for media items (public endpoint)
   */
  async searchMedia(type, query, options = {}) {
    if (!this.validateMediaType(type)) {
      throw new Error(ERROR_MESSAGES.INVALID_MEDIA_TYPE);
    }

    const endpoint = SIMKL_ENDPOINTS.SEARCH(type, query);
    const params = new URLSearchParams({
      extended: 'full',
      ...options
    });

    return this.makeRequest(`${endpoint}&${params.toString()}`, false);
  }

  /**
   * Get detailed item information (public endpoint)
   */
  async getItemDetails(type, id, options = {}) {
    if (!this.validateMediaType(type)) {
      throw new Error(ERROR_MESSAGES.INVALID_MEDIA_TYPE);
    }

    const endpoint = SIMKL_ENDPOINTS.ITEM_DETAILS(type, id);
    const params = new URLSearchParams({
      extended: 'full',
      ...options
    });

    return this.makeRequest(`${endpoint}?${params.toString()}`, false);
  }

  /**
   * Get user statistics (public endpoint)
   */
  async getUserStats(userId) {
    if (!userId) {
      throw new Error(ERROR_MESSAGES.NO_USER_ID);
    }

    const endpoint = SIMKL_ENDPOINTS.USER_STATS(userId);
    return this.makeRequest(endpoint, false);
  }

  /**
   * Get user list (public endpoint)
   */
  async getUserList(userId, mediaType, listType, options = {}) {
    if (!userId) {
      throw new Error(ERROR_MESSAGES.NO_USER_ID);
    }

    if (!this.validateMediaType(mediaType)) {
      throw new Error(ERROR_MESSAGES.INVALID_MEDIA_TYPE);
    }

    if (!this.validateListType(listType)) {
      throw new Error(ERROR_MESSAGES.INVALID_LIST_TYPE);
    }

    const endpoint = SIMKL_ENDPOINTS.USER_LIST(userId, mediaType, listType);
    const params = new URLSearchParams({
      extended: 'full',
      ...options
    });

    return this.makeRequest(`${endpoint}?${params.toString()}`, false);
  }

  /**
   * Get all sync items (authenticated endpoint)
   */
  async getAllSyncItems(options = {}) {
    const endpoint = SIMKL_ENDPOINTS.SYNC_ALL;
    const params = new URLSearchParams({
      extended: 'full',
      ...options
    });

    return this.makeRequest(`${endpoint}?${params.toString()}`, true);
  }

  /**
   * Request OAuth PIN (authenticated endpoint)
   */
  async requestOAuthPin() {
    const endpoint = SIMKL_ENDPOINTS.OAUTH_PIN;
    return this.makeRequest(endpoint, false, 'GET');
  }

  /**
   * Poll for OAuth token (authenticated endpoint)
   */
  async pollOAuthToken(userCode) {
    const endpoint = SIMKL_ENDPOINTS.OAUTH_TOKEN(userCode);
    return this.makeRequest(endpoint, false, 'GET');
  }

  /**
   * Make HTTP request with proper error handling and retries
   */
  async makeRequest(endpoint, requiresAuth = false, method = 'GET', body = null) {
    if (!this.settings?.clientId) {
      throw new Error(ERROR_MESSAGES.NO_CLIENT_ID);
    }

    if (requiresAuth && !this.settings?.accessToken) {
      throw new Error(ERROR_MESSAGES.NO_ACCESS_TOKEN);
    }

    // Queue requests to avoid rate limiting
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        endpoint,
        requiresAuth,
        method,
        body,
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  /**
   * Process request queue with rate limiting
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        const result = await this.executeRequest(request);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }

      // Rate limiting delay
      if (this.requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute individual HTTP request
   */
  async executeRequest({ endpoint, requiresAuth, method, body }) {
    const url = `${SIMKL_API_BASE}${endpoint}`;
    const headers = this.buildHeaders(requiresAuth);

    const config = {
      method,
      headers,
      signal: AbortSignal.timeout(this.settings.requestTimeout)
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    let lastError;
    
    // Retry mechanism
    for (let attempt = 1; attempt <= this.settings.maxRetries; attempt++) {
      try {
        if (this.settings.debugMode) {
          console.log(`Simkl API Request (attempt ${attempt}):`, { url, headers, method });
        }

        const response = await fetch(url, config);
        
        if (response.ok) {
          const data = await response.json();
          
          if (this.settings.debugMode) {
            console.log('Simkl API Response:', data);
          }
          
          return data;
        }

        // Handle specific error codes
        const errorMessage = await this.handleErrorResponse(response);
        
        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(errorMessage);
        }

        lastError = new Error(errorMessage);
        
        // Exponential backoff for retries
        if (attempt < this.settings.maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
          );
        }

      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          throw new Error(ERROR_MESSAGES.TIMEOUT_ERROR);
        }

        if (error.message.includes('Failed to fetch') || 
            error.message.includes('NetworkError')) {
          if (attempt < this.settings.maxRetries) {
            await new Promise(resolve => 
              setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
            );
            continue;
          }
          throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
        }

        // Don't retry for other errors
        throw error;
      }
    }

    throw lastError || new Error(ERROR_MESSAGES.API_ERROR);
  }

  /**
   * Build request headers
   */
  buildHeaders(requiresAuth) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'simkl-api-key': this.settings.clientId
    };

    if (requiresAuth && this.settings.accessToken) {
      headers['Authorization'] = `Bearer ${this.settings.accessToken}`;
    }

    return headers;
  }

  /**
   * Handle error responses
   */
  async handleErrorResponse(response) {
    const status = response.status;
    
    try {
      const errorData = await response.json();
      const errorMessage = errorData.error || errorData.message || '';
      
      switch (status) {
        case 401:
          return ERROR_MESSAGES.UNAUTHORIZED;
        case 403:
          return ERROR_MESSAGES.FORBIDDEN;
        case 404:
          return ERROR_MESSAGES.NOT_FOUND;
        case 412:
          return 'Invalid Client ID. Please check your API key.';
        case 429:
          return ERROR_MESSAGES.RATE_LIMITED;
        default:
          return errorMessage || `HTTP ${status}: ${ERROR_MESSAGES.API_ERROR}`;
      }
    } catch (e) {
      return `HTTP ${status}: ${ERROR_MESSAGES.API_ERROR}`;
    }
  }

  /**
   * Validate media type
   */
  validateMediaType(type) {
    return Object.values(SIMKL_MEDIA_TYPES).includes(type);
  }

  /**
   * Validate list type
   */
  validateListType(type) {
    return Object.values(SIMKL_LIST_TYPES).includes(type);
  }

  /**
   * Get Simkl URL for an item
   */
  getSimklUrl(mediaType, id) {
    if (!id) return '#';
    return `https://simkl.com/${mediaType}/${id}`;
  }
}
// Simkl Cache System 

export class SimklCache {
  constructor() {
    this.cache = new Map();
    this.defaultTimeout = 300000; // 5 minutes
  }

  /**
   * Get item from cache
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Set item in cache
   */
  set(key, data, timeout = this.defaultTimeout) {
    const item = {
      data,
      expiry: Date.now() + timeout,
      timestamp: Date.now()
    };

    this.cache.set(key, item);
  }

  /**
   * Check if item exists in cache and is valid
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Remove item from cache
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }

  /**
   * Clean expired items
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validItems = 0;
    let expiredItems = 0;
    let totalSize = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        expiredItems++;
      } else {
        validItems++;
      }
      totalSize += this.estimateSize(item.data);
    }

    return {
      totalItems: this.cache.size,
      validItems,
      expiredItems,
      estimatedSize: totalSize
    };
  }

  /**
   * Estimate size of cached data (rough calculation)
   */
  estimateSize(data) {
    try {
      return JSON.stringify(data).length * 2; // rough estimate (2 bytes per char)
    } catch (e) {
      return 0;
    }
  }

  /**
   * Set cache timeout
   */
  setTimeout(timeout) {
    this.defaultTimeout = timeout;
  }
}

