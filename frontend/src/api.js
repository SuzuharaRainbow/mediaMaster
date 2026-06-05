import axios from "axios";

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:8000",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => {
    const payload = response.data;
    if (payload && typeof payload === "object" && "code" in payload) {
      if (payload.code === 0) {
        return payload.data ?? null;
      }
      throw new ApiError(payload.message || "API_ERROR", payload.code, response.status);
    }
    return payload;
  },
  (error) => {
    const payload = error.response?.data;
    if (payload && typeof payload === "object" && "code" in payload) {
      throw new ApiError(payload.message || "API_ERROR", payload.code, error.response?.status || 500);
    }
    throw new ApiError(error.message, error.response?.status || 500, payload?.code);
  }
);

export default api;