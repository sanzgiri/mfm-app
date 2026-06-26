# Meditations for Mortals - Netlify App

A 30-day meditation journey based on Oliver Burkeman's "Meditations for Mortals" with persistent progress tracking across devices.

## Features

- 30 daily meditations (5 weeks)
- Expanded meditation content with reflection questions and film examples
- Personal notes for each day (auto-saved, debounced)
- Progress tracking (mark days complete) with longest-streak counter
- "Resume where you left off" and an end-of-journey celebration
- Export your notes (Markdown) and a full backup (JSON); import to restore
- Offline support via a service worker (installable PWA)
- Cross-device sync via Netlify Functions + Netlify Blobs
- No external database required

## Project Structure

```
meditations-mortals/
├── public/
│   ├── index.html       # Main app interface
│   ├── app.js           # Frontend logic
│   ├── data.js          # Generated meditation content (npm run build)
│   ├── sw.js            # Service worker (offline support)
│   ├── manifest.json    # PWA manifest
│   └── style.css        # Styling
├── netlify/
│   └── functions/
│       ├── saveProgress.js   # Save user progress (Netlify Blobs)
│       ├── loadProgress.js   # Load user progress (Netlify Blobs)
│       └── clearProgress.js  # Clear user data (Netlify Blobs)
├── process_content.js   # Parses doc1.txt/doc2.txt -> public/data.js
└── netlify.toml         # Netlify configuration
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
- **Storage**: User data is stored in **Netlify Blobs** (a managed, persistent key/value store), keyed by an anonymous user ID. Data survives function cold starts and redeploys.
- **User ID**: Automatically generated UUID stored in browser localStorage
- **Offline**: A service worker caches the app shell and content, so the app works without a connection. Progress made offline syncs on reconnect.

## Data Persistence Note

This app uses **Netlify Blobs** for storage, which persists user data reliably across function invocations and deploys. Notes and progress are also cached in `localStorage` for instant load and offline use.

Note: the Blobs store requires the `SITE_ID` and a Netlify token to be available to the functions in some environments (see the `getStore(...)` calls). On Netlify these are typically injected automatically; for local `netlify dev` you may need to set `SITE_ID` and `NETLIFY_AUTH_TOKEN`.

Because a user is identified by a UUID in their browser, clearing browser storage will orphan that account. Use **Export notes** in the app to keep a backup, and **Import backup** to restore.

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

- Edit source content in `doc1.txt` / `doc2.txt`, then run `npm run build` to regenerate `public/data.js`
- Customize styles in `style.css`
- Modify functions in `netlify/functions/` for different storage backends
- When you change cached assets, bump `CACHE_VERSION` in `public/sw.js`

## License

Content based on "Meditations for Mortals" by Oliver Burkeman.
App code provided for personal/educational use.
