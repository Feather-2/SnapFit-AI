-- 修复和标准化数据库中的IP记录
-- 将IPv6本地地址统一转换为IPv4格式

-- ========================================
-- 1. 备份现有数据
-- ========================================

-- 创建备份表（如果不存在）
DO $$
BEGIN
    -- 备份安全事件表
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'security_events_ip_backup') THEN
        CREATE TABLE security_events_ip_backup AS 
        SELECT * FROM security_events WHERE ip_address IN ('::1', '::ffff:127.0.0.1');
        RAISE NOTICE 'Created backup of security_events with IPv6 localhost records';
    END IF;
    
    -- 备份IP封禁表
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ip_bans_ip_backup') THEN
        CREATE TABLE ip_bans_ip_backup AS 
        SELECT * FROM ip_bans WHERE ip_address IN ('::1', '::ffff:127.0.0.1');
        RAISE NOTICE 'Created backup of ip_bans with IPv6 localhost records';
    END IF;
END $$;

-- ========================================
-- 2. 修复安全事件表中的IP地址
-- ========================================

-- 统计修复前的记录
DO $$
DECLARE
    ipv6_localhost_count INTEGER;
    ipv6_mapped_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO ipv6_localhost_count FROM security_events WHERE ip_address = '::1';
    SELECT COUNT(*) INTO ipv6_mapped_count FROM security_events WHERE ip_address = '::ffff:127.0.0.1';
    
    RAISE NOTICE 'Before fix - IPv6 localhost (::1): % records', ipv6_localhost_count;
    RAISE NOTICE 'Before fix - IPv6 mapped (::ffff:127.0.0.1): % records', ipv6_mapped_count;
END $$;

-- 修复 IPv6 localhost (::1) -> 127.0.0.1
UPDATE security_events 
SET ip_address = '127.0.0.1'::INET
WHERE ip_address = '::1'::INET;

-- 修复 IPv6 mapped IPv4 (::ffff:127.0.0.1) -> 127.0.0.1
UPDATE security_events 
SET ip_address = '127.0.0.1'::INET
WHERE ip_address = '::ffff:127.0.0.1'::INET;

-- 修复其他可能的IPv6本地地址格式
UPDATE security_events 
SET ip_address = '127.0.0.1'::INET
WHERE ip_address IN ('0:0:0:0:0:0:0:1'::INET, '::0001'::INET);

-- ========================================
-- 3. 修复IP封禁表中的IP地址
-- ========================================

-- 修复 IPv6 localhost (::1) -> 127.0.0.1
UPDATE ip_bans 
SET ip_address = '127.0.0.1'::INET
WHERE ip_address = '::1'::INET;

-- 修复 IPv6 mapped IPv4 (::ffff:127.0.0.1) -> 127.0.0.1
UPDATE ip_bans 
SET ip_address = '127.0.0.1'::INET
WHERE ip_address = '::ffff:127.0.0.1'::INET;

-- 修复其他可能的IPv6本地地址格式
UPDATE ip_bans 
SET ip_address = '127.0.0.1'::INET
WHERE ip_address IN ('0:0:0:0:0:0:0:1'::INET, '::0001'::INET);

-- ========================================
-- 4. 合并重复的本地IP记录
-- ========================================

-- 对于安全事件表，我们保留所有记录，因为它们是历史事件
-- 但是对于IP封禁表，我们需要合并重复的记录

-- 处理可能的重复封禁记录
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- 检查是否有重复的127.0.0.1封禁记录
    SELECT COUNT(*) - COUNT(DISTINCT ip_address) INTO duplicate_count
    FROM ip_bans 
    WHERE ip_address = '127.0.0.1' AND is_active = true;
    
    IF duplicate_count > 0 THEN
        -- 保留最新的封禁记录，删除旧的
        DELETE FROM ip_bans 
        WHERE ip_address = '127.0.0.1' 
        AND is_active = true 
        AND id NOT IN (
            SELECT id FROM ip_bans 
            WHERE ip_address = '127.0.0.1' AND is_active = true 
            ORDER BY banned_at DESC 
            LIMIT 1
        );
        
        RAISE NOTICE 'Removed % duplicate ban records for 127.0.0.1', duplicate_count;
    ELSE
        RAISE NOTICE 'No duplicate ban records found for 127.0.0.1';
    END IF;
