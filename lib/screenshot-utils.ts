/**
 * 截图工具函数
 * 支持html2canvas和html-to-image两种方案
 */

/**
 * 修复导航栏和页面布局错位问题的工具函数
 * @param element 要修复的元素
 * @param options 修复选项
 */
export function fixElementPositioning(
  element: HTMLElement,
  options: {
    resetTransforms?: boolean;
    fixPositioning?: boolean;
    preserveAbsolute?: boolean;
    fixNavigation?: boolean;
  } = {}
): () => void {
  const {
    resetTransforms = true,
    fixPositioning = true,
    preserveAbsolute = true,
    fixNavigation = true
  } = options;

  // 保存原始样式
  const originalStyles = new Map<HTMLElement, {
    transform: string;
    position: string;
    top: string;
    left: string;
    right: string;
    bottom: string;
    animation: string;
    transition: string;
    zIndex: string;
  }>();

  // 保存导航栏的原始样式
  const navigationElements = document.querySelectorAll('nav, [class*="nav"], .sticky, [class*="sticky"]') as NodeListOf<HTMLElement>;
  const originalNavStyles = new Map<HTMLElement, {
    position: string;
    top: string;
    zIndex: string;
    transform: string;
  }>();

  // 修复导航栏
  if (fixNavigation) {
    navigationElements.forEach((nav) => {
      if (nav.style) {
        // 保存原始样式
        originalNavStyles.set(nav, {
          position: nav.style.position,
          top: nav.style.top,
          zIndex: nav.style.zIndex,
          transform: nav.style.transform,
        });

        // 检查是否是sticky或fixed导航栏
        const computedStyle = window.getComputedStyle(nav);
        if (computedStyle.position === 'sticky' || computedStyle.position === 'fixed') {
          nav.style.position = 'relative';
          nav.style.top = '';
          nav.style.transform = '';
          nav.style.zIndex = '';
        }
      }
    });
  }

  // 获取所有子元素
  const allElements = [element, ...element.querySelectorAll('*')] as HTMLElement[];

  allElements.forEach((el) => {
    if (!el.style) return;

    // 保存原始样式
    originalStyles.set(el, {
      transform: el.style.transform,
      position: el.style.position,
      top: el.style.top,
      left: el.style.left,
      right: el.style.right,
      bottom: el.style.bottom,
      animation: el.style.animation,
      transition: el.style.transition,
      zIndex: el.style.zIndex,
    });

    // 应用修复
    if (resetTransforms) {
      el.style.transform = '';
      el.style.animation = '';
      el.style.transition = '';
    }

    if (fixPositioning) {
      const currentPosition = el.style.position || window.getComputedStyle(el).position;
      if (currentPosition === 'fixed' || currentPosition === 'sticky') {
        el.style.position = 'relative';
        el.style.top = '';
        el.style.left = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.zIndex = '';
      } else if (!preserveAbsolute && currentPosition === 'absolute') {
        el.style.position = 'relative';
      }
    }
  });

  // 返回恢复函数
  return () => {
    // 恢复导航栏样式
    if (fixNavigation) {
      navigationElements.forEach((nav) => {
        const original = originalNavStyles.get(nav);
        if (original && nav.style) {
          Object.assign(nav.style, original);
        }
      });
    }

    // 恢复元素样式
    allElements.forEach((el) => {
      const original = originalStyles.get(el);
      if (original && el.style) {
        Object.assign(el.style, original);
      }
    });
  };
}



/**
 * 使用浏览器原生截图API（如果支持）
 * @param element 要截图的元素
 * @param filename 文件名
 */
export async function captureWithNativeAPI(
  element: HTMLElement,
  filename: string = 'screenshot.png'
): Promise<void> {
  try {
    // 检查是否支持Screen Capture API
    if (!('getDisplayMedia' in navigator.mediaDevices)) {
      throw new Error('浏览器不支持屏幕捕获API');
    }

    // 请求屏幕捕获权限
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true
    });

    // 创建video元素来捕获流
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    // 等待视频加载
    await new Promise((resolve) => {
      video.onloadedmetadata = resolve;
    });

    // 创建canvas来绘制视频帧
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 绘制当前帧
    ctx.drawImage(video, 0, 0);

    // 停止流
    stream.getTracks().forEach(track => track.stop());

    // 转换为blob并下载
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('原生截图失败:', error);
    throw new Error('屏幕捕获失败，请检查浏览器权限设置');
  }
}

/**
 * 简单的DOM转图片功能（不依赖外部库）
 * @param element 要截图的元素
 * @param filename 文件名
 */
export async function captureElementSimple(
  element: HTMLElement,
  filename: string = 'screenshot.png'
): Promise<void> {
  try {
    // 获取元素的样式和内容
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    // 创建SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', rect.width.toString());
    svg.setAttribute('height', rect.height.toString());
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

    // 创建foreignObject来包含HTML内容
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('width', '100%');
    foreignObject.setAttribute('height', '100%');

    // 克隆元素
    const clonedElement = element.cloneNode(true) as HTMLElement;

    // 应用样式
    clonedElement.style.width = rect.width + 'px';
    clonedElement.style.height = rect.height + 'px';
    clonedElement.style.backgroundColor = computedStyle.backgroundColor || '#ffffff';

    foreignObject.appendChild(clonedElement);
    svg.appendChild(foreignObject);

    // 转换为数据URL
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    // 创建图片
    const img = new Image();
    img.onload = () => {
      // 创建canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      canvas.width = rect.width * 2; // 高分辨率
      canvas.height = rect.height * 2;

      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);

      // 转换为blob并下载
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          URL.revokeObjectURL(url);
        }
      }, 'image/png');

      URL.revokeObjectURL(svgUrl);
    };

    img.src = svgUrl;

  } catch (error) {
    console.error('简单截图失败:', error);
    throw new Error('截图功能暂时不可用');
  }
}

