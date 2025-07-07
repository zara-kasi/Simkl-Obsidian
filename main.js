import { Plugin, Notice, requestUrl, Setting, PluginSettingTab, App } from 'obsidian';
import { parse } from 'url';

interface SimklAuthSettings {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiry: number;
    autoSync: boolean;
    syncInterval: number;
}

const DEFAULT_SETTINGS: SimklAuthSettings = {
    clientId: '',
    clientSecret: '',
    accessToken: '',
    refreshToken: '',
    tokenExpiry: 0,
    autoSync: false,
    syncInterval: 3600000 // 1 hour in milliseconds
};

export default class SimklPlugin extends Plugin {
    settings: SimklAuthSettings;
    private authServer: any;
    private readonly REDIRECT_URI = 'http://localhost:8080/callback';
    private readonly AUTH_URL = 'https://simkl.com/oauth/authorize';
    private readonly TOKEN_URL = 'https://simkl.com/oauth/token';
    private readonly API_BASE_URL = 'https://api.simkl.com';
    private syncIntervalId: NodeJS.Timeout | null = null;

    async onload() {
        console.log('Loading Simkl Integration Plugin');
        
        await this.loadSettings();
        
        // Add settings tab
        this.addSettingTab(new SimklSettingTab(this.app, this));
        
        // Add ribbon icon
        this.addRibbonIcon('tv', 'Simkl Integration', (evt: MouseEvent) => {
            this.openSimklCommands();
        });

        // Add commands
        this.addCommand({
            id: 'authenticate-simkl',
            name: 'Authenticate with Simkl',
            callback: () => this.authenticateWithSimkl()
        });

        this.addCommand({
            id: 'test-simkl-api',
            name: 'Test Simkl API Connection',
            callback: () => this.testSimklApi()
        });

        this.addCommand({
            id: 'sync-watchlist',
            name: 'Sync Watchlist to Note',
            callback: () => this.syncWatchlistToNote()
        });

        this.addCommand({
            id: 'sync-watching',
            name: 'Sync Currently Watching',
            callback: () => this.syncCurrentlyWatching()
        });

        this.addCommand({
            id: 'sync-stats',
            name: 'Sync Viewing Statistics',
            callback: () => this.syncViewingStats()
        });

        this.addCommand({
            id: 'search-add-show',
            name: 'Search and Add Show',
            callback: () => this.searchAndAddShow()
        });

        this.addCommand({
            id: 'disconnect-simkl',
            name: 'Disconnect from Simkl',
            callback: () => this.disconnectFromSimkl()
        });

        // Start auto-sync if enabled
        if (this.settings.autoSync && this.isTokenValid()) {
            this.startAutoSync();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // OAuth 2.0 Authentication Flow
    async authenticateWithSimkl() {
        if (!this.settings.clientId || !this.settings.clientSecret) {
            new Notice('Please configure Client ID and Client Secret in plugin settings first.');
            return;
        }

        if (this.isTokenValid()) {
            new Notice('Already authenticated with Simkl!');
            return;
        }

        try {
            // Step 1: Start local server to catch redirect
            await this.startAuthServer();
            
            // Step 2: Generate auth URL and open browser
            const authUrl = this.generateAuthUrl();
            
            // Open the auth URL in the user's default browser
            window.open(authUrl, '_blank');
            
            new Notice('Opening Simkl authentication page...');
            
        } catch (error) {
            console.error('Authentication failed:', error);
            new Notice('Authentication failed. Please try again.');
        }
    }

    private generateAuthUrl(): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.settings.clientId,
            redirect_uri: this.REDIRECT_URI,
            scope: 'public', // Adjust scope as needed
            state: this.generateRandomState()
        });

