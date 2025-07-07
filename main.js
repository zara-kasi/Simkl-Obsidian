const { Plugin, PluginSettingTab, Setting, Notice, Modal } = require('obsidian');

  class PinAuthModal extends Modal {
  constructor(app, pinData, onComplete) {
    super(app);
    this.pinData = pinData;
    this.onComplete = onComplete;
    this.isPolling = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    // Title
    contentEl.createEl('h2', { text: 'Authenticate with Simkl' });
    
    // Instructions
    const instructionsEl = contentEl.createEl('div', { cls: 'simkl-auth-instructions' });
    instructionsEl.createEl('p', { 
      text: 'To authenticate with Simkl, please follow these steps:' 
    });
    
    const stepsList = instructionsEl.createEl('ol');
    stepsList.createEl('li', { text: 'Copy the PIN code below' });
    stepsList.createEl('li', { text: 'Click "Open Simkl" to visit the authentication page' });
    stepsList.createEl('li', { text: 'Enter the PIN code on the Simkl website' });
    stepsList.createEl('li', { text: 'Return to Obsidian - authentication will complete automatically' });
    
    // PIN display
    const pinContainer = contentEl.createEl('div', { cls: 'simkl-pin-container' });
    pinContainer.style.cssText = 'text-align: center; margin: 20px 0; padding: 20px; background: var(--background-secondary); border-radius: 8px;';
    
    pinContainer.createEl('p', { text: 'Your PIN code:' });
    const pinEl = pinContainer.createEl('div', { 
      text: this.pinData.user_code,
      cls: 'simkl-pin-code'
    });
    pinEl.style.cssText = 'font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 10px 0;';
    
    // Buttons
    const buttonContainer = contentEl.createEl('div', { cls: 'simkl-auth-buttons' });
    buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin-top: 20px;';
    
    const openUrlButton = buttonContainer.createEl('button', { 
      text: 'Open Simkl',
      cls: 'mod-cta'
    });
openUrlButton.onclick = () => {
  try {
    // Try electron first
    if (window.require) {
      window.require('electron').shell.openExternal(this.pinData.verification_url);
    } else {
      // Fallback to window.open
      window.open(this.pinData.verification_url, '_blank');
    }
  } catch (error) {
    console.error('Failed to open URL:', error);
    new Notice('Please manually navigate to: ' + this.pinData.verification_url);
  }
};
    
    const copyPinButton = buttonContainer.createEl('button', { text: 'Copy PIN' });
    copyPinButton.onclick = () => {
      navigator.clipboard.writeText(this.pinData.user_code);
      copyPinButton.textContent = 'Copied!';
      setTimeout(() => {
        copyPinButton.textContent = 'Copy PIN';
      }, 2000);
    };
    
    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.onclick = () => {
      this.close();
    };
    
    // Status indicator
    this.statusEl = contentEl.createEl('div', { cls: 'simkl-auth-status' });
    this.statusEl.style.cssText = 'text-align: center; margin-top: 15px; font-style: italic;';
    this.statusEl.textContent = 'Waiting for authentication...';
    
    // Start polling
    this.startPolling();
  }

  startPolling() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.pollForCompletion();
  }

  async pollForCompletion() {
    try {
      const response = await fetch(
        `https://api.simkl.com/oauth/pin/${this.pinData.user_code}?client_id=${this.app.plugins.plugins['simkl-integration'].settings.clientId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          this.statusEl.textContent = 'Authentication successful!';
          this.statusEl.style.color = 'var(--text-success)';
          
          // Save token and close
          setTimeout(() => {
            this.close();
            this.onComplete(true, data);
          }, 1000);
          return;
        }
      }
      
      // Continue polling if still waiting
      if (this.isPolling) {
        setTimeout(() => this.pollForCompletion(), 3000);
      }
    } catch (error) {
      console.error('Polling error:', error);
      if (this.isPolling) {
        setTimeout(() => this.pollForCompletion(), 5000);
      }
    }
  }

  onClose() {
    this.isPolling = false;
    if (this.onComplete) {
      this.onComplete(false);
    }
  }
  }
class SimklPlugin extends Plugin {
constructor(app, manifest) {
  super(app, manifest);
  this.cache = new Map();
  this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  this.requestQueue = [];
  this.isProcessingQueue = false;
}
  
  async authenticateWithPin() {
  try {
    // Step 1: Get PIN from Simkl
    const pinData = await this.requestPin();
    
    // Step 2: Show PIN to user
    const modal = new PinAuthModal(this.app, pinData, async (success) => {
      if (success) {
        // Step 3: Poll for token
        const token = await this.pollForToken(pinData.user_code);
        
        // Step 4: Save token
        this.settings.accessToken = token.access_token;
        await this.saveSettings();
        
        new Notice('Successfully authenticated with Simkl!');
        
        // Clear cache to force refresh with new token
        this.cache.clear();
      }
    });
    
    modal.open();
    
  } catch (error) {
    console.error('Authentication error:', error);
    new Notice(`Authentication failed: ${error.message}`);
  }
}

async requestPin() {
  const response = await fetch(`https://api.simkl.com/oauth/pin?client_id=${this.settings.clientId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to request PIN: ${response.status}`);
  }
  
  return await response.json();
}

async pollForToken(userCode) {
  const pollInterval = 5000; // 5 seconds
  const maxAttempts = 60; // 5 minutes total
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `https://api.simkl.com/oauth/pin/${userCode}?client_id=${this.settings.clientId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          return data;
        }
      } else if (response.status === 400) {
        // Still waiting for user authorization
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      } else {
        throw new Error(`Polling failed: ${response.status}`);
      }
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw new Error('Authentication timed out. Please try again.');
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  throw new Error('Authentication timed out. Please try again.');
} 


  async onload() {
    console.log('Loading Simkl Plugin');
    
    // Load settings first
    await this.loadSettings();
    // Add this in your onload() method after loading settings
this.addCommand({
  id: 'authenticate-simkl',
  name: 'Authenticate with Simkl',
  callback: async () => {
    if (!this.settings.clientId) {
      new Notice('Please configure your Client ID in settings first');
      return;
    }
    await this.authenticateWithPin();
  }
});
    
    // Register code block processor
    this.registerMarkdownCodeBlockProcessor('simkl', this.processSimklCodeBlock.bind(this));
    
    // Register inline link processor
    this.registerMarkdownPostProcessor(this.processInlineLinks.bind(this));
    
    // Add plugin settings
    this.addSettingTab(new SimklSettingTab(this.app, this));
    
    // Add status bar for debugging
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('Simkl: Ready');
  }

  async loadSettings() {
    this.settings = Object.assign({}, {
      defaultLayout: 'card',
      showCoverImages: true,
      showRatings: true,
      showProgress: true,
      showGenres: true,
      clientId: '',
      accessToken: '',
      userId: '',
      debugMode: false,
      requestTimeout: 15000, // 15 seconds for mobile
      maxRetries: 3
    }, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async processSimklCodeBlock(source, el, ctx) {
    try {
      this.statusBarItem.setText('Simkl: Processing...');
      const config = this.parseCodeBlockConfig(source);
      
      if (this.settings.debugMode) {
        console.log('Simkl Config:', config);
      }
      
      const data = await this.fetchSimklData(config);
      this.renderSimklData(el, data, config);
      this.statusBarItem.setText('Simkl: Ready');
    } catch (error) {
      console.error('Simkl Plugin Error:', error);
      this.statusBarItem.setText('Simkl: Error');
      this.renderError(el, error.message);
      
      // Show notice for debugging
      if (this.settings.debugMode) {
        new Notice(`Simkl Error: ${error.message}`);
      }
    }
  }

  parseCodeBlockConfig(source) {
    const config = {};
    const lines = source.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      if (key && value) {
        config[key] = value;
      }
    }
    
    // Set defaults
    config.userId = config.userId || config.username || this.settings.userId;
    config.listType = config.listType || 'watching';
    config.layout = config.layout || this.settings.defaultLayout;
    config.mediaType = config.mediaType || 'tv';
    config.type = config.type || 'list';
    
    // Validation
    if (!config.userId && config.type !== 'stats') {
      throw new Error('User ID is required. Please set it in plugin settings or specify userId in the code block.');
    }
    
    if (!this.settings.clientId) {
      throw new Error('Client ID not configured. Please set it in plugin settings.');
    }
    
    return config;
  }

  async processInlineLinks(el, ctx) {
    const inlineLinks = el.querySelectorAll('a[href^="simkl:"]');
    
    for (const link of inlineLinks) {
      const href = link.getAttribute('href');
      try {
        const config = this.parseInlineLink(href);
        const data = await this.fetchSimklData(config);
        
        const container = document.createElement('div');
        container.className = 'simkl-inline-container';
        this.renderSimklData(container, data, config);
        
        link.parentNode.replaceChild(container, link);
      } catch (error) {
        console.error('Simkl Inline Link Error:', error);
        this.renderError(link, error.message);
      }
    }
  }

  parseInlineLink(href) {
    const parts = href.replace('simkl:', '').split('/');
    
    if (parts.length < 1) {
      throw new Error('Invalid Simkl link format');
    }
    
    const config = { layout: 'card' };
    
    if (parts[0] === 'stats') {
      config.userId = this.settings.userId;
      config.type = 'stats';
    } else if (parts.length === 1) {
      config.userId = parts[0];
      config.mediaType = 'tv';
      config.listType = 'watching';
      config.type = 'list';
    } else {
      config.userId = parts[0];
      if (parts[1] === 'stats') {
        config.type = 'stats';
      } else {
        config.mediaType = parts[1];
        config.listType = parts[2] || 'watching';
        config.type = 'list';
      }
    }
    
    if (!config.userId) {
      config.userId = this.settings.userId;
    }
    
    return config;
  }

  async fetchSimklData(config) {
    const cacheKey = JSON.stringify(config);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      if (this.settings.debugMode) {
        console.log('Using cached data for:', cacheKey);
      }
      return cached.data;
    }
    
    if (!this.settings.clientId) {
      throw new Error('Client ID not configured. Please set it in plugin settings.');
    }
    
    // Queue requests to avoid overwhelming the API
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ config, resolve, reject });
      this.processRequestQueue();
    });
  }

  async processRequestQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const { config, resolve, reject } = this.requestQueue.shift();
      
      try {
        const data = await this.makeSimklRequest(config);
        
        // Filter sync data for authenticated requests
        const filteredData = this.settings.accessToken && config.type !== 'stats' ? 
          this.filterSyncData(data, config) : data;
        
        const cacheKey = JSON.stringify(config);
        
        this.cache.set(cacheKey, {
          data: filteredData,
          timestamp: Date.now()
        });
        
        resolve(filteredData);
      } catch (error) {
        reject(error);
      }
      
      // Add delay between requests to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    this.isProcessingQueue = false;
  }

  // Filter sync data by list type and media type
// Filter sync data by list type and media type
filterSyncData(data, config) {
  if (!data || !Array.isArray(data)) return data;
  
  // Debug logging
  if (this.settings.debugMode) {
    console.log('Raw sync data:', data);
    console.log('Config:', config);
  }
  
  // Map list types to sync status values
  const statusMap = {
    'watching': 'watching',
    'plantowatch': 'plantowatch', 
    'hold': 'hold',
    'completed': 'completed',
    'dropped': 'dropped'
  };
  
  const targetStatus = statusMap[config.listType] || config.listType;
  
  // Filter data by status and media type
  return data.filter(item => {
    // Check if item has the required structure
    if (!item) return false;
    
    const matchesStatus = item.status === targetStatus;
    const hasCorrectMediaType = config.mediaType === 'tv' ? 
      (item.show || item.type === 'show') : 
      (item.movie || item.type === 'movie');
    
    if (this.settings.debugMode) {
      console.log(`Item: ${item.show?.title || item.movie?.title}, Status: ${item.status}, Type: ${item.type}, Matches: ${matchesStatus && hasCorrectMediaType}`);
    }
    
    return matchesStatus && hasCorrectMediaType;
  });
}
  async makeSimklRequest(config) {
    let url;
    let headers = {
  'simkl-api-key': this.settings.clientId,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

    if (config.type === 'stats') {
      // Stats endpoint
      url = `https://api.simkl.com/users/${config.userId}/stats`;
    } else {
      // Always try authenticated endpoint first if we have a token
// In makeSimklRequest, replace the authenticated section:
if (this.settings.accessToken) {
  headers['Authorization'] = `Bearer ${this.settings.accessToken}`;
  // Use the general sync endpoint and filter client-side
  url = `https://api.simkl.com/sync/all-items?extended=full`;
} else {
  // Public endpoint remains the same
  url = `https://api.simkl.com/users/${config.userId}/list/${config.mediaType}/${config.listType}?extended=full`;
}
    }

    if (this.settings.debugMode) {
      console.log('Making request to:', url);
      console.log('Headers:', headers);
    }

    let lastError;
    
    // Retry mechanism
    for (let attempt = 1; attempt <= this.settings.maxRetries; attempt++) {
      try {
        const response = await this.makeHttpRequest(url, headers);
        
        if (response.ok) {
          const data = await response.json();
          
          if (this.settings.debugMode) {
            console.log('Received data:', data);
          }
          
          return data;
        }
        
        // Handle specific error codes
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your access token.');
        } else if (response.status === 403) {
          throw new Error('Access forbidden. Check your API key or user permissions.');
        } else if (response.status === 412) {
          throw new Error('Client ID failed - check your simkl-api-key header.');
        } else if (response.status === 404) {
          throw new Error('User not found or list is empty.');
        } else if (response.status === 429) {
          // Rate limited - wait and retry
          if (attempt < this.settings.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            continue;
          }
          throw new Error('Too many requests. Please try again later.');
        } else if (response.status >= 500) {
          // Server error - retry
          if (attempt < this.settings.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          throw new Error('Simkl server error. Please try again later.');
        }
        
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage += ` - ${errorData.error}`;
          }
        } catch (e) {
          // Can't parse error response
        }
        
        throw new Error(`Simkl API Error: ${errorMessage}`);
        
      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please check your internet connection.');
        }
        
        if (error.message.includes('Failed to fetch') || 
            error.message.includes('Network request failed') ||
            error.message.includes('NetworkError')) {
          if (attempt < this.settings.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          throw new Error('Network error. Please check your internet connection and try again.');
        }
        
        // Don't retry for authentication or client errors
        if (error.message.includes('Authentication failed') || 
            error.message.includes('Access forbidden') ||
            error.message.includes('Client ID failed') ||
            error.message.includes('User not found')) {
          throw error;
        }
        
        // Retry for other errors
        if (attempt < this.settings.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    }
    
    throw lastError || new Error('Failed to fetch data from Simkl after multiple attempts');
  }

  async makeHttpRequest(url, headers) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.settings.requestTimeout);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        signal: controller.signal,
        // Add mobile-specific options
        cache: 'no-cache',
        credentials: 'omit',
        mode: 'cors'
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  getSimklUrl(mediaType, id) {
    if (!id) return '#';
    return `https://simkl.com/${mediaType}/${id}`;
  }

  renderSimklData(el, data, config) {
    el.empty();
    el.className = 'simkl-container';
    
    if (config.type === 'stats') {
      this.renderUserStats(el, data);
    } else {
      this.renderMediaList(el, data, config);
    }
    
    // Add required Simkl attribution link (required by API terms)
    const attributionDiv = document.createElement('div');
    attributionDiv.className = 'simkl-attribution';
    attributionDiv.style.cssText = 'margin-top: 10px; text-align: center; font-size: 0.8em; opacity: 0.7;';
    
    const simklLink = document.createElement('a');
    simklLink.href = 'https://simkl.com';
    simklLink.textContent = 'Powered by Simkl';
    simklLink.target = '_blank';
    simklLink.rel = 'noopener noreferrer';
    simklLink.style.cssText = 'color: inherit; text-decoration: none;';
    
    attributionDiv.appendChild(simklLink);
    el.appendChild(attributionDiv);
  }

  renderUserStats(el, stats) {
    const statsDiv = document.createElement('div');
    statsDiv.className = 'simkl-user-stats';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'user-header';
    const header = document.createElement('h3');
    header.textContent = 'Simkl Statistics';
    headerDiv.appendChild(header);
    statsDiv.appendChild(headerDiv);
    
    const gridDiv = document.createElement('div');
    gridDiv.className = 'stats-grid';
    
    // TV Stats
    if (stats.tv) {
      const tvSection = this.createStatSection('TV Shows', [
        { label: 'Shows', value: stats.tv.shows || 0 },
        { label: 'Episodes', value: stats.tv.episodes || 0 },
        { label: 'Minutes', value: (stats.tv.minutes || 0).toLocaleString() }
      ]);
      gridDiv.appendChild(tvSection);
    }
    
    // Anime Stats
    if (stats.anime) {
      const animeSection = this.createStatSection('Anime', [
        { label: 'Shows', value: stats.anime.shows || 0 },
        { label: 'Episodes', value: stats.anime.episodes || 0 },
        { label: 'Minutes', value: (stats.anime.minutes || 0).toLocaleString() }
      ]);
      gridDiv.appendChild(animeSection);
    }
    
    // Movie Stats
    if (stats.movies) {
      const moviesSection = this.createStatSection('Movies', [
        { label: 'Count', value: stats.movies.movies || 0 },
        { label: 'Minutes', value: (stats.movies.minutes || 0).toLocaleString() }
      ]);
      gridDiv.appendChild(moviesSection);
    }
    
    statsDiv.appendChild(gridDiv);
    el.appendChild(statsDiv);
  }

  createStatSection(title, stats) {
    const section = document.createElement('div');
    section.className = 'stat-section';
    
    const titleEl = document.createElement('h4');
    titleEl.textContent = title;
    section.appendChild(titleEl);
    
    stats.forEach(stat => {
      const item = document.createElement('div');
      item.className = 'stat-item';
      
      const label = document.createElement('span');
      label.textContent = stat.label + ':';
      item.appendChild(label);
      
      const value = document.createElement('span');
      value.textContent = stat.value;
      item.appendChild(value);
      
      section.appendChild(item);
    });
    
    return section;
  }
