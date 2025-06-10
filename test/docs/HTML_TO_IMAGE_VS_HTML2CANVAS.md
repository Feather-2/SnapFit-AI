# 📊 html-to-image vs html2canvas 对比分析

## 🎯 问题背景

在Next.js 15 + React 19环境下，html2canvas出现严重的错位问题，特别是：
- Sticky/Fixed导航栏导致内容偏移
- 滚动位置影响截图准确性
- Transform样式干扰元素定位
- 兼容性问题

## 📋 方案对比

### html2canvas (传统方案)
```typescript
// 优点
✅ 成熟稳定，使用广泛
✅ 功能丰富，配置选项多
✅ 社区支持好

// 缺点
❌ 定位精度问题严重
❌ 与React 19兼容性差
❌ 包体积较大 (依赖多)
❌ 性能相对较慢
❌ 错位问题难以完全解决
```

### html-to-image (推荐方案)
```typescript
// 优点
✅ 更好的定位精度
✅ 无依赖，包体积小
✅ 更快的渲染速度
✅ 多种输出格式 (PNG/JPEG/SVG/Canvas)
✅ 更现代的API设计
✅ 与React 19兼容性好

// 缺点
❌ 相对较新，社区较小
❌ 某些边缘情况支持不如html2canvas
```

## 🔧 实现对比

### html2canvas实现
```typescript
import html2canvas from 'html2canvas';

const canvas = await html2canvas(element, {
  backgroundColor: '#ffffff',
  scale: 2,
  useCORS: true,
  allowTaint: true,
  scrollX: 0,
  scrollY: 0,
  // 需要大量配置来修复错位问题
  onclone: (clonedDoc, clonedElement) => {
    // 复杂的样式修复逻辑
  }
});
```

### html-to-image实现
```typescript
import * as htmlToImage from 'html-to-image';

const dataUrl = await htmlToImage.toPng(element, {
  backgroundColor: '#ffffff',
  pixelRatio: 2,
  cacheBust: true,
  style: {
    transform: 'none',
    animation: 'none',
    transition: 'none',
  },
  filter: (node) => {
    return node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE';
  }
});
```

## 📈 性能对比

| 指标 | html2canvas | html-to-image |
|------|-------------|---------------|
| 包体积 | ~500KB | ~50KB |
| 渲染速度 | 较慢 | 更快 |
| 内存占用 | 较高 | 较低 |
| 错位问题 | 严重 | 轻微 |
| 兼容性 | React 19问题 | 良好 |

## 🧪 测试结果

### 错位测试
- **html2canvas原始**: 严重错位，导航栏高度偏移
- **html2canvas修复**: 部分改善，但仍有问题
- **html-to-image**: 定位准确，无明显错位

### 兼容性测试
- **Next.js 15**: html-to-image表现更好
- **React 19**: html-to-image无兼容性问题
- **现代浏览器**: 两者都支持良好

## 💡 迁移建议

### 1. 立即迁移场景
- 遇到严重错位问题
- 使用Next.js 15 + React 19
- 对包体积敏感
- 需要更好的性能

### 2. 渐进迁移策略
```typescript
// 智能降级方案
export async function smartCapture(element, filename, options = {}) {
  try {
    // 优先使用html-to-image
    await captureWithHtmlToImage(element, filename, options);
  } catch (error) {
    console.warn('html-to-image失败，降级到html2canvas:', error);
    // 降级到html2canvas
    await captureWithHtml2Canvas(element, filename, options);
  }
}
```

### 3. 配置对比
```typescript
// html-to-image配置 (推荐)
const htmlToImageOptions = {
  backgroundColor: '#ffffff',
  pixelRatio: 2,
  cacheBust: true,
  style: {
    transform: 'none',
    animation: 'none',
    transition: 'none',
  },
  filter: (node) => {
    return !node.classList?.contains('no-screenshot') &&
           node.tagName !== 'SCRIPT' &&
           node.tagName !== 'STYLE';
  }
};

// html2canvas配置 (需要大量修复)
const html2canvasOptions = {
  backgroundColor: '#ffffff',
  scale: 2,
  useCORS: true,
  allowTaint: true,
  scrollX: 0,
  scrollY: 0,
  windowWidth: actualWidth,
  windowHeight: actualHeight,
  ignoreElements: (el) => { /* 复杂逻辑 */ },
  onclone: (clonedDoc, clonedElement) => { /* 大量修复代码 */ }
};
```

## 🎯 最终建议

### 对于新项目
- **直接使用html-to-image**
- 更好的性能和准确性
- 更小的包体积
- 更好的现代框架兼容性

### 对于现有项目
- **逐步迁移到html-to-image**
- 使用智能降级策略
- 保持向后兼容性
- 重点解决错位问题

### 特殊情况
- 如果html-to-image无法满足特定需求
- 可以继续使用修复后的html2canvas
- 但建议优先尝试html-to-image

## 📚 相关资源

- [html-to-image GitHub](https://github.com/bubkoo/html-to-image)
- [html2canvas GitHub](https://github.com/niklasvh/html2canvas)
- [测试页面](./test-screenshot.html)
- [修复指南](./CANVAS_EXPORT_FIX_GUIDE.md)
