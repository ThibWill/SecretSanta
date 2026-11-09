// Tous les appels à l'API passent par ici.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let onUnauthorized = null;

/** Fonction appelée sur toute réponse 401 (hors tentative de connexion). */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Impossible de joindre le serveur. Vérifie ta connexion.');
  }

  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Réponse non JSON (proxy, serveur arrêté…)
  }

  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') onUnauthorized?.();
    throw new ApiError(
      res.status,
      data?.error?.code ?? 'INTERNAL_ERROR',
      data?.error?.message ?? 'Une erreur inattendue est survenue.',
    );
  }
  return data;
}

export const api = {
  userNames: () => request('GET', '/users/names'),
  login: (name, password) => request('POST', '/auth/login', { name, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),
  getDraw: () => request('GET', '/draw'),
  draw: () => request('POST', '/draw'),
  getMyLetter: () => request('GET', '/letters/me'),
  saveMyLetter: (content) => request('PUT', '/letters/me', { content }),
  getLetters: () => request('GET', '/letters'),
  adminStatus: () => request('GET', '/admin/status'),
  adminReset: (resetLetters) => request('POST', '/admin/reset', { resetLetters }),
};
