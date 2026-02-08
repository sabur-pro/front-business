import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Simple token getter to avoid circular imports
const getTokens = () => {
    if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
    try {
        const stored = localStorage.getItem('warehouse-auth');
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                accessToken: parsed.state?.accessToken || null,
                refreshToken: parsed.state?.refreshToken || null,
            };
        }
    } catch {
        // ignore
    }
    return { accessToken: null, refreshToken: null };
};

const setTokens = (accessToken: string, refreshToken: string) => {
    if (typeof window === 'undefined') return;
    try {
        const stored = localStorage.getItem('warehouse-auth');
        if (stored) {
            const parsed = JSON.parse(stored);
            parsed.state.accessToken = accessToken;
            parsed.state.refreshToken = refreshToken;
            localStorage.setItem('warehouse-auth', JSON.stringify(parsed));
        }
    } catch {
        // ignore
    }
};

const clearTokens = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('warehouse-auth');
    window.location.href = '/login';
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const { accessToken } = getTokens();
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // If 401 and not a retry, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const { refreshToken } = getTokens();

            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_URL}/auth/refresh`, {
                        refreshToken,
                    });

                    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

                    setTokens(newAccessToken, newRefreshToken);

                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // Refresh failed, logout user
                    clearTokens();
                    return Promise.reject(refreshError);
                }
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    register: async (data: RegisterData) => {
        const response = await api.post<AuthResponse>('/auth/register', data);
        return response.data;
    },

    login: async (data: LoginData) => {
        const response = await api.post<AuthResponse>('/auth/login', data);
        return response.data;
    },

    refresh: async (refreshToken: string) => {
        const response = await api.post<TokenResponse>('/auth/refresh', { refreshToken });
        return response.data;
    },

    logout: async (refreshToken: string) => {
        await api.post('/auth/logout', { refreshToken });
    },

    getMe: async () => {
        const response = await api.get<UserResponse>('/auth/me');
        return response.data;
    },
};

// Warehouse API
export const warehouseApi = {
    getAll: async () => {
        const response = await api.get<WarehouseResponse[]>('/warehouses');
        return response.data;
    },

    getByPoint: async (pointId: string) => {
        const response = await api.get<WarehouseResponse[]>(`/warehouses/point/${pointId}`);
        return response.data;
    },

    create: async (data: CreateWarehouseData) => {
        const response = await api.post<WarehouseResponse>('/warehouses', data);
        return response.data;
    },

    update: async (id: string, data: UpdateWarehouseData) => {
        const response = await api.put<WarehouseResponse>(`/warehouses/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/warehouses/${id}`);
    },
};

// Organization API
export const organizationApi = {
    // Accounts
    getAccounts: async () => {
        const response = await api.get<AccountResponse[]>('/organizations/accounts');
        return response.data;
    },

    createAccount: async (data: CreateAccountData) => {
        const response = await api.post<AccountResponse>('/organizations/accounts', data);
        return response.data;
    },

    // Points
    getPoints: async () => {
        const response = await api.get<PointResponse[]>('/organizations/points');
        return response.data;
    },

    getPointsByAccount: async (accountId: string) => {
        const response = await api.get<PointResponse[]>(`/organizations/accounts/${accountId}/points`);
        return response.data;
    },

    createPoint: async (accountId: string, data: CreatePointData) => {
        const response = await api.post<PointResponse>(`/organizations/accounts/${accountId}/points`, data);
        return response.data;
    },

    updatePoint: async (pointId: string, data: CreatePointData) => {
        const response = await api.put<PointResponse>(`/organizations/points/${pointId}`, data);
        return response.data;
    },
};

// Types
export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: UserResponse;
}

export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
}

export interface UserResponse {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone?: string;
    role: 'ORGANIZER' | 'POINT_ADMIN';
    accountId?: string;
}

export interface WarehouseResponse {
    id: string;
    name: string;
    pointId: string;
    address: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateWarehouseData {
    name: string;
    pointId: string;
    address?: string;
    description?: string;
}

export interface UpdateWarehouseData {
    name?: string;
    address?: string;
    description?: string;
    isActive?: boolean;
}

export interface AccountResponse {
    id: string;
    name: string;
    ownerId: string;
    isActive: boolean;
    createdAt: string;
}

export interface CreateAccountData {
    name: string;
}

export interface PointResponse {
    id: string;
    name: string;
    address: string | null;
    accountId: string;
    isActive: boolean;
    createdAt: string;
}

export interface CreatePointData {
    name: string;
    address?: string;
}

export interface ApiError {
    message: string;
    statusCode: number;
}

// Settings API
export const settingsApi = {
    get: async () => {
        const response = await api.get<OrgSettingsResponse>('/settings');
        return response.data;
    },

    update: async (data: UpdateOrgSettingsData) => {
        const response = await api.put<OrgSettingsResponse>('/settings', data);
        return response.data;
    },
};

export interface OrgSettingsResponse {
    id: string;
    accountId: string;
    canAddEmployees: boolean;
    canAddPoints: boolean;
    canAddWarehouses: boolean;
}

export interface UpdateOrgSettingsData {
    canAddEmployees?: boolean;
    canAddPoints?: boolean;
    canAddWarehouses?: boolean;
}


// Employee API
export const employeeApi = {
    getAll: async () => {
        const response = await api.get<EmployeeResponse[]>('/employees');
        return response.data;
    },

    create: async (data: CreateEmployeeData) => {
        const response = await api.post<EmployeeResponse>('/employees', data);
        return response.data;
    },

    getByPoint: async (pointId: string) => {
        const response = await api.get<EmployeeResponse[]>(`/employees/point/${pointId}`);
        return response.data;
    },

    assignPoint: async (employeeId: string, pointId: string) => {
        const response = await api.post<PointAssignmentResponse>(`/employees/${employeeId}/assign-point`, { pointId });
        return response.data;
    },

    unassignPoint: async (employeeId: string, pointId: string) => {
        await api.delete(`/employees/${employeeId}/unassign-point`, { data: { pointId } });
    },

    delete: async (employeeId: string) => {
        await api.delete(`/employees/${employeeId}`);
    },
};

export interface EmployeeResponse {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone?: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export interface CreateEmployeeData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
}

export interface PointAssignmentResponse {
    id: string;
    pointId: string;
    pointName: string;
    userId: string;
    role: string;
    createdAt: string;
}
