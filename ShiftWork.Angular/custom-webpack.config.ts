const webpack = require('webpack');
const dotenv = require('dotenv').config({ path: './.env' });

// Only these keys are exposed to the browser bundle. Everything else in .env
// (e.g. AWS_SECRET_ACCESS_KEY) must never be inlined into client-side JS.
// Add a key here only if it is safe to be public.
const PUBLIC_ENV_KEYS = [
  'API_URL',
  'MCP_URL',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

// Values from .env win; real environment variables (CI / Docker build args)
// are used as a fallback so builds work without a .env file.
const fileEnv: Record<string, string> = dotenv.parsed || {};
const publicEnv: Record<string, string> = {};
for (const key of PUBLIC_ENV_KEYS) {
  const value = fileEnv[key] ?? process.env[key];
  if (value !== undefined) {
    publicEnv[key] = value;
  }
}

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(publicEnv)
    })
  ]
};
