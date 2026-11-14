import { API_BASE_URL } from '../config';

// The same headers AuthContext's getAuthHeaders builds, read from the saved session
// so query functions can run outside React.
export const authHeaders = () => {
  let token = null;
  try {
    token = localStorage.getItem('token');
  } catch {
    /* storage unavailable */
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

// GET an API path and return its JSON; throws `errorMessage` on a non-2xx answer
export const apiGet = async (path, errorMessage = 'Request failed') => {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(errorMessage);
  return res.json();
};
