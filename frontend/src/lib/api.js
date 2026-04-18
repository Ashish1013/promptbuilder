import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const AUTH_TOKEN_STORAGE_KEY = "reachall-auth-token";
export const AUTH_USER_STORAGE_KEY = "reachall-auth-user";

const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 20000,
});

const getStoredUser = () => {
  try {
    const user = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    return null;
  }
};

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const saveAuthSession = (token, user) => {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
};

export const getAuthUserFromStorage = () => getStoredUser();

export const loginUser = async (payload) => {
  const response = await apiClient.post("/auth/login", payload);
  return response.data;
};

export const fetchMe = async () => {
  const response = await apiClient.get("/auth/me");
  return response.data;
};

export const fetchMyActivity = async () => {
  const response = await apiClient.get("/activity/me");
  return response.data;
};

export const fetchActivityTable = async () => {
  const response = await apiClient.get("/activity");
  return response.data;
};

export const fetchUsers = async () => {
  const response = await apiClient.get("/users");
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await apiClient.delete(`/users/${userId}`);
  return response.data;
};

export const createUser = async (payload) => {
  const response = await apiClient.post("/users", payload);
  return response.data;
};

export const updateUserRole = async (userId, payload) => {
  const response = await apiClient.put(`/users/${userId}/role`, payload);
  return response.data;
};

export const updateRolesMatrix = async (payload) => {
  const response = await apiClient.put("/roles", payload);
  return response.data.roles;
};

export const fetchTemplateLibrary = async () => {
  const response = await apiClient.get("/template-library");
  return response.data;
};

export const fetchArchivedTemplates = async () => {
  const response = await apiClient.get("/template-library/archived");
  return response.data;
};

export const fetchReadyTemplates = async () => {
  const response = await apiClient.get("/template-library/ready");
  return response.data;
};

export const cloneTemplateLibraryItem = async (payload) => {
  const response = await apiClient.post("/template-library/clone", payload);
  return response.data;
};

export const updateTemplateLibraryItem = async (templateId, payload) => {
  const response = await apiClient.put(`/template-library/${templateId}`, payload);
  return response.data;
};

export const archiveTemplateLibraryItem = async (templateId) => {
  const response = await apiClient.put(`/template-library/${templateId}/archive`);
  return response.data;
};

export const unarchiveTemplateLibraryItem = async (templateId) => {
  const response = await apiClient.put(`/template-library/${templateId}/unarchive`);
  return response.data;
};

export const fetchTemplates = async () => {
  const response = await apiClient.get("/templates");
  return response.data;
};

export const updateTemplateSection = async (sectionId, payload) => {
  const response = await apiClient.put(`/templates/${sectionId}`, payload);
  return response.data;
};

export const fetchPromptDrafts = async () => {
  const response = await apiClient.get("/prompts");
  return response.data;
};

export const fetchPromptDraft = async (draftId) => {
  const response = await apiClient.get(`/prompts/${draftId}`);
  return response.data;
};

export const createPromptDraft = async (payload) => {
  const response = await apiClient.post("/prompts", payload);
  return response.data;
};

export const updatePromptDraft = async (draftId, payload) => {
  const response = await apiClient.put(`/prompts/${draftId}`, payload);
  return response.data;
};

export const deletePromptDraft = async (draftId) => {
  const response = await apiClient.delete(`/prompts/${draftId}`);
  return response.data;
};

export const compilePrompt = async (sections) => {
  const response = await apiClient.post("/prompts/compile", { sections });
  return response.data;
};

export const fetchRolesMatrix = async () => {
  const response = await apiClient.get("/roles");
  return response.data.roles;
};
