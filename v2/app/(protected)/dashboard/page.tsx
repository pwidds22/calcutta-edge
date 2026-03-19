import { getDashboardData } from '@/actions/dashboard';
import { UserDashboard } from '@/components/dashboard/user-dashboard';

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <UserDashboard data={data} />
    </div>
  );
}
