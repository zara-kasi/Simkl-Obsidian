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
// Authentication & API Layer Fix

// Fix #1: Authentication Flow & API Request Structure

class SimklAuthManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.baseUrl = 'https://api.simkl.com';
  }

  async authenticateWithPin() {
    if (!this.plugin.settings.clientId) {
      throw new Error('Client ID not configured. Please set it in plugin settings first.');
    }

    try {
      // Step 1: Get PIN
      const pinData = await this.requestPin();
      
      // Step 2: Show PIN modal and handle completion
      return new Promise((resolve, reject) => {
        const modal = new PinAuthModal(this.plugin.app, pinData, async (success, tokenData) => {
          if (success && tokenData) {
            try {
              // Save tokens
              this.plugin.settings.accessToken = tokenData.access_token;
              this.plugin.settings.refreshToken = tokenData.refresh_token;
              await this.plugin.saveSettings();
              
              // Clear cache to force refresh
              this.plugin.cache.clear();
              
              new Notice('Successfully authenticated with Simkl!');
              resolve(true);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error('Authentication cancelled or failed'));
          }
        });
        
        modal.open();
      });
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  async requestPin() {
    const url = `${this.baseUrl}/oauth/pin?client_id=${this.plugin.settings.clientId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'simkl-api-key': this.plugin.settings.clientId
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to request PIN: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  }

  isAuthenticated() {
    return !!this.plugin.settings.accessToken;
  }

  async signOut() {
    this.plugin.settings.accessToken = '';
    this.plugin.settings.refreshToken = '';
    await this.plugin.saveSettings();
    this.plugin.cache.clear();
  }
}

class SimklApiClient {
  constructor(plugin) {
    this.plugin = plugin;
    this.baseUrl = 'https://api.simkl.com';
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'simkl-api-key': this.plugin.settings.clientId,
      ...options.headers
    };

    // Add auth header if available
    if (this.plugin.settings.accessToken) {
      headers['Authorization'] = `Bearer ${this.plugin.settings.accessToken}`;
    }

    const requestOptions = {
      method: options.method || 'GET',
      headers,
      ...options
    };

    if (this.plugin.settings.debugMode) {
      console.log('Simkl API Request:', url, requestOptions);
    }

    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      await this.handleApiError(response);
    }

    const data = await response.json();
    
    if (this.plugin.settings.debugMode) {
      console.log('Simkl API Response:', data);
    }
    
    return data;
  }

  async handleApiError(response) {
    let errorMessage = `HTTP ${response.status}`;
    
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage += ` - ${errorData.error}`;
      }
      if (errorData.message) {
        errorMessage += ` - ${errorData.message}`;
      }
    } catch (e) {
      // Can't parse error response, use status text
      errorMessage += ` - ${response.statusText}`;
    }

    // Handle specific error cases
    switch (response.status) {
      case 401:
        throw new Error('Authentication failed. Please re-authenticate with Simkl.');
      case 403:
        throw new Error('Access forbidden. Check your API permissions.');
      case 404:
        throw new Error('Resource not found. Check your configuration.');
      case 429:
        throw new Error('Rate limit exceeded. Please try again later.');
      case 500:
      case 502:
      case 503:
        throw new Error('Simkl server error. Please try again later.');
      default:
        throw new Error(`Simkl API Error: ${errorMessage}`);
    }
  }

  // Public endpoints (no auth required)
  async searchShows(query, type = 'tv') {
    return this.makeRequest(`/search/${type}?q=${encodeURIComponent(query)}&extended=full`);
  }

  async getShowById(id, type = 'tv') {
    return this.makeRequest(`/${type}/${id}?extended=full`);
  }

  async getUserStats(userId) {
    return this.makeRequest(`/users/${userId}/stats`);
  }

  // Authenticated endpoints
  async getUserWatchlist(type = 'tv', status = 'watching') {
    if (!this.plugin.settings.accessToken) {
      throw new Error('Authentication required for watchlist access');
    }
    
    return this.makeRequest(`/sync/all-items?extended=full`);
  }

  async getUserProfile() {
    if (!this.plugin.settings.accessToken) {
      throw new Error('Authentication required for profile access');
    }
    
    return this.makeRequest('/users/settings');
  }
}
// Improved PIN Authentication Modal

// Fix #2: Improved PIN Authentication Modal

class PinAuthModal extends Modal {
  constructor(app, pinData, onComplete) {
    super(app);
    this.pinData = pinData;
    this.onComplete = onComplete;
    this.isPolling = false;
    this.pollInterval = null;
    this.maxAttempts = 60; // 5 minutes with 5-second intervals
    this.currentAttempt = 0;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('simkl-auth-modal');
    
    // Title
    const titleEl = contentEl.createEl('h2', { text: 'Authenticate with Simkl' });
    titleEl.addClass('simkl-auth-title');
    
    // Instructions
    this.createInstructions(contentEl);
    
    // PIN display
    this.createPinDisplay(contentEl);
    
    // Action buttons
    this.createActionButtons(contentEl);
    
    // Status indicator
    this.createStatusIndicator(contentEl);
    
    // Start polling
    this.startPolling();
  }

  createInstructions(container) {
    const instructionsEl = container.createEl('div', { cls: 'simkl-auth-instructions' });
    
    instructionsEl.createEl('p', { 
      text: 'To authenticate with Simkl, follow these steps:',
      cls: 'simkl-instruction-header'
    });
    
    const stepsList = instructionsEl.createEl('ol', { cls: 'simkl-steps-list' });
    
    const steps = [
      'Copy the PIN code below',
      'Click "Open Simkl" to visit the authentication page',
      'Enter the PIN code on the Simkl website',
      'Return to Obsidian - authentication will complete automatically'
    ];
    
    steps.forEach(step => {
      stepsList.createEl('li', { text: step });
    });
  }

  createPinDisplay(container) {
    const pinContainer = container.createEl('div', { cls: 'simkl-pin-container' });
    
    pinContainer.createEl('p', { 
      text: 'Your PIN code:',
      cls: 'simkl-pin-label'
    });
    
    const pinCodeEl = pinContainer.createEl('div', { 
      text: this.pinData.user_code,
      cls: 'simkl-pin-code'
    });
    
    // Make PIN selectable for easy copying
    pinCodeEl.setAttribute('tabindex', '0');
    pinCodeEl.addEventListener('click', () => {
      this.copyPinToClipboard();
    });
  }

  createActionButtons(container) {
    const buttonContainer = container.createEl('div', { cls: 'simkl-auth-buttons' });
    
    // Open Simkl button
    const openUrlButton = buttonContainer.createEl('button', { 
      text: 'Open Simkl',
      cls: 'mod-cta'
    });
    openUrlButton.addEventListener('click', () => this.openSimklUrl());
    
    // Copy PIN button
    this.copyButton = buttonContainer.createEl('button', { 
      text: 'Copy PIN',
      cls: 'mod-secondary'
    });
    this.copyButton.addEventListener('click', () => this.copyPinToClipboard());
    
    // Cancel button
    const cancelButton = buttonContainer.createEl('button', { 
      text: 'Cancel',
      cls: 'mod-destructive'
    });
    cancelButton.addEventListener('click', () => this.close());
  }

  createStatusIndicator(container) {
    this.statusEl = container.createEl('div', { cls: 'simkl-auth-status' });
    this.updateStatus('Waiting for authentication...', 'waiting');
  }

  openSimklUrl() {
    try {
      // Try electron first (desktop app)
      if (window.require) {
        const { shell } = window.require('electron');
        shell.openExternal(this.pinData.verification_url);
      } else {
        // Fallback for web/mobile
        window.open(this.pinData.verification_url, '_blank');
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
      new Notice('Please manually navigate to: ' + this.pinData.verification_url);
    }
  }

  async copyPinToClipboard() {
    try {
      await navigator.clipboard.writeText(this.pinData.user_code);
      this.copyButton.textContent = 'Copied!';
      this.copyButton.addClass('success');
      
      setTimeout(() => {
        this.copyButton.textContent = 'Copy PIN';
        this.copyButton.removeClass('success');
      }, 2000);
    } catch (error) {
      console.error('Failed to copy PIN:', error);
      new Notice('Failed to copy PIN. Please copy manually: ' + this.pinData.user_code);
    }
  }

  updateStatus(message, type = 'waiting') {
    if (!this.statusEl) return;
    
    this.statusEl.textContent = message;
    this.statusEl.className = `simkl-auth-status ${type}`;
    
    // Add attempt counter for waiting state
    if (type === 'waiting' && this.currentAttempt > 0) {
      const timeLeft = Math.max(0, this.maxAttempts - this.currentAttempt) * 5;
      this.statusEl.textContent = `${message} (${timeLeft}s remaining)`;
    }
  }

  startPolling() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.currentAttempt = 0;
    this.pollForCompletion();
  }

  async pollForCompletion() {
    if (!this.isPolling || this.currentAttempt >= this.maxAttempts) {
      if (this.currentAttempt >= this.maxAttempts) {
        this.updateStatus('Authentication timed out. Please try again.', 'error');
        setTimeout(() => this.close(), 3000);
      }
      return;
    }

    this.currentAttempt++;
    
    try {
      const response = await fetch(
        `https://api.simkl.com/oauth/pin/${this.pinData.user_code}?client_id=${this.app.plugins.plugins['simkl-integration'].settings.clientId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'simkl-api-key': this.app.plugins.plugins['simkl-integration'].settings.clientId
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          this.updateStatus('Authentication successful!', 'success');
          
          // Wait a moment before closing
          setTimeout(() => {
            this.close();
            this.onComplete(true, data);
          }, 1000);
          return;
        }
      } else if (response.status === 400) {
        // Still waiting for user authorization - continue polling
        this.updateStatus('Waiting for authentication...', 'waiting');
      } else {
        // Other error - stop polling
        this.updateStatus('Authentication failed. Please try again.', 'error');
        setTimeout(() => this.close(), 3000);
        return;
      }
    } catch (error) {
      console.error('Polling error:', error);
      
      if (this.currentAttempt >= this.maxAttempts) {
        this.updateStatus('Network error. Please check your connection.', 'error');
        setTimeout(() => this.close(), 3000);
        return;
      }
    }
    
    // Continue polling
    if (this.isPolling) {
      this.pollInterval = setTimeout(() => this.pollForCompletion(), 5000);
    }
  }

  onClose() {
    this.isPolling = false;
    
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.onComplete) {
      this.onComplete(false);
    }
  }
  }

