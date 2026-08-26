import type { DeckSpec, SlideLayout, SlideSpec, TemplateId } from '@/domain/types'
import { ensureDeckElements } from '@/domain/elements'
import { planDeck } from '@/domain/planner'

const starterSlides: SlideSpec[] = [
  {
    id: 'slide-cover',
    layout: 'cover',
    eyebrow: 'AGENT-FIRST PRESENTATION',
    title: '从一句指令，到一份可继续打磨的演示稿',
    subtitle: '让 Agent 负责生成，让网页负责修改，让导出发生在用户真正需要的时候。',
    images: [{ src: 'assets/cover-hero.jpg', alt: '深色灯光下的电路板与芯片' }],
    footer: 'CreatPPT / 2026',
  },
  {
    id: 'slide-agenda',
    layout: 'agenda',
    eyebrow: 'CONTENTS',
    title: '把复杂度藏在结果之后',
    bullets: ['为什么重新定义交付物', '一条更短的生成链路', '网页编辑与按需导出', '从垂直切片到模板生态'],
    footer: '01 / 叙事结构',
  },
  {
    id: 'slide-statement',
    layout: 'statement',
    eyebrow: '核心判断',
    title: '用户需要的不是“AI 做 PPT”的过程，而是一份已经能看的结果。',
    body: '生成前不展示空白画布，不要求逐页确认。Agent 在后台完成内容、素材、模板匹配与版面检查，用户只在需要修改时进入工作台。',
    footer: '02 / 产品原则',
  },
  {
    id: 'slide-metrics',
    layout: 'metrics',
    eyebrow: '目标体验',
    title: '用更少操作，交付更完整的成果',
    stats: [
      { value: '1', label: '一句自然语言指令', detail: '无需学习编辑器' },
      { value: '<60s', label: '生成可浏览网页', detail: '不含外部图片生成时间' },
      { value: '3', label: '首发模板体系', detail: '结构与视觉均不同' },
      { value: '1-click', label: '用户主动导出', detail: 'PPTX 不进入生成主链路' },
    ],
    footer: '03 / 成功指标',
  },
  {
    id: 'slide-split',
    layout: 'split',
    eyebrow: '工作方式',
    title: '先完成，再进入编辑',
    body: 'Agent 输出受约束的 DeckSpec，模板引擎将语义内容变成稳定页面。用户打开时看到的是完整演示稿，而不是创作向导。',
    bullets: ['文字可直接修改', '图片可替换或上传', '页面可排序与切换布局', '所有修改自动保存'],
    images: [{ src: 'assets/team-collaboration.jpg', alt: '团队成员围绕屏幕协作' }],
    footer: '04 / Web 工作台',
  },
  {
    id: 'slide-comparison',
    layout: 'comparison',
    eyebrow: '取舍',
    title: '不再二选一：网页负责表现，PPT 负责流通',
    columns: [
      { title: '网页演示稿', body: '视觉呈现与轻量修改', bullets: ['模板完整还原', '即时保存', '浏览器内演示'] },
      { title: '按需导出', body: '只在点击后生成 PPTX', bullets: ['基础元素可编辑', '复杂视觉稳定降级', '导出后结构校验'] },
    ],
    footer: '05 / 双层交付',
  },
  {
    id: 'slide-chart',
    layout: 'chart',
    eyebrow: '生成主链路',
    title: '把等待时间花在内容，而不是文件转换',
    body: 'PPTX 导出移出 Agent 主链路后，生成阶段只处理叙事、素材与网页排版。',
    chart: {
      unit: '秒',
      points: [
        { label: '内容规划', value: 18 },
        { label: '素材匹配', value: 24 },
        { label: '模板排版', value: 11 },
        { label: '质量检查', value: 6 },
      ],
    },
    footer: '06 / 性能预算',
  },
  {
    id: 'slide-timeline',
    layout: 'timeline',
    eyebrow: '实施路径',
    title: '先证明闭环，再扩张能力',
    steps: [
      { label: '01', title: '契约', body: 'DeckSpec 与模板槽位' },
      { label: '02', title: '渲染', body: '一套模板完整成稿' },
      { label: '03', title: '编辑', body: '高频修改与自动保存' },
      { label: '04', title: '导出', body: '用户点击后生成 PPTX' },
      { label: '05', title: '扩展', body: '模板 SDK 与生态' },
    ],
    footer: '07 / 里程碑',
  },
  {
    id: 'slide-gallery',
    layout: 'gallery',
    eyebrow: '模板不是换色',
    title: '每一种视觉语言，都应有自己的构图节奏',
    images: [
      { src: 'assets/workshop.jpg', alt: '团队工作坊', caption: '协作叙事' },
      { src: 'assets/architecture.jpg', alt: '现代建筑立面', caption: '结构秩序' },
      { src: 'assets/studio.jpg', alt: '明亮创意工作室', caption: '品牌表达' },
    ],
    footer: '08 / 模板资产',
  },
  {
    id: 'slide-quote',
    layout: 'quote',
    eyebrow: '设计原则',
    title: '让系统承担复杂度',
    quote: '好的 Agent 工具不应该把生成过程搬到用户面前，而应该把一个可以继续工作的结果交到用户手里。',
    quoteBy: 'CreatPPT 产品原则',
    images: [{ src: 'assets/portrait.jpg', alt: '面向侧光的人物肖像' }],
    footer: '09 / 体验判断',
  },
  {
    id: 'slide-closing',
    layout: 'closing',
    eyebrow: 'NEXT',
    title: '从一套模板开始，把完整体验做对。',
    body: '生成网页。按需修改。点击导出。',
    footer: 'CreatPPT / Web-first',
  },
]

