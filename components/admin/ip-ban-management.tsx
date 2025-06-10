"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Ban, ShieldCheck, AlertTriangle, Clock, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface IPBanRecord {
  id: string;
  ipAddress: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  bannedAt: string;
  expiresAt?: string;
  isActive: boolean;
  banType: 'manual' | 'automatic' | 'temporary';
}

interface BanStats {
  totalActive: number;
  totalExpired: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  recentBans: number;
}

export function IPBanManagement() {
  const [bans, setBans] = useState<IPBanRecord[]>([]);
  const [stats, setStats] = useState<BanStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const { toast } = useToast();

  // 封禁表单状态
  const [banForm, setBanForm] = useState({
    ipAddress: '',
    reason: '',
    duration: 0, // 0表示永久
    severity: 'medium' as const
  });

  // 加载封禁列表
  const loadBans = async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/ip-bans?page=${pageNum}&limit=20`);
      const data = await response.json();

      if (data.success) {
        setBans(data.data);
        setTotalPages(data.totalPages);
        setPage(pageNum);
      } else {
        toast({
          title: "加载失败",
          description: data.error || "无法加载封禁列表",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "网络错误",
        description: "无法连接到服务器",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // 加载统计信息
  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/ip-bans/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // 封禁IP
  const handleBanIP = async () => {
    if (!banForm.ipAddress || !banForm.reason) {
      toast({
        title: "输入错误",
        description: "请填写IP地址和封禁原因",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/admin/ip-bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banForm)
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "封禁成功",
          description: `IP ${banForm.ipAddress} 已被封禁`
        });
        
        setBanForm({ ipAddress: '', reason: '', duration: 0, severity: 'medium' });
        setShowBanDialog(false);
        loadBans(page);
        loadStats();
      } else {
        toast({
          title: "封禁失败",
          description: data.error || "无法封禁IP",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "网络错误",
        description: "无法连接到服务器",
        variant: "destructive"
      });
    }
  };

  // 解封IP
  const handleUnbanIP = async (ipAddress: string) => {
    try {
      const response = await fetch(`/api/admin/ip-bans?ip=${encodeURIComponent(ipAddress)}&reason=manual_unban`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "解封成功",
          description: `IP ${ipAddress} 已被解封`
        });
        
        loadBans(page);
        loadStats();
      } else {
        toast({
          title: "解封失败",
          description: data.error || "无法解封IP",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "网络错误",
        description: "无法连接到服务器",
        variant: "destructive"
      });
    }
  };

  // 格式化时间
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('zh-CN');
  };

  // 获取严重程度颜色
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  // 获取封禁类型颜色
  const getBanTypeColor = (banType: string) => {
    switch (banType) {
      case 'automatic': return 'destructive';
      case 'manual': return 'default';
      case 'temporary': return 'secondary';
      default: return 'default';
    }
  };

  useEffect(() => {
    loadBans();
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃封禁</CardTitle>
              <Ban className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActive}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已过期</CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalExpired}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">最近24小时</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentBans}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">自动封禁</CardTitle>
              <Shield className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byType.automatic || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 操作区域 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>IP封禁管理</CardTitle>
            <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Ban className="h-4 w-4 mr-2" />
                  封禁IP
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>手动封禁IP</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="ipAddress">IP地址</Label>
                    <Input
                      id="ipAddress"
                      value={banForm.ipAddress}
                      onChange={(e) => setBanForm(prev => ({ ...prev, ipAddress: e.target.value }))}
                      placeholder="192.168.1.1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="reason">封禁原因</Label>
                    <Textarea
                      id="reason"
                      value={banForm.reason}
                      onChange={(e) => setBanForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="请描述封禁原因..."
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="duration">封禁时长（分钟，0表示永久）</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={banForm.duration}
                      onChange={(e) => setBanForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                      min="0"
                      max="525600"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="severity">严重程度</Label>
                    <Select value={banForm.severity} onValueChange={(value: any) => setBanForm(prev => ({ ...prev, severity: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">低</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="critical">严重</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowBanDialog(false)}>
                      取消
                    </Button>
                    <Button onClick={handleBanIP}>
                      确认封禁
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* 封禁列表 */}
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP地址</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>严重程度</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>封禁时间</TableHead>
                  <TableHead>过期时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bans.map((ban) => (
                  <TableRow key={ban.id}>
                    <TableCell className="font-mono">{ban.ipAddress}</TableCell>
                    <TableCell className="max-w-xs truncate" title={ban.reason}>
                      {ban.reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(ban.severity)}>
                        {ban.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBanTypeColor(ban.banType)}>
                        {ban.banType}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatTime(ban.bannedAt)}</TableCell>
                    <TableCell>
                      {ban.expiresAt ? formatTime(ban.expiresAt) : '永久'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnbanIP(ban.ipAddress)}
                      >
                        解封
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex justify-center space-x-2">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => loadBans(page - 1)}
                >
                  上一页
                </Button>
                <span className="flex items-center px-4">
                  第 {page} 页，共 {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => loadBans(page + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
