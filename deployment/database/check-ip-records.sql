-- 检查数据库中的IP记录
-- 用于调试IP获取和记录问题

-- 1. 检查安全事件表中的IP记录
SELECT 
    'security_events' as table_name,
    ip_address,
    COUNT(*) as record_count,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen,
    ARRAY_AGG(DISTINCT event_type) as event_types
FROM security_events 
GROUP BY ip_address 
ORDER BY record_count DESC;

-- 2. 检查IP封禁表中的记录
SELECT 
    'ip_bans' as table_name,
    ip_address,
    COUNT(*) as record_count,
    MIN(banned_at) as first_banned,
    MAX(banned_at) as last_banned,
    COUNT(*) FILTER (WHERE is_active = true) as active_bans,
    ARRAY_AGG(DISTINCT ban_type) as ban_types
FROM ip_bans 
GROUP BY ip_address 
ORDER BY record_count DESC;

-- 3. 分析IPv6地址记录
SELECT 
    'IPv6 Analysis' as analysis_type,
    ip_address,
    CASE 
        WHEN ip_address = '::1' THEN 'IPv6 Localhost'
        WHEN ip_address::text LIKE '::ffff:%' THEN 'IPv4-mapped IPv6'
        WHEN family(ip_address) = 6 THEN 'Pure IPv6'
        WHEN family(ip_address) = 4 THEN 'IPv4'
        ELSE 'Unknown'
    END as ip_type,
    COUNT(*) as occurrences
FROM (
    SELECT ip_address FROM security_events
    UNION ALL
    SELECT ip_address FROM ip_bans
) combined_ips
GROUP BY ip_address, ip_type
ORDER BY occurrences DESC;

-- 4. 检查本地IP地址记录
SELECT 
    'Local IP Analysis' as analysis_type,
    ip_address,
    CASE 
        WHEN ip_address = '127.0.0.1' THEN 'IPv4 Localhost'
        WHEN ip_address = '::1' THEN 'IPv6 Localhost'
        WHEN ip_address::text LIKE '192.168.%' THEN 'Private Network (192.168.x.x)'
        WHEN ip_address::text LIKE '10.%' THEN 'Private Network (10.x.x.x)'
        WHEN ip_address::text LIKE '172.%' THEN 'Private Network (172.x.x.x)'
        WHEN ip_address::text = 'unknown' THEN 'Unknown IP'
        ELSE 'Public IP'
    END as ip_category,
    COUNT(*) as total_records
FROM (
    SELECT ip_address FROM security_events
    UNION ALL
    SELECT ip_address FROM ip_bans
) all_ips
GROUP BY ip_address, ip_category
ORDER BY total_records DESC;

-- 5. 最近的安全事件（包含IP信息）
SELECT 
    'Recent Security Events' as info_type,
    created_at,
    ip_address,
    event_type,
    severity,
    description,
    user_agent
FROM security_events 
ORDER BY created_at DESC 
LIMIT 20;

-- 6. 检查是否有重复的IPv6本地地址记录
SELECT 
    'Duplicate Local IPs' as check_type,
    COUNT(*) as total_local_records,
    COUNT(DISTINCT ip_address) as unique_local_ips
FROM (
    SELECT ip_address FROM security_events 
    WHERE ip_address IN ('127.0.0.1', '::1', '::ffff:127.0.0.1')
    UNION ALL
    SELECT ip_address FROM ip_bans 
    WHERE ip_address IN ('127.0.0.1', '::1', '::ffff:127.0.0.1')
) local_ips;

-- 7. 统计信息汇总
SELECT 
    'Summary Statistics' as summary_type,
    (SELECT COUNT(*) FROM security_events) as total_security_events,
    (SELECT COUNT(DISTINCT ip_address) FROM security_events) as unique_ips_in_security_events,
    (SELECT COUNT(*) FROM ip_bans) as total_ip_bans,
    (SELECT COUNT(DISTINCT ip_address) FROM ip_bans) as unique_ips_in_bans,
    (SELECT COUNT(*) FROM security_events WHERE ip_address = '::1') as ipv6_localhost_events,
    (SELECT COUNT(*) FROM security_events WHERE ip_address = '127.0.0.1') as ipv4_localhost_events;