// Robust Configuration Parser
// Fix #3: Robust Configuration Parser

class SimklConfigParser {
  constructor(plugin) {
    this.plugin = plugin;
    this.validMediaTypes = ['tv', 'anime', 'movie'];
    this.validListTypes = ['watching', 'completed', 'plantowatch', 'hold', 'dropped'];
    this.validLayouts = ['card', 'table', 'list'];
    this.validRequestTypes = ['list', 'search', 'stats', 'show'];
  }

  parseCodeBlockConfig(source) {
    const config = this.parseConfigLines(source);
    return this.validateAndNormalizeConfig(config, 'codeblock');
  }

  parseInlineConfig(href) {
    const config = this.parseInlineHref(href);
    return this.validateAndNormalizeConfig(config, 'inline');
  }

  parseConfigLines(source) {
    const config = {};
    const lines = source.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // Allow comments
    
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (!match) continue;
      
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();
      
      if (key && value) {
        config[this.normalizeKey(key)] = this.normalizeValue(value);
      }
    }
    
    return config;
  }

  parseInlineHref(href) {
    // Remove simkl: prefix
    const path = href.replace(/^simkl:/, '');
    const parts = path.split('/').filter(Boolean);
    
    const config = {};
    
    if (parts.length === 0) {
      throw new Error('Invalid Simkl link format');
    }
    
    // Parse different patterns:
    // simkl:stats -> user stats
    // simkl:username -> user's watching TV
    // simkl:username/stats -> user stats
    // simkl:username/tv/watching -> specific list
    // simkl:show/breaking-bad -> specific show
    
    if (parts[0] === 'stats') {
      config.type = 'stats';
      config.userId = this.plugin.settings.userId;
    } else if (parts[0] === 'show' && parts[1]) {
      config.type = 'show';
      config.slug = parts[1];
      config.mediaType = 'tv'; // default
    } else if (parts.length === 1) {
      config.type = 'list';
      config.userId = parts[0];
      config.mediaType = 'tv';
      config.listType = 'watching';
    } else if (parts.length >= 2) {
      config.userId = parts[0];
      
      if (parts[1] === 'stats') {
        config.type = 'stats';
      } else {
        config.type = 'list';
        config.mediaType = parts[1];
        config.listType = parts[2] || 'watching';
      }
    }
    
    return config;
  }

  normalizeKey(key) {
    // Map various key formats to standard names
    const keyMap = {
      'mediatype': 'mediaType',
      'media_type': 'mediaType',
      'media': 'mediaType',
      'listtype': 'listType',
      'list_type': 'listType',
      'list': 'listType',
      'status': 'listType',
      'userid': 'userId',
      'user_id': 'userId',
      'user': 'userId',
      'username': 'userId',
      'id': 'showId',
      'showid': 'showId',
      'show_id': 'showId',
      'tmdb': 'tmdbId',
      'tmdb_id': 'tmdbId',
      'imdb': 'imdbId',
      'imdb_id': 'imdbId',
      'simkl': 'simklId',
      'simkl_id': 'simklId'
    };
    
    return keyMap[key] || key;
  }

  normalizeValue(value) {
    // Remove quotes and normalize boolean values
    const cleaned = value.replace(/^["']|["']$/g, '');
    
    // Handle boolean values
    if (cleaned.toLowerCase() === 'true') return true;
    if (cleaned.toLowerCase() === 'false') return false;
    
    // Handle numeric values
    if (/^\d+$/.test(cleaned)) return parseInt(cleaned, 10);
    
    return cleaned;
  }

  validateAndNormalizeConfig(config, source) {
    const normalized = { ...config };
    
    // Set defaults
    normalized.type = normalized.type || 'list';
    normalized.mediaType = normalized.mediaType || 'tv';
    normalized.listType = normalized.listType || 'watching';
    normalized.layout = normalized.layout || this.plugin.settings.defaultLayout;
    normalized.userId = normalized.userId || this.plugin.settings.userId;
    
    // Validate type
    if (!this.validRequestTypes.includes(normalized.type)) {
      throw new Error(`Invalid type: ${normalized.type}. Must be one of: ${this.validRequestTypes.join(', ')}`);
    }
    
    // Validate media type
    if (!this.validMediaTypes.includes(normalized.mediaType)) {
      throw new Error(`Invalid mediaType: ${normalized.mediaType}. Must be one of: ${this.validMediaTypes.join(', ')}`);
    }
    
    // Validate list type
    if (!this.validListTypes.includes(normalized.listType)) {
      throw new Error(`Invalid listType: ${normalized.listType}. Must be one of: ${this.validListTypes.join(', ')}`);
    }
    
    // Validate layout
    if (!this.validLayouts.includes(normalized.layout)) {
      throw new Error(`Invalid layout: ${normalized.layout}. Must be one of: ${this.validLayouts.join(', ')}`);
    }
    
    // Type-specific validation
    if (normalized.type === 'list' && !normalized.userId) {
      throw new Error('userId is required for list type. Set it in plugin settings or specify in config.');
    }
    
    if (normalized.type === 'show' && !normalized.slug && !normalized.showId) {
      throw new Error('slug or showId is required for show type.');
    }
    
    if (normalized.type === 'search' && !normalized.query) {
      throw new Error('query is required for search type.');
    }
    
    // API configuration validation
    if (!this.plugin.settings.clientId) {
      throw new Error('Client ID not configured. Please set it in plugin settings.');
    }
    
    return normalized;
  }

  generateCacheKey(config) {
    // Create a stable cache key
    const keyParts = [
      config.type,
      config.mediaType,
      config.listType,
      config.userId,
      config.slug,
      config.showId,
      config.query
    ].filter(Boolean);
    
    return keyParts.join(':');
  }
}

// Simkl Authentication Manager

// Simkl Authentication Manager
class SimklAuthManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.authModal = null;
    this.pollInterval = null;
    this.maxPollAttempts = 60; // 5 minutes at 5s intervals
    this.currentPollAttempt = 0;
  }

  async authenticate() {
    try {
      // Step 1: Request PIN from Simkl
      const pinData = await this.requestDevicePin();
      
      // Step 2: Show PIN modal to user
      await this.showPinModal(pinData);
      
      return true;
    } catch (error) {
      console.error('[Simkl Auth] Authentication failed:', error);
      this.plugin.showNotice(`Authentication failed: ${error.message}`);
      return false;
    }
  }

  async requestDevicePin() {
    const response = await fetch(`${SIMKL_API.BASE_URL}/oauth/pin`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'simkl-api-key': this.plugin.settings.clientId
      }
    });

    if (!response.ok) {
      const error = await this.parseApiError(response);
      throw new Error(`Failed to request PIN: ${error}`);
    }

    return await response.json();
  }

  async showPinModal(pinData) {
    return new Promise((resolve, reject) => {
      this.authModal = new SimklPinModal(
        this.plugin.app, 
        pinData, 
        (success, tokenData) => {
          if (success && tokenData) {
            this.handleAuthSuccess(tokenData);
            resolve(true);
          } else {
            reject(new Error('Authentication cancelled'));
          }
        }
      );
      this.authModal.open();
    });
  }

  async handleAuthSuccess(tokenData) {
    // Save token to settings
    this.plugin.settings.accessToken = tokenData.access_token;
    this.plugin.settings.refreshToken = tokenData.refresh_token;
    this.plugin.settings.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
    
    await this.plugin.saveSettings();
    
    // Clear cache to force refresh with new token
    this.plugin.cache.clear();
    
    this.plugin.showNotice('Successfully authenticated with Simkl!');
  }

  async parseApiError(response) {
    try {
      const errorData = await response.json();
      return errorData.error || errorData.message || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  isAuthenticated() {
    return !!(this.plugin.settings.accessToken && 
              this.plugin.settings.tokenExpiry > Date.now());
  }

  async signOut() {
    this.plugin.settings.accessToken = '';
    this.plugin.settings.refreshToken = '';
    this.plugin.settings.tokenExpiry = 0;
    
    await this.plugin.saveSettings();
    this.plugin.cache.clear();
    
    this.plugin.showNotice('Signed out from Simkl');
  }

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'simkl-api-key': this.plugin.settings.clientId
    };

    if (this.isAuthenticated()) {
      headers['Authorization'] = `Bearer ${this.plugin.settings.accessToken}`;
    }

    return headers;
  }
}
// Simkl PIN Authentication Modal
class SimklPinModal extends Modal {
  constructor(app, pinData, onComplete) {
    super(app);
    this.pinData = pinData;
    this.onComplete = onComplete;
    this.isPolling = false;
    this.pollTimeout = null;
    this.pollAttempts = 0;
    this.maxPollAttempts = 60; // 5 minutes
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('simkl-pin-modal');
    
    this.createHeader();
    this.createInstructions();
    this.createPinDisplay();
    this.createActionButtons();
    this.createStatusIndicator();
    
    this.startPolling();
  }

