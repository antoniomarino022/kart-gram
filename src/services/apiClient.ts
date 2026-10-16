import axios from "axios";

/**
 * Istanza centralizzata di Axios per le chiamate verso le API del backend
 */
export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});
