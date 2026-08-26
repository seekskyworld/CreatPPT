import type { ImageAsset, TemplateId } from './types'

export type StarterImage = ImageAsset

export interface StarterTemplateImages {
  cover: StarterImage
  split: StarterImage
  gallery: [StarterImage, StarterImage, StarterImage]
  quote: StarterImage
}

/** The six-image visual language owned by each built-in template. */
export const STARTER_TEMPLATE_IMAGES: Record<TemplateId, StarterTemplateImages> = {
  signal: {
    cover: { src: 'assets/cover-hero.jpg', alt: '深色灯光下的电路板与芯片' },
    split: { src: 'assets/signal-server-room.jpg', alt: '暗色数据中心与服务器机架' },
    gallery: [
      { src: 'assets/signal-night-infrastructure.jpg', alt: '夜间城市基础设施与光轨', caption: '方向与规模' },
      { src: 'assets/signal-hardware-macro.jpg', alt: '精密硬件与金属接口微距', caption: '技术细节' },
      { src: 'assets/architecture.jpg', alt: '现代建筑立面', caption: '结构秩序' },
    ],
    quote: { src: 'assets/portrait.jpg', alt: '面向侧光的人物肖像' },
  },
  editorial: {
    cover: { src: 'assets/cover-banner.jpg', alt: '编辑工作台与灵感墙的横向场景' },
    split: { src: 'assets/editorial-research-desk.jpg', alt: '明亮安静的研究桌面' },
    gallery: [
      { src: 'assets/editorial-still-life.jpg', alt: '编辑部风格静物', caption: '编辑视角' },
      { src: 'assets/editorial-library.jpg', alt: '现代图书馆几何空间', caption: '结构秩序' },
      { src: 'assets/workshop.jpg', alt: '多人围绕草图进行工作坊讨论', caption: '协作研究' },
    ],
    quote: { src: 'assets/editorial-portrait.jpg', alt: '研究者或创作者半身肖像' },
  },
  studio: {
    cover: { src: 'assets/studio-wide-workspace.jpg', alt: '开放创意工作室与协作空间的横向场景' },
    split: { src: 'assets/studio-prototype-hands.jpg', alt: '双手组装无品牌产品原型' },
    gallery: [
      { src: 'assets/studio-materials-flatlay.jpg', alt: '创意材料平铺', caption: '材料语言' },
      { src: 'assets/studio-product-still-life.jpg', alt: '无品牌产品概念模型', caption: '产品表达' },
      { src: 'assets/studio.jpg', alt: '明亮创意工作室', caption: '品牌表达' },
    ],
    quote: { src: 'assets/team-collaboration.jpg', alt: '创意团队围绕屏幕协作' },
  },
}

export function starterImagePool(templateId: TemplateId): StarterImage[] {
  const images = STARTER_TEMPLATE_IMAGES[templateId]
  return [images.cover, images.split, ...images.gallery, images.quote].map(image => ({ ...image }))
}