  createHeader() {
    const header = this.contentEl.createEl('div', { cls: 'simkl-modal-header' });
    header.createEl('h2', { text: 'Authenticate with Simkl' });
    header.createEl('div', { cls: 'simkl-logo' }); // For future logo
  }

  createInstructions() {
    const instructions = this.contentEl.createEl('div', { cls: 'simkl-instructions' });
    
    instructions.createEl('p', { 
      text: 'Follow these steps to connect your Simkl account:' 
    });
    
    const steps = instructions.createEl('ol', { cls: 'simkl-steps' });
    steps.createEl('li', { text: 'Copy the PIN code below' });
    steps.createEl('li', { text: 'Click "Open Simkl" to visit the authentication page' });
    steps.createEl('li', { text: 'Enter the PIN code on the Simkl website' });
    steps.createEl('li', { text: 'Return here - authentication will complete automatically' });
  }

  createPinDisplay() {
    const pinContainer = this.contentEl.createEl('div', { cls: 'simkl-pin-container' });
    
    pinContainer.createEl('div', { 
      text: 'Your PIN Code:',
      cls: 'simkl-pin-label' 
    });
    
    this.pinDisplay = pinContainer.createEl('div', { 
      text: this.pinData.user_code,
      cls: 'simkl-pin-code'
    });
    
    // Add click-to-copy functionality
    this.pinDisplay.addEventListener('click', () => this.copyPin());
    this.pinDisplay.setAttribute('title', 'Click to copy');
  }

