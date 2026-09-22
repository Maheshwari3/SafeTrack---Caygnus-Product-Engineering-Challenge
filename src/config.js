// Central API configuration for SafeTrack
// __DEV__ is automatically true during development and false in Release APK builds.

// 1. DEVELOPMENT URL (Used when running in debug mode via Metro / USB)
const DEV_API_URL = 'http://localhost:5000';

// 2. RELEASE / PRODUCTION URL
// On real devices / Release APKs, "localhost" points to the phone itself and will NOT connect to your PC.
// Choose one of the following for your Release APK:
//
// Option A (Recommended for Real Release): Deployed Cloud Backend (e.g., Render, Railway, AWS)
// const PROD_API_URL = 'https://safetrack-api.onrender.com';
//
// Option B (Quickest for Testing Release APK on phone without deploying): Free HTTPS tunnel (ngrok / localtunnel)
// Run in your backend terminal: npx localtunnel --port 5000
// Then paste the URL here:
// const PROD_API_URL = 'https://your-tunnel-name.loca.lt';
//
// Option C (Local Wi-Fi Testing): Your PC's Wi-Fi IP address (Phone and PC must be on the same Wi-Fi)
// Check with 'ipconfig' in terminal. Current PC IP: 10.102.115.9
const PROD_API_URL = 'http://10.102.115.9:5000';

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const INCIDENTS_API_URL = `${API_BASE_URL}/api/incidents`;
export const MESSAGES_API_URL = `${API_BASE_URL}/api/messages`;

