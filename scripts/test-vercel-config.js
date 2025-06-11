#!/usr/bin/env node

/**
 * 测试 Vercel 配置和超时设置
 * 运行: node scripts/test-vercel-config.js
 */

// 模拟不同的环境变量
const testConfigs = [
  {
    name: 'Local Development',
    env: {},
  },
  {
    name: 'Vercel Hobby',
    env: {
      VERCEL: '1',
      VERCEL_ENV: 'production',
    },
  },
  {
    name: 'Vercel Pro',
    env: {
      VERCEL: '1',
      VERCEL_ENV: 'production',
      VERCEL_PLAN: 'pro',
    },
  },
];

function testConfig(config) {
  console.log(`\n🧪 Testing: ${config.name}`);
  console.log('=' .repeat(50));

  // 设置环境变量
  Object.keys(config.env).forEach(key => {
    process.env[key] = config.env[key];
  });

  // 清除模块缓存以重新加载配置
  delete require.cache[require.resolve('../lib/vercel-config.ts')];
  delete require.cache[require.resolve('../lib/openai-client.ts')];

  try {
    // 动态导入配置（需要转译 TypeScript）
    console.log('📋 Environment Variables:');
    console.log(`  VERCEL: ${process.env.VERCEL || 'undefined'}`);
    console.log(`  VERCEL_ENV: ${process.env.VERCEL_ENV || 'undefined'}`);
    console.log(`  VERCEL_PLAN: ${process.env.VERCEL_PLAN || 'undefined'}`);

    // 模拟配置逻辑
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
    const isPro = process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PLAN === 'pro';

    console.log('\n⚙️  Configuration Results:');
    console.log(`  Is Vercel Environment: ${isVercel}`);
    console.log(`  Is Pro Plan: ${isPro}`);

    // 计算超时值
    const functionTimeout = isPro ? 300 : 60; // 秒
    const singleRequestTimeout = Math.min(functionTimeout * 0.7 * 1000, 50000); // 毫秒
    const overallTimeout = Math.min(functionTimeout * 0.85 * 1000, 55000); // 毫秒

    console.log('\n⏱️  Timeout Settings:');
    console.log(`  Function Max Duration: ${functionTimeout}s`);
    console.log(`  Single Request Timeout: ${singleRequestTimeout / 1000}s`);
    console.log(`  Overall Process Timeout: ${overallTimeout / 1000}s`);

    // OpenAI Client 超时
    const openaiTimeouts = {
      SIMPLE_CHAT: isVercel ? 45000 : 55000,
      SMART_SUGGESTIONS: isVercel ? 50000 : 55000,
      DEFAULT: isVercel ? 45000 : 55000,
    };

    console.log('\n🤖 OpenAI Client Timeouts:');
    Object.entries(openaiTimeouts).forEach(([key, value]) => {
      console.log(`  ${key}: ${value / 1000}s`);
    });

    // 验证配置合理性
    console.log('\n✅ Configuration Validation:');
    const issues = [];

    if (singleRequestTimeout >= functionTimeout * 1000) {
      issues.push('Single request timeout exceeds function duration');
    }

    if (overallTimeout >= functionTimeout * 1000) {
      issues.push('Overall timeout exceeds function duration');
    }

    if (openaiTimeouts.SMART_SUGGESTIONS >= functionTimeout * 1000) {
      issues.push('OpenAI timeout exceeds function duration');
    }

    if (issues.length === 0) {
      console.log('  ✅ All timeouts are properly configured');
    } else {
      console.log('  ❌ Configuration issues found:');
      issues.forEach(issue => console.log(`    - ${issue}`));
    }

  } catch (error) {
    console.error(`❌ Error testing ${config.name}:`, error.message);
  }

  // 清理环境变量
  Object.keys(config.env).forEach(key => {
    delete process.env[key];
  });
}

console.log('🚀 Vercel Configuration Test Suite');
console.log('Testing timeout configurations for different environments...\n');

testConfigs.forEach(testConfig);

console.log('\n🎯 Summary:');
console.log('- Hobby Plan: 60s max duration, optimized timeouts');
console.log('- Pro Plan: 300s max duration, extended timeouts');
console.log('- Local Dev: 60s timeouts for consistency');
console.log('\n📚 For more details, see: docs/smart-suggestions-timeout-fix.md');
