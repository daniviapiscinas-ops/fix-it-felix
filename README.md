# 🔨 Fix-It Felix Jr.

A pixel-art arcade game inspired by the classic Fix-It Felix Jr. from *Wreck-It Ralph*.

![Game Screenshot](screenshots/screen1.png)

## 🎮 Gameplay

- **Félix** repairs broken windows on an apartment building
- **Ralph** throws bricks from the roof — dodge them!
- Repair all windows to advance to the next level
- Each level is faster and harder

## 🕹️ Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Move left/right | ← → | D-Pad |
| Move up/down floor | ↑ ↓ | D-Pad |
| Repair window | Space | 🔨 Button |

## 📱 Play Store / App Publishing

This game is a **Progressive Web App (PWA)** — it can be published to the Google Play Store using [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or [PWABuilder](https://www.pwabuilder.com).

### Quick Publish with PWABuilder

1. Host this project on GitHub Pages (see below)
2. Go to [pwabuilder.com](https://www.pwabuilder.com)
3. Paste your GitHub Pages URL
4. Click **Build** → choose **Android**
5. Download the `.aab` file
6. Upload to [Google Play Console](https://play.google.com/console)

### GitHub Pages Hosting

```bash
# In your GitHub repo settings:
Settings → Pages → Source: main branch / root
```

Your game will be live at `https://yourusername.github.io/fix-it-felix/`

## 🚀 Local Development

No build step needed — pure HTML5 + JavaScript.

```bash
# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`

## 📁 Project Structure

```
fix-it-felix/
├── index.html       # Game shell + HUD + touch controls
├── game.js          # Game engine + pixel-art renderer
├── manifest.json    # PWA manifest (icons, display mode)
├── sw.js            # Service Worker (offline support)
├── icons/           # App icons (48px → 512px)
│   └── icon-*.png
└── screenshots/
    └── screen1.png  # Play Store screenshot
```

## 🎨 Technical Details

- **Renderer**: HTML5 Canvas 2D, pixel-art sprites drawn procedurally
- **No dependencies**: Zero external libraries
- **Mobile-first**: Responsive layout, touch D-pad + repair button
- **Offline**: Service Worker caches all assets after first load
- **Performance**: 60fps requestAnimationFrame loop

## 📦 Required Icons

Generate icons from `icons/icon-512.png` using:
- [PWABuilder Image Generator](https://www.pwabuilder.com/imageGenerator)
- Or: `npx pwa-asset-generator icon-512.png ./icons`

Sizes needed: 48, 72, 96, 144, 192, 512 px

## 📄 License

MIT — free to use and modify.

---

*Inspired by Fix-It Felix Jr. from Walt Disney Animation Studios' Wreck-It Ralph (2012). This is a fan game for educational purposes.*
