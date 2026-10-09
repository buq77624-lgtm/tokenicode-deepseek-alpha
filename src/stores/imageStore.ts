import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bridge } from '../lib/tauri-bridge';
import { useSettingsStore } from './settingsStore';
import {
  DEFAULT_CUSTOM_CONFIGS,
  resolveResolution,
  type CustomImageConfig,
  type ImageAspectRatio,
  type ImageQuality,
  type ImageStyle,
} from '../lib/image-presets';

export interface ImageApiConfig extends CustomImageConfig {
  proxyUrl?: string;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  revisedPrompt?: string;
  model: string;
  providerName: string;
  aspectRatio: ImageAspectRatio;
  size: string;
  filePath: string;
  dataUrl: string;
  createdAt: number;
  isFavorite?: boolean;
}

export interface DirectGenerateParams {
  prompt: string;
  model?: string;
  aspectRatio?: ImageAspectRatio;
  configId?: string;
}

interface ImageState {
  configs: ImageApiConfig[];
  activeConfigId: string;
  prompt: string;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
  style: ImageStyle;
  isGenerating: boolean;
  generationSeconds: number;
  errorMessage: string | null;
  currentImage: GeneratedImage | null;
  history: GeneratedImage[];
  isConfigModalOpen: boolean;
  isImageMode: boolean;

  // Actions
  setIsImageMode: (enabled: boolean) => void;
  toggleImageMode: () => void;
  setPrompt: (prompt: string) => void;
  setAspectRatio: (ratio: ImageAspectRatio) => void;
  setQuality: (quality: ImageQuality) => void;
  setStyle: (style: ImageStyle) => void;
  setActiveConfigId: (id: string) => void;
  setConfigModalOpen: (open: boolean) => void;
  getActiveConfig: () => ImageApiConfig;
  updateConfig: (id: string, patch: Partial<ImageApiConfig>) => void;
  addConfig: (config: Omit<ImageApiConfig, 'id'>) => string;
  deleteConfig: (id: string) => void;

  // 多模型管理
  addModelToConfig: (configId: string, modelName: string) => void;
  removeModelFromConfig: (configId: string, modelName: string) => void;
  selectModel: (modelName: string) => void;

  setCurrentImage: (img: GeneratedImage | null) => void;
  toggleFavorite: (id: string) => void;
  deleteHistoryItem: (id: string) => void;
  clearHistory: () => void;
  ensureImageDataUrl: (image: GeneratedImage) => Promise<string>;
  generate: () => Promise<GeneratedImage | null>;
  generateDirectly: (params: DirectGenerateParams) => Promise<GeneratedImage>;
  setAsWallpaper: (image: GeneratedImage | { dataUrl?: string; filePath?: string }) => Promise<boolean>;
}

