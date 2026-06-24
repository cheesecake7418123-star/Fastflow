import { useEffect, useState } from 'react';
import { CheckSquare, FolderOpen, Clock, AlertCircle, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Task, Project } from '../types';

interface Stats {
  totalProjects: number;
  totalTasks: number;
  doneTasks: number;
  doingTasks: number;
  holdTasks: number;
  todoTasks: number;
}

const STATUS_BADGE: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-600',
  doing: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
  hold: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do', doing: 'Doing', done: 'Done', hold: 'Hold',
};

export default function Dashboard({ onNavigate }: { onNavigate: (page: string, id?: string) => void }) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalProjects: 0, totalTasks: 0, doneTasks: 0, doingTasks: 0, holdTasks: 0, todoTasks: 0 });
  const [recentTasks, setRecentTasks] = useState<(Task & { project?: Project })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: projects }, { data: tasks }] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*, project:projects(id,name,color)').order('created_at', { ascending: false }),
      ]);
      const allTasks = tasks ?? [];
      setStats({
        totalProjects: (projects ?? []).length,
        totalTasks: allTasks.length,
        doneTasks: allTasks.filter(t => t.status === 'done').length,
        doingTasks: allTasks.filter(t => t.status === 'doing').length,
        holdTasks: allTasks.filter(t => t.status === 'hold').length,
        todoTasks: allTasks.filter(t => t.status === 'todo').length,
      });
      setRecentTasks(allTasks.slice(0, 8));
      setLoading(false);
    }
    load();
  }, []);

  const statCards = [
    { label: 'Projects', value: stats.totalProjects, icon: FolderOpen, color: 'bg-blue-500', light: 'bg-blue-50 text-blue-600' },
    { label: 'Total Tasks', value: stats.totalTasks, icon: CheckSquare, color: 'bg-slate-700', light: 'bg-slate-100 text-slate-600' },
    { label: 'In Progress', value: stats.doingTasks, icon: TrendingUp, color: 'bg-amber-500', light: 'bg-amber-50 text-amber-600' },
    { label: 'Completed', value: stats.doneTasks, icon: Clock, color: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-600' },
    { label: 'On Hold', value: stats.holdTasks, icon: AlertCircle, color: 'bg-red-500', light: 'bg-red-50 text-red-600' },
    { label: 'To Do', value: stats.todoTasks, icon: Users, color: 'bg-violet-500', light: 'bg-violet-50 text-violet-600' },
  ];

  const donePercent = stats.totalTasks > 0 ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here's an overview of your workspace</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {statCards.map(({ label, value, icon: Icon, light }) => (
                <div key={label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{label}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${light}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Overall Progress</h2>
                <span className="text-sm font-semibold text-emerald-600">{donePercent}% complete</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${donePercent}%` }}
                />
              </div>
              <div className="flex gap-6 mt-3">
                {[
                  { label: 'To Do', val: stats.todoTasks, cls: 'bg-gray-400' },
                  { label: 'Doing', val: stats.doingTasks, cls: 'bg-amber-400' },
                  { label: 'Done', val: stats.doneTasks, cls: 'bg-emerald-400' },
                  { label: 'Hold', val: stats.holdTasks, cls: 'bg-red-400' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={`w-2 h-2 rounded-full ${s.cls}`} />
                    {s.label}: {s.val}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Tasks */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Recent Tasks</h2>
                <button onClick={() => onNavigate('tasks')} className="text-sm text-blue-600 hover:underline">View all</button>
              </div>
              <div className="divide-y divide-gray-50">
                {recentTasks.length === 0 && (
                  <div className="px-6 py-10 text-center text-gray-400 text-sm">No tasks yet. Create a project and add some tasks!</div>
                )}
                {recentTasks.map(task => (
                  <div key={task.id} className="px-6 py-3 flex items-center gap-4">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: (task as any).project?.color ?? '#94a3b8' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                      <p className="text-xs text-gray-400">{(task as any).project?.name ?? 'Unknown project'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[task.status]}`}>
                      {STATUS_LABEL[task.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
