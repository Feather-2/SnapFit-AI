"use client"

import { useState } from "react";
import { KeyUploadForm } from "@/components/shared-keys/key-upload-form";
import { UsageLeaderboard } from "@/components/shared-keys/usage-leaderboard";
import { MyConfigurations } from "@/components/shared-keys/my-configurations";
import { TrustLevelGuard } from "@/components/shared-keys/trust-level-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrainCircuit, Trophy, Plus, Settings } from "lucide-react";
import { useTranslation } from "@/hooks/use-i18n";

export default function SharedKeysPage() {
  const t = useTranslation('sharedKeys')
  const [activeTab, setActiveTab] = useState("leaderboard");

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        {/* 左侧：介绍区域 */}
        <div className="lg:col-span-3 space-y-6">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
              <BrainCircuit className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">
              {t('title')}
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              {t('subtitle')}
            </p>
          </div>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">{t('benefits.title')}</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                    <span>{t('benefits.benefit1')}</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                    <span>{t('benefits.benefit2')}</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                    <span>{t('benefits.benefit3')}</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                    <span>{t('benefits.benefit4')}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">{t('security.title')}</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[1, 2, 3, 4].map((num) => (
                    <li key={num} className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span>{t(`security.feature${num}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：Tab区域 */}
        <div className="lg:col-span-7 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="leaderboard" className="flex items-center space-x-2">
                <Trophy className="w-4 h-4" />
                <span>{t('tabs.leaderboard')}</span>
              </TabsTrigger>
              <TabsTrigger value="my-configs" className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>{t('tabs.myConfigs')}</span>
              </TabsTrigger>
              <TabsTrigger value="share" className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>{t('tabs.share')}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leaderboard" className="mt-6">
              <UsageLeaderboard />
            </TabsContent>

            <TabsContent value="my-configs" className="mt-6">
              <TrustLevelGuard>
                <MyConfigurations />
              </TrustLevelGuard>
            </TabsContent>

            <TabsContent value="share" className="mt-6">
              <TrustLevelGuard>
                <KeyUploadForm onSuccess={() => setActiveTab("my-configs")} />
              </TrustLevelGuard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}