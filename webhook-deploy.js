#!/usr/bin/env node

/**
 * GitHub Container Registry Webhook处理程序
 * 当新的Docker镜像发布到GHCR时，自动拉取并部署
 */

const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 配置
const PORT = process.env.PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || ''; // GitHub webhook密钥
const DEPLOY_SCRIPT = process.env.DEPLOY_SCRIPT || './deploy.sh';

// 确保部署脚本存在且可执行
try {
  fs.accessSync(DEPLOY_SCRIPT, fs.constants.X_OK);
} catch (err) {
  console.error(`错误: 部署脚本 ${DEPLOY_SCRIPT} 不存在或不可执行`);
  console.error('请确保脚本存在并运行: chmod +x ' + DEPLOY_SCRIPT);
  process.exit(1);
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 只处理POST请求
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('方法不允许');
    return;
  }

  // 只处理/webhook路径
  if (req.url !== '/webhook') {
    res.statusCode = 404;
    res.end('未找到');
    return;
  }

  // 获取请求体
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    // 验证GitHub签名（如果设置了密钥）
    if (SECRET) {
      const signature = req.headers['x-hub-signature-256'];
      if (!signature) {
        res.statusCode = 401;
        res.end('未授权：缺少签名');
        return;
      }

      const hmac = crypto.createHmac('sha256', SECRET);
      const digest = 'sha256=' + hmac.update(body).digest('hex');
      if (signature !== digest) {
        res.statusCode = 401;
        res.end('未授权：签名无效');
        return;
      }
    }

    // 解析请求体
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (err) {
      res.statusCode = 400;
      res.end('无效的JSON');
      return;
    }

    // 检查事件类型
    const event = req.headers['x-github-event'];
    if (event === 'package' && payload.action === 'published') {
      console.log('检测到新的包发布，开始部署...');
      
      // 执行部署脚本
      exec(DEPLOY_SCRIPT, (error, stdout, stderr) => {
        if (error) {
          console.error(`部署错误: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`部署stderr: ${stderr}`);
        }
        console.log(`部署输出: ${stdout}`);
      });
      
      res.statusCode = 200;
      res.end('部署已启动');
    } else {
      console.log(`忽略事件: ${event}`);
      res.statusCode = 200;
      res.end('事件已忽略');
    }
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`Webhook服务器运行在端口 ${PORT}`);
  console.log(`使用部署脚本: ${DEPLOY_SCRIPT}`);
  console.log('等待GitHub包事件...');
});

// 处理进程信号
process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
}); 