// 测试html-to-image的正确导入方式

// 方式1: 命名导入
import { toPng, toJpeg, toSvg } from 'html-to-image';

// 方式2: 全部导入
import * as htmlToImage from 'html-to-image';

// 方式3: 动态导入
const htmlToImageDynamic = await import('html-to-image');

console.log('方式1 - 命名导入:', typeof toPng);
console.log('方式2 - 全部导入:', typeof htmlToImage.toPng);
console.log('方式3 - 动态导入:', typeof htmlToImageDynamic.toPng);