export const useImageStore = create<ImageState>()(
  persist(
    (set, get) => ({
      configs: DEFAULT_CUSTOM_CONFIGS.map((c) => ({
        ...c,
        defaultAspectRatio: c.defaultAspectRatio || '1:1',
        defaultQuality: c.defaultQuality || 'standard',
      })),
      activeConfigId: 'custom_default',
      prompt: '',
      aspectRatio: '1:1',
      quality: 'standard',
      style: 'vivid',
      isGenerating: false,
      generationSeconds: 0,
      errorMessage: null,
      currentImage: null,
      history: [],
      isConfigModalOpen: false,
      isImageMode: false,

      setIsImageMode: (isImageMode) => set({ isImageMode }),
      toggleImageMode: () => set((s) => ({ isImageMode: !s.isImageMode })),

      setPrompt: (prompt) => set({ prompt }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      setQuality: (quality) => set({ quality }),
      setStyle: (style) => set({ style }),
      setActiveConfigId: (activeConfigId) => set({ activeConfigId }),
      setConfigModalOpen: (isConfigModalOpen) => set({ isConfigModalOpen }),

      getActiveConfig: () => {
        const { configs, activeConfigId } = get();
        return (
          configs.find((c) => c.id === activeConfigId) ||
          configs[0] || {
            id: 'custom_default',
            name: '自定义 API 接口',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: '',
            model: 'dall-e-3',
            availableModels: ['dall-e-3'],
            defaultAspectRatio: '1:1',
            defaultQuality: 'standard',
          }
        );
      },

      updateConfig: (id, patch) =>
        set((state) => ({
          configs: state.configs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      addConfig: (configData) => {
        const newId = `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newConfig: ImageApiConfig = {
          ...configData,
          id: newId,
        };
        set((state) => ({
          configs: [...state.configs, newConfig],
          activeConfigId: newId,
        }));
        return newId;
      },

      deleteConfig: (id) =>
        set((state) => {
          const filtered = state.configs.filter((c) => c.id !== id);
          const fallback = filtered[0] || {
            id: 'custom_default',
            name: '自定义 API 接口',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: '',
            model: 'dall-e-3',
            availableModels: ['dall-e-3'],
            defaultAspectRatio: '1:1',
            defaultQuality: 'standard',
          };
          const nextConfigs = filtered.length > 0 ? filtered : [fallback];
          const nextActive =
            state.activeConfigId === id ? nextConfigs[0].id : state.activeConfigId;
          return { configs: nextConfigs, activeConfigId: nextActive };
        }),

      // 添加模型到配置
      addModelToConfig: (configId, modelName) => {
        const trimmed = modelName.trim();
        if (!trimmed) return;
        set((state) => ({
          configs: state.configs.map((c) => {
            if (c.id !== configId) return c;
            if (c.availableModels.includes(trimmed)) {
              return { ...c, model: trimmed };
            }
            return {
              ...c,
              availableModels: [...c.availableModels, trimmed],
              model: trimmed,
            };
          }),
        }));
      },

      // 从配置中移除模型
      removeModelFromConfig: (configId, modelName) => {
        set((state) => ({
          configs: state.configs.map((c) => {
            if (c.id !== configId) return c;
            const updated = c.availableModels.filter((m) => m !== modelName);
            const nextModel = c.model === modelName ? updated[0] || 'dall-e-3' : c.model;
            return {
              ...c,
              availableModels: updated.length > 0 ? updated : ['dall-e-3'],
              model: nextModel,
            };
          }),
        }));
      },

      // 切换当前激活配置的模型
      selectModel: (modelName) => {
        const activeId = get().activeConfigId;
        get().updateConfig(activeId, { model: modelName });
      },

      setCurrentImage: (currentImage) => set({ currentImage }),

      toggleFavorite: (id) =>
        set((state) => ({
          history: state.history.map((h) =>
            h.id === id ? { ...h, isFavorite: !h.isFavorite } : h
          ),
          currentImage:
            state.currentImage?.id === id
              ? { ...state.currentImage, isFavorite: !state.currentImage.isFavorite }
              : state.currentImage,
        })),

      deleteHistoryItem: (id) =>
        set((state) => {
          const nextHistory = state.history.filter((h) => h.id !== id);
          return {
            history: nextHistory,
            currentImage: state.currentImage?.id === id ? nextHistory[0] || null : state.currentImage,
          };
        }),

      clearHistory: () => set({ history: [], currentImage: null }),

      /** 确保图片具备用于前端渲染的 dataUrl（如果被持久化剥离，按需从本地磁盘快速加载） */
      ensureImageDataUrl: async (image) => {
        if (image.dataUrl && image.dataUrl.length > 50) {
          return image.dataUrl;
        }
        try {
          const base64 = await bridge.readFileBase64(image.filePath);
          image.dataUrl = base64;
          return base64;
        } catch {
          return '';
        }
      },

      /** 工作台通用生成 */
      generate: async () => {
        const state = get();
        const prompt = state.prompt.trim();
        if (!prompt) {
          set({ errorMessage: '请输入绘图提示词 (Prompt)' });
          return null;
        }

        try {
          return await get().generateDirectly({
            prompt,
            aspectRatio: state.aspectRatio,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          set({
            isGenerating: false,
            errorMessage: msg || '生成图像遇到未知错误',
          });
          return null;
        }
      },

      /** 对话流与无感生图核心方法 */
      generateDirectly: async ({ prompt, model, aspectRatio, configId }) => {
        const state = get();
        const cleanPrompt = prompt.trim();
        if (!cleanPrompt) {
          throw new Error('请输入生图提示词');
        }

        const config = configId
          ? state.configs.find((c) => c.id === configId) || state.getActiveConfig()
          : state.getActiveConfig();

        if (!config.baseUrl?.trim()) {
          throw new Error('未配置生图 Base URL，请在设置中配置');
        }

        if (!config.apiKey?.trim()) {
          set({ isConfigModalOpen: true });
          throw new Error(`【${config.name}】未配置 API Key，请在生图设置中填写`);
        }

        const activeModel = model || config.model || 'dall-e-3';
        const targetRatio = aspectRatio || state.aspectRatio || '1:1';
        const cwd = useSettingsStore.getState().workingDirectory;
        const resolution = resolveResolution(activeModel, targetRatio);

        set({
          isGenerating: true,
          generationSeconds: 0,
          errorMessage: null,
        });

        const timer = setInterval(() => {
          set((s) => ({ generationSeconds: s.generationSeconds + 1 }));
        }, 1000);

        try {
          const res = await bridge.generateImage({
            base_url: config.baseUrl,
            api_key: config.apiKey,
            model: activeModel,
            prompt: cleanPrompt,
            size: resolution,
            quality: state.quality,
            style: state.style,
            proxy_url: config.proxyUrl,
            cwd: cwd || undefined,
          });

          clearInterval(timer);

          if (!res.success || !res.images || res.images.length === 0) {
            throw new Error('未接收到生成的有效图像数据');
          }

          const primaryItem = res.images[0];
          const newImage: GeneratedImage = {
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            prompt: res.prompt,
            revisedPrompt: primaryItem.revised_prompt,
            model: res.model,
            providerName: config.name,
            aspectRatio: targetRatio,
            size: resolution,
            filePath: primaryItem.file_path,
            dataUrl: primaryItem.data_url,
            createdAt: res.created_at * 1000,
          };

          set((s) => ({
            isGenerating: false,
            currentImage: newImage,
            history: [newImage, ...s.history],
          }));

          return newImage;
        } catch (err: unknown) {
          clearInterval(timer);
          set({ isGenerating: false });
          throw err;
        }
      },

      /** 将生成的图像一键设为 TOKENICODE 客户端原生壁纸 */
      setAsWallpaper: async (image) => {
        try {
          let dataUrl = image.dataUrl;
          if (!dataUrl && image.filePath) {
            dataUrl = await bridge.readFileBase64(image.filePath);
          }
          if (!dataUrl) return false;

          const res = await fetch(dataUrl);
          const blob = await res.blob();
          await useSettingsStore.getState().setCustomBgImage(blob);
          return true;
        } catch (e) {
          console.error('[imageStore] 设置壁纸失败:', e);
          return false;
        }
      },
    }),
    {
      name: 'tokenicode_image_store',
      partialize: (state) => ({
        configs: state.configs,
        activeConfigId: state.activeConfigId,
        aspectRatio: state.aspectRatio,
        quality: state.quality,
        style: state.style,
        history: state.history.slice(0, 100).map((h) => ({
          ...h,
          dataUrl: '',
        })),
      }),
      // 迁移：清除旧预设配置，只保留纯自定义接口
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.configs && state.configs.length > 0) {
          const cleaned = state.configs.filter((c: any) => !c.isPreset);
          if (cleaned.length > 0) {
            state.configs = cleaned;
          } else {
            state.configs = DEFAULT_CUSTOM_CONFIGS.map((c) => ({
              ...c,
              defaultAspectRatio: c.defaultAspectRatio || '1:1',
              defaultQuality: c.defaultQuality || 'standard',
            }));
            state.activeConfigId = state.configs[0].id;
          }
        }
      },
    }
  )
);
