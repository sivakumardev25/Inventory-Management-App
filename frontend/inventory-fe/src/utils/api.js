import axios from "axios";

const api = axios.create({
  baseURL:
    process.env.REACT_APP_BASE_API_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    "/api",
  headers: {
    "Content-Type": "application/json",
  },
  // withCredentials: true,
  timeout: 15000, // 10 seconds timeout
});
// console.log("API Base URL:", baseURL);

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err.response?.data?.message || err.message || "Something went wrong";
    return Promise.reject(new Error(msg));
  },
);

export default api;

  

