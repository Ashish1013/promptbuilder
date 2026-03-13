import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 20000,
});

const withRoleHeader = (role) => ({
  headers: {
    "x-user-role": role,
  },
});

export const fetchTemplates = async () => {
  const response = await apiClient.get("/templates");
  return response.data;
};

export const updateTemplateSection = async (sectionId, payload, role) => {
  const response = await apiClient.put(`/templates/${sectionId}`, payload, withRoleHeader(role));
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

export const createPromptDraft = async (payload, role) => {
  const response = await apiClient.post("/prompts", payload, withRoleHeader(role));
  return response.data;
};

export const updatePromptDraft = async (draftId, payload, role) => {
  const response = await apiClient.put(`/prompts/${draftId}`, payload, withRoleHeader(role));
  return response.data;
};

export const deletePromptDraft = async (draftId, role) => {
  const response = await apiClient.delete(`/prompts/${draftId}`, withRoleHeader(role));
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
