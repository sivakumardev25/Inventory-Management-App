import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  // withCredentials: true,
  timeout: 15000, // 10 seconds timeout
});

api.interceptors.request.use(
  (res) => res,
  (err) => {
    const msg =
      err.response?.data?.message || err.message || "Something went wrong";
    return Promise.reject(new Error(msg));
  },
);

export default api;