  createActionButtons() {
    const buttonContainer = this.contentEl.createEl('div', { cls: 'simkl-button-container' });
    
    // Open Simkl button
    this.openButton = buttonContainer.createEl('button', { 
      text: 'Open Simkl',
      cls: 'mod-cta'
    });
    this.openButton.addEventListener('click', () => this.openSimklAuth());
    
    // Copy PIN button
    this.copyButton = buttonContainer.createEl('button', { 
      text: 'Copy PIN',
      cls: 'mod-secondary'
    });
    this.copyButton.addEventListener('click', () => this.copyPin());
    
    // Cancel button
    this.cancelButton = buttonContainer.createEl('button', { 
      text: 'Cancel',
      cls: 'mod-secondary'
    });
    this.cancelButton.addEventListener('click', () => this.close());
  }

  createStatusIndicator() {
    this.statusContainer = this.contentEl.createEl('div', { cls: 'simkl-status-container' });
    
    this.statusIndicator = this.statusContainer.createEl('div', { cls: 'simkl-status-indicator' });
    this.statusText = this.statusContainer.createEl('div', { 
      text: 'Waiting for authentication...',
      cls: 'simkl-status-text'
    });
  }

  async openSimklAuth() {
    try {
      // Try electron shell first (desktop)
      if (window.require) {
        const { shell } = window.require('electron');
        await shell.openExternal(this.pinData.verification_url);
      } else {
        // Fallback for web/mobile
        window.open(this.pinData.verification_url, '_blank');
      }
      
      this.updateStatus('opened', 'Browser opened - enter your PIN on Simkl');
    } catch (error) {
      console.error('Failed to open URL:', error);
      this.updateStatus('error', 'Failed to open browser. Please visit: ' + this.pinData.verification_url);
    }
  }

