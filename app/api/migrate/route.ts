import { NextRequest, NextResponse } from 'next/server'
import { DataMigration } from '@/lib/migration-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data, userId, userEmail, userName } = body

    switch (action) {
      case 'migrate_from_indexeddb':
        const migrationResult = await DataMigration.migrateFromIndexedDB(
          data,
          userEmail,
          userName
        )
        return NextResponse.json(migrationResult)

      case 'validate_migration':
        if (!userId) {
          return NextResponse.json(
            { error: 'Missing userId for validation' },
            { status: 400 }
          )
        }
        const validationResult = await DataMigration.validateMigration(userId)
        return NextResponse.json(validationResult)

      case 'create_backup':
        if (!userId) {
          return NextResponse.json(
            { error: 'Missing userId for backup' },
            { status: 400 }
          )
        }
        const backupResult = await DataMigration.createBackup(userId)
        return NextResponse.json(backupResult)

      case 'restore_from_backup':
        const restoreResult = await DataMigration.restoreFromBackup(
          data,
          userId
        )
        return NextResponse.json(restoreResult)

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Migration API error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 