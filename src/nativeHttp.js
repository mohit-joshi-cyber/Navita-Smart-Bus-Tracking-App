// src/nativeHttp.js
// Exports a fetch-like function `nativeFetch(url, options)`
// Uses Axios for HTTP requests with consistent behavior across platforms

import axios from 'axios';

export async function nativeFetch(url, options = {}) {
  // Normalize options
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  const body = options.body;

  try {
    // Configure axios request
    const config = {
      url,
      method,
      headers,
      responseType: 'json',
      validateStatus: () => true, // Don't throw on HTTP error status
    };

    // Add data/body if provided
    if (body !== undefined) {
      config.data = body;
    }

    // Make the request with axios
    const response = await axios(config);

    // Create a fetch-like response object
    const fetchLikeResponse = {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      url: response.config.url,
      json: async () => response.data,
      text: async () => {
        if (typeof response.data === 'string') {
          return response.data;
        }
        return JSON.stringify(response.data);
      },
      blob: async () => {
        if (response.data instanceof Blob) {
          return response.data;
        }
        return new Blob([JSON.stringify(response.data)], {
          type: response.headers['content-type'] || 'application/json',
        });
      },
      clone: () => {
        // Simple clone implementation
        return { ...fetchLikeResponse };
      },
    };

    return fetchLikeResponse;
  } catch (error) {
    // Handle network errors or other exceptions
    console.error('HTTP request failed:', error);
    
    // Return a error response similar to fetch
    return {
      ok: false,
      status: 0,
      statusText: error.message || 'Network Error',
      headers: {},
      json: async () => ({ error: error.message }),
      text: async () => error.message,
      blob: async () => new Blob([error.message]),
      clone: () => this,
    };
  }
}

export default nativeFetch;