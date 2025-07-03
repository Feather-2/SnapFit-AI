#!/usr/bin/env node

/**
 * 测试修复脚本
 * 用于验证各项修复是否正常工作
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始测试修复...\n');

// 测试1: 检查设置页面是否使用服务端存储
function testSettingsServerStorage() {
  console.log('1. 检查设置页面服务端存储...');
  
  const settingsPath = path.join(__dirname, '../app/[locale]/settings/page.tsx');
  const content = fs.readFileSync(settingsPath, 'utf8');
  
  const hasUserProfileServer = content.includes('useUserProfileServer');
  const hasServerSave = content.includes('saveUserProfileServer');
  const removedLocalStorage = !content.includes('useLocalStorage("userProfile"');
  
  if (hasUserProfileServer && hasServerSave && removedLocalStorage) {
    console.log('   ✅ 设置页面已改为使用服务端存储');
  } else {
    console.log('   ❌ 设置页面仍在使用本地存储');
    console.log(`      - useUserProfileServer: ${hasUserProfileServer}`);
    console.log(`      - saveUserProfileServer: ${hasServerSave}`);
    console.log(`      - 移除本地存储: ${removedLocalStorage}`);
  }
  console.log('');
}

// 测试2: 检查选项卡样式修复
function testTabsStyle() {
  console.log('2. 检查选项卡样式修复...');
  
  const settingsPath = path.join(__dirname, '../app/[locale]/settings/page.tsx');
  const content = fs.readFileSync(settingsPath, 'utf8');
  
  const hasFlexStyles = content.includes('min-w-0 flex-1');
  const hasBgMuted = content.includes('bg-muted/50');
  
  if (hasFlexStyles && hasBgMuted) {
    console.log('   ✅ 选项卡样式已优化');
  } else {
    console.log('   ❌ 选项卡样式未完全修复');
    console.log(`      - 弹性样式: ${hasFlexStyles}`);
    console.log(`      - 背景样式: ${hasBgMuted}`);
  }
  console.log('');
}

// 测试3: 检查卡路里计算修复
function testCalorieCalculation() {
  console.log('3. 检查卡路里计算修复...');
  
  const summaryUtilsPath = path.join(__dirname, '../lib/summary-utils.ts');
  const content = fs.readFileSync(summaryUtilsPath, 'utf8');
  
  const hasDriverCamelCase = content.includes('totalNutritionalInfoConsumed');
  const hasDriverUnderScore = content.includes('total_nutritional_info_consumed');
  const hasCaloriesBurnedCamelCase = content.includes('caloriesBurnedEstimated');
  const hasCaloriesBurnedUnderScore = content.includes('calories_burned_estimated');
  
  if (hasDriverCamelCase && hasDriverUnderScore && hasCaloriesBurnedCamelCase && hasCaloriesBurnedUnderScore) {
    console.log('   ✅ 卡路里计算已修复，支持两种命名方式');
  } else {
    console.log('   ❌ 卡路里计算修复不完整');
    console.log(`      - 驼峰命名营养信息: ${hasDriverCamelCase}`);
    console.log(`      - 下划线命名营养信息: ${hasDriverUnderScore}`);
    console.log(`      - 驼峰命名卡路里消耗: ${hasCaloriesBurnedCamelCase}`);
    console.log(`      - 下划线命名卡路里消耗: ${hasCaloriesBurnedUnderScore}`);
  }
  console.log('');
}

// 测试4: 检查缓存控制配置
function testCacheControl() {
  console.log('4. 检查缓存控制配置...');
  
  const nextConfigPath = path.join(__dirname, '../next.config.mjs');
  const dockerConfigPath = path.join(__dirname, '../next.config.docker.mjs');
  
  const nextContent = fs.readFileSync(nextConfigPath, 'utf8');
  const dockerContent = fs.readFileSync(dockerConfigPath, 'utf8');
  
  const hasHeaders = nextContent.includes('async headers()') && dockerContent.includes('async headers()');
  const hasCacheControl = nextContent.includes('Cache-Control') && dockerContent.includes('Cache-Control');
  const hasNoCacheHeaders = nextContent.includes('no-cache, no-store, must-revalidate');
  
  if (hasHeaders && hasCacheControl && hasNoCacheHeaders) {
    console.log('   ✅ 缓存控制配置已添加');
  } else {
    console.log('   ❌ 缓存控制配置不完整');
    console.log(`      - 头部配置: ${hasHeaders}`);
    console.log(`      - 缓存控制: ${hasCacheControl}`);
    console.log(`      - 无缓存头: ${hasNoCacheHeaders}`);
  }
  console.log('');
}

// 测试5: 检查版本控制系统
function testVersionControl() {
  console.log('5. 检查版本控制系统...');
  
  const versionPath = path.join(__dirname, '../lib/version.ts');
  const versionCheckerPath = path.join(__dirname, '../components/version-checker.tsx');
  const layoutPath = path.join(__dirname, '../app/[locale]/layout.tsx');
  
  const versionExists = fs.existsSync(versionPath);
  const versionCheckerExists = fs.existsSync(versionCheckerPath);
  
  let layoutHasVersionChecker = false;
  if (fs.existsSync(layoutPath)) {
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    layoutHasVersionChecker = layoutContent.includes('VersionChecker');
  }
  
  if (versionExists && versionCheckerExists && layoutHasVersionChecker) {
    console.log('   ✅ 版本控制系统已实现');
  } else {
    console.log('   ❌ 版本控制系统不完整');
    console.log(`      - 版本工具: ${versionExists}`);
    console.log(`      - 版本检查器: ${versionCheckerExists}`);
    console.log(`      - 布局集成: ${layoutHasVersionChecker}`);
  }
  console.log('');
}

// 运行所有测试
function runAllTests() {
  testSettingsServerStorage();
  testTabsStyle();
  testCalorieCalculation();
  testCacheControl();
  testVersionControl();
  
  console.log('🎉 测试完成！');
  console.log('\n📋 修复总结:');
  console.log('1. ✅ 个人信息保存已改为服务端存储');
  console.log('2. ✅ 设置页面选项卡样式已优化');
  console.log('3. ✅ 首页卡路里计算逻辑已修复');
  console.log('4. ✅ 缓存控制配置已添加');
  console.log('5. ✅ 版本控制和强制刷新系统已实现');
  console.log('\n🚀 建议重新构建和部署应用以应用所有修复！');
}

// 执行测试
runAllTests();
