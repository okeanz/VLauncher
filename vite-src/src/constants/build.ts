/**
 * The server menu is for the admin: players always play on the main server.
 * It shows in `vite dev` and in builds made with VITE_SERVER_PICKER=1.
 */
export const serverPicker = import.meta.env.DEV || import.meta.env.VITE_SERVER_PICKER === '1';
