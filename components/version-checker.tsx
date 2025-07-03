"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Info } from "lucide-react";
import { checkForUpdates, forceRefresh, getVersionInfo } from "@/lib/version";
import { useTranslations } from "next-intl";

export function VersionChecker() {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const t = useTranslations("common");

  useEffect(() => {
    // 检查是否有更新
    const hasUpdates = checkForUpdates();
    if (hasUpdates) {
      setShowUpdateDialog(true);
    }
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    forceRefresh();
  };

  const handleDismiss = () => {
    setShowUpdateDialog(false);
  };

  return (
    <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            应用已更新
          </DialogTitle>
          <DialogDescription>
            检测到应用有新版本，建议刷新页面以获得最佳体验。
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
          <Info className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <div>版本: {getVersionInfo().version}</div>
            <div>构建时间: {new Date(getVersionInfo().buildTime).toLocaleString()}</div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="w-full sm:w-auto"
          >
            稍后提醒
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                立即刷新
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
