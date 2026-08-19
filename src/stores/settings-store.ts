'use client';

import { create } from 'zustand';
import { settingsApi, OrgSettingsResponse } from '@/lib/api';

interface SettingsState {
    settings: OrgSettingsResponse | null;
    isLoading: boolean;
    fetchSettings: () => Promise<void>;
    updateSettings: (data: Partial<OrgSettingsResponse>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: null,
    isLoading: false,

    fetchSettings: async () => {
        set({ isLoading: true });
        try {
            const data = await settingsApi.get();
            set({ settings: data });
        } catch (err) {
            console.error('Failed to fetch settings', err);
            // Fallback defaults so UI settings section remains accessible
            if (!get().settings) {
                set({
                    settings: {
                        id: '',
                        accountId: '',
                        canAddEmployees: true,
                        canAddPoints: true,
                        canAddWarehouses: true,
                        canAddProducts: false,
                        hardDeleteProducts: false,
                    },
                });
            }
        } finally {
            set({ isLoading: false });
        }
    },

    updateSettings: async (data) => {
        try {
            const updated = await settingsApi.update(data);
            set({ settings: updated });
        } catch (err) {
            console.error('Failed to update settings', err);
            throw err;
        }
    },
}));
