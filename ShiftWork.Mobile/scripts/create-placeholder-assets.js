const fs = require('fs');
const path = require('path');

// This script creates minimal SVG placeholders for development
// Replace these with actual assets before production

const assetsDir = path.join(__dirname, 'assets');

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Simple SVG icon (1024x1024)
const iconSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#4A90E2"/>
  <text x="512" y="512" font-family="Arial" font-size="120" fill="white" text-anchor="middle" dominant-baseline="middle">SW</text>
  <circle cx="512" cy="700" r="80" fill="white" opacity="0.8"/>
  <rect x="482" y="620" width="60" height="100" fill="white" opacity="0.8"/>
</svg>`;

// Simple splash screen (1284x2778)
const splashSvg = `<svg width="1284" height="2778" xmlns="http://www.w3.org/2000/svg">
  <rect width="1284" height="2778" fill="#4A90E2"/>
  <text x="642" y="1200" font-family="Arial" font-size="120" fill="white" text-anchor="middle" font-weight="bold">ShiftWork</text>
  <text x="642" y="1350" font-family="Arial" font-size="60" fill="white" text-anchor="middle" opacity="0.8">Mobile</text>
  <circle cx="642" cy="1550" r="100" fill="white" opacity="0.8"/>
  <rect x="592" y="1450" width="100" height="150" fill="white" opacity="0.8"/>
</svg>`;

// Simple favicon (48x48)
const faviconSvg = `<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" fill="#4A90E2"/>
  <text x="24" y="24" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">SW</text>
</svg>`;

// Write SVG files (browsers can display SVG as images)
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSvg);
fs.writeFileSync(path.join(assetsDir, 'splash.svg'), splashSvg);
fs.writeFileSync(path.join(assetsDir, 'favicon.svg'), faviconSvg);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.svg'), iconSvg); // Same as icon for now

console.log('✅ Placeholder SVG assets created in ./assets/');
console.log('⚠️  Note: Expo requires PNG files. Install sharp to convert or create PNG files manually.');
console.log('');
console.log('To create proper PNG assets:');
console.log('1. Use an online converter: https://svgtopng.com/');
console.log('2. Or install sharp: npm install --save-dev sharp');
console.log('3. Or use design tools: Figma, Canva, etc.');
console.log('');
console.log('Required PNG sizes:');
console.log('- icon.png: 1024x1024');
console.log('- adaptive-icon.png: 1024x1024');
console.log('- splash.png: 1284x2778');
console.log('- favicon.png: 48x48');
