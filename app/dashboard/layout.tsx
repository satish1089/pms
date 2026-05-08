import Image from "next/image";
import { redirect } from "next/navigation";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";
import { NotificationsBell } from "@/components/notifications-bell";
import { DashboardHeaderTitle } from "@/components/dashboard-header-title";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = {
    _id: session.sub,
    name: session.name,
    email: session.email,
    role: session.role,
  };

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar role={session.role} />
      <SidebarInset className="min-w-0 min-h-0 overflow-hidden">
        <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-3 backdrop-blur-md sm:px-5">
          <SidebarTrigger className="-ml-1 size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" />
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt="Projectly"
              width={28}
              height={28}
              priority
              className="size-7 shrink-0 rounded-md sm:hidden"
            />
            <DashboardHeaderTitle />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell />
            <Separator
              orientation="vertical"
              className="h-5 bg-border/60"
            />
            <UserMenu user={user} />
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="w-full px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
