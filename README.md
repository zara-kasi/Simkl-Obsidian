# Simkl-Obsidian
Simkl Integration for Obsidian.md

# Simkl Obsidian Plugin - Complete User Guide

## Table of Contents
1. [Installation](#installation)
2. [Getting Your API Key](#getting-your-api-key)
3. [Plugin Configuration](#plugin-configuration)
4. [Basic Usage](#basic-usage)
5. [Code Block Examples](#code-block-examples)
6. [Inline Link Examples](#inline-link-examples)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)
9. [Tips and Best Practices](#tips-and-best-practices)

---

## Installation

### Step 1: Download the Plugin Files
You need three files:
- `main.js` - The main plugin code
- `manifest.json` - Plugin metadata
- `styles.css` - Styling for the plugin

### Step 2: Install on Android
1. Open your file manager app
2. Navigate to your Obsidian vault folder
3. Go to `.obsidian/plugins/` (create this folder if it doesn't exist)
4. Create a new folder called `simkl-integration`
5. Copy all three files into this folder

**Full path should be:**
```
[Your Vault]/.obsidian/plugins/simkl-integration/
├── main.js
├── manifest.json
└── styles.css
```

### Step 3: Enable the Plugin
1. Open Obsidian
2. Go to Settings (gear icon)
3. Click on "Community plugins"
4. Turn off "Safe mode" if it's on
5. Click "Reload" to refresh the plugin list
6. Find "Simkl Integration" in the list
7. Toggle it on

---

## Getting Your API Key

### Step 1: Create a Simkl Developer Account
1. Go to [https://simkl.com/settings/developer](https://simkl.com/settings/developer)
2. Log in to your Simkl account
3. Click "Create New App"

### Step 2: Configure Your App
Fill in the following details:
- **App Name**: `Obsidian Integration` (or any name you prefer)
- **App Description**: `Personal use for Obsidian notes`
- **Website**: Leave blank or use your personal website
- **Redirect URI**: `http://localhost` (required but not used)

### Step 3: Get Your Client ID
1. After creating the app, you'll see your **Client ID**
2. Copy this ID - you'll need it for the plugin settings
3. **Keep this ID private** - don't share it publicly

---

## Plugin Configuration

### Step 1: Open Plugin Settings
1. Go to Obsidian Settings
2. Click on "Community plugins"
3. Find "Simkl Integration" and click the settings icon (gear)

### Step 2: Configure Settings
**Required Settings:**
- **Client ID**: Paste your Simkl API Client ID here

**Optional Settings:**
- **Default Layout**: Choose between Card or Table layout
- **Show Cover Images**: Toggle poster/cover images on/off
- **Show Ratings**: Toggle user ratings display
- **Show Progress**: Toggle progress information
- **Show Genres**: Toggle genre tags

### Step 3: Save Settings
Click outside the settings or close the settings tab to save automatically.

---

## Basic Usage

The plugin supports two main ways to display Simkl data:

### 1. Code Blocks
Use fenced code blocks with `simkl` as the language:

```simkl
username: your-simkl-username
mediaType: tv
listType: watching
```

### 2. Inline Links
Use special `simkl:` links that get automatically converted:

```markdown
Check out my [currently watching](simkl:username/tv/watching) shows!
```

---

## Code Block Examples

### Basic TV Shows List
```simkl
username: your-username
mediaType: tv
listType: watching
```

### Anime with Card Layout
```simkl
username: your-username
mediaType: anime
listType: completed
layout: card
```

### Movies in Table Format
```simkl
username: your-username
mediaType: movies
listType: plantowatch
layout: table
```

### User Statistics
```simkl
username: your-username
type: stats
```

### All Available Parameters
```simkl
username: your-username
mediaType: tv
listType: watching
layout: card
```

**Parameter Options:**

**mediaType:**
- `tv` - TV Shows
- `anime` - Anime
- `movies` - Movies

**listType:**
- `watching` or `current` - Currently watching
- `completed` - Completed shows
- `plantowatch` or `planning` - Plan to watch
- `hold` or `paused` - On hold
- `dropped` - Dropped

**layout:**
- `card` - Card layout with images
- `table` - Table layout

**type:**
- `stats` - User statistics (ignores other parameters)

---

## Inline Link Examples

### Basic Inline Links
```markdown
My [currently watching](simkl:username/tv/watching) TV shows
My [completed anime](simkl:username/anime/completed) list
Movies I [plan to watch](simkl:username/movies/plantowatch)
```

### Statistics Link
```markdown
Check out my [Simkl stats](simkl:username/stats)
```

### Multiple Links in One Line
```markdown
Status: [Watching](simkl:username/tv/watching) | [Completed](simkl:username/tv/completed) | [Planning](simkl:username/tv/plantowatch)
```

---

## Advanced Features

### Custom Layouts in Different Notes

**For Reviews (Table Layout):**
```simkl
username: your-username
mediaType: tv
listType: completed
layout: table
```

**For Recommendations (Card Layout):**
```simkl
username: your-username
mediaType: anime
listType: watching
layout: card
```

### Combining with Other Obsidian Features

**In Daily Notes:**
```markdown
# Today's Entertainment

## Currently Watching
```simkl
username: your-username
mediaType: tv
listType: watching
```

## My Stats
```simkl
username: your-username
type: stats
```
```

**In MOCs (Maps of Content):**
```markdown
# Entertainment Dashboard

- [Currently Watching TV](simkl:username/tv/watching)
- [Watching Anime](simkl:username/anime/watching)
- [Movies to Watch](simkl:username/movies/plantowatch)
- [My Statistics](simkl:username/stats)
```

### Using with Templates
Create a template note with:
```markdown
# {{title}} Review

## My Progress
```simkl
username: your-username
mediaType: tv
listType: watching
```

## Completed This Month
```simkl
username: your-username
mediaType: tv
listType: completed
```
```

---

## Troubleshooting

### Common Issues

#### 1. "Client ID not configured" Error
**Problem**: Plugin shows error about missing Client ID
**Solution**: 
- Go to plugin settings
- Enter your Simkl API Client ID
- Make sure there are no extra spaces

#### 2. "Username is required" Error
**Problem**: Code block doesn't specify username
**Solution**: 
- Always include `username: your-username` in code blocks
- Replace `your-username` with your actual Simkl username

#### 3. "Simkl API Error: 401" 
**Problem**: Authentication failed
**Solution**: 
- Double-check your Client ID in settings
- Make sure you copied the entire Client ID
- Try regenerating your Client ID on Simkl

#### 4. "Simkl API Error: 404"
**Problem**: User not found
**Solution**: 
- Verify the username is correct
- Check if the user's profile is public
- Make sure the username doesn't have special characters

#### 5. Empty Results
**Problem**: Code block shows but no content
**Solution**: 
- Check if the user has items in that list
- Try a different listType (e.g., `completed` instead of `watching`)
- Verify the mediaType is correct

#### 6. Images Not Loading
**Problem**: Cover images don't appear
**Solution**: 
- Check if "Show Cover Images" is enabled in settings
- Some entries might not have cover images
- Try refreshing the page

### API Rate Limits
- The plugin caches results for 5 minutes
- If you're making many requests, wait a few minutes between updates
- Clear cache by restarting Obsidian if needed

---

## Tips and Best Practices

### 1. Organize Your Entertainment Notes
```markdown
# Entertainment
## Currently Watching
- [TV Shows](simkl:username/tv/watching)
- [Anime](simkl:username/anime/watching)

## Completed
- [TV Shows](simkl:username/tv/completed)
- [Anime](simkl:username/anime/completed)

## Statistics
- [Overall Stats](simkl:username/stats)
```

### 2. Use Different Layouts for Different Purposes
- **Card Layout**: Better for browsing and visual appeal
- **Table Layout**: Better for quick scanning and data comparison

### 3. Create Entertainment Templates
Save commonly used code blocks as templates:

**Template: Current Progress**
```simkl
username: your-username
mediaType: tv
listType: watching
layout: card
```

### 4. Combine with Other Plugins
- Use with **Dataview** to create dynamic queries
- Combine with **Templater** for automated note creation
- Use with **Calendar** plugin for tracking viewing schedules

### 5. Privacy Considerations
- Your Client ID is private - don't share it
- Only public Simkl profiles will work
- Consider using a dedicated Simkl account for public sharing

### 6. Performance Tips
- Use caching effectively - avoid refreshing too frequently
- For large lists, consider using table layout for better performance
- Close unused notes with Simkl blocks to save resources

### 7. Backup Your Settings
- Export your plugin settings regularly
- Keep a backup of your Client ID
- Document your common code block configurations

---

## Example Use Cases

### 1. Weekly Review Template
```markdown
# Week of {{date}}

## What I Watched
```simkl
username: your-username
mediaType: tv
listType: watching
layout: card
```

## Completed This Week
```simkl
username: your-username
mediaType: tv
listType: completed
layout: table
```
```

### 2. Recommendation Note
```markdown
# Recommendations from Friends

## Currently Watching
Check out what I'm watching: [My List](simkl:username/tv/watching)

## My Stats
```simkl
username: your-username
type: stats
```
```

### 3. Entertainment Dashboard
```markdown
# 🎬 Entertainment Dashboard

## Quick Links
- [Watching TV](simkl:username/tv/watching)
- [Watching Anime](simkl:username/anime/watching)
- [Movies to Watch](simkl:username/movies/plantowatch)
- [My Statistics](simkl:username/stats)

## Current Progress
```simkl
username: your-username
mediaType: tv
listType: watching
layout: card
```
```

---

## Conclusion

The Simkl Obsidian plugin brings your entertainment tracking directly into your notes. With code blocks and inline links, you can create dynamic, always-updated entertainment dashboards, reviews, and tracking systems.

Remember to:
- Keep your Client ID secure
- Use caching efficiently
- Experiment with different layouts
- Create templates for common use cases

Happy note-taking and entertainment tracking! 🎬📺