  async copyPin() {
    try {
      await navigator.clipboard.writeText(this.pinData.user_code);
      
      const originalText = this.copyButton.textContent;
      this.copyButton.textContent = 'Copied!';
      this.copyButton.addClass('mod-success');
      
      setTimeout(() => {
        this.copyButton.textContent = originalText;
        this.copyButton.removeClass('mod-success');
      }, 2000);
      
    } catch (error) {
      console.error('Failed to copy PIN:', error);
      this.updateStatus('error', 'Failed to copy PIN. Please copy manually: ' + this.pinData.user_code);
    }
  }

  startPolling() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.pollAttempts = 0;
    this.pollForToken();
  }

  async pollForToken() {
    if (!this.isPolling || this.pollAttempts >= this.maxPollAttempts) {
      this.updateStatus('timeout', 'Authentication timed out. Please try again.');
      return;
    }

    this.pollAttempts++;
    
    try {
      const response = await fetch(
        `${SIMKL_API.BASE_URL}/oauth/pin/${this.pinData.user_code}?client_id=${this.pinData.client_id}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (response.ok) {
        const tokenData = await response.json();
        if (tokenData.access_token) {
          this.handleAuthSuccess(tokenData);
          return;
        }
      }
      
      // Continue polling
      this.pollTimeout = setTimeout(() => this.pollForToken(), 5000);
      
    } catch (error) {
      console.error('Polling error:', error);
      
      // Retry with exponential backoff
      const delay = Math.min(5000 * Math.pow(1.5, this.pollAttempts), 30000);
      this.pollTimeout = setTimeout(() => this.pollForToken(), delay);
    }
  }

  handleAuthSuccess(tokenData) {
    this.updateStatus('success', 'Authentication successful!');
    
    // Disable buttons
    this.openButton.disabled = true;
    this.copyButton.disabled = true;
    this.cancelButton.textContent = 'Close';
    
    // Auto-close after delay
    setTimeout(() => {
      this.close();
      this.onComplete(true, tokenData);
    }, 1500);
  }

  updateStatus(type, message) {
    this.statusText.textContent = message;
    this.statusContainer.removeClass('status-waiting', 'status-opened', 'status-success', 'status-error', 'status-timeout');
    this.statusContainer.addClass(`status-${type}`);
  }

  onClose() {
    this.isPolling = false;
    
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    
    // Call completion callback if not already called
    if (this.onComplete && !this.statusContainer.hasClass('status-success')) {
      this.onComplete(false);
    }
  }
      }
// Simkl API Client
class SimklApiClient {
  constructor(plugin) {
    this.plugin = plugin;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitDelay = 1000; // 1 second between requests
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const { endpoint, options, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await this.executeRequest(endpoint, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      // Rate limiting
      if (this.requestQueue.length > 0) {
        await this.delay(this.rateLimitDelay);
      }
    }
    
    this.isProcessingQueue = false;
  }

  async executeRequest(endpoint, options = {}) {
    const { 
      method = 'GET', 
      params = {},
      requiresAuth = false,
      retries = 3,
      timeout = 15000 
    } = options;

    // Build URL with params
    const url = this.buildUrl(endpoint, params);
    
    // Get headers
    const headers = this.plugin.authManager.getAuthHeaders();
    
    // Check authentication requirement
    if (requiresAuth && !this.plugin.authManager.isAuthenticated()) {
      throw new Error('Authentication required for this endpoint');
    }

    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method,
          headers,
          signal: AbortSignal.timeout(timeout)
        });
        
        if (response.ok) {
          return await response.json();
        }
        
        // Handle specific HTTP errors
        await this.handleHttpError(response, attempt, retries);
        
      } catch (error) {
        lastError = error;
        
        if (this.shouldRetry(error, attempt, retries)) {
          await this.delay(1000 * attempt); // Exponential backoff
          continue;
        }
        
        throw this.processError(error);
      }
    }
    
    throw lastError;
  }

  buildUrl(endpoint, params = {}) {
    const url = new URL(endpoint, SIMKL_API.BASE_URL);
    
    // Add client_id to all requests
    params.client_id = this.plugin.settings.clientId;
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    return url.toString();
  }

  async fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async handleHttpError(response, attempt, maxRetries) {
    const status = response.status;
    
    switch (status) {
      case 401:
        // Clear invalid token
        await this.plugin.authManager.signOut();
        throw new Error('Authentication expired. Please sign in again.');
        
      case 403:
        throw new Error('Access forbidden. Check your API permissions.');
        
      case 404:
        throw new Error('Content not found or user/list is private.');
        
      case 412:
        throw new Error('Invalid API key. Please check your Client ID.');
        
      case 429:
        // Rate limited - wait longer
        if (attempt < maxRetries) {
          await this.delay(5000 * attempt);
          return; // Retry
        }
        throw new Error('Rate limit exceeded. Please try again later.');
        
      case 500:
      case 502:
      case 503:
        // Server errors - retry
        if (attempt < maxRetries) {
          await this.delay(2000 * attempt);
          return; // Retry
        }
        throw new Error('Simkl server error. Please try again later.');
        
      default:
        const errorMessage = await this.parseErrorResponse(response);
        throw new Error(`API Error (${status}): ${errorMessage}`);
    }
  }

  async parseErrorResponse(response) {
    try {
      const errorData = await response.json();
      return errorData.error || errorData.message || 'Unknown error';
    } catch {
      return 'Unable to parse error response';
    }
  }

  shouldRetry(error, attempt, maxRetries) {
    if (attempt >= maxRetries) return false;
    
    // Retry on network errors
    if (error.name === 'AbortError' || 
        error.name === 'TypeError' ||
        error.message.includes('fetch') ||
        error.message.includes('network')) {
      return true;
    }
    
    // Don't retry on client errors
    if (error.message.includes('Authentication') ||
        error.message.includes('forbidden') ||
        error.message.includes('Invalid API key')) {
      return false;
    }
    
    return true;
  }

  processError(error) {
    if (error.name === 'AbortError') {
      return new Error('Request timed out. Please check your connection.');
    }
    
    if (error.message.includes('fetch')) {
      return new Error('Network error. Please check your internet connection.');
    }
    
    return error;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  async getUserStats(userId) {
    return this.makeRequest(`/users/${userId}/stats`);
  }

  async getUserList(userId, mediaType, listType) {
    return this.makeRequest(`/users/${userId}/list/${mediaType}/${listType}`, {
      params: { extended: 'full' }
    });
  }

  async getUserSyncData(mediaType = 'all') {
    return this.makeRequest('/sync/all-items', {
      params: { 
        extended: 'full',
        type: mediaType 
      },
      requiresAuth: true
    });
  }

  async searchMedia(query, mediaType = 'show') {
    return this.makeRequest(`/search/${mediaType}`, {
      params: { 
        q: query,
        extended: 'full' 
      }
    });
  }

  async getMediaDetails(mediaType, id) {
    return this.makeRequest(`/${mediaType}/${id}`, {
      params: { extended: 'full' }
    });
  }
}


// prompt Authentication Fix: Separates auth logic into SimklAuthManager and API calls into SimklApiClient with proper error handling
Modal Fix: Robust PIN authentication with better UX, timeout handling, and status updates
Config Parser Fix: Handles various input formats, validates properly, and provides clear error messages

Next steps to implement:

Replace the existing authentication code with the new SimklAuthManager
Update the PIN modal with the improved version
Replace the config parsing with the new robust parser    Here is the 1st prompt Use on the previous chat and It couldn't complete the ans because you rate limit. Here is how much he did it before ( I want you to continue from where you left before) : //Refactored Simkl Plugin - Main Entry Point Code ,  Load settings, // Settings tab ,// Status bar , // Simkl Plugin Constants, / API Configuration , };
// Simkl API Layer , // Simkl Cache System  ,  You did this in previous step.  Previous prompt : You are an expert Obsidian plugin developer and API integrator. You are helping me debug and fix a broken plugin I’ve written called **Simkl-Obsidian**.

---

### 🔧 What I'm Trying to Build

I’m building an Obsidian plugin that allows users to embed **Simkl watchlist data** (TV shows, movies, anime) into Obsidian using **code blocks** or **inline links**, similar to the popular AniList plugin.

Example usage in markdown:

```
```simkl
MediaType: tv
Slug: breaking-bad
```
```

This should render a styled card with metadata about that TV show (title, poster, rating, episodes, etc.).

---

### 🧠 Current Plugin Features (Broken)

- Code-block processor for `simkl` blocks
- Tries to use Simkl’s API to fetch show/list data
- Tries to support watchlists, table view, card view
- Has plugin settings for API key and user ID

---

### ❌ Why It Fails

Here is the full list of **all known problems and flaws** in the plugin's current version. Please go through them category by category and propose precise, modular fixes.

#### 🔒 Authentication & API Usage
- AUTH-01: Uses only simkl-api-key but tries to access private user endpoints
- AUTH-02: No OAuth2 or token handling
- AUTH-03: No way for user to paste their Bearer token manually
- AUTH-04: Wrong assumption that username/userId is sufficient for access
- AUTH-05: Doesn’t separate public endpoints vs private

#### 🧠 API Logic
- API-01: Calls `/sync/all-items` without token
- API-02: Doesn’t handle API errors or empty responses
- API-03: Crashes if fields like `poster`, `rating` are missing
- API-04: Poor cache key design (JSON.stringify config)
- API-05: No cache invalidation or TTL
- API-06: No loading state in UI

#### 🧩 Architecture Problems
- ARCH-01: Uses CommonJS (`require`) in an ES module environment
- ARCH-02: No separation of concerns; all logic in one file
- ARCH-03: Public vs Authenticated logic not modularized
- ARCH-04: Raw HTML string rendering
- ARCH-05: No fallback if fetch fails

#### 🎯 Obsidian Integration Bugs
- OBS-01: Misuses `registerMarkdownPostProcessor`
- OBS-02: Replaces `` tags badly in inline link rendering
- OBS-03: No dynamic re-render on settings change
- OBS-04: Input parsing is case/space sensitive
- OBS-05: No live-preview vs reading-mode distinction

#### 💣 Error Handling
- ERR-01: Error strings use raw `\n` which break layout
- ERR-02: No visible errors, console logs, or debug output
- ERR-03: Doesn’t warn if config is incomplete
- ERR-04: No message if list is empty

#### 🧪 Code Quality
- CODE-01: No types or comments
- CODE-02: Vague variable names
- CODE-03: Large duplicated HTML strings
- CODE-04: Inline caching and config logic
- CODE-05: No tests

#### 🧾 Documentation Problems
- DOC-01: README is over 1,700 lines of repetition
- DOC-02: No instructions for getting API token
- DOC-03: Too many similar usage examples
- DOC-04: Lacks comparison to AniList plugin
- DOC-05: No navigation or TOC

#### 🧑🎨 UX Problems
- UX-01: No fallback if config is partial
- UX-02: No "Loading..." placeholder
- UX-03: Poster URL not validated
- UX-04: No toggle support for genres/seasons
- UX-05: No fallback for missing data

#### 🧩 Missing Features
- FEAT-01: No support for movie/anime types
- FEAT-02: No episode/season embeds
- FEAT-03: No watch status tag
- FEAT-04: No refresh button or cache clear
- FEAT-05: No command palette options

---

### ✅ What I Want You To Do

1. Understand the goal: Obsidian plugin to embed Simkl data like AniList does.
2. Read each category of flaws and start solving them **systematically**.
3. Give me **refactored code**, with **ES module support**, improved **auth**, **error handling**, **input parsing**, and **robust architecture**.
4. Break large steps into small modular functions (e.g. `fetchSimklData(config)`, `renderCardView(data)`).
5. Help me replace `/sync/all-items` with either:
   - public API (like `/search/tv?q=`)
   - or authenticated user token (with pasted Bearer token option)
6. Ensure it works without OAuth, but structure it so OAuth can be added later.

---

### 📂 GitHub Repo (optional)
I can send you the full code if needed, or you can give me a scaffold that I can copy into the plugin manually.

Ready to begin? don't try to write the whole code but rather than fix something with step by step and don't exceed the let's say 100 line of course fix give the fix and write the next fix

