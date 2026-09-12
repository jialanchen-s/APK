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
} from '@/components/ui/sidebar';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem } from '@/components/ui/breadcrumb';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { Separator } from '@/components/ui/separator';
import { Calculator, ListChecks, Archive, Boxes, Bot, Search, ChevronsUpDown, LogOut } from 'lucide-react';
import { useAppInfo } from '@lark-apaas/client-toolkit/hooks/useAppInfo';
import { useCurrentUserProfile } from '@lark-apaas/client-toolkit/hooks/useCurrentUserProfile';
import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@lark-apaas/client-toolkit/auth';
import { Shield } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: { action: string; subject: string };
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '测算工作台', icon: Calculator, permission: { action: 'create', subject: 'EstimateTask' } },
  { path: '/batch-fill', label: '批量参数填报', icon: ListChecks, permission: { action: 'update', subject: 'PendingItem' } },
  { path: '/contract-archive', label: '历史合同归档', icon: Archive, permission: { action: 'read', subject: 'ContractArchive' } },
  { path: '/price-query', label: '历史价格快查', icon: Search, permission: { action: 'read', subject: 'PriceQuery' } },
  { path: '/model-studio', label: '建模台', icon: Boxes, permission: { action: 'read', subject: 'Model' } },
  { path: '/agent', label: 'AI核算助手', icon: Bot, permission: { action: 'use', subject: 'Agent' } },
  { path: '/role-management', label: '权限管理', icon: Shield, permission: { action: 'manage', subject: 'Permission' } },
];

const GUEST_AVATAR = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/LMfspH/ljhwZthlaukjlkulzlp/miao/no-person.svg';

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
  const activeTitle = activeItem?.label ?? '焊装费用测算系统';

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
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <Calculator className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-bold tracking-tight">{appName || '焊装费用测算系统'}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">成本工程工具</span>
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
                      <SidebarMenuButton asChild isActive={isActive} className="rounded-2xl">
                        <Link to={item.path}>
                          <item.icon className={`size-4 ${isActive ? 'text-primary' : ''}`} />
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
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent rounded-2xl">
                    <Avatar className="size-8 rounded-full ring-2 ring-transparent hover:ring-primary/40 transition-all">
                      <AvatarImage src={displayAvatar} alt={displayName} />
                      <AvatarFallback className="rounded-full text-xs">
                        {displayName?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-medium">{displayName}</span>
                      <span className="truncate text-xs text-sidebar-foreground/60">
                        {isLoggedIn ? '已登录' : '未登录'}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
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
      </Sidebar>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3 backdrop-blur-sm bg-card/60">
          <SidebarTrigger />
          <Separator className="bg-border/60" />
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
      </main>

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

const Layout = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default Layout;