        return `${this.AUTH_URL}?${params.toString()}`;
    }

    private generateRandomState(): string {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    private async startAuthServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.authServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
                const url = parse(req.url || '', true);
                
                if (url.pathname === '/callback') {
                    const { code, error } = url.query;
                    
                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                                    <h1 style="color: #f44336;">Authentication Error</h1>
                                    <p>Error: ${error}</p>
                                    <p>You can close this window.</p>
                                </body>
                            </html>
                        `);
                        this.closeAuthServer();
                        reject(new Error(`Authentication error: ${error}`));
                        return;
                    }

                    if (code) {
                        try {
                            // Exchange code for access token
                            await this.exchangeCodeForToken(code as string);
                            
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                                        <h1 style="color: #4CAF50;">✓ Authentication Successful!</h1>
                                        <p>You have successfully connected your Simkl account to Obsidian.</p>
                                        <p>You can now close this window and return to Obsidian.</p>
                                        <script>
                                            setTimeout(() => {
                                                window.close();
                                            }, 3000);
                                        </script>
                                    </body>
                                </html>
                            `);
                            
                            this.closeAuthServer();
                            new Notice('Successfully authenticated with Simkl!');
                            
                            // Start auto-sync if enabled
                            if (this.settings.autoSync) {
                                this.startAutoSync();
                            }
                            
                            resolve();
                            
                        } catch (error) {
                            res.writeHead(500, { 'Content-Type': 'text/html' });
                            res.end(`
                                <html>
                                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                                        <h1 style="color: #f44336;">Authentication Error</h1>
                                        <p>Failed to exchange code for token.</p>
                                        <p>You can close this window.</p>
                                    </body>
                                </html>
                            `);
                            this.closeAuthServer();
                            reject(error);
                        }
                    }
                }
            });

            this.authServer.listen(8080, 'localhost', () => {
                console.log('Auth server started on http://localhost:8080');
                resolve();
            });

            this.authServer.on('error', (error: Error) => {
                reject(error);
            });
        });
    }

    private async exchangeCodeForToken(code: string): Promise<void> {
        const tokenData = {
            grant_type: 'authorization_code',
            code: code,
            client_id: this.settings.clientId,
            client_secret: this.settings.clientSecret,
            redirect_uri: this.REDIRECT_URI
        };

        try {
            const response = await requestUrl({
                url: this.TOKEN_URL,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(tokenData).toString()
            });

            const tokenResponse = response.json;
            
            if (tokenResponse.access_token) {
                this.settings.accessToken = tokenResponse.access_token;
                this.settings.refreshToken = tokenResponse.refresh_token || '';
                this.settings.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);
                
                await this.saveSettings();
                console.log('Token saved successfully');
            } else {
                throw new Error('No access token received');
            }
            
        } catch (error) {
            console.error('Token exchange failed:', error);
            throw new Error('Failed to exchange code for token');
        }
    }

    private closeAuthServer(): void {
        if (this.authServer) {
            this.authServer.close();
            this.authServer = null;
        }
    }

   isTokenValid(): boolean {
        return this.settings.accessToken && 
               this.settings.tokenExpiry > Date.now();
    }

    private async refreshAccessToken(): Promise<void> {
        if (!this.settings.refreshToken) {
            throw new Error('No refresh token available');
        }

        const refreshData = {
            grant_type: 'refresh_token',
            refresh_token: this.settings.refreshToken,
            client_id: this.settings.clientId,
            client_secret: this.settings.clientSecret
        };

        try {
            const response = await requestUrl({
                url: this.TOKEN_URL,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(refreshData).toString()
            });

            const tokenResponse = response.json;
            
            if (tokenResponse.access_token) {
                this.settings.accessToken = tokenResponse.access_token;
                this.settings.refreshToken = tokenResponse.refresh_token || this.settings.refreshToken;
                this.settings.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);
                
                await this.saveSettings();
            }
            
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw new Error('Failed to refresh token');
        }
    }

    // API Helper Methods
    async makeAuthenticatedRequest(endpoint: string, options: any = {}): Promise<any> {
        // Check if token is valid, refresh if needed
        if (!this.isTokenValid()) {
            if (this.settings.refreshToken) {
                await this.refreshAccessToken();
            } else {
                throw new Error('No valid token available. Please authenticate first.');
            }
        }

        const headers = {
            'Authorization': `Bearer ${this.settings.accessToken}`,
            'Content-Type': 'application/json',
            'simkl-api-version': '1.4.6',
            ...options.headers
        };

        try {
            const response = await requestUrl({
                url: `${this.API_BASE_URL}${endpoint}`,
                method: options.method || 'GET',
                headers: headers,
                body: options.body ? JSON.stringify(options.body) : undefined
            });

            return response.json;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Core Plugin Features
    async testSimklApi(): Promise<void> {
        try {
            const userInfo = await this.makeAuthenticatedRequest('/users/settings');
            console.log('User info:', userInfo);
            new Notice(`Hello ${userInfo.user.name}! API connection successful.`);
        } catch (error) {
            console.error('API test failed:', error);
            new Notice('API test failed. Please check your authentication.');
        }
    }

    async syncWatchlistToNote(): Promise<void> {
        try {
            const watchlist = await this.makeAuthenticatedRequest('/sync/all-items/');
            const content = this.formatWatchlistForNote(watchlist);
            
            await this.createOrUpdateNote('Simkl Watchlist', content);
            new Notice('Watchlist synced successfully!');
        } catch (error) {
            console.error('Watchlist sync failed:', error);
            new Notice('Failed to sync watchlist. Please check your authentication.');
        }
    }

    async syncCurrentlyWatching(): Promise<void> {
        try {
            const watching = await this.makeAuthenticatedRequest('/sync/all-items/watching');
            const content = this.formatCurrentlyWatchingForNote(watching);
            
            await this.createOrUpdateNote('Currently Watching', content);
            new Notice('Currently watching list synced successfully!');
        } catch (error) {
            console.error('Currently watching sync failed:', error);
            new Notice('Failed to sync currently watching. Please check your authentication.');
        }
    }

    async syncViewingStats(): Promise<void> {
        try {
            const stats = await this.makeAuthenticatedRequest('/users/stats');
            const content = this.formatStatsForNote(stats);
            
            await this.createOrUpdateNote('Viewing Statistics', content);
            new Notice('Viewing statistics synced successfully!');
        } catch (error) {
            console.error('Stats sync failed:', error);
            new Notice('Failed to sync viewing statistics. Please check your authentication.');
        }
    }

    async searchAndAddShow(): Promise<void> {
        // This would typically open a modal for searching
        // For now, we'll just show a notice
        new Notice('Search functionality would open here. This requires a custom modal implementation.');
    }

    // Utility Methods
    private formatWatchlistForNote(watchlist: any): string {
        let content = `# Simkl Watchlist\n\n`;
        content += `*Last updated: ${new Date().toLocaleString()}*\n\n`;

        if (watchlist.shows && watchlist.shows.length > 0) {
            content += `## TV Shows (${watchlist.shows.length})\n\n`;
            watchlist.shows.forEach((show: any) => {
                content += `- **${show.title}** (${show.year})\n`;
                if (show.status) content += `  - Status: ${show.status}\n`;
                if (show.rating) content += `  - Rating: ${show.rating}/10\n`;
                content += `\n`;
            });
        }

        if (watchlist.movies && watchlist.movies.length > 0) {
            content += `## Movies (${watchlist.movies.length})\n\n`;
            watchlist.movies.forEach((movie: any) => {
                content += `- **${movie.title}** (${movie.year})\n`;
                if (movie.rating) content += `  - Rating: ${movie.rating}/10\n`;
                content += `\n`;
            });
        }

        return content;
    }

    private formatCurrentlyWatchingForNote(watching: any): string {
        let content = `# Currently Watching\n\n`;
        content += `*Last updated: ${new Date().toLocaleString()}*\n\n`;

        if (watching.shows && watching.shows.length > 0) {
            watching.shows.forEach((show: any) => {
                content += `## ${show.title} (${show.year})\n\n`;
                if (show.last_watched_at) {
                    content += `- Last watched: ${new Date(show.last_watched_at).toLocaleDateString()}\n`;
                }
                if (show.next_to_watch) {
                    content += `- Next episode: S${show.next_to_watch.season}E${show.next_to_watch.episode}\n`;
                }
                content += `\n`;
            });
        } else {
            content += `No shows currently being watched.\n\n`;
        }

        return content;
    }

    private formatStatsForNote(stats: any): string {
        let content = `# Viewing Statistics\n\n`;
        content += `*Last updated: ${new Date().toLocaleString()}*\n\n`;

        if (stats.movies) {
            content += `## Movies\n`;
            content += `- Total watched: ${stats.movies.watched || 0}\n`;
            content += `- Total minutes: ${stats.movies.minutes_watched || 0}\n`;
            content += `- Average rating: ${stats.movies.rating || 'N/A'}\n\n`;
        }

        if (stats.shows) {
            content += `## TV Shows\n`;
            content += `- Episodes watched: ${stats.shows.episodes_watched || 0}\n`;
            content += `- Total minutes: ${stats.shows.minutes_watched || 0}\n`;
            content += `- Average rating: ${stats.shows.rating || 'N/A'}\n\n`;
        }

        return content;
    }

    private async createOrUpdateNote(title: string, content: string): Promise<void> {
        const fileName = `${title}.md`;
        const file = this.app.vault.getAbstractFileByPath(fileName);
        
        if (file) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(fileName, content);
        }
    }

    // Auto-sync functionality
    private startAutoSync(): void {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
        }

        this.syncIntervalId = setInterval(async () => {
            try {
                await this.syncWatchlistToNote();
                await this.syncCurrentlyWatching();
                console.log('Auto-sync completed');
            } catch (error) {
                console.error('Auto-sync failed:', error);
            }
        }, this.settings.syncInterval);
    }

    private stopAutoSync(): void {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }

    async disconnectFromSimkl(): Promise<void> {
        this.settings.accessToken = '';
        this.settings.refreshToken = '';
        this.settings.tokenExpiry = 0;
        await this.saveSettings();
        
        this.stopAutoSync();
        
        new Notice('Disconnected from Simkl successfully.');
    }

    private openSimklCommands(): void {
        // This would open a command palette or menu
        // For now, we'll just show available commands
        new Notice('Available commands: Authenticate, Sync Watchlist, Sync Currently Watching, Sync Stats');
    }

    onunload() {
        console.log('Unloading Simkl Integration Plugin');
        this.closeAuthServer();
        this.stopAutoSync();
    }
}

