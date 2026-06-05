import { DashboardHome } from "@/features/dashboard/components/DashboardHome";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";

export default function HomePage() {
  return (
    <DashboardShell>
      <DashboardHome />
    </DashboardShell>
  );
}
