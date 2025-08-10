const { Plugin, Setting, Notice, PluginSettingTab, Modal } = require('obsidian');

class SimklAuthPlugin extends Plugin {
    async onload() {
        console.log('SIMKL Auth Plugin Loading...');
        
        await this.loadSettings();
        this.addSettingTab(new SimklAuthSettingTab(this.app, this));
        
        console.log('SIMKL Auth Plugin Loaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, {
            clientId: '',
            clientSecret: '',
            accessToken: ''
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async startPinAuthentication() {
        if (!this.settings.clientId) {
            new Notice('❌ Please enter your Client ID in settings first');
            return;
        }

        console.log('Starting PIN authentication...');
        console.log('Using Client ID:', this.settings.clientId);
        
        try {
            // Step 1: Request device code
            console.log('Step 1: Requesting device code...');
            
            // The correct endpoint is /oauth/pin with URL parameters
            const pinUrl = `https://api.simkl.com/oauth/pin?client_id=${encodeURIComponent(this.settings.clientId)}&redirect_uri=${encodeURIComponent('urn:ietf:wg:oauth:2.0:oob')}`;
            
            console.log('PIN request URL:', pinUrl);
            
            const deviceResponse = await fetch(pinUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('Device response status:', deviceResponse.status);
            console.log('Device response headers:', Object.fromEntries(deviceResponse.headers.entries()));

            const responseText = await deviceResponse.text();
            console.log('Raw response:', responseText);

            if (!deviceResponse.ok) {
                console.error('Device code request failed:', deviceResponse.status, responseText);
                throw new Error(`Device code request failed: HTTP ${deviceResponse.status} - ${responseText}`);
            }

            let deviceData;
            try {
                deviceData = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response JSON:', parseError);
                throw new Error(`Invalid response format: ${responseText}`);
            }

            console.log('✓ Device code received:', deviceData);

            if (!deviceData.user_code) {
                throw new Error('Invalid response: missing user_code');
            }

            // Step 2: Show PIN to user and start polling
            const modal = new PinDisplayModal(this.app, deviceData, this);
            modal.open();

            // Step 3: Start polling for tokens
            this.startPolling(deviceData);

        } catch (error) {
            console.error('PIN authentication failed:', error);
            new Notice(`❌ Authentication failed: ${error.message}`, 8000);
        }
    }

    async startPolling(deviceData) {
        const { user_code, interval = 5, expires_in = 900 } = deviceData;
        const maxAttempts = Math.floor(expires_in / interval);
        let attempts = 0;

        console.log(`Starting polling: interval=${interval}s, max_attempts=${maxAttempts}`);

        const poll = async () => {
            attempts++;
            console.log(`Polling attempt ${attempts}/${maxAttempts}...`);

            if (attempts > maxAttempts) {
                console.log('❌ Polling timeout reached');
                new Notice('❌ Authentication timeout. Please try again.', 8000);
                return;
            }

            try {
                // The correct polling endpoint with URL parameters
                const pollUrl = `https://api.simkl.com/oauth/pin/${encodeURIComponent(user_code)}?client_id=${encodeURIComponent(this.settings.clientId)}`;

                console.log('Polling URL:', pollUrl);

                const response = await fetch(pollUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                const responseText = await response.text();
                console.log('Polling response:', response.status, responseText);

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('Failed to parse polling response:', parseError);
                    throw new Error(`Invalid polling response: ${responseText}`);
                }

                console.log('Parsed polling response:', data);

                // Check for different response scenarios
                if (data.access_token) {
                    // Success! Store the token
                    console.log('✅ Access token received!');
                    this.settings.accessToken = data.access_token;
                    await this.saveSettings();
                    new Notice('✅ Successfully authenticated with SIMKL!', 5000);
                    
                    // Close any open modals
                    document.querySelectorAll('.modal-container').forEach(modal => {
                        if (modal.querySelector('.simkl-pin-modal')) {
                            modal.remove();
                        }
                    });
                    return;
                }

                // If 404 or result is null/empty, user hasn't entered code yet
                if (response.status === 404 || !data || Object.keys(data).length === 0) {
                    console.log('User has not entered code yet, continuing to poll...');
                    setTimeout(poll, interval * 1000);
                    return;
                }

                // If we get a different error
                if (data.error) {
                    if (data.error === 'authorization_pending') {
                        console.log('Authorization pending, continuing to poll...');
                        setTimeout(poll, interval * 1000);
                    } else if (data.error === 'expired_token') {
                        console.log('❌ Device code expired');
                        new Notice('❌ Authentication code expired. Please try again.', 8000);
                    } else {
                        console.error('Polling error:', data.error);
                        throw new Error(data.error);
                    }
                } else {
                    // Continue polling if no error and no token yet
                    setTimeout(poll, interval * 1000);
                }

            } catch (error) {
                console.error('Polling error:', error);
                // Don't show error notice for 404s during polling
                if (!error.message.includes('404')) {
                    new Notice(`❌ Authentication error: ${error.message}`, 8000);
                }
                // Continue polling on error
                setTimeout(poll, interval * 1000);
            }
        };

        // Start first poll after the interval
        setTimeout(poll, interval * 1000);
    }

    async testAccessToken() {
        if (!this.settings.accessToken) {
            new Notice('❌ No access token found. Please authenticate first.');
            return;
        }

        if (!this.settings.clientId) {
            new Notice('❌ No Client ID found. Please configure settings first.');
            return;
        }

        console.log('Testing access token...');
        
        try {
            // Test the token with user settings endpoint
            const response = await fetch('https://api.simkl.com/users/settings', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.accessToken}`,
                    'simkl-api-key': this.settings.clientId,
                    'Accept': 'application/json'
                }
            });

            const responseText = await response.text();
            console.log('Test response:', response.status, responseText);

            if (response.ok) {
                const userData = JSON.parse(responseText);
                console.log('✅ Token test successful:', userData);
                const username = userData.user?.name || 'Unknown User';
                new Notice(`✅ Token valid! Connected as: ${username}`, 5000);
            } else if (response.status === 401) {
                console.log('❌ Token expired or invalid');
                new Notice('❌ Access token expired or invalid. Please re-authenticate.', 8000);
                // Clear the invalid token
                this.settings.accessToken = '';
                await this.saveSettings();
            } else {
                console.error('Token test failed:', response.status, responseText);
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }

        } catch (error) {
            console.error('Token test error:', error);
            new Notice(`❌ Token test failed: ${error.message}`, 8000);
        }
    }

    async clearToken() {
        if (!this.settings.accessToken) {
            new Notice('No access token to clear.');
            return;
        }

        this.settings.accessToken = '';
        await this.saveSettings();
        new Notice('✅ Access token cleared.');
        console.log('Access token cleared');
    }
}

class PinDisplayModal extends Modal {
    constructor(app, deviceData, plugin) {
        super(app);
        this.deviceData = deviceData;
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('simkl-pin-modal');

        contentEl.createEl('h2', { 
            text: 'SIMKL Authentication',
            attr: { style: 'text-align: center; margin-bottom: 20px;' }
        });

        const instructionsEl = contentEl.createEl('div', {
            attr: { style: 'text-align: center; padding: 20px;' }
        });

        instructionsEl.createEl('h3', { 
            text: 'Follow these steps:',
            attr: { style: 'margin-bottom: 15px;' }
        });
        
        const stepsList = instructionsEl.createEl('ol', {
            attr: { style: 'text-align: left; max-width: 400px; margin: 0 auto 20px auto;' }
        });

        stepsList.createEl('li', { text: `Visit: ${this.deviceData.verification_url || 'https://simkl.com/pin'}` });
        stepsList.createEl('li', { text: 'Enter the code shown below' });
        stepsList.createEl('li', { text: 'Authorize the application' });
        stepsList.createEl('li', { text: 'This dialog will close automatically when complete' });

        // Large PIN code display
        const codeEl = instructionsEl.createEl('div', {
            text: this.deviceData.user_code,
            attr: { 
                style: 'font-size: 3em; font-weight: bold; color: var(--accent-color); margin: 30px 0; padding: 20px; border: 3px solid var(--accent-color); border-radius: 12px; font-family: monospace; letter-spacing: 5px;'
            }
        });

        // Button container
        const buttonContainer = instructionsEl.createEl('div', {
            attr: { style: 'margin-top: 20px;' }
        });

        const copyButton = buttonContainer.createEl('button', {
            text: '📋 Copy Code',
            attr: { style: 'margin: 5px 10px; padding: 10px 20px; font-size: 1em;' }
        });

        const openLinkButton = buttonContainer.createEl('button', {
            text: '🔗 Open SIMKL PIN Page',
            attr: { style: 'margin: 5px 10px; padding: 10px 20px; font-size: 1em;' }
        });

        const cancelButton = buttonContainer.createEl('button', {
            text: '❌ Cancel',
            attr: { style: 'margin: 5px 10px; padding: 10px 20px; font-size: 1em;' }
        });

        // Status message
        const statusEl = instructionsEl.createEl('div', {
            text: '⏳ Waiting for authorization...',
            attr: { style: 'margin-top: 20px; font-style: italic; color: var(--text-muted);' }
        });

        // Event handlers
        copyButton.onclick = () => {
            navigator.clipboard.writeText(this.deviceData.user_code);
            new Notice('📋 Code copied to clipboard!');
        };

        openLinkButton.onclick = () => {
            window.open(this.deviceData.verification_url || 'https://simkl.com/pin', '_blank');
        };

        cancelButton.onclick = () => {
            this.close();
            new Notice('Authentication cancelled.');
        };

        // Auto-close after expiration time
        const expirationTime = (this.deviceData.expires_in || 900) * 1000;
        setTimeout(() => {
            if (this.containerEl.isConnected) {
                this.close();
                new Notice('❌ Authentication code expired.');
            }
        }, expirationTime);

        // Show expiration countdown
        const expirationEl = instructionsEl.createEl('div', {
            attr: { style: 'margin-top: 15px; font-size: 0.9em; color: var(--text-muted);' }
        });

        let timeLeft = this.deviceData.expires_in || 900;
        const updateCountdown = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            expirationEl.textContent = `⏰ Code expires in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft > 0) {
                timeLeft--;
                setTimeout(updateCountdown, 1000);
            }
        };
        updateCountdown();
    }
}

class SimklAuthSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'SIMKL Authentication Settings' });

        // Instructions
        const instructionsEl = containerEl.createEl('div', { 
            cls: 'setting-item-description',
            attr: { style: 'margin-bottom: 20px; padding: 15px; background: var(--background-secondary); border-radius: 5px;' }
        });
        
        instructionsEl.innerHTML = `
            <h3>📋 Setup Instructions:</h3>
            <ol>
                <li>Go to <a href="https://simkl.com/settings/developer/" target="_blank">SIMKL Developer Settings</a></li>
                <li>Click <strong>"Create New App"</strong></li>
                <li>Fill in:
                    <ul>
                        <li><strong>Name:</strong> "Obsidian SIMKL Plugin" (or any name)</li>
                        <li><strong>Description:</strong> "Personal integration"</li>
                        <li><strong>Redirect URI:</strong> <code>urn:ietf:wg:oauth:2.0:oob</code></li>
                    </ul>
                </li>
                <li>Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> below</li>
                <li>Click <strong>"🔐 Start Authentication"</strong> button below</li>
            </ol>
        `;

        // Client ID setting
        new Setting(containerEl)
            .setName('🔑 Client ID')
            .setDesc('Your SIMKL application Client ID (required)')
            .addText(text => text
                .setPlaceholder('Enter your SIMKL Client ID...')
                .setValue(this.plugin.settings.clientId || '')
                .onChange(async (value) => {
                    this.plugin.settings.clientId = value.trim();
                    await this.plugin.saveSettings();
                    this.display(); // Refresh display
                }));

        // Client Secret setting
        new Setting(containerEl)
            .setName('🔐 Client Secret')
            .setDesc('Your SIMKL application Client Secret (optional, for enhanced features)')
            .addText(text => text
                .setPlaceholder('Enter your SIMKL Client Secret...')
                .setValue(this.plugin.settings.clientSecret || '')
                .onChange(async (value) => {
                    this.plugin.settings.clientSecret = value.trim();
                    await this.plugin.saveSettings();
                }));

        // Status display
        const statusEl = containerEl.createEl('div', { 
            cls: 'setting-item-description',
            attr: { style: 'margin: 20px 0; padding: 15px; border-radius: 5px;' }
        });

        let statusText = '';
        let statusColor = '';
        let statusBg = '';

        if (this.plugin.settings.accessToken) {
            statusText = '🎉 Status: ✅ Authenticated and ready to use!';
            statusColor = 'var(--text-success)';
            statusBg = 'var(--background-secondary)';
        } else if (this.plugin.settings.clientId) {
            statusText = '⏳ Status: Ready to authenticate (click button below)';
            statusColor = 'var(--text-muted)';
            statusBg = 'var(--background-secondary-alt)';
        } else {
            statusText = '❌ Status: Please enter Client ID first';
            statusColor = 'var(--text-error)';
            statusBg = 'var(--background-secondary-alt)';
        }

        statusEl.innerHTML = `<h4 style="color: ${statusColor};">${statusText}</h4>`;
        statusEl.style.background = statusBg;

        // Authentication Actions
        const actionsEl = containerEl.createEl('div', { 
            attr: { style: 'margin: 20px 0; padding: 15px; background: var(--background-secondary); border-radius: 5px;' }
        });
        
        actionsEl.createEl('h3', { text: '🎯 Authentication Actions' });

        // Start Authentication Button
        new Setting(actionsEl)
            .setName('🔐 Start Authentication')
            .setDesc(this.plugin.settings.clientId ? 
                'Begin the PIN authentication flow with SIMKL' : 
                'Enter Client ID first to enable authentication'
            )
            .addButton(button => button
                .setButtonText('🔐 Start Authentication')
                .setDisabled(!this.plugin.settings.clientId)
                .onClick(async () => {
                    button.setDisabled(true);
                    button.setButtonText('Starting...');
                    
                    try {
                        await this.plugin.startPinAuthentication();
                    } finally {
                        button.setDisabled(!this.plugin.settings.clientId);
                        button.setButtonText('🔐 Start Authentication');
                    }
                }));

        // Test Token Button
        if (this.plugin.settings.accessToken) {
            new Setting(actionsEl)
                .setName('🧪 Test Access Token')
                .setDesc('Verify that your access token is still valid')
                .addButton(button => button
                    .setButtonText('🧪 Test Token')
                    .onClick(async () => {
                        button.setDisabled(true);
                        button.setButtonText('Testing...');
                        
                        try {
                            await this.plugin.testAccessToken();
                        } finally {
                            button.setDisabled(false);
                            button.setButtonText('🧪 Test Token');
                            this.display(); // Refresh in case token was cleared
                        }
                    }));
        }

        // Clear Token Button
        if (this.plugin.settings.accessToken) {
            new Setting(actionsEl)
                .setName('🗑️ Clear Access Token')
                .setDesc('Remove stored access token (you will need to re-authenticate)')
                .addButton(button => button
                    .setButtonText('🗑️ Clear Token')
                    .setWarning()
                    .onClick(async () => {
                        await this.plugin.clearToken();
                        this.display(); // Refresh display
                    }));
        }

        // Debug Information
        if (this.plugin.settings.accessToken || this.plugin.settings.clientId) {
            const debugEl = containerEl.createEl('details', { 
                attr: { style: 'margin-top: 20px; padding: 10px; background: var(--background-secondary-alt); border-radius: 5px;' }
            });
            
            const summaryEl = debugEl.createEl('summary', { 
                text: '🔍 Debug Information',
                attr: { style: 'cursor: pointer; font-weight: bold;' }
            });

            const debugContent = debugEl.createEl('div', { 
                attr: { style: 'margin-top: 10px; font-family: monospace; font-size: 0.9em;' }
            });

            let debugInfo = '';
            if (this.plugin.settings.clientId) {
                debugInfo += `Client ID: ${this.plugin.settings.clientId.substring(0, 8)}...\n`;
            }
            if (this.plugin.settings.clientSecret) {
                debugInfo += `Client Secret: ${this.plugin.settings.clientSecret.substring(0, 8)}...\n`;
            }
            if (this.plugin.settings.accessToken) {
                debugInfo += `Access Token: ${this.plugin.settings.accessToken.substring(0, 12)}...\n`;
            }

            debugContent.textContent = debugInfo || 'No configuration data';
        }
    }
}

module.exports = SimklAuthPlugin;