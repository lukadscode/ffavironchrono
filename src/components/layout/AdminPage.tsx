import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

type AdminPageProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function AdminPage({
  title,
  description,
  icon,
  actions,
  children,
  className,
  contentClassName,
}: AdminPageProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1600px] space-y-6", className)}>
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        actions={actions}
      />
      <div className={cn("space-y-6", contentClassName)}>{children}</div>
    </div>
  );
}
