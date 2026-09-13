import { useState, useCallback } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem } from '@/components/ui/breadcrumb';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator, ListChecks, Archive, Boxes, Bot, Search, Shield, LogOut, Settings } from 'lucide-react';
import { useAppInfo } from '@client/src/common/platform/app-info';
import { useCurrentUserProfile } from '@client/src/common/platform/auth';
import { getDataloom } from '@client/src/common/platform/dataloom';
import { logger } from '@client/src/common/platform/logger';
import { useAuth } from '@client/src/common/platform/auth';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: { action: string; subject: string };
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '制造费用智能测算系统', icon: Calculator, permission: { action: 'create', subject: 'EstimateTask' } },
  { path: '/batch-fill', label: '批量参数填报', icon: ListChecks, permission: { action: 'update', subject: 'PendingItem' } },
  { path: '/contract-archive', label: '历史合同归档', icon: Archive, permission: { action: 'read', subject: 'ContractArchive' } },
  { path: '/price-query', label: '历史价格快查', icon: Search, permission: { action: 'read', subject: 'PriceQuery' } },
  { path: '/model-studio', label: '建模台', icon: Boxes, permission: { action: 'read', subject: 'Model' } },
  { path: '/agent', label: 'AI核算助手', icon: Bot, permission: { action: 'use', subject: 'Agent' } },
  { path: '/role-management', label: '权限管理', icon: Shield, permission: { action: 'manage', subject: 'Permission' } },
  { path: '/settings', label: '系统设置', icon: Settings, permission: { action: 'manage', subject: 'Permission' } },
];

const GUEST_AVATAR = '/images/avatar/no-person.svg';

const LayoutContent = () => {
  const location = useLocation();
  const { pathname } = location;
  const { appName } = useAppInfo();
  const userInfo = useCurrentUserProfile();
  const { ability, isLoading: authLoading } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const visibleNavItems = (authLoading || !ability)
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => ability.can(item.permission.action, item.permission.subject));

  const isLoggedIn = !!userInfo?.user_id;
  const displayName = isLoggedIn ? userInfo.name : '游客';
  const displayAvatar = isLoggedIn ? userInfo.avatar : GUEST_AVATAR;

  const activeItem = visibleNavItems.find((item) => item.path === pathname);
  const activeTitle = activeItem?.label ?? '制造费用智能测算系统';

  const handleLogout = useCallback(async () => {
    setShowLogoutConfirm(false);
    try {
      const dataloom = await getDataloom();
      const result = await dataloom.service.session.signOut();
      if (result.error) {
        logger.error('退出登录失败:', result.error.message);
        return;
      }
      window.location.reload();
    } catch (err) {
      logger.error('退出登录异常:', JSON.stringify(err));
    }
  }, []);

  const handleLogin = useCallback(async () => {
    const dataloom = await getDataloom();
    dataloom.service.session.redirectToLogin();
  }, []);

  return (
    <>
      <div className="mesh-blob" aria-hidden="true" />
      <Sidebar
        collapsible="icon"
        className="border-r-0 bg-transparent"
      >
        <div className="m-4 flex h-[calc(100dvh-2rem)] flex-col rounded-[1.85rem] bg-white/[0.55] p-2 backdrop-blur-xl backdrop-saturate-160 shadow-[inset_0_1px_0_rgba(255_255_255_0.65),0_0_0_1px_rgba(10_10_10_0.06),0_24px_48px_-28px_rgba(10_10_10_0.18)]">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link to="/">
                    <div className="flex aspect-square size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-glow text-cream shadow-[inset_0_1px_0_rgba(255_255_255_0.25)]">
                      <Calculator className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-bold tracking-tight text-foreground">
                        {appName || '制造费用智能测算系统'}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">成本工程工具</span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleNavItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            'rounded-2xl transition-all duration-700',
                            isActive
                              ? 'bg-foreground text-background shadow-sm'
                              : 'text-muted-foreground hover:bg-white/80 hover:text-foreground',
                          )}
                        >
                          <Link to={item.path}>
                            <item.icon className="size-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-white/70 rounded-2xl"
                    >
                      <Avatar className="size-8 rounded-full ring-1 ring-[rgba(10_10_10_0.1)]">
                        <AvatarImage src={displayAvatar} alt={displayName} />
                        <AvatarFallback className="rounded-full bg-secondary text-xs">
                          {displayName?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="truncate font-medium text-foreground">{displayName}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {isLoggedIn ? '已登录' : '未登录'}
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="w-[--radix-dropdown-menu-trigger-width] rounded-2xl">
                    <DropdownMenuItem
                      className="cursor-pointer rounded-xl"
                      onClick={isLoggedIn ? () => setShowLogoutConfirm(true) : handleLogin}
                    >
                      <LogOut className="mr-2 size-4" />
                      <span>{isLoggedIn ? '退出登录' : '登录'}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </div>
      </Sidebar>

      <SidebarInset className="relative z-10">
        <header className="flex items-center gap-2 px-6 pt-4">
          <SidebarTrigger className="size-9 rounded-full border border-border bg-white/60 backdrop-blur hover:bg-white/80" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="text-foreground font-bold tracking-tight">
                {activeTitle}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </SidebarInset>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="tracking-tight">确认退出登录</DialogTitle>
            <DialogDescription>
              退出后将需要重新登录才能继续使用系统功能。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setShowLogoutConfirm(false)}>
              取消
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={handleLogout}>
              确认退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Layout = () => (
  <SidebarProvider defaultOpen>
    <LayoutContent />
  </SidebarProvider>
);

export default Layout;