renderMediaList(el, entries, config) {
  // Add debugging - INSERT THIS NEW CODE
  if (this.settings.debugMode) {
    console.log('Rendering entries:', entries);
    console.log('Config:', config);
    console.log('Entries length:', entries?.length);
  }
  
  // Keep the existing code below unchanged
  if (!entries || entries.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'simkl-empty';
    emptyDiv.textContent = 'No items found';
    el.appendChild(emptyDiv);
    return;
  }
  
  if (config.layout === 'table') {
    this.renderTableLayout(el, entries, config);
  } else {
    this.renderCardLayout(el, entries, config);
  }
}


  renderCardLayout(el, entries, config) {
    const gridDiv = document.createElement('div');
    gridDiv.className = 'simkl-cards-grid';
    
    entries.forEach(entry => {
      const show = entry.show || entry.movie;
      if (!show) return;
      
      const cardDiv = document.createElement('div');
      cardDiv.className = 'simkl-card';
      
      // Cover image
      if (this.settings.showCoverImages && show.poster) {
        const img = document.createElement('img');
        img.src = show.poster;
        img.alt = show.title;
        img.className = 'media-cover';
        img.loading = 'lazy';
        
        // Add error handling for images
        img.onerror = function() {
          this.style.display = 'none';
        };
        
        cardDiv.appendChild(img);
      }
      
      const mediaInfoDiv = document.createElement('div');
      mediaInfoDiv.className = 'media-info';
      
      // Title
      const titleEl = document.createElement('h4');
      const titleLink = document.createElement('a');
      titleLink.href = this.getSimklUrl(config.mediaType, show.ids?.simkl);
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.className = 'simkl-title-link';
      titleLink.textContent = show.title;
      titleEl.appendChild(titleLink);
      mediaInfoDiv.appendChild(titleEl);
      
      // Details
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'media-details';
      
      if (show.year) {
        const yearSpan = document.createElement('span');
        yearSpan.className = 'year';
        yearSpan.textContent = show.year;
        detailsDiv.appendChild(yearSpan);
      }
      
      if (this.settings.showProgress && entry.watched_episodes) {
        const progressSpan = document.createElement('span');
        progressSpan.className = 'progress';
        progressSpan.textContent = `${entry.watched_episodes}/${show.total_episodes || '?'} episodes`;
        detailsDiv.appendChild(progressSpan);
      }
      
      if (this.settings.showRatings && entry.user_rating) {
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score';
        scoreSpan.textContent = `★ ${entry.user_rating}`;
        detailsDiv.appendChild(scoreSpan);
      }
      
      mediaInfoDiv.appendChild(detailsDiv);
      
      // Genres
      if (this.settings.showGenres && show.genres && show.genres.length > 0) {
        const genresDiv = document.createElement('div');
        genresDiv.className = 'genres';
        show.genres.slice(0, 3).forEach(genre => {
          const genreTag = document.createElement('span');
          genreTag.className = 'genre-tag';
          genreTag.textContent = genre;
          genresDiv.appendChild(genreTag);
        });
        mediaInfoDiv.appendChild(genresDiv);
      }
      
      cardDiv.appendChild(mediaInfoDiv);
      gridDiv.appendChild(cardDiv);
    });
    
    el.appendChild(gridDiv);
  }

  renderTableLayout(el, entries, config) {
    const table = document.createElement('table');
    table.className = 'simkl-table';
    
    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Title', 'Year'];
    if (this.settings.showProgress) headers.push('Progress');
    if (this.settings.showRatings) headers.push('Rating');
    
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    
    entries.forEach(entry => {
      const show = entry.show || entry.movie;
      if (!show) return;
      
      const row = document.createElement('tr');
      // Title
      const titleCell = document.createElement('td');
      const titleLink = document.createElement('a');
      titleLink.href = this.getSimklUrl(config.mediaType, show.ids?.simkl);
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.className = 'simkl-title-link';
      titleLink.textContent = show.title;
      titleCell.appendChild(titleLink);
      row.appendChild(titleCell);
      
      // Year
      const yearCell = document.createElement('td');
      yearCell.textContent = show.year || '-';
      row.appendChild(yearCell);
      
      // Progress
      if (this.settings.showProgress) {
        const progressCell = document.createElement('td');
        progressCell.textContent = entry.watched_episodes ? 
          `${entry.watched_episodes}/${show.total_episodes || '?'}` : '-';
        row.appendChild(progressCell);
      }
      
      // Rating
      if (this.settings.showRatings) {
        const scoreCell = document.createElement('td');
        scoreCell.textContent = entry.user_rating ? `★ ${entry.user_rating}` : '-';
        row.appendChild(scoreCell);
      }
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    el.appendChild(table);
  }

  renderError(el, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'simkl-error';
    errorDiv.textContent = `Error: ${message}`;
    el.appendChild(errorDiv);
  }

  onunload() {
    console.log('Unloading Simkl Plugin');
  }
}

class SimklSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Simkl Integration Settings' });
    
    containerEl.createEl('p', { 
      text: 'To use this plugin, you need to get a Client ID from Simkl. Go to https://simkl.com/settings/developer and create a new app to get your Client ID.'
    });
    
    containerEl.createEl('p', { 
      text: 'Note: You need your Simkl User ID (not username). You can find this in your Simkl profile URL or by checking the network tab in your browser when viewing your profile.'
    });
    
    // API Settings
    containerEl.createEl('h3', { text: 'API Configuration' });
    
    new Setting(containerEl)
      .setName('Client ID')
      .setDesc('Your Simkl API Client ID (required)')
      .addText(text => text
        .setPlaceholder('Enter your Simkl Client ID')
        .setValue(this.plugin.settings.clientId)
        .onChange(async (value) => {
          this.plugin.settings.clientId = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('User ID')
      .setDesc('Your Simkl User ID (not username) - required for personal data')
      .addText(text => text
        .setPlaceholder('Enter your Simkl User ID')
        .setValue(this.plugin.settings.userId)
        .onChange(async (value) => {
          this.plugin.settings.userId = value;
          await this.plugin.saveSettings();
        }));
    
    // Replace the existing Access Token setting with this:
new Setting(containerEl)
  .setName('Authentication')
  .setDesc(this.plugin.settings.accessToken ? 
    'You are authenticated with Simkl' : 
    'Authenticate with Simkl to access your private lists')
  .addButton(button => {
    if (this.plugin.settings.accessToken) {
      button
        .setButtonText('Sign Out')
        .setWarning()
        .onClick(async () => {
          this.plugin.settings.accessToken = '';
          await this.plugin.saveSettings();
          this.plugin.cache.clear();
          this.display(); // Refresh the settings page
          new Notice('Signed out from Simkl');
        });
    } else {
      button
        .setButtonText('Sign In with Simkl')
        .setCta()
        .onClick(async () => {
          if (!this.plugin.settings.clientId) {
            new Notice('Please enter your Client ID first');
            return;
          }
          
          button.setButtonText('Authenticating...');
          try {
            await this.plugin.authenticateWithPin();
            this.display(); // Refresh the settings page
          } catch (error) {
            new Notice(`Authentication failed: ${error.message}`);
          }
          button.setButtonText('Sign In with Simkl');
        });
    }
  });
    // Display Settings
    containerEl.createEl('h3', { text: 'Display Options' });
    
    new Setting(containerEl)
      .setName('Default Layout')
      .setDesc('Choose the default layout for media lists')
      .addDropdown(dropdown => dropdown
        .addOption('card', 'Card Layout')
        .addOption('table', 'Table Layout')
        .setValue(this.plugin.settings.defaultLayout)
        .onChange(async (value) => {
          this.plugin.settings.defaultLayout = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Show Cover Images')
      .setDesc('Display cover images for shows/movies')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showCoverImages)
        .onChange(async (value) => {
          this.plugin.settings.showCoverImages = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Show Ratings')
      .setDesc('Display user ratings/scores')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showRatings)
        .onChange(async (value) => {
          this.plugin.settings.showRatings = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Show Progress')
      .setDesc('Display progress information')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showProgress)
        .onChange(async (value) => {
          this.plugin.settings.showProgress = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Show Genres')
      .setDesc('Display genre tags')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showGenres)
        .onChange(async (value) => {
          this.plugin.settings.showGenres = value;
          await this.plugin.saveSettings();
        }));
    
    // Advanced Settings
    containerEl.createEl('h3', { text: 'Advanced Settings' });
    
    new Setting(containerEl)
      .setName('Debug Mode')
      .setDesc('Enable debug logging and error notices')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.debugMode)
        .onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Request Timeout')
      .setDesc('Request timeout in milliseconds (default: 15000)')
      .addText(text => text
        .setPlaceholder('15000')
        .setValue(this.plugin.settings.requestTimeout.toString())
        .onChange(async (value) => {
          const timeout = parseInt(value);
          if (!isNaN(timeout) && timeout > 0) {
            this.plugin.settings.requestTimeout = timeout;
            await this.plugin.saveSettings();
          }
        }));
    
    new Setting(containerEl)
      .setName('Max Retries')
      .setDesc('Maximum number of retry attempts for failed requests')
      .addSlider(slider => slider
        .setLimits(1, 5, 1)
        .setValue(this.plugin.settings.maxRetries)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxRetries = value;
          await this.plugin.saveSettings();
        }));
    
    // Usage Examples
    containerEl.createEl('h3', { text: 'Usage Examples' });
    
    const exampleDiv = containerEl.createEl('div');
    exampleDiv.createEl('p', { text: 'Code block format:' });
    exampleDiv.createEl('pre', { 
      text: `\`\`\`simkl
userId: YOUR_USER_ID
mediaType: tv
listType: watching
layout: card
\`\`\``
    });
    
    exampleDiv.createEl('p', { text: 'Inline links:' });
    exampleDiv.createEl('pre', { 
      text: `[My Stats](simkl:stats)
[My Watching](simkl:YOUR_USER_ID/tv/watching)
[My Anime](simkl:YOUR_USER_ID/anime/watching)`
    });
    
    // Test Connection Button
    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Test your API configuration')
      .addButton(button => button
        .setButtonText('Test API')
        .onClick(async () => {
          button.setButtonText('Testing...');
          try {
            await this.testConnection();
            new Notice('Connection successful!');
            button.setButtonText('Test API');
          } catch (error) {
            new Notice(`Connection failed: ${error.message}`);
            button.setButtonText('Test API');
          }
     
        }));
  }

  async testConnection() {
    if (!this.plugin.settings.clientId) {
      throw new Error('Client ID not configured');
    }
    
    if (!this.plugin.settings.userId) {
      throw new Error('User ID not configured');
    }
    
    // Test with stats endpoint as it's usually public
    const config = {
      type: 'stats',
      userId: this.plugin.settings.userId
    };
    
    await this.plugin.makeSimklRequest(config);
  }
}

module.exports = SimklPlugin;
