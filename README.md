# Meditations for Mortals - Netlify App

A four-week meditation journey based on Oliver Burkeman's "Meditations for Mortals" with persistent progress tracking across devices.

## Features

- 28 daily meditations (4 weeks)
- Expanded meditation content with reflection questions
- Personal notes for each day
- Progress tracking (mark days complete)
- Cross-device sync via Netlify Functions
- No external database required

## Project Structure

```
meditations-mortals/
├── public/
│   ├── index.html       # Main app interface
│   ├── app.js          # Frontend logic
│   └── style.css       # Styling
├── netlify/
│   └── functions/
│       ├── saveProgress.js   # Save user progress
│       ├── loadProgress.js   # Load user progress
│       └── clearProgress.js  # Clear user data
└── netlify.toml        # Netlify configuration
```

## Deploy to Netlify

### Option 1: Deploy via GitHub

1. Push this folder to a GitHub repository
2. Go to [Netlify](https://netlify.com) and sign in
3. Click "New site from Git"
4. Select your repository
5. Netlify will auto-detect settings from `netlify.toml`
6. Click "Deploy"

### Option 2: Manual Deploy

1. Go to [Netlify](https://netlify.com) and sign in
2. Drag and drop the entire `meditations-mortals` folder onto Netlify
3. Wait for deployment to complete

## How It Works

- **Frontend**: Static HTML/CSS/JS served from `public/` folder
- **Backend**: Netlify Functions (serverless) handle data persistence
- **Storage**: User data stored as JSON files in `/tmp` (ephemeral but persists across function warm runs)
- **User ID**: Automatically generated UUID stored in browser localStorage

## Data Persistence Note

This app uses Netlify Functions with `/tmp` storage, which:
- Works great for personal use and small groups
- Data persists as long as the Lambda function stays "warm" (typically hours to days)
- For production apps with many users, consider upgrading to a database (FaunaDB, Supabase, etc.)

## Local Development

To test locally:

1. Install Netlify CLI: `npm install -g netlify-cli`
2. Run: `netlify dev`
3. Open: `http://localhost:8888`

## Usage

1. Visit your deployed site
2. Browse the 4-week calendar
3. Click any day to read the meditation
4. Write personal reflections in the notes area
5. Mark days as complete
6. Progress automatically saves and syncs across devices

## Customization

- Edit meditation content in `app.js` (meditationData object)
- Customize styles in `style.css`
- Modify functions in `netlify/functions/` for different storage backends

## License

Content based on "Meditations for Mortals" by Oliver Burkeman.
App code provided for personal/educational use.
