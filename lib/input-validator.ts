/**
 * 输入验证和清理工具
 * 防止恶意输入和注入攻击
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  type?: 'string' | 'number' | 'email' | 'url' | 'array' | 'object';
  customValidator?: (value: any) => boolean | string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

export class InputValidator {
  /**
   * 验证单个字段
   */
  static validateField(value: any, rules: ValidationRule, fieldName: string = 'field'): ValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;

    // 必填检查
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    // 如果值为空且非必填，直接返回成功
    if (!rules.required && (value === undefined || value === null || value === '')) {
      return { isValid: true, errors: [], sanitizedValue: value };
    }

    // 类型检查
    if (rules.type) {
      switch (rules.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`${fieldName} must be a string`);
          } else {
            // 清理字符串：移除潜在的XSS字符
            sanitizedValue = this.sanitizeString(value);
          }
          break;
        case 'number':
          if (typeof value !== 'number' && isNaN(Number(value))) {
            errors.push(`${fieldName} must be a number`);
          } else {
            sanitizedValue = Number(value);
          }
          break;
        case 'email':
          if (typeof value !== 'string' || !this.isValidEmail(value)) {
            errors.push(`${fieldName} must be a valid email`);
          }
          break;
        case 'url':
          if (typeof value !== 'string' || !this.isValidUrl(value)) {
            errors.push(`${fieldName} must be a valid URL`);
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`${fieldName} must be an array`);
          }
          break;
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value) || value === null) {
            errors.push(`${fieldName} must be an object`);
          }
          break;
      }
    }

    // 长度检查（适用于字符串和数组）
    if (rules.minLength !== undefined) {
      const length = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : 0;
      if (length < rules.minLength) {
        errors.push(`${fieldName} must be at least ${rules.minLength} characters/items long`);
      }
    }

    if (rules.maxLength !== undefined) {
      const length = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : 0;
      if (length > rules.maxLength) {
        errors.push(`${fieldName} must be no more than ${rules.maxLength} characters/items long`);
      }
    }

    // 正则表达式检查
    if (rules.pattern && typeof value === 'string') {
      if (!rules.pattern.test(value)) {
        errors.push(`${fieldName} format is invalid`);
      }
    }

    // 自定义验证器
    if (rules.customValidator) {
      const customResult = rules.customValidator(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `${fieldName} is invalid`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: errors.length === 0 ? sanitizedValue : value
    };
  }

  /**
   * 验证对象的多个字段
   */
  static validateObject(data: Record<string, any>, rules: Record<string, ValidationRule>): ValidationResult {
    const allErrors: string[] = [];
    const sanitizedData: Record<string, any> = {};

    for (const [fieldName, fieldRules] of Object.entries(rules)) {
      const fieldValue = data[fieldName];
      const result = this.validateField(fieldValue, fieldRules, fieldName);

      if (!result.isValid) {
        allErrors.push(...result.errors);
      } else {
        sanitizedData[fieldName] = result.sanitizedValue;
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      sanitizedValue: allErrors.length === 0 ? sanitizedData : data
    };
  }

  /**
   * 清理字符串，防止XSS攻击
   */
  private static sanitizeString(str: string): string {
    return str
      .replace(/[<>]/g, '') // 移除尖括号
      .replace(/javascript:/gi, '') // 移除javascript协议
      .replace(/on\w+=/gi, '') // 移除事件处理器
      .trim();
  }

  /**
   * 验证邮箱格式
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证URL格式
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证AI消息数组
   */
  static validateAIMessages(messages: any[]): ValidationResult {
    if (!Array.isArray(messages)) {
      return { isValid: false, errors: ['Messages must be an array'] };
    }

    if (messages.length === 0) {
      return { isValid: false, errors: ['Messages array cannot be empty'] };
    }

    if (messages.length > 100) {
      return { isValid: false, errors: ['Too many messages (max 100)'] };
    }

    const errors: string[] = [];
    const sanitizedMessages: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      if (!message || typeof message !== 'object') {
        errors.push(`Message ${i} must be an object`);
        continue;
      }

      if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
        errors.push(`Message ${i} must have a valid role (user, assistant, or system)`);
        continue;
      }

      if (!message.content || typeof message.content !== 'string') {
        errors.push(`Message ${i} must have content as a string`);
        continue;
      }

      if (message.content.length > 10000) {
        errors.push(`Message ${i} content is too long (max 10000 characters)`);
        continue;
      }

      sanitizedMessages.push({
        role: message.role,
        content: this.sanitizeString(message.content)
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: errors.length === 0 ? sanitizedMessages : messages
    };
  }

  /**
   * 验证文件上传
   */
  static validateFileUpload(file: File): ValidationResult {
    const errors: string[] = [];

    // 文件大小限制：500KB
    const maxSize = 500 * 1024;
    if (file.size > maxSize) {
      errors.push(`File size must be less than ${maxSize / 1024}KB`);
    }

    // 文件类型限制
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      errors.push('File type must be JPEG, PNG, GIF, or WebP');
    }

    // 文件名长度限制
    if (file.name.length > 255) {
      errors.push('File name is too long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * 常用验证规则预设
 */
export const ValidationRules = {
  // 用户名
  username: {
    required: true,
    type: 'string' as const,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_-]+$/
  },

  // 邮箱
  email: {
    required: true,
    type: 'email' as const,
    maxLength: 255
  },

  // 密码
  password: {
    required: true,
    type: 'string' as const,
    minLength: 8,
    maxLength: 128
  },

  // AI配置名称
  configName: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: 100
  },

  // API密钥
  apiKey: {
    required: true,
    type: 'string' as const,
    minLength: 10,
    maxLength: 200, // 降低到200字符
    pattern: /^[a-zA-Z0-9_\-\.]+$/ // 允许点号
  },

  // 描述字段
  description: {
    required: false,
    type: 'string' as const,
    maxLength: 1000 // 最大1000字符
  },

  // 备注字段
  notes: {
    required: false,
    type: 'string' as const,
    maxLength: 2000 // 最大2000字符
  },

  // 医疗历史
  medicalHistory: {
    required: false,
    type: 'string' as const,
    maxLength: 5000 // 最大5000字符
  },

  // 生活方式
  lifestyle: {
    required: false,
    type: 'string' as const,
    maxLength: 3000 // 最大3000字符
  },

  // 标签数组
  tags: {
    required: false,
    type: 'array' as const,
    maxLength: 10 // 最多10个标签
  },

  // 单个标签
  tag: {
    required: false,
    type: 'string' as const,
    maxLength: 50 // 单个标签最大50字符
  },

  // Base URL
  baseUrl: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: 500,
    pattern: /^https?:\/\/.+/ // 基本URL格式
  },

  // 每日限制
  dailyLimit: {
    required: true,
    type: 'number' as const,
    customValidator: (value: number) => {
      if (value === 999999) return true; // 无限制
      return value >= 150 && value <= 99999;
    }
  }
};
