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

// Refresh token mutex to prevent concurrent refresh attempts
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (error: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token!);
        }
    });
    failedQueue = [];
};

// Response interceptor - handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // Another refresh is in progress — queue this request
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const { refreshToken } = getTokens();

            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_URL}/auth/refresh`, {
                        refreshToken,
                    });

                    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

                    setTokens(newAccessToken, newRefreshToken);
                    processQueue(null, newAccessToken);

                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    clearTokens();
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }

            isRefreshing = false;
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

    getById: async (id: string) => {
        const response = await api.get<WarehouseResponse>(`/warehouses/${id}`);
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

    getAllAccounts: async () => {
        const response = await api.get<AccountResponse[]>('/organizations/accounts/all');
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
    canAddProducts?: boolean;
    canManageCounterparties?: boolean;
}

export interface WarehouseResponse {
    id: string;
    name: string;
    type: 'WAREHOUSE' | 'SHOP';
    pointId: string;
    address: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateWarehouseData {
    name: string;
    type?: 'WAREHOUSE' | 'SHOP';
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
    canAddProducts: boolean;
}

export interface UpdateOrgSettingsData {
    canAddEmployees?: boolean;
    canAddPoints?: boolean;
    canAddWarehouses?: boolean;
    canAddProducts?: boolean;
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

    updatePermissions: async (employeeId: string, data: UpdateEmployeePermissionsData) => {
        const response = await api.put<EmployeeResponse>(`/employees/${employeeId}/permissions`, data);
        return response.data;
    },

    update: async (employeeId: string, data: UpdateEmployeeDataPayload) => {
        const response = await api.put<EmployeeResponse>(`/employees/${employeeId}`, data);
        return response.data;
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
    canCreateShipment: boolean;
    canReceiveShipment: boolean;
    canSell: boolean;
    canAddProducts: boolean;
    canManageCounterparties: boolean;
    isActive: boolean;
    createdAt: string;
}

export interface UpdateEmployeePermissionsData {
    canCreateShipment?: boolean;
    canReceiveShipment?: boolean;
    canSell?: boolean;
    canAddProducts?: boolean;
    canManageCounterparties?: boolean;
}

export interface CreateEmployeeData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
}

export interface UpdateEmployeeDataPayload {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
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

// Product API
export const productApi = {
    create: async (data: CreateProductData) => {
        const response = await api.post<ProductResponse>('/products', data);
        return response.data;
    },

    batchCreate: async (data: BatchCreateProductsData) => {
        const response = await api.post<BatchCreateProductsResponse>('/products/batch', data);
        return response.data;
    },

    getAll: async () => {
        const response = await api.get<ProductResponse[]>('/products');
        return response.data;
    },

    getByPoint: async (pointId: string) => {
        const response = await api.get<ProductResponse[]>(`/products/point/${pointId}`);
        return response.data;
    },

    update: async (id: string, data: UpdateProductData) => {
        const response = await api.put<ProductResponse>(`/products/${id}`, data);
        return response.data;
    },

    searchProducts: async (accountId: string, params: { page?: number; limit?: number; search?: string }) => {
        const response = await api.get<PaginatedProductsResponse>(`/products/search/${accountId}`, { params });
        return response.data;
    },

    searchByWarehouse: async (warehouseId: string, params: { page?: number; limit?: number; search?: string; zeroBoxes?: boolean }) => {
        const response = await api.get<PaginatedProductsResponse>(`/products/warehouse/${warehouseId}`, { params });
        return response.data;
    },

    searchByPoint: async (pointId: string, params: { page?: number; limit?: number; search?: string }) => {
        const response = await api.get<PaginatedProductsResponse>(`/products/point/${pointId}/search`, { params });
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/products/${id}`);
    },

    deleteMany: async (ids: string[]): Promise<{ deleted: number }> => {
        const response = await api.delete<{ deleted: number }>('/products/batch', { data: { ids } });
        return response.data;
    },

    getStats: async (): Promise<ProductStatsResponse> => {
        const response = await api.get<ProductStatsResponse>('/products/stats');
        return response.data;
    },

    searchAll: async (params: { page?: number; limit?: number; search?: string }): Promise<PaginatedProductsResponse> => {
        const response = await api.get<PaginatedProductsResponse>('/products/search-all', { params });
        return response.data;
    },
};

