/**
 * Adaptador personalizado para persistir la sesión de Supabase
 * dentro de un Chrome Extension Service Worker donde localStorage no existe.
 */
export const ChromeStorageAdapter = {
  getItem: async (key) => {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key] || null;
    } catch (error) {
      console.error('Error leyendo de chrome.storage:', error);
      return null;
    }
  },

  setItem: async (key, value) => {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('Error guardando en chrome.storage:', error);
    }
  },

  removeItem: async (key) => {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error('Error borrando de chrome.storage:', error);
    }
  }
};