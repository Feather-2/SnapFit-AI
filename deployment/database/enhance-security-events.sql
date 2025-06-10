-- 增强安全事件记录
-- 为缺失用户ID的安全事件补充用户信息

-- ========================================
-- 1. 分析当前安全事件的用户ID缺失情况
-- ========================================

DO $$
DECLARE
    total_events INTEGER;
    events_with_user INTEGER;
    events_without_user INTEGER;
    missing_percentage NUMERIC;
BEGIN
    -- 统计总事件数
    SELECT COUNT(*) INTO total_events FROM security_events;
    
    -- 统计有用户ID的事件数
    SELECT COUNT(*) INTO events_with_user FROM security_events WHERE user_id IS NOT NULL;
    
    -- 统计缺少用户ID的事件数
    SELECT COUNT(*) INTO events_without_user FROM security_events WHERE user_id IS NULL;
    
    -- 计算缺失百分比
    IF total_events > 0 THEN
        missing_percentage := (events_without_user::NUMERIC / total_events::NUMERIC) * 100;
    ELSE
        missing_percentage := 0;
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Security Events User ID Analysis';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total events: %', total_events;
    RAISE NOTICE 'Events with user ID: %', events_with_user;
    RAISE NOTICE 'Events without user ID: %', events_without_user;
    RAISE NOTICE 'Missing user ID percentage: %%%', ROUND(missing_percentage, 2);
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 2. 创建用户活动关联函数
-- ========================================

CREATE OR REPLACE FUNCTION correlate_user_security_events()
RETURNS TABLE(
    enhanced_count INTEGER,
    correlation_method TEXT,
    details TEXT
) AS $$
DECLARE
    enhanced_by_session INTEGER := 0;
    enhanced_by_pattern INTEGER := 0;
    enhanced_by_proximity INTEGER := 0;
BEGIN
    -- 方法1: 基于会话时间关联
    -- 如果用户在某个IP上有已知活动，关联前后5分钟内相同IP的未知事件
    WITH user_sessions AS (
        SELECT DISTINCT 
            user_id, 
            ip_address, 
            created_at,
            created_at - INTERVAL '5 minutes' as window_start,
            created_at + INTERVAL '5 minutes' as window_end
        FROM security_events 
        WHERE user_id IS NOT NULL
    ),
    events_to_enhance AS (
        SELECT DISTINCT se.id, us.user_id
        FROM security_events se
        JOIN user_sessions us ON se.ip_address = us.ip_address
        WHERE se.user_id IS NULL
        AND se.created_at BETWEEN us.window_start AND us.window_end
    )
    UPDATE security_events 
    SET 
        user_id = ete.user_id,
        metadata = COALESCE(metadata, '{}'::jsonb) || 
                   jsonb_build_object(
                       'enhanced', true,
                       'enhanced_at', NOW(),
                       'enhancement_method', 'session_correlation',
                       'enhancement_reason', 'IP and time proximity to known user session'
                   )
    FROM events_to_enhance ete
    WHERE security_events.id = ete.id;
    
    GET DIAGNOSTICS enhanced_by_session = ROW_COUNT;
    
    -- 方法2: 基于IP使用模式关联
    -- 如果某个IP 90%以上的已知事件都属于同一用户，则关联该IP的未知事件
    WITH ip_user_patterns AS (
        SELECT 
            ip_address,
            user_id,
            COUNT(*) as event_count,
            COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY ip_address) as percentage
        FROM security_events 
        WHERE user_id IS NOT NULL
        GROUP BY ip_address, user_id
        HAVING COUNT(*) >= 3  -- 至少3个事件
    ),
    dominant_users AS (
        SELECT ip_address, user_id
        FROM ip_user_patterns
        WHERE percentage >= 90  -- 90%以上的事件属于该用户
    ),
    pattern_events_to_enhance AS (
        SELECT DISTINCT se.id, du.user_id
        FROM security_events se
        JOIN dominant_users du ON se.ip_address = du.ip_address
        WHERE se.user_id IS NULL
        AND se.created_at >= NOW() - INTERVAL '7 days'  -- 只处理最近7天的事件
    )
    UPDATE security_events 
    SET 
        user_id = pete.user_id,
        metadata = COALESCE(metadata, '{}'::jsonb) || 
                   jsonb_build_object(
                       'enhanced', true,
                       'enhanced_at', NOW(),
                       'enhancement_method', 'pattern_correlation',
                       'enhancement_reason', 'IP usage pattern indicates high probability user match'
                   )
    FROM pattern_events_to_enhance pete
    WHERE security_events.id = pete.id
    AND security_events.user_id IS NULL;  -- 确保不覆盖已有的关联
    
    GET DIAGNOSTICS enhanced_by_pattern = ROW_COUNT;
    
    -- 方法3: 基于时间邻近性关联
    -- 关联在同一IP上时间非常接近（1分钟内）的事件
    WITH proximity_correlations AS (
        SELECT DISTINCT
            se1.id as target_event_id,
            se2.user_id
        FROM security_events se1
        JOIN security_events se2 ON se1.ip_address = se2.ip_address
        WHERE se1.user_id IS NULL
        AND se2.user_id IS NOT NULL
        AND ABS(EXTRACT(EPOCH FROM (se1.created_at - se2.created_at))) <= 60  -- 1分钟内
        AND se1.created_at >= NOW() - INTERVAL '24 hours'  -- 只处理最近24小时
    )
    UPDATE security_events 
    SET 
        user_id = pc.user_id,
        metadata = COALESCE(metadata, '{}'::jsonb) || 
                   jsonb_build_object(
                       'enhanced', true,
                       'enhanced_at', NOW(),
                       'enhancement_method', 'proximity_correlation',
                       'enhancement_reason', 'Very close temporal proximity to known user event'
                   )
    FROM proximity_correlations pc
    WHERE security_events.id = pc.target_event_id
    AND security_events.user_id IS NULL;
    
    GET DIAGNOSTICS enhanced_by_proximity = ROW_COUNT;
    
    -- 返回结果
    RETURN QUERY VALUES 
        (enhanced_by_session, 'session_correlation', 'Events correlated based on session time windows'),
        (enhanced_by_pattern, 'pattern_correlation', 'Events correlated based on IP usage patterns'),
        (enhanced_by_proximity, 'proximity_correlation', 'Events correlated based on temporal proximity');
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. 执行关联增强
-- ========================================