export interface ProductStatsResponse {
    uniqueProducts: number;
    totalBoxes: number;
    totalPairs: number;
}

export interface PaginatedProductsResponse {
    items: ProductResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ProductResponse {
    id: string;
    sku: string;
    photoOriginal: string | null;
    photo: string | null;
    sizeRange: string | null;
    boxCount: number;
    pairCount: number;
    priceYuan: number;
    priceRub: number;
    totalYuan: number;
    totalRub: number;
    recommendedSalePrice: number;
    totalRecommendedSale: number;
    actualSalePrice: number;
    totalActualSale: number;
    barcode: string | null;
    accountId: string;
    warehouseId: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateProductData {
    sku: string;
    photoOriginal?: string | null;
    photo?: string | null;
    sizeRange?: string;
    boxCount: number;
    pairCount: number;
    priceYuan: number;
    priceRub: number;
    totalYuan: number;
    totalRub: number;
    recommendedSalePrice?: number;
    totalRecommendedSale?: number;
    actualSalePrice?: number;
    totalActualSale?: number;
    barcode?: string;
    pointId: string;
}

export interface UpdateProductData {
    sku?: string;
    photoOriginal?: string | null;
    photo?: string | null;
    sizeRange?: string;
    boxCount?: number;
    pairCount?: number;
    priceYuan?: number;
    priceRub?: number;
    totalYuan?: number;
    totalRub?: number;
    recommendedSalePrice?: number;
    totalRecommendedSale?: number;
    actualSalePrice?: number;
    totalActualSale?: number;
    barcode?: string;
    isActive?: boolean;
}

export interface BatchProductItem {
    sku: string;
    photoOriginal?: string | null;
    photo?: string | null;
    sizeRange?: string;
    boxCount: number;
    pairCount: number;
    priceYuan: number;
    priceRub: number;
    totalYuan: number;
    totalRub: number;
    recommendedSalePrice?: number;
    totalRecommendedSale?: number;
    actualSalePrice?: number;
    totalActualSale?: number;
    barcode?: string;
}

export interface BatchCreateProductsData {
    pointId: string;
    warehouseId?: string;
    supplierId?: string;
    paidAmount?: number;
    items: BatchProductItem[];
}

export interface BatchCreateProductsResponse {
    products: ProductResponse[];
    count: number;
}

// Upload API
export const uploadApi = {
    uploadPhoto: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<UploadResponse>('/upload/photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    uploadPhotos: async (files: File[]) => {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        const response = await api.post<UploadResponse[]>('/upload/photos', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },
};

export interface UploadResponse {
    url: string;
    filename: string;
    originalName: string;
    size: number;
}

// ==================== SHIPMENT API ====================

export type ShipmentStatus = 'PENDING' | 'SENT' | 'CONFIRMED' | 'CANCELLED';

export interface ShipmentItemResponse {
    id: string;
    productId: string;
    sku: string;
    photo: string | null;
    sizeRange: string | null;
    boxCount: number;
    pairCount: number;
    priceYuan: number;
    priceRub: number;
    totalYuan: number;
    totalRub: number;
}

export interface ShipmentResponse {
    id: string;
    number: string;
    fromAccountId: string;
    toAccountId: string;
    fromPointId: string;
    toPointId: string;
    fromWarehouseId: string | null;
    toWarehouseId: string | null;
    fromPointName?: string;
    toPointName?: string;
    fromAccountName?: string;
    toAccountName?: string;
    totalYuan: number;
    totalRub: number;
    waybillPhoto: string | null;
    transportPhoto: string | null;
    receiverWaybillPhoto: string | null;
    status: ShipmentStatus;
    note: string | null;
    sentAt: string | null;
    receivedAt: string | null;
    confirmedAt: string | null;
    createdAt: string;
    updatedAt: string;
    items: ShipmentItemResponse[];
}

export interface PaginatedShipmentsResponse {
    items: ShipmentResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CreateShipmentItemData {
    productId: string;
    boxCount: number;
    pairCount: number;
}

export interface CreateShipmentData {
    fromPointId: string;
    toPointId: string;
    waybillPhoto?: string;
    transportPhoto?: string;
    note?: string;
    items: CreateShipmentItemData[];
}

export interface AcceptShipmentData {
    receiverWaybillPhoto?: string;
}

// ==================== SHOP API ====================

export interface ShopEmployeeResponse {
    id: string;
    warehouseId: string;
    userId: string;
    createdAt: string;
    userName?: string;
    userEmail?: string;
    userPhone?: string | null;
    shopName?: string;
}

export interface AddShopEmployeeData {
    shopId: string;
    userId: string;
}

export const shopApi = {
    addEmployee: async (data: AddShopEmployeeData) => {
        const response = await api.post<ShopEmployeeResponse>('/shops/employees', data);
        return response.data;
    },

    getEmployees: async (shopId: string) => {
        const response = await api.get<ShopEmployeeResponse[]>(`/shops/employees/${shopId}`);
        return response.data;
    },

    getMyShops: async () => {
        const response = await api.get<ShopEmployeeResponse[]>('/shops/my-shops');
        return response.data;
    },

    removeEmployee: async (shopId: string, userId: string) => {
        await api.delete(`/shops/employees/${shopId}/${userId}`);
    },
};

// ==================== SALE API ====================

export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export interface SaleItemResponse {
    id: string;
    productId: string | null;
    sku: string;
    photo: string | null;
    sizeRange: string | null;
    boxCount: number;
    pairCount: number;
    priceYuan: number;
    priceRub: number;
    totalYuan: number;
    totalRub: number;
    recommendedSalePrice: number;
    actualSalePrice: number;
    totalRecommended: number;
    totalActual: number;
    profit: number;
}

export interface SaleResponse {
    id: string;
    number: string;
    pointId: string;
    shopId: string;
    accountId: string;
    totalYuan: number;
    totalRub: number;
    totalRecommended: number;
    totalActual: number;
    paidAmount: number;
    cashAmount: number;
    cardAmount: number;
    paymentMethod: PaymentMethod;
    profit: number;
    status: SaleStatus;
    note: string | null;
    soldById: string | null;
    clientId: string | null;
    clientName?: string;
    createdAt: string;
    updatedAt: string;
    items: SaleItemResponse[];
    shopName?: string;
    pointName?: string;
    soldByName?: string;
}

export interface PaginatedSalesResponse {
    items: SaleResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CreateSaleItemData {
    productId: string;
    boxCount: number;
    pairCount: number;
    actualSalePrice: number;
}

export interface CreateSaleData {
    shopId: string;
    note?: string;
    clientId?: string;
    paidAmount?: number;
    paymentMethod?: PaymentMethod;
    cashAmount?: number;
    cardAmount?: number;
    items: CreateSaleItemData[];
}

export const saleApi = {
    create: async (data: CreateSaleData) => {
        const response = await api.post<SaleResponse>('/sales', data);
        return response.data;
    },

    getByShop: async (shopId: string, params?: { page?: number; limit?: number; status?: SaleStatus }) => {
        const response = await api.get<PaginatedSalesResponse>(`/sales/shop/${shopId}`, { params });
        return response.data;
    },

    getByAccount: async (accountId: string, params?: { page?: number; limit?: number; status?: SaleStatus }) => {
        const response = await api.get<PaginatedSalesResponse>(`/sales/account/${accountId}`, { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get<SaleResponse>(`/sales/${id}`);
        return response.data;
    },

    cancel: async (id: string) => {
        const response = await api.put<SaleResponse>(`/sales/${id}/cancel`);
        return response.data;
    },
};

// ==================== COUNTERPARTY API ====================

export type CounterpartyType = 'SUPPLIER' | 'CLIENT';
export type CounterpartyTransactionType = 'GOODS_RECEIVED' | 'GOODS_SOLD' | 'PAYMENT_IN' | 'PAYMENT_OUT';

export interface CounterpartyResponse {
    id: string;
    name: string;
    phone: string | null;
    note: string | null;
    type: CounterpartyType;
    accountId: string;
    balance: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PaginatedCounterpartiesResponse {
    items: CounterpartyResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CounterpartyTransactionResponse {
    id: string;
    counterpartyId: string;
    type: CounterpartyTransactionType;
    amount: number;
    description: string | null;
    relatedId: string | null;
    createdAt: string;
}

export interface PaginatedCounterpartyTransactionsResponse {
    items: CounterpartyTransactionResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CreateCounterpartyData {
    name: string;
    phone?: string;
    note?: string;
    type: CounterpartyType;
}

export interface UpdateCounterpartyData {
    name?: string;
    phone?: string;
    note?: string;
    isActive?: boolean;
}

export interface PayCounterpartyDebtData {
    counterpartyId: string;
    amount: number;
    description?: string;
    fromCashRegisterId?: string;
}

export const counterpartyApi = {
    create: (data: CreateCounterpartyData) =>
        api.post<CounterpartyResponse>('/counterparties', data).then(r => r.data),

    getByAccount: (accountId: string, params?: { page?: number; limit?: number; type?: CounterpartyType; search?: string }) =>
        api.get<PaginatedCounterpartiesResponse>(`/counterparties/account/${accountId}`, { params }).then(r => r.data),

    getById: (id: string) =>
        api.get<CounterpartyResponse>(`/counterparties/${id}`).then(r => r.data),

    getTransactions: (id: string, params?: { page?: number; limit?: number }) =>
        api.get<PaginatedCounterpartyTransactionsResponse>(`/counterparties/${id}/transactions`, { params }).then(r => r.data),

    update: (id: string, data: UpdateCounterpartyData) =>
        api.put<CounterpartyResponse>(`/counterparties/${id}`, data).then(r => r.data),

    payDebt: (data: PayCounterpartyDebtData) =>
        api.post<CounterpartyResponse>('/counterparties/pay-debt', data).then(r => r.data),
};

// ==================== CASH REGISTER API ====================

export type PaymentMethod = 'CASH' | 'CARD';

export type CashTransactionType =
    | 'SALE_INCOME'
    | 'SALE_INCOME_CARD'
    | 'PAYMENT_TO_SUPPLIER'
    | 'PAYMENT_FROM_CLIENT'
    | 'EXPENSE'
    | 'ADJUSTMENT'
    | 'TRANSFER_TO_SAFE'
    | 'TRANSFER_FROM_SAFE'
    | 'CARD_TO_SAFE'
    | 'SAFE_TO_CARD'
    | 'PAYOUT_CASH'
    | 'PAYOUT_SAFE'
    | 'PAYOUT_CARD';

export interface CashRegisterResponse {
    id: string;
    shopId: string;
    balance: number;
    cardBalance: number;
    safeBalance: number;
    shopName?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CashTransactionResponse {
    id: string;
    cashRegisterId: string;
    type: CashTransactionType;
    amount: number;
    description: string | null;
    counterpartyId: string | null;
    relatedId: string | null;
    createdAt: string;
}

export interface CashRegisterSummaryResponse {
    register: CashRegisterResponse;
    totalOwedToSuppliers: number;
    totalOwedByClients: number;
}

export interface PaginatedCashTransactionsResponse {
    items: CashTransactionResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PayFromCashRegisterData {
    shopId: string;
    counterpartyId: string;
    amount: number;
    description?: string;
}

export interface ReceiveToCashRegisterData {
    shopId: string;
    counterpartyId: string;
    amount: number;
    description?: string;
}

// ==================== EXPENSE TYPES ====================

export interface ExpenseResponse {
    id: string;
    cashRegisterId: string;
    category: string;
    amount: number;
    description: string | null;
    paymentMethod: string;
    createdById: string | null;
    createdAt: string;
}

export interface PaginatedExpensesResponse {
    items: ExpenseResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CreateExpenseData {
    shopId: string;
    category: string;
    amount: number;
    description?: string;
    paymentMethod?: PaymentMethod;
}

// ==================== PAYOUT TYPES ====================

export type PayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PayoutResponse {
    id: string;
    number: string;
    cashRegisterId: string;
    shopId: string;
    accountId: string;
    cashAmount: number;
    safeAmount: number;
    cardAmount: number;
    totalAmount: number;
    status: PayoutStatus;
    note: string | null;
    createdById: string | null;
    approvedById: string | null;
    approvedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PaginatedPayoutsResponse {
    items: PayoutResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CreatePayoutData {
    shopId: string;
    cashAmount?: number;
    safeAmount?: number;
    cardAmount?: number;
    note?: string;
}

export interface TransferToSafeData {
    shopId: string;
    amount: number;
    source: 'CASH' | 'CARD';
}

export const cashRegisterApi = {
    getSummary: (shopId: string) =>
        api.get<CashRegisterSummaryResponse>(`/cash-register/shop/${shopId}`).then(r => r.data),

    getTransactions: (shopId: string, params?: { page?: number; limit?: number }) =>
        api.get<PaginatedCashTransactionsResponse>(`/cash-register/shop/${shopId}/transactions`, { params }).then(r => r.data),

    paySupplier: (data: PayFromCashRegisterData) =>
        api.post<CashRegisterResponse>('/cash-register/pay-supplier', data).then(r => r.data),

    receiveFromClient: (data: ReceiveToCashRegisterData) =>
        api.post<CashRegisterResponse>('/cash-register/receive-from-client', data).then(r => r.data),

    transferToSafe: (data: TransferToSafeData) =>
        api.post<CashRegisterResponse>('/cash-register/transfer-to-safe', data).then(r => r.data),

    // Expenses
    createExpense: (data: CreateExpenseData) =>
        api.post<ExpenseResponse>('/cash-register/expense', data).then(r => r.data),

    getExpenses: (shopId: string, params?: { page?: number; limit?: number }) =>
        api.get<PaginatedExpensesResponse>(`/cash-register/shop/${shopId}/expenses`, { params }).then(r => r.data),

    // Payouts
    createPayout: (data: CreatePayoutData) =>
        api.post<PayoutResponse>('/cash-register/payout', data).then(r => r.data),

    approvePayout: (id: string) =>
        api.put<PayoutResponse>(`/cash-register/payout/${id}/approve`).then(r => r.data),

    rejectPayout: (id: string) =>
        api.put<PayoutResponse>(`/cash-register/payout/${id}/reject`).then(r => r.data),

    getPayoutsByShop: (shopId: string, params?: { page?: number; limit?: number; status?: PayoutStatus }) =>
        api.get<PaginatedPayoutsResponse>(`/cash-register/payouts/shop/${shopId}`, { params }).then(r => r.data),

    getPayoutsByAccount: (accountId: string, params?: { page?: number; limit?: number; status?: PayoutStatus }) =>
        api.get<PaginatedPayoutsResponse>(`/cash-register/payouts/account/${accountId}`, { params }).then(r => r.data),

    getPayoutById: (id: string) =>
        api.get<PayoutResponse>(`/cash-register/payout/${id}`).then(r => r.data),
};

export const shipmentApi = {
    create: async (data: CreateShipmentData) => {
        const response = await api.post<ShipmentResponse>('/shipments', data);
        return response.data;
    },

    accept: async (id: string, data: AcceptShipmentData) => {
        const response = await api.put<ShipmentResponse>(`/shipments/${id}/accept`, data);
        return response.data;
    },

    cancel: async (id: string) => {
        const response = await api.put<ShipmentResponse>(`/shipments/${id}/cancel`);
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get<ShipmentResponse>(`/shipments/${id}`);
        return response.data;
    },

    getMy: async (params?: { page?: number; limit?: number; status?: ShipmentStatus }) => {
        const response = await api.get<PaginatedShipmentsResponse>('/shipments/my', { params });
        return response.data;
    },

    getOutgoing: async (accountId: string, params?: { page?: number; limit?: number; status?: ShipmentStatus }) => {
        const response = await api.get<PaginatedShipmentsResponse>(`/shipments/outgoing/${accountId}`, { params });
        return response.data;
    },

    getIncoming: async (accountId: string, params?: { page?: number; limit?: number; status?: ShipmentStatus }) => {
        const response = await api.get<PaginatedShipmentsResponse>(`/shipments/incoming/${accountId}`, { params });
        return response.data;
    },
};
