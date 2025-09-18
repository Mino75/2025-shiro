# 🏰 Shiro 城

## 📋 Table of Contents
- [📖 About](#-about)
- [🚀 Getting Started](#-getting-started)
- [🔨 How to Build / How to Run](#-how-to-build--how-to-run)
- [🏗️ Project Structure](#️-project-structure)
- [🎯 Features](#-features)
- [📚 Dependencies](#-dependencies)
- [🐳 Docker Deployment](#-docker-deployment)
- [💡 Usage](#-usage)
- [⚙️ Configuration](#️-configuration)
- [🎮 Game Mechanics](#-game-mechanics)
- [📱 Service Worker & Caching](#-service-worker--caching)
- [📄 License](#-license)

## 📖 About
Shiro 城 is an offline-first real-time strategy tower defense game built as a Progressive Web App. Players command armies of diverse units (from dinosaurs to mythical creatures) in epic castle-vs-castle battles. The game features adaptive caching strategies for reliable performance even on slow networks, making it playable anywhere without internet connectivity.

## 🚀 Getting Started

### Prerequisites
- Node.js (v20 or higher)
- npm package manager
- Modern web browser with Service Worker support

### 📦 Installation
```bash
git clone <repository-url>
cd shiro
npm install
```

## 🔨 How to Build / How to Run

### Development Mode
```bash
# Start the development server
node server.js
```
The application will be available at `http://localhost:3000`

### Production Mode
```bash
# Set environment variables (optional)
export CACHE_VERSION=v3
export APP_NAME=shiro
export PORT=3000

# Start the server
node server.js
```

### Environment Variables
- `CACHE_VERSION`: Service worker cache version (default: v2)
- `APP_NAME`: Application name for caching (default: shiro)
- `PORT`: Server port (default: 3000)
- `SW_FIRST_TIME_TIMEOUT`: Network timeout for new users (default: 20000ms)
- `SW_RETURNING_USER_TIMEOUT`: Network timeout for returning users (default: 5000ms)

## 🏗️ Project Structure
```
shiro/
├── index.html              # Main game interface
├── main.js                 # Core game logic and mechanics
├── styles.js               # Complete CSS styling system
├── server.js               # Express server with cache injection
├── service-worker.js       # Advanced PWA caching strategy
├── manifest.json           # PWA manifest configuration
├── package.json            # Dependencies and scripts
├── dockerfile              # Docker containerization
├── .gitignore              # Git ignore patterns
├── README.md               # Project documentation
├── LICENSE                 # MIT license
└── .github/workflows/      # CI/CD automation
    └── main.yaml           # Docker build and push workflow
```

## 🎯 Features

### 🎮 Gameplay Features
- **Real-time Strategy**: Fast-paced castle defense with strategic unit deployment
- **25+ Unique Units**: Diverse roster from dinosaurs (🦕🦖) to mythical creatures (🐉👻)
- **Dual-Lane Combat**: Ground and air unit layers with different tactical considerations
- **Turn-based Recruitment**: Strategic unit selection every 8 seconds
- **Dynamic AI Opponent**: Intelligent enemy that adapts to player strategies
- **Progressive Difficulty**: Balanced unit costs and abilities for strategic depth

### 🏰 Combat System
- **Melee & Ranged Units**: Close combat fighters and long-range attackers
- **Projectile Physics**: Realistic projectile movement and collision detection
- **Area of Effect**: Explosive units with blast radius damage
- **Jump Mechanics**: Special movement patterns for certain unit types
- **Castle Siege**: Direct castle assault when units reach enemy territory

### 📱 Technical Features
- **Offline-First Design**: Complete functionality without internet connection
- **Adaptive Caching**: Smart network strategies for different connection qualities
- **Responsive Design**: Optimized for desktop and mobile (landscape mode)
- **Progressive Web App**: Installable with native app-like experience
- **Performance Optimized**: 60fps smooth animations and responsive controls

## 📚 Dependencies

### Core Dependencies
- **Express**: `^4.18.2` - Web server framework for static file serving

### Built-in Technologies
- **Vanilla JavaScript**: Pure JS without external game frameworks
- **CSS3 Animations**: Hardware-accelerated animations and transitions
- **Service Workers**: Advanced caching and offline functionality
- **Web APIs**: FileSystem, Canvas, and modern browser features

### No External Game Libraries
Shiro is built entirely with native web technologies, ensuring:
- Minimal bundle size
- Fast loading times
- No dependency vulnerabilities
- Maximum browser compatibility

## 🐳 Docker Deployment

### Build Docker Image
```bash
docker build -t shiro:latest .
```

### Run Container
```bash
# Basic run
docker run -p 3000:3000 shiro:latest

# With custom environment
docker run -p 3000:3000 -e CACHE_VERSION=v3 -e PORT=3000 shiro:latest
```

### Docker Configuration
- **Base Image**: Node.js 23 Alpine (lightweight)
- **Working Directory**: `/app`
- **Exposed Port**: 3000
- **Multi-stage Build**: Optimized for production deployment

## 💡 Usage

### 🎮 Game Controls
- **Unit Selection**: Choose from 2 presented units each turn
- **Strategic Timing**: 8-second decision window per turn
- **Auto-Pick**: Automatic selection if no choice made
- **Slot Management**: Replace existing units when at maximum capacity

### 🏆 Victory Conditions
- **Castle Destruction**: Reduce enemy castle HP to zero
- **Unit Breach**: Units reaching enemy castle deal direct damage
- **Strategic Defense**: Balance offensive pushes with defensive formations

### 📱 Mobile Experience
- **Landscape Mode**: Optimized for horizontal screen orientation
- **Touch Controls**: Responsive button interactions
- **Portrait Lock**: Automatic rotation prompt for mobile users
- **Offline Play**: Full functionality without network connection

## ⚙️ Configuration

### Game Balance Tuning
The `CONFIG` object in `main.js` allows fine-tuning of game mechanics:

```javascript
const CONFIG = {
  GLOBAL_SPEED: 0.2,           // Overall game speed multiplier
  TURN_MS: 8000,               // Turn duration in milliseconds
  CASTLE_HP_BASE: 18,          // Starting castle health
  MAX_ACTIVE_TYPES: 6,         // Maximum unit types per player
  // ... extensive configuration options
};
```

### Visual Customization
- **Dynamic Castle Sizing**: Responsive to screen width
- **Scenery Generation**: Procedural clouds, trees, and terrain
- **Color Themes**: CSS custom properties for easy theming
- **Animation Speeds**: Configurable through global speed multiplier

## 🎮 Game Mechanics

### Unit Categories
1. **Tanks**: High HP, low damage (🦕 Sauropod, 🐦‍🔥 Phoenix)
2. **Rushers**: Fast, light units (🏇 Cavalry, 🦅 Eagle)
3. **Ranged**: Long-distance attackers (🧚 Fairy, 🦌 Stag)
4. **Jumpers**: Special movement patterns (🦘 Kangaroo, 🦗 Cricket)
5. **Blasters**: Area-of-effect damage (🦋 Butterfly, 🐉 Dragon)
6. **Specialists**: Unique abilities (👻 Ghost, 🐧 Penguin)

### Combat Mechanics
- **Layer System**: Ground and air units with targeting rules
- **Range Calculation**: Distance-based engagement zones
- **Damage Types**: Direct, projectile, and area-of-effect
- **Movement AI**: Units advance until enemies are in range
- **Castle Collision**: Direct damage when units reach enemy castle

### Production System
- **Continuous Spawning**: Active units spawn at regular intervals
- **Strategic Choices**: Turn-based unit type selection
- **Resource Management**: Production cooldowns balance unit strength
- **Slot Replacement**: Strategic decision to replace existing units

## 📱 Service Worker & Caching

### Adaptive Network Strategy
- **First-time Users**: Extended timeout (20s) for complete download
- **Returning Users**: Quick timeout (5s) with instant cache fallback
- **Offline Support**: Full gameplay without network connection
- **Version Management**: Automatic cache updates with version control

### Cache Features
- **Atomic Updates**: All files cached together or none at all
- **Background Sync**: Non-blocking updates when possible
- **Cache Rescue**: Automatic recovery from cache corruption
- **Memory Optimization**: Efficient storage and cleanup

### Network Resilience
- **Slow Connection Handling**: Adaptive timeouts for poor networks
- **Connection Drops**: Graceful fallback to cached versions
- **Partial Download Protection**: No mixed old/new file versions
- **Reliability Priority**: Consistent experience over speed

## 📄 License
MIT License

Copyright (c) 2025 Mino

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
