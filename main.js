const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

class SimklPlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }

  async onload() {
    console.log('Loading Simkl Plugin');
    
    // Load settings first
    await this.loadSettings();
    
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
        const cacheKey = JSON.stringify(config);
        
        this.cache.set(cacheKey, {
          data: data,
          timestamp: Date.now()
        });
        
        resolve(data);
      } catch (error) {
        reject(error);
      }
      
      // Add delay between requests to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    this.isProcessingQueue = false;
  }

  async makeSimklRequest(config) {
    let url;
    let headers = {
      'simkl-api-version': '1',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (config.type === 'stats') {
      url = `https://api.simkl.com/users/${config.userId}/stats?client_id=${this.settings.clientId}`;
    } else {
      // Always try authenticated endpoint first if we have a token
      if (this.settings.accessToken) {
        headers['Authorization'] = `Bearer ${this.settings.accessToken}`;
        url = `https://api.simkl.com/sync/all-items/${config.mediaType}/${config.listType}?extended=full`;
      } else {
        // Try public endpoint
        url = `https://api.simkl.com/users/${config.userId}/list/${config.mediaType}/${config.listType}?client_id=${this.settings.clientId}&extended=full`;
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
          throw new Error('Access forbidden. The user profile might be private.');
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
    
    new Setting(containerEl)
      .setName('Access Token')
      .setDesc('Your Simkl access token (required for private watchlists)')
      .addText(text => text
        .setPlaceholder('Enter your Simkl access token')
        .setValue(this.plugin.settings.accessToken)
        .onChange(async (value) => {
          this.plugin.settings.accessToken = value;
          await this.plugin.saveSettings();
        }));
    
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