/**
 * 使用html-to-image库进行截图 - 更好的定位精度
 * @param element 要截图的HTML元素
 * @param filename 下载的文件名
 * @param options 截图选项
 */
export async function captureWithHtmlToImage(
  element: HTMLElement,
  filename: string = 'screenshot.png',
  options: {
    backgroundColor?: string;
    scale?: number;
    quality?: number;
    format?: 'png' | 'jpeg';
    fixNavigation?: boolean;
  } = {}
): Promise<void> {
  const {
    backgroundColor = '#ffffff',
    scale = 2,
    quality = 0.9,
    format = 'png',
    fixNavigation = true
  } = options;

  try {
    // 动态导入html-to-image
    const { toPng, toJpeg } = await import('html-to-image');

    // 保存当前滚动位置
    const originalScrollTop = window.scrollY || document.documentElement.scrollTop;
    const originalScrollLeft = window.scrollX || document.documentElement.scrollLeft;

    // 滚动到页面顶部以避免偏移
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 100));

    // 应用错位修复，包括导航栏修复
    const restorePositioning = fixNavigation ? fixElementPositioning(element, {
      resetTransforms: true,
      fixPositioning: true,
      preserveAbsolute: true,
      fixNavigation: true
    }) : () => {};

    // 保存容器原始样式
    const originalContainerStyles = {
      width: element.style.width,
      maxWidth: element.style.maxWidth,
      margin: element.style.margin,
      padding: element.style.padding,
      position: element.style.position,
      transform: element.style.transform,
    };

    // 获取元素实际尺寸
    const rect = element.getBoundingClientRect();
    const actualWidth = Math.min(element.scrollWidth || rect.width, 800);
    const actualHeight = element.scrollHeight || rect.height;

    // 临时调整容器样式
    element.style.width = `${actualWidth}px`;
    element.style.maxWidth = `${actualWidth}px`;
    element.style.margin = '0';
    element.style.padding = '2rem';
    element.style.position = 'static';
    element.style.transform = 'none';

    // 等待样式应用
    await new Promise(resolve => setTimeout(resolve, 100));

    // 配置html-to-image选项
    const htmlToImageOptions = {
      backgroundColor,
      pixelRatio: scale,
      quality: format === 'jpeg' ? quality : undefined,
      cacheBust: true,
      width: actualWidth,
      height: actualHeight,
      style: {
        transform: 'none',
        animation: 'none',
        transition: 'none',
        width: `${actualWidth}px`,
        maxWidth: `${actualWidth}px`,
        margin: '0',
        padding: '2rem',
        position: 'static',
      },
      filter: (node: HTMLElement) => {
        // 排除可能干扰的元素
        return !node.classList?.contains('no-screenshot') &&
               node.tagName !== 'SCRIPT' &&
               node.tagName !== 'STYLE';
      },
    };

    // 根据格式选择对应的函数
    let dataUrl: string;
    if (format === 'jpeg') {
      dataUrl = await toJpeg(element, htmlToImageOptions);
    } else {
      dataUrl = await toPng(element, htmlToImageOptions);
    }

    // 恢复容器原始样式
    Object.assign(element.style, originalContainerStyles);

    // 恢复原始样式和滚动位置
    restorePositioning();
    window.scrollTo(originalScrollLeft, originalScrollTop);

    // 下载图片
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error('html-to-image截图失败:', error);
    throw new Error(`截图失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 智能截图函数 - 自动选择最佳截图方法
 * @param element 要截图的元素
 * @param filename 文件名
 * @param options 选项
 */
export async function smartCapture(
  element: HTMLElement,
  filename: string = 'summary-screenshot.png',
  options: {
    preferredMethod?: 'html2canvas' | 'html-to-image' | 'native' | 'simple';
    backgroundColor?: string;
    scale?: number;
  } = {}
): Promise<void> {
  const { preferredMethod = 'html-to-image', backgroundColor = '#ffffff', scale = 2 } = options;

  // 添加时间戳到文件名
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const finalFilename = filename.replace('.png', `_${timestamp}.png`);

  try {
    switch (preferredMethod) {
      case 'html-to-image':
        await captureWithHtmlToImage(element, finalFilename, { backgroundColor, scale });
        break;
      case 'html2canvas':
        // html2canvas已移除，使用html-to-image替代
        await captureWithHtmlToImage(element, finalFilename, { backgroundColor, scale });
        break;
      case 'native':
        await captureWithNativeAPI(element, finalFilename);
        break;
      case 'simple':
        await captureElementSimple(element, finalFilename);
        break;
      default:
        // 优先尝试html-to-image，失败则使用简单截图
        try {
          await captureWithHtmlToImage(element, finalFilename, { backgroundColor, scale });
        } catch {
          await captureElementSimple(element, finalFilename);
        }
    }
  } catch (error) {
    console.error('所有截图方法都失败了:', error);
    throw error;
  }
}
