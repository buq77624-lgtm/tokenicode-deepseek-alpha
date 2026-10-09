/**
 * AI 图像生成自定义接口与参数规范
 */

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageQuality = 'standard' | 'hd';
export type ImageStyle = 'vivid' | 'natural';

export interface CustomImageConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  availableModels: string[];
  defaultAspectRatio?: ImageAspectRatio;
  defaultQuality?: ImageQuality;
}

export const DEFAULT_CUSTOM_CONFIGS: CustomImageConfig[] = [
  {
    id: 'custom_default',
    name: '自定义 API 接口',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'dall-e-3',
    availableModels: [
      'dall-e-3',
      'black-forest-labs/FLUX.1-schnell',
      'black-forest-labs/FLUX.1-dev',
      'stabilityai/stable-diffusion-3.5-large',
    ],
    defaultAspectRatio: '1:1',
    defaultQuality: 'standard',
  },
];

/** 比例对应常见像素分辨率映射 */
export function resolveResolution(model: string, ratio: ImageAspectRatio): string {
  const isDalle3 = model.toLowerCase().includes('dall-e-3');
  switch (ratio) {
    case '1:1':
      return '1024x1024';
    case '16:9':
      return isDalle3 ? '1792x1024' : '1344x768';
    case '9:16':
      return isDalle3 ? '1024x1792' : '768x1344';
    case '4:3':
      return isDalle3 ? '1024x1024' : '1152x864';
    case '3:4':
      return isDalle3 ? '1024x1024' : '864x1152';
    default:
      return '1024x1024';
  }
}