END $$;

-- ========================================
-- 5. 验证修复结果
-- ========================================

DO $$
DECLARE
    ipv4_localhost_events INTEGER;
    ipv4_localhost_bans INTEGER;
    remaining_ipv6_events INTEGER;
    remaining_ipv6_bans INTEGER;
BEGIN
    -- 统计修复后的记录
    SELECT COUNT(*) INTO ipv4_localhost_events FROM security_events WHERE ip_address = '127.0.0.1';
    SELECT COUNT(*) INTO ipv4_localhost_bans FROM ip_bans WHERE ip_address = '127.0.0.1';
    
    -- 检查是否还有IPv6本地地址
    SELECT COUNT(*) INTO remaining_ipv6_events FROM security_events 
    WHERE ip_address IN ('::1', '::ffff:127.0.0.1', '0:0:0:0:0:0:0:1');
    
    SELECT COUNT(*) INTO remaining_ipv6_bans FROM ip_bans 
    WHERE ip_address IN ('::1', '::ffff:127.0.0.1', '0:0:0:0:0:0:0:1');
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'IP Address Fix Results:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'IPv4 localhost events (127.0.0.1): %', ipv4_localhost_events;
    RAISE NOTICE 'IPv4 localhost bans (127.0.0.1): %', ipv4_localhost_bans;
    RAISE NOTICE 'Remaining IPv6 localhost events: %', remaining_ipv6_events;
    RAISE NOTICE 'Remaining IPv6 localhost bans: %', remaining_ipv6_bans;
    
    IF remaining_ipv6_events = 0 AND remaining_ipv6_bans = 0 THEN
        RAISE NOTICE '✅ All IPv6 localhost addresses successfully converted to IPv4';
    ELSE
        RAISE NOTICE '⚠️  Some IPv6 localhost addresses may still exist';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 6. 显示当前IP分布
-- ========================================

-- 显示安全事件中的IP分布
SELECT 
    'Security Events IP Distribution' as table_name,
    ip_address,
    COUNT(*) as record_count,
    CASE 
        WHEN ip_address = '127.0.0.1' THEN 'Local Development'
        WHEN ip_address::text LIKE '192.168.%' THEN 'Private Network'
        WHEN ip_address::text LIKE '10.%' THEN 'Private Network'
        WHEN ip_address::text = 'unknown' THEN 'Unknown'
        ELSE 'Public/Other'
    END as ip_category
FROM security_events 
GROUP BY ip_address 
ORDER BY record_count DESC
LIMIT 10;

-- 显示IP封禁中的IP分布
SELECT 
    'IP Bans Distribution' as table_name,
    ip_address,
    COUNT(*) as record_count,
    COUNT(*) FILTER (WHERE is_active = true) as active_bans,
    CASE 
        WHEN ip_address = '127.0.0.1' THEN 'Local Development'
        WHEN ip_address::text LIKE '192.168.%' THEN 'Private Network'
        WHEN ip_address::text LIKE '10.%' THEN 'Private Network'
        WHEN ip_address::text = 'unknown' THEN 'Unknown'
        ELSE 'Public/Other'
    END as ip_category
FROM ip_bans 
GROUP BY ip_address 
ORDER BY record_count DESC
LIMIT 10;

-- 记录修复完成
INSERT INTO security_events (
    ip_address,
    event_type,
    severity,
    description,
    metadata
) VALUES (
    '127.0.0.1'::INET,
    'system_maintenance',
    'low',
    'IP address records standardization completed',
    jsonb_build_object(
        'operation', 'ip_standardization',
        'timestamp', NOW(),
        'converted_addresses', ARRAY['::1', '::ffff:127.0.0.1']
    )
);

SELECT 'IP address standardization completed successfully!' as status;
