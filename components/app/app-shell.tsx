'use client';

import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { getKulfonModule, type KulfonModuleId } from './modules';

type AppShellProps = {
  activeModule: KulfonModuleId;
  onModuleChange: (module: KulfonModuleId) => void;
  isBusy?: boolean;
  children: ReactNode;
};

export function AppShell({ activeModule, onModuleChange, isBusy = false, children }: AppShellProps) {
  const module = getKulfonModule(activeModule);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <div className="command-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1680px] grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <AppSidebar activeModule={activeModule} onModuleChange={onModuleChange} />

        <div className="grid min-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-4">
          <AppHeader activeModule={module} isBusy={isBusy} />

          <div className="grid min-h-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">{children}</div>

            <aside className="hidden space-y-4 2xl:block">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>System</CardTitle>
                      <CardDescription>Stały panel statusu Kulfona.</CardDescription>
                    </div>
                    <Badge variant="success">online</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                    <p className="text-sm font-semibold">Moduł aktywny</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.label}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                    <p className="text-sm font-semibold">Approval flow</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Widoczny przy akcjach zapisujących.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Narzędzia aktywne</CardTitle>
                  <CardDescription>Obecny zakres bez zmian w runtime.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="outline">GitHub</Badge>
                  <Badge variant="outline">Vercel</Badge>
                  <Badge variant="outline">Jules</Badge>
                  <Badge variant="outline">Approval</Badge>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
