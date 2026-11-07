// Set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:5000) to use a local server instead
const DEFAULT_API_URL = 'https://productivity-planner-moyy.onrender.com';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

// The free Render instance can take ~50s to wake up after being idle
export const REQUEST_TIMEOUT_MS = 70_000;
