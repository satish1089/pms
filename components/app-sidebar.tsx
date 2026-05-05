"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ListChecks,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { type UserRole } from "@/lib/roles";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const mainNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/dashboard/projects", icon: FolderKanban },
  { title: "Tasks", url: "/dashboard/tasks", icon: ListChecks },
  { title: "Users", url: "/dashboard/users", icon: Users, adminOnly: true },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

const menuButtonClasses =
  "h-10 -mx-2 w-[calc(100%+1rem)] rounded-none px-4 " +
  "group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-2 " +
  "data-[active=true]:bg-primary/15 data-[active=true]:text-primary data-[active=true]:font-medium data-[active=true]:hover:bg-primary/20 data-[active=true]:hover:text-primary";

export function AppSidebar({ role }: { role?: UserRole }) {
  const pathname = usePathname();

  const isActive = (url: string) => {
    if (url === "/dashboard") return pathname === "/dashboard";
    return pathname === url || pathname?.startsWith(url + "/");
  };

  const canManage = role === "admin" || role === "project_manager";
  const navItems = mainNav.filter((i) => !i.adminOnly || canManage);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 flex-row items-center border-b p-0 px-3 group-data-[collapsible=icon]:px-2">
        <Link
          href="/dashboard"
          className="flex w-full items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold shadow-sm">
            P
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-semibold tracking-tight">
              Projectly
            </span>
            {/* <span className="text-[10px] text-muted-foreground">
              Project Management
            </span> */}
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={cn(menuButtonClasses)}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            All systems normal
          </span>
          <span>v0.1.0</span>
        </div>
      </SidebarFooter> */}
    </Sidebar>
  );
}
