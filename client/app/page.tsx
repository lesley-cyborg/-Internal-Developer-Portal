// client/app/page.tsx
import { 
  GitPullRequest, 
  CheckCircle2, 
  ShieldAlert, 
  Clock, 
  Activity, 
  LayoutDashboard, 
  Settings, 
  Bell 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

// --- Types ---
interface PR {
  number: number;
  title: string;
  author: string;
  state: string;
  security_status: string;
  created_at: string;
  merged_at: string | null;
  time_to_merge_hours: number | null;
}

interface Metrics {
  total_prs: number;
  merged_prs: number;
  blocked_prs: number;
  avg_time_to_merge_hours: number | null;
  security_fail_rate: number;
}

interface ActivityEvent {
  event: string;
  deliveryId: string;
  createdAt: string;
}

// --- Data Fetching ---
async function getData() {
  const [prsRes, metricsRes, activityRes] = await Promise.all([
    fetch('http://localhost:3001/api/v1/pull-requests', { cache: 'no-store' }),
    fetch('http://localhost:3001/api/v1/metrics/summary', { cache: 'no-store' }),
    fetch('http://localhost:3001/api/v1/activity', { cache: 'no-store' }),
  ]);
  
  return {
    prs: (await prsRes.json()).pull_requests as PR[],
    metrics: await metricsRes.json() as Metrics,
    activity: (await activityRes.json()).events as ActivityEvent[],
  };
}

// --- Components ---
function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold">D</div>
        <h1 className="text-xl font-bold tracking-tight">DevPulse</h1>
      </div>
      
      <nav className="space-y-2 flex-1">
        <a href="#" className="flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-lg text-white">
          <LayoutDashboard size={20} />
          <span className="font-medium">Dashboard</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition">
          <GitPullRequest size={20} />
          <span>Pull Requests</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition">
          <ShieldAlert size={20} />
          <span>Security</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition">
          <Settings size={20} />
          <span>Settings</span>
        </a>
      </nav>

      <div className="pt-6 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center font-bold text-sm">
            LC
          </div>
          <div>
            <p className="text-sm font-medium">Lesley Cyborg</p>
            <p className="text-xs text-slate-400">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatCard({ title, value, icon: Icon, color, trend }: any) {
  const colorClasses: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  return (
    <div className={`p-6 rounded-xl border ${colorClasses[color]} flex flex-col justify-between`}>
      <div className="flex justify-between items-start mb-4">
        <span className="text-sm font-medium opacity-80 uppercase tracking-wider">{title}</span>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-3xl font-bold mb-1">{value}</div>
        {trend && <div className="text-xs opacity-70">{trend}</div>}
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const { prs, metrics, activity } = await getData();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Topbar */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Engineering Overview</h2>
            <p className="text-slate-500 text-sm mt-1">Real-time metrics from GitHub</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Live Sync
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600">
              <Bell size={20} />
            </button>
          </div>
        </header>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total PRs" value={metrics.total_prs} icon={GitPullRequest} color="blue" trend="+2 this week" />
          <StatCard title="Merged" value={metrics.merged_prs} icon={CheckCircle2} color="green" trend="100% success" />
          <StatCard title="Blocked" value={metrics.blocked_prs} icon={ShieldAlert} color="red" trend="Requires attention" />
          <StatCard title="Avg Merge Time" value={`${metrics.avg_time_to_merge_hours || 0}h`} icon={Clock} color="purple" trend="-15% vs last month" />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* PR Table (Takes up 2/3) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-900">Recent Pull Requests</h3>
              <span className="text-xs text-slate-500 font-medium">{prs.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">PR</th>
                    <th className="px-6 py-3 text-left font-medium">Author</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                    <th className="px-6 py-3 text-left font-medium">Security</th>
                    <th className="px-6 py-3 text-left font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prs.map((pr) => (
                    <tr key={pr.number} className={`hover:bg-slate-50 transition ${pr.security_status === 'blocked' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-slate-400">#{pr.number}</span>
                          <span className="font-medium text-slate-900 text-sm truncate max-w-[200px]">{pr.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <img 
                            src={`https://ui-avatars.com/api/?name=${pr.author}&background=random&size=24`} 
                            className="w-6 h-6 rounded-full" 
                            alt={pr.author} 
                          />
                          <span className="text-sm text-slate-600">{pr.author}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          pr.state === 'merged' ? 'bg-purple-100 text-purple-700' :
                          pr.state === 'open' ? 'bg-green-100 text-green-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {pr.state}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          pr.security_status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${pr.security_status === 'blocked' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                          {pr.security_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                        {pr.time_to_merge_hours !== null ? `${pr.time_to_merge_hours}h` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity Feed (Takes up 1/3) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Activity size={16} className="text-slate-500" />
              <h3 className="font-semibold text-slate-900 text-sm">Live Activity</h3>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto max-h-[400px]">
              {activity.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No recent activity</p>
              ) : (
                activity.map((event, idx) => (
                  <div key={idx} className="flex gap-3 relative">
                    {/* Timeline line */}
                    {idx !== activity.length - 1 && (
                      <div className="absolute left-[19px] top-8 bottom-[-16px] w-px bg-slate-200"></div>
                    )}
                    <div className="relative z-10 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                      <GitPullRequest size={16} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 font-medium capitalize truncate">
                        {event.event.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
                        ID: {event.deliveryId.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}