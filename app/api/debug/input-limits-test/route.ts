import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { InputValidator, ValidationRule } from '@/lib/input-validator';
import { getSizeLimits, formatBytes } from '@/lib/request-size-limiter';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      title: 'Input Limits Test & Information',
      requestSizeLimits: getSizeLimits(),
      fieldLimits: {
        text: {
          notes: '2000 characters',
          medicalHistory: '5000 characters',
          lifestyle: '3000 characters',
          description: '1000 characters',
          goal: '100 characters',
          tag: '50 characters'
        },
        numbers: {
          weight: '20-500 kg',
          height: '50-300 cm',
          age: '1-150 years',
          targetCalories: '500-10000 calories'
        },
        arrays: {
          tags: 'Maximum 10 tags',
          messages: 'Maximum 100 messages'
        },
        files: {
          images: 'Maximum 500KB, JPEG/PNG/GIF/WebP only'
        }
      },
      testInstructions: {
        'POST /test-field': 'Test individual field validation',
        'POST /test-large-request': 'Test request size limits',
        'POST /test-profile': 'Test profile data validation'
      }
    });

  } catch (error) {
    console.error('Input limits test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { testType, data } = await request.json();

    let result: any = {
      testType,
      timestamp: new Date().toISOString()
    };

    switch (testType) {
      case 'test-field':
        // 测试单个字段验证
        const { fieldName, fieldValue, rules } = data;
        
        const fieldResult = InputValidator.validateField(fieldValue, rules, fieldName);
        
        result.fieldTest = {
          fieldName,
          fieldValue: typeof fieldValue === 'string' && fieldValue.length > 100 
            ? fieldValue.substring(0, 100) + '...' 
            : fieldValue,
          rules,
          validation: fieldResult,
          passed: fieldResult.isValid
        };
        break;

      case 'test-large-request':
        // 测试大请求
        const requestSize = JSON.stringify(data).length;
        
        result.sizeTest = {
          requestSize: formatBytes(requestSize),
          requestSizeBytes: requestSize,
          limits: getSizeLimits(),
          wouldBeBlocked: requestSize > 100 * 1024, // settings API limit
          message: requestSize > 100 * 1024 
            ? 'This request would be blocked by size limits'
            : 'This request is within size limits'
        };
        break;

      case 'test-profile':
        // 测试profile数据验证
        const profileData = data.profileData || {};
        
        const validationRules: Record<string, ValidationRule> = {
          weight: { required: false, type: 'number', customValidator: (v) => v >= 20 && v <= 500 },
          height: { required: false, type: 'number', customValidator: (v) => v >= 50 && v <= 300 },
          age: { required: false, type: 'number', customValidator: (v) => v >= 1 && v <= 150 },
          notes: { required: false, type: 'string', maxLength: 2000 },
          medicalHistory: { required: false, type: 'string', maxLength: 5000 },
          lifestyle: { required: false, type: 'string', maxLength: 3000 }
        };

        const profileResult = InputValidator.validateObject(profileData, validationRules);
        
        result.profileTest = {
          profileData: Object.keys(profileData).reduce((acc, key) => {
            const value = profileData[key];
            acc[key] = typeof value === 'string' && value.length > 100 
              ? value.substring(0, 100) + '...' 
              : value;
            return acc;
          }, {} as any),
          validation: profileResult,
          passed: profileResult.isValid,
          sanitizedData: profileResult.sanitizedValue
        };
        break;

      case 'test-extreme':
        // 测试极端情况
        const extremeTests = [
          {
            name: 'Very long string',
            test: () => {
              const longString = 'A'.repeat(10000);
              return InputValidator.validateField(longString, { type: 'string', maxLength: 1000 }, 'longString');
            }
          },
          {
            name: 'Invalid number',
            test: () => {
              return InputValidator.validateField('not-a-number', { type: 'number' }, 'invalidNumber');
            }
          },
          {
            name: 'XSS attempt',
            test: () => {
              const xssString = '<script>alert("xss")</script>';
              return InputValidator.validateField(xssString, { type: 'string', maxLength: 100 }, 'xssString');
            }
          },
          {
            name: 'SQL injection attempt',
            test: () => {
              const sqlString = "'; DROP TABLE users; --";
              return InputValidator.validateField(sqlString, { type: 'string', maxLength: 100 }, 'sqlString');
            }
          }
        ];

        result.extremeTests = extremeTests.map(test => ({
          name: test.name,
          result: test.test(),
          passed: test.test().isValid
        }));
        break;

      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Input limits test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
