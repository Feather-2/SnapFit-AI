import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { InputValidator, ValidationRule } from '@/lib/input-validator';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      title: 'Homepage Input Limits Test',
      limits: {
        chat: {
          messageLength: '10,000 characters',
          imagesPerMessage: '5 images max',
          imageSize: '500KB per image'
        },
        foodRecords: {
          foodName: '200 characters',
          description: '3,000 characters',
          calories: '0-10,000 kcal',
          grams: '0-10,000 g'
        },
        exerciseRecords: {
          exerciseName: '200 characters',
          description: '3,000 characters',
          duration: '0-1,440 minutes (24 hours)',
          calories: '0-10,000 kcal'
        },
        personalData: {
          weight: '20-500 kg',
          height: '50-300 cm',
          age: '1-150 years'
        },
        sync: {
          maxLogsPerRequest: '100 logs',
          maxLogSize: '50KB per log',
          maxTextFieldLength: '10,000 characters'
        }
      },
      testEndpoints: {
        'POST /test-chat-message': 'Test chat message limits',
        'POST /test-food-record': 'Test food record limits',
        'POST /test-exercise-record': 'Test exercise record limits',
        'POST /test-personal-data': 'Test personal data limits',
        'POST /test-sync-data': 'Test sync data limits'
      }
    });

  } catch (error) {
    console.error('Homepage limits test error:', error);
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
      case 'test-chat-message':
        // 测试聊天消息限制
        const { message, images } = data;
        
        const messageValidation = InputValidator.validateField(
          message, 
          { type: 'string', maxLength: 10000 }, 
          'message'
        );
        
        const imageValidation = images && Array.isArray(images) 
          ? { isValid: images.length <= 5, errors: images.length > 5 ? ['Too many images'] : [] }
          : { isValid: true, errors: [] };

        result.chatTest = {
          message: {
            length: message?.length || 0,
            validation: messageValidation,
            passed: messageValidation.isValid
          },
          images: {
            count: images?.length || 0,
            validation: imageValidation,
            passed: imageValidation.isValid
          },
          overall: messageValidation.isValid && imageValidation.isValid
        };
        break;

      case 'test-food-record':
        // 测试食物记录限制
        const { foodName, description, calories, grams } = data;
        
        const validations = {
          foodName: InputValidator.validateField(foodName, { type: 'string', maxLength: 200 }, 'foodName'),
          description: InputValidator.validateField(description, { type: 'string', maxLength: 3000 }, 'description'),
          calories: InputValidator.validateField(calories, { 
            type: 'number', 
            customValidator: (v) => v >= 0 && v <= 10000 
          }, 'calories'),
          grams: InputValidator.validateField(grams, { 
            type: 'number', 
            customValidator: (v) => v >= 0 && v <= 10000 
          }, 'grams')
        };

        result.foodTest = {
          validations,
          passed: Object.values(validations).every(v => v.isValid),
          summary: {
            foodNameLength: foodName?.length || 0,
            descriptionLength: description?.length || 0,
            caloriesValue: calories,
            gramsValue: grams
          }
        };
        break;

      case 'test-exercise-record':
        // 测试运动记录限制
        const { exerciseName, exerciseDescription, duration, exerciseCalories } = data;
        
        const exerciseValidations = {
          exerciseName: InputValidator.validateField(exerciseName, { type: 'string', maxLength: 200 }, 'exerciseName'),
          description: InputValidator.validateField(exerciseDescription, { type: 'string', maxLength: 3000 }, 'description'),
          duration: InputValidator.validateField(duration, { 
            type: 'number', 
            customValidator: (v) => v >= 0 && v <= 1440 
          }, 'duration'),
          calories: InputValidator.validateField(exerciseCalories, { 
            type: 'number', 
            customValidator: (v) => v >= 0 && v <= 10000 
          }, 'calories')
        };

        result.exerciseTest = {
          validations: exerciseValidations,
          passed: Object.values(exerciseValidations).every(v => v.isValid),
          summary: {
            exerciseNameLength: exerciseName?.length || 0,
            descriptionLength: exerciseDescription?.length || 0,
            durationValue: duration,
            caloriesValue: exerciseCalories
          }
        };
        break;

      case 'test-personal-data':
        // 测试个人数据限制
        const { weight, height, age } = data;
        
        const personalValidations = {
          weight: InputValidator.validateField(weight, { 
            type: 'number', 
            customValidator: (v) => v >= 20 && v <= 500 
          }, 'weight'),
          height: InputValidator.validateField(height, { 
            type: 'number', 
            customValidator: (v) => v >= 50 && v <= 300 
          }, 'height'),
          age: InputValidator.validateField(age, { 
            type: 'number', 
            customValidator: (v) => v >= 1 && v <= 150 
          }, 'age')
        };

        result.personalTest = {
          validations: personalValidations,
          passed: Object.values(personalValidations).every(v => v.isValid),
          summary: {
            weightValue: weight,
            heightValue: height,
            ageValue: age
          }
        };
        break;

      case 'test-sync-data':
        // 测试同步数据限制
        const { logs } = data;
        
        const syncValidation = {
          logCount: {
            isValid: Array.isArray(logs) && logs.length <= 100,
            errors: Array.isArray(logs) && logs.length > 100 ? ['Too many logs'] : []
          },
          logSizes: logs && Array.isArray(logs) ? logs.map((log, index) => {
            const size = JSON.stringify(log).length;
            return {
              index,
              size,
              isValid: size <= 50 * 1024,
              errors: size > 50 * 1024 ? ['Log too large'] : []
            };
          }) : []
        };

        result.syncTest = {
          logCount: logs?.length || 0,
          validation: syncValidation,
          passed: syncValidation.logCount.isValid && 
                  syncValidation.logSizes.every(ls => ls.isValid),
          summary: {
            totalLogs: logs?.length || 0,
            totalSize: logs ? JSON.stringify(logs).length : 0,
            averageLogSize: logs?.length ? Math.round(JSON.stringify(logs).length / logs.length) : 0
          }
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Homepage limits test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
