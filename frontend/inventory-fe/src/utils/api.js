import axios from "axios";

const rawApiBaseUrl =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_BASE_API_URL ||
  "/api";

const apiBaseUrl = rawApiBaseUrl.replace(/\/auth\/?$/, "").replace(/\/$/, "");

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  // withCredentials: true,
  timeout: 15000, // 10 seconds timeout
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err.response?.data?.message || err.message || "Something went wrong";
    return Promise.reject(new Error(msg));
  },
);

export default api;
