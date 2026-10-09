export interface ImageIntentResult {
  isImageRequest: boolean;
  prompt: string;
  originalText: string;
}

/**
 * 智能识别自然语言中的 AI 生图意图
 * 例如：
 * - "帮我生成一本书的图片" -> prompt: "一本书"
 * - "画一张猫咪在草地上玩耍" -> prompt: "猫咪在草地上玩耍"
 * - "生成一张太空科幻壁纸" -> prompt: "太空科幻壁纸"
 * - "请帮我画一个可爱的机器猫" -> prompt: "可爱的机器猫"
 * - "帮我做一张科技风海报" -> prompt: "科技风海报"
 * - "画一只金毛" -> prompt: "金毛"
 * - "生成图片：红色法拉利跑车" -> prompt: "红色法拉利跑车"
 * - "generate an image of a cyber city" -> prompt: "a cyber city"
 * - "draw a cute puppy on the grass" -> prompt: "a cute puppy on the grass"
 */
export function detectImageIntent(text: string): ImageIntentResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { isImageRequest: false, prompt: '', originalText: text };
  }

  // 1. 明确的命令或前缀形式
  const cmdMatch = trimmed.match(/^(?:\/image|\/draw|生图|画图|生成图片)[：:\s]+(.+)$/i);
  if (cmdMatch && cmdMatch[1]) {
    return { isImageRequest: true, prompt: cmdMatch[1].trim(), originalText: text };
  }

  // 2. 中文自然语言意图识别规则
  const zhPatterns = [
    // 模式 A：帮我/请/麻烦 + 生成/绘制/画/制作 + (数量词) + 提示词 + 的 + 图片/壁纸/插画等
    // 例如："帮我生成一本书的图片", "请帮我画一张猫咪睡觉的插画", "制作一张科幻壁纸"
    /^(?:帮我|请帮我|麻烦|请|给我)?(?:生成|绘制|画|制作|渲染|出)(?:一张|一个|幅|几张|下)?(?:关于|包含)?(.+?)(?:的)?(?:图片|图画|插画|壁纸|海报|插图|画卷|画作|照片|图像|图)(?:吧|呀|吗|呢|！|!|。)?$/i,

    // 模式 B：帮我/请/麻烦 + 画/绘制/生成 + 提示词
    // 例如："帮我画一只可爱的小狗", "画一个太空人", "请画一幅日落海滩"
    /^(?:帮我|请帮我|麻烦|请)?(?:画|绘制)(?:一个|一只|一位|一部|一辆|一栋|一朵|一幅|一张)?(.+?)(?:吧|呀|吗|呢|！|!|。)?$/i,

    // 模式 C：生成/制作 + (数量词) + 提示词 + 后缀
    // 例如："生成一张可爱的卡通小猪图片", "生成一幅星空画"
    /^(?:生成|制作)(?:一个|一只|一位|一部|一辆|一栋|一朵|一幅|一张)?(.+?)(?:的)?(?:图片|壁纸|插画|照片|图)(?:吧|呀|吗|呢|！|!|。)?$/i,
  ];

  for (const pattern of zhPatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // 过滤非生图的误判词（如“帮我写代码”、“画流程图”、“画架构图”）
      const isBlacklisted = /^(代码|函数|文件|文档|脚本|网页|表格|流程图|架构图|思维导图|时序图|UML)$/i.test(extracted);
      if (extracted.length >= 1 && !isBlacklisted) {
        return { isImageRequest: true, prompt: extracted, originalText: text };
      }
    }
  }

  // 3. 英文自然语言意图识别规则
  // 例如："generate an image of a book", "draw a cute cat in the garden"
  const enMatchA = trimmed.match(/^(?:please\s+)?(?:generate|draw|paint|create|render|make)\s+(?:an?|some)?\s*(?:image|picture|drawing|painting|photo|illustration|wallpaper)\s+(?:of|showing|depicting|about)\s+(.+?)[.!]?$/i);
  if (enMatchA && enMatchA[1]) {
    return { isImageRequest: true, prompt: enMatchA[1].trim(), originalText: text };
  }

  const enMatchB = trimmed.match(/^(?:please\s+)?(?:draw|paint)\s+(?:an?|some)?\s*(.+?)[.!]?$/i);
  if (enMatchB && enMatchB[1]) {
    const extracted = enMatchB[1].trim();
    const isBlacklisted = /^(code|function|file|script|diagram|chart|flowchart|uml)$/i.test(extracted);
    if (extracted.length >= 2 && !isBlacklisted) {
      return { isImageRequest: true, prompt: extracted, originalText: text };
    }
  }

  return { isImageRequest: false, prompt: '', originalText: text };
}
