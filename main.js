const { Plugin, PluginSettingTab, Setting } = require('obsidian');

class SimklPlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
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
  }

  async loadSettings() {
    this.settings = Object.assign({}, {
      defaultLayout: 'card',
      showCoverImages: true,
      showRatings: true,
      showProgress: true,
      showGenres: true,
      clientId: '', // Users need to set this
      accessToken: '', // For authenticated requests
      userId: '' // User's Simkl ID
    }, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async processSimklCodeBlock(source, el, ctx) {
    try {
      const config = this.parseCodeBlockConfig(source);
      const data = await this.fetchSimklData(config);
      this.renderSimklData(el, data, config);
    } catch (error) {
      this.renderError(el, error.message);
    }
  }

  parseCodeBlockConfig(source) {
    const config = {};
    const lines = source.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key && value) {
        config[key] = value;
      }
    }
    
    // Use userId from config or fallback to settings
    if (!config.userId && !this.settings.userId) {
      throw new Error('User ID is required. Please set it in plugin settings or specify userId in the code block.');
    }
    
    if (!this.settings.clientId) {
      throw new Error('Client ID not configured. Please set it in plugin settings.');
    }
    
    config.userId = config.userId || this.settings.userId;
    config.listType = config.listType || 'watching';
    config.layout = config.layout || this.settings.defaultLayout;
    config.mediaType = config.mediaType || 'tv'; // tv, anime, movies
    
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
        this.renderError(link, error.message);
      }
    }
  }

  parseInlineLink(href) {
    // Parse: simkl:userId/tv/watching or simkl:userId/stats
    const parts = href.replace('simkl:', '').split('/');
    
    if (parts.length < 2) {
      throw new Error('Invalid Simkl link format. Use: simkl:userId/stats or simkl:userId/tv/watching');
    }
    
    const config = {
      userId: parts[0],
      layout: 'card'
    };
    
    if (parts[1] === 'stats') {
      config.type = 'stats';
    } else {
      config.mediaType = parts[1]; // tv, anime, movies
      config.listType = parts[2] || 'watching';
    }
    
    return config;
  }

  async fetchSimklData(config) {
    const cacheKey = JSON.stringify(config);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    if (!this.settings.clientId) {
      throw new Error('Client ID not configured. Please set it in plugin settings.');
    }
    
    let url;
    const headers = {
      'simkl-api-version': '1',
      'Content-Type': 'application/json'
    };
    
    if (config.type === 'stats') {
      // User stats endpoint - public endpoint using user ID
      url = `https://api.simkl.com/users/${config.userId}/stats?client_id=${this.settings.clientId}`;
    } else {
      // For user watchlist, we need to use the sync endpoint with authentication
      if (!this.settings.accessToken) {
        throw new Error('Access token required for user watchlist. Please authenticate with Simkl first.');
      }
      
      headers['Authorization'] = `Bearer ${this.settings.accessToken}`;
      
      // Use the correct sync endpoint for getting user's lists
      const listMap = {
        'watching': 'watching',
        'completed': 'completed',
        'plantowatch': 'plantowatch',
        'hold': 'hold',
        'dropped': 'dropped'
      };
      
      const status = listMap[config.listType] || 'watching';
      url = `https://api.simkl.com/sync/all-items/${config.mediaType}/${status}?extended=full`;
    }
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage += ` - ${errorData.error}`;
          }
        } catch (e) {
          // If we can't parse JSON, try text
          try {
            const errorText = await response.text();
            errorMessage += ` - ${errorText}`;
          } catch (e2) {
            // If we can't read anything, just use the status
          }
        }
        throw new Error(`Simkl API Error: ${errorMessage}`);
      }
      
      const result = await response.json();
      
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error('Simkl API Error:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Network error: Please check your internet connection');
      }
      throw new Error(`Failed to fetch data from Simkl: ${error.message}`);
    }
  }

  // Helper function to generate Simkl URL
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
    const statsHtml = `
      <div class="simkl-user-stats">
        <div class="user-header">
          <h3>📊 Simkl Statistics</h3>
        </div>
        <div class="stats-grid">
          <div class="stat-section">
            <h4>📺 TV Shows</h4>
            <div class="stat-item">
              <span>Shows:</span>
              <span>${stats.tv?.shows || 0}</span>
            </div>
            <div class="stat-item">
              <span>Episodes:</span>
              <span>${stats.tv?.episodes || 0}</span>
            </div>
            <div class="stat-item">
              <span>Minutes:</span>
              <span>${(stats.tv?.minutes || 0).toLocaleString()}</span>
            </div>
          </div>
          <div class="stat-section">
            <h4>🎌 Anime</h4>
            <div class="stat-item">
              <span>Shows:</span>
              <span>${stats.anime?.shows || 0}</span>
            </div>
            <div class="stat-item">
              <span>Episodes:</span>
              <span>${stats.anime?.episodes || 0}</span>
            </div>
            <div class="stat-item">
              <span>Minutes:</span>
              <span>${(stats.anime?.minutes || 0).toLocaleString()}</span>
            </div>
          </div>
          <div class="stat-section">
            <h4>🎬 Movies</h4>
            <div class="stat-item">
              <span>Count:</span>
              <span>${stats.movies?.movies || 0}</span>
            </div>
            <div class="stat-item">
              <span>Minutes:</span>
              <span>${(stats.movies?.minutes || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    el.innerHTML = statsHtml;
  }

  renderMediaList(el, entries, config) {
    if (!entries || entries.length === 0) {
      el.innerHTML = '<div class="simkl-empty">No items found</div>';
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
      const show = entry.show;
      if (!show) return;
      
      const title = show.title;
      
      const cardDiv = document.createElement('div');
      cardDiv.className = 'simkl-card';
      
      if (this.settings.showCoverImages && show.poster) {
        const img = document.createElement('img');
        img.src = show.poster;
        img.alt = title;
        img.className = 'media-cover';
        img.onerror = function() {
          this.style.display = 'none';
        };
        cardDiv.appendChild(img);
      }
      
      const mediaInfoDiv = document.createElement('div');
      mediaInfoDiv.className = 'media-info';
      
      // Create clickable title
      const titleElement = document.createElement('h4');
      const titleLink = document.createElement('a');
      titleLink.href = this.getSimklUrl(config.mediaType, show.ids?.simkl);
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.className = 'simkl-title-link';
      titleLink.textContent = title;
      titleElement.appendChild(titleLink);
      mediaInfoDiv.appendChild(titleElement);
      
      // Create details div
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
      
      // Create genres div
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
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const titleHeader = document.createElement('th');
    titleHeader.textContent = 'Title';
    headerRow.appendChild(titleHeader);
    
    const yearHeader = document.createElement('th');
    yearHeader.textContent = 'Year';
    headerRow.appendChild(yearHeader);
    
    if (this.settings.showProgress) {
      const progressHeader = document.createElement('th');
      progressHeader.textContent = 'Progress';
      headerRow.appendChild(progressHeader);
    }
    
    if (this.settings.showRatings) {
      const scoreHeader = document.createElement('th');
      scoreHeader.textContent = 'Rating';
      headerRow.appendChild(scoreHeader);
    }
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    entries.forEach(entry => {
      const show = entry.show;
      if (!show) return;
      
      const title = show.title;
      
      const row = document.createElement('tr');
      
      // Title cell with clickable link
      const titleCell = document.createElement('td');
      const titleLink = document.createElement('a');
      titleLink.href = this.getSimklUrl(config.mediaType, show.ids?.simkl);
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.className = 'simkl-title-link';
      titleLink.textContent = title;
      titleCell.appendChild(titleLink);
      row.appendChild(titleCell);
      
      // Year cell
      const yearCell = document.createElement('td');
      yearCell.textContent = show.year || '-';
      row.appendChild(yearCell);
      
      // Progress cell
      if (this.settings.showProgress) {
        const progressCell = document.createElement('td');
        progressCell.textContent = entry.watched_episodes ? 
          `${entry.watched_episodes}/${show.total_episodes || '?'}` : '-';
        row.appendChild(progressCell);
      }
      
      // Rating cell
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
    el.innerHTML = `<div class="simkl-error">❌ Error: ${message}</div>`;
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
    
    // Instructions section
    const instructionsDiv = containerEl.createEl('div', { cls: 'setting-item-description' });
    instructionsDiv.createEl('h3', { text: 'Setup Instructions:' });
    instructionsDiv.createEl('p', { text: '1. Go to https://simkl.com/settings/developer and create a new app to get your Client ID.' });
    instructionsDiv.createEl('p', { text: '2. Find your User ID by going to your Simkl profile. It\'s the number in the URL.' });
    instructionsDiv.createEl('p', { text: '3. For watchlists, you\'ll need an access token. User stats work with just Client ID.' });
    
    // Usage examples
    const examplesDiv = containerEl.createEl('div', { cls: 'setting-item-description' });
    examplesDiv.createEl('h3', { text: 'Usage Examples:' });
    examplesDiv.createEl('p', { text: 'Code blocks:' });
    examplesDiv.createEl('pre', { text: '```simkl\nuserId: 123456\nmediaType: tv\nlistType: watching\nlayout: card\n```' });
    examplesDiv.createEl('p', { text: 'Inline links:' });
    examplesDiv.createEl('pre', { text: '[My Stats](simkl:123456/stats)\n[Currently Watching](simkl:123456/tv/watching)' });
    
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
      .setDesc('Your Simkl User ID (find it in your profile URL)')
      .addText(text => text
        .setPlaceholder('Enter your Simkl User ID')
        .setValue(this.plugin.settings.userId)
        .onChange(async (value) => {
          this.plugin.settings.userId = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Access Token')
      .setDesc('Your Simkl access token (required for watchlists, optional for stats)')
      .addText(text => text
        .setPlaceholder('Enter your Simkl access token')
        .setValue(this.plugin.settings.accessToken)
        .onChange(async (value) => {
          this.plugin.settings.accessToken = value;
          await this.plugin.saveSettings();
        }));
    
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
        .setValue(this.settings.showGenres)
        .onChange(async (value) => {
          this.plugin.settings.showGenres = value;
          await this.plugin.saveSettings();
        }));
  }
}

module.exports = SimklPlugin;