SELECT * FROM correlate_user_security_events();

-- ========================================
-- 4. 显示增强结果统计
-- ========================================

DO $$
DECLARE
    total_events_after INTEGER;
    events_with_user_after INTEGER;
    events_without_user_after INTEGER;
    enhanced_events INTEGER;
    improvement_percentage NUMERIC;
BEGIN
    -- 统计增强后的情况
    SELECT COUNT(*) INTO total_events_after FROM security_events;
    SELECT COUNT(*) INTO events_with_user_after FROM security_events WHERE user_id IS NOT NULL;
    SELECT COUNT(*) INTO events_without_user_after FROM security_events WHERE user_id IS NULL;
    SELECT COUNT(*) INTO enhanced_events FROM security_events WHERE metadata->>'enhanced' = 'true';
    
    -- 计算改进百分比
    IF total_events_after > 0 THEN
        improvement_percentage := (enhanced_events::NUMERIC / total_events_after::NUMERIC) * 100;
    ELSE
        improvement_percentage := 0;
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Enhancement Results';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total events after enhancement: %', total_events_after;
    RAISE NOTICE 'Events with user ID after: %', events_with_user_after;
    RAISE NOTICE 'Events without user ID after: %', events_without_user_after;
    RAISE NOTICE 'Enhanced events: %', enhanced_events;
    RAISE NOTICE 'Enhancement coverage: %%%', ROUND(improvement_percentage, 2);
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 5. 显示增强方法统计
-- ========================================

SELECT 
    'Enhancement Methods' as analysis_type,
    metadata->>'enhancement_method' as method,
    COUNT(*) as enhanced_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM security_events 
WHERE metadata->>'enhanced' = 'true'
GROUP BY metadata->>'enhancement_method'
ORDER BY enhanced_count DESC;

-- ========================================
-- 6. 显示最近增强的事件样本
-- ========================================

SELECT 
    'Recent Enhanced Events' as sample_type,
    created_at,
    ip_address,
    user_id,
    event_type,
    metadata->>'enhancement_method' as enhancement_method,
    metadata->>'enhancement_reason' as enhancement_reason
FROM security_events 
WHERE metadata->>'enhanced' = 'true'
ORDER BY metadata->>'enhanced_at' DESC
LIMIT 10;

-- ========================================
-- 7. 创建定期增强任务函数
-- ========================================

CREATE OR REPLACE FUNCTION schedule_security_event_enhancement()
RETURNS INTEGER AS $$
DECLARE
    total_enhanced INTEGER := 0;
    method_results RECORD;
BEGIN
    -- 执行关联增强
    FOR method_results IN SELECT * FROM correlate_user_security_events() LOOP
        total_enhanced := total_enhanced + method_results.enhanced_count;
        
        -- 记录增强活动
        INSERT INTO security_events (
            ip_address,
            event_type,
            severity,
            description,
            metadata
        ) VALUES (
            '0.0.0.0'::INET,
            'system_maintenance',
            'low',
            'Automated security event enhancement completed',
            jsonb_build_object(
                'enhancement_method', method_results.correlation_method,
                'enhanced_count', method_results.enhanced_count,
                'details', method_results.details,
                'automated', true,
                'scheduled_at', NOW()
            )
        );
    END LOOP;
    
    RETURN total_enhanced;
END;
$$ LANGUAGE plpgsql;

-- 记录增强完成事件
INSERT INTO security_events (
    ip_address,
    event_type,
    severity,
    description,
    metadata
) VALUES (
    '0.0.0.0'::INET,
    'system_maintenance',
    'low',
    'Security events enhancement process completed',
    jsonb_build_object(
        'process', 'security_event_enhancement',
        'completed_at', NOW(),
        'script_version', '1.0'
    )
);

SELECT 'Security events enhancement completed successfully!' as status;