// Settings Tab
class SimklSettingTab extends PluginSettingTab {
    plugin: SimklPlugin;

    constructor(app: App, plugin: SimklPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Simkl Integration Settings' });

        // Authentication section
        containerEl.createEl('h3', { text: 'Authentication' });
        
        new Setting(containerEl)
            .setName('Client ID')
            .setDesc('Your Simkl application Client ID')
            .addText(text => text
                .setPlaceholder('Enter your Client ID')
                .setValue(this.plugin.settings.clientId)
                .onChange(async (value) => {
                    this.plugin.settings.clientId = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Client Secret')
            .setDesc('Your Simkl application Client Secret')
            .addText(text => text
                .setPlaceholder('Enter your Client Secret')
                .setValue(this.plugin.settings.clientSecret)
                .onChange(async (value) => {
                    this.plugin.settings.clientSecret = value;
                    await this.plugin.saveSettings();
                }));

        // Connection status
        const statusEl = containerEl.createEl('div');
        statusEl.createEl('strong', { text: 'Connection Status: ' });
        const status = this.plugin.isTokenValid() ? 'Connected' : 'Not Connected';
        const statusColor = this.plugin.isTokenValid() ? 'green' : 'red';
        statusEl.createEl('span', { text: status, attr: { style: `color: ${statusColor}` } });

        // Sync settings
        containerEl.createEl('h3', { text: 'Sync Settings' });

        new Setting(containerEl)
            .setName('Enable Auto-sync')
            .setDesc('Automatically sync your watchlist and currently watching shows')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSync)
                .onChange(async (value) => {
                    this.plugin.settings.autoSync = value;
                    await this.plugin.saveSettings();
                    
                    if (value && this.plugin.isTokenValid()) {
                        this.plugin.startAutoSync();
                    } else {
                        this.plugin.stopAutoSync();
                    }
                }));

        new Setting(containerEl)
            .setName('Sync Interval (minutes)')
            .setDesc('How often to sync data (minimum 5 minutes)')
            .addSlider(slider => slider
                .setLimits(5, 1440, 5)
                .setValue(this.plugin.settings.syncInterval / 60000)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.syncInterval = value * 60000;
                    await this.plugin.saveSettings();
                    
                    if (this.plugin.settings.autoSync && this.plugin.isTokenValid()) {
                        this.plugin.startAutoSync();
                    }
                }));

        // Instructions
        containerEl.createEl('h3', { text: 'Setup Instructions' });
        const instructionsEl = containerEl.createEl('div');
        instructionsEl.innerHTML = `
            <p>1. Go to <a href="https://simkl.com/settings/developer" target="_blank">Simkl Developer Settings</a></p>
            <p>2. Create a new application</p>
            <p>3. Set the redirect URI to: <code>http://localhost:8080/callback</code></p>
            <p>4. Copy the Client ID and Client Secret to the fields above</p>
            <p>5. Use the "Authenticate with Simkl" command to connect your account</p>
        `;
    }
}
