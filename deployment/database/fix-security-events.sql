-- 修复安全事件表中的错误记录
-- 将系统维护事件从 suspicious_activity 改为 system_maintenance

-- 1. 添加新的事件类型到约束中（如果还没有的话）
DO $$
BEGIN
    -- 检查约束是否已经包含 system_maintenance
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'valid_event_type' 
        AND check_clause LIKE '%system_maintenance%'
    ) THEN
        -- 删除旧约束
        ALTER TABLE security_events DROP CONSTRAINT IF EXISTS valid_event_type;
        
        -- 添加新约束
        ALTER TABLE security_events ADD CONSTRAINT valid_event_type CHECK (event_type IN (
            'rate_limit_exceeded',
            'invalid_input',
            'unauthorized_access',
            'suspicious_activity',
            'brute_force_attempt',
            'data_injection_attempt',
            'file_upload_violation',
            'api_abuse',
            'privilege_escalation_attempt',
            'system_maintenance'
        ));
        
        RAISE NOTICE 'Added system_maintenance event type to constraints';
    ELSE
        RAISE NOTICE 'system_maintenance event type already exists in constraints';
    END IF;
END $$;

-- 2. 修复现有的错误记录
UPDATE security_events 
SET event_type = 'system_maintenance'
WHERE event_type = 'suspicious_activity' 
  AND (
    description LIKE '%Security system upgrade completed%' OR
    description LIKE '%Automatically unbanned expired IPs%' OR
    description LIKE '%system upgrade%' OR
    description LIKE '%maintenance%'
  );

-- 3. 显示修复结果
DO $$
DECLARE
    fixed_count INTEGER;
    total_suspicious INTEGER;
    total_maintenance INTEGER;
BEGIN
    -- 统计修复的记录数
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    
    -- 统计当前的事件类型分布
    SELECT COUNT(*) INTO total_suspicious
    FROM security_events 
    WHERE event_type = 'suspicious_activity';
    
    SELECT COUNT(*) INTO total_maintenance
    FROM security_events 
    WHERE event_type = 'system_maintenance';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Security Events Cleanup Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Records fixed: %', fixed_count;
    RAISE NOTICE 'Current suspicious_activity events: %', total_suspicious;
    RAISE NOTICE 'Current system_maintenance events: %', total_maintenance;
    RAISE NOTICE '';
    
    IF fixed_count > 0 THEN
        RAISE NOTICE '✅ Successfully moved % system events from suspicious_activity to system_maintenance', fixed_count;
    ELSE
        RAISE NOTICE '✅ No system events found in suspicious_activity category';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- 4. 显示当前事件类型分布
SELECT 
    event_type,
    COUNT(*) as count,
    MIN(created_at) as first_event,
    MAX(created_at) as last_event
FROM security_events 
GROUP BY event_type 
ORDER BY count DESC;