export type StarterImage = NonNullable<SlideSpec['images']>[number]

export interface StarterTemplateImages {
  cover: StarterImage
  split: StarterImage
  gallery: [StarterImage, StarterImage, StarterImage]
  quote: StarterImage
}

/**
 * The starter library is deliberately partitioned into three six-image sets.
 * Keeping this map explicit makes a template switch observable in the first
 * viewport as well as on the image-bearing content pages.
 */
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

const STARTER_ASSET_SOURCES = new Set(
  Object.values(STARTER_TEMPLATE_IMAGES).flatMap(images => [
    images.cover.src,
    images.split.src,
    ...images.gallery.map(image => image.src),
    images.quote.src,
  ]),
)

export function createStarterDeck(title = 'CreatPPT Web-first', templateId: TemplateId = 'editorial', slideCount = 11): DeckSpec {
  const count = Math.min(24, Math.max(3, slideCount))
  const slides = Array.from({ length: count }, (_, index) => {
    const source = starterSlides[index % starterSlides.length]
    return structuredClone({
      ...source,
      id: index < starterSlides.length ? source.id : `${source.id}-${index + 1}`,
    })
  })
  slides[0].title = title
  applyTemplateImages(slides, templateId)

  const deck = planDeck({
    version: 2,
    id: slugify(title) || 'creatppt-deck',
    title,
    subtitle: 'Agent-first Web presentation',
    templateId,
    updatedAt: new Date().toISOString(),
    slides,
    designContext: {
      purpose: '把复杂内容整理成可继续修改的演示稿',
      language: /[\u4e00-\u9fff]/.test(title) ? 'zh-CN' : 'en',
      fidelity: 'balanced',
      deliveryFormats: ['web', 'pptx'],
    },
    tweaks: {
      density: 'balanced',
      fontScale: 1,
      accentMode: 'default',
    },
  })
  ensureDeckElements(deck)
  return deck
}

/**
 * Apply the curated image set for a template. With preserveCustomImages enabled,
 * only paths from the starter library are replaced; user uploads and remote media
 * remain untouched when a user switches templates in the editor.
 */
export function applyTemplateImages(slides: SlideSpec[], templateId: TemplateId, preserveCustomImages = false): void {
  const images = STARTER_TEMPLATE_IMAGES[templateId]
  const cover = findTemplateSlide(slides, 'cover', 'slide-cover')
  const split = findTemplateSlide(slides, 'split', 'slide-split')
  const gallery = findTemplateSlide(slides, 'gallery', 'slide-gallery')
  const quote = findTemplateSlide(slides, 'quote', 'slide-quote')
  replaceSlideImages(cover, [images.cover], preserveCustomImages)
  replaceSlideImages(split, [images.split], preserveCustomImages)
  replaceSlideImages(gallery, images.gallery, preserveCustomImages)
  replaceSlideImages(quote, [images.quote], preserveCustomImages)
}

function findTemplateSlide(slides: SlideSpec[], layout: SlideLayout, starterIdPrefix: string): SlideSpec | undefined {
  return slides.find(slide => slide.layout === layout && slide.id.startsWith(starterIdPrefix))
    ?? slides.find(slide => slide.layout === layout)
}

function replaceSlideImages(slide: SlideSpec | undefined, desired: StarterImage[], preserveCustomImages: boolean): void {
  if (!slide) return
  if (!preserveCustomImages) {
    slide.images = desired.map(cloneImage)
    return
  }
  if (!slide.images?.length) return
  slide.images = slide.images.map((current, index) => {
    const replacement = desired[index]
    if (!replacement || !STARTER_ASSET_SOURCES.has(current.src)) return current
    return { ...cloneImage(replacement), assetId: current.assetId }
  })
}

function cloneImage(image: StarterImage): StarterImage {
  return { ...image }
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}
