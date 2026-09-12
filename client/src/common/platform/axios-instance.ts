import axios from 'axios';

export const axiosForBackend = axios.create({
  baseURL: '/',
  withCredentials: true,
});
