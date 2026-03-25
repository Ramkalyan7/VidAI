import axios from "axios";
import { getAuthToken } from "./auth-storage";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: string; message?: string } | undefined)
        ?.error ??
      (error.response?.data as { error?: string; message?: string } | undefined)
        ?.message ??
      error.message
    );
  }

  return "Something went wrong.";
}

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
};

export type Project = {
  id: string;
  title: string | null;
  createdAt: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
  videos?: Array<{
    id: string;
    prompt: string;
    status: string;
    videoUrl: string | null;
    createdAt: string;
  }>;
};

export type AiServiceOutput = {
  code: string | null;
  description: string | null;
  error: string | null;
};

export async function signupRequest(email: string, password: string) {
  try {
    const response = await apiClient.post<{ success: boolean; data: AuthResponse }>(
      "/auth/signup",
      { email, password }
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function loginRequest(email: string, password: string) {
  try {
    const response = await apiClient.post<{ success: boolean; data: AuthResponse }>(
      "/auth/login",
      { email, password }
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function createProjectRequest(message: string) {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to continue.");
  }

  try {
    const response = await apiClient.post<{
      success: boolean;
      data: { projectId: string };
    }>(
      "/projects",
      { message }
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getProjectsRequest() {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to continue.");
  }

  try {
    const response = await apiClient.get<{ success: boolean; data: Project[] }>(
      "/projects"
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getProjectRequest(projectId: string) {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to continue.");
  }

  try {
    const response = await apiClient.get<{ success: boolean; data: Project }>(
      `/projects/${projectId}`
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function chatProjectRequest(projectId: string, message: string) {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to continue.");
  }

  try {
    const response = await apiClient.post<{ success: boolean; data: AiServiceOutput }>(
      `/projects/${projectId}/chat`,
      { message }
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
