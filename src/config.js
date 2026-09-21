// Central API configuration for SafeTrack
// Using http://localhost:5000 with 'adb reverse tcp:5000 tcp:5000'.
// This communicates directly over USB loopback, bypassing Windows Firewall blocks.

export const API_BASE_URL = 'http://localhost:5000';
export const INCIDENTS_API_URL = `${API_BASE_URL}/api/incidents`;
export const MESSAGES_API_URL = `${API_BASE_URL}/api/messages`;
