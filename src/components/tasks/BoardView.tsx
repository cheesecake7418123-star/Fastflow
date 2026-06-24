import { Task, Project, TaskStatus } from '../../types';
import TaskStatusBadge from './TaskStatusBadge';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Trash2 } from 'lucide-react';

interface Props {
  projects: Project[];
  tasks: Task[];
  onRefresh: () => void;
  onSelectTask: (task: Task) => void;
  filterProjectId?: string;
}

const COLUMNS: { status: TaskStatus; label: string; headerCls: string; dotCls: string }[] = [
  { status: 'todo',  label: 'To Do',  headerCls: 'border-t-gray-300',  dotCls: 'bg-gray-400' },
  { status: 'doing', label: 'Doing',  headerCls: 'border-t-amber-400', dotCls: 'bg-amber-400' },
  { status: 'done',  label: 'Done',   headerCls: 'border-t-emerald-400', dotCls: 'bg-emerald-400' },
  { status: 'hold',  label: 'Hold',   headerCls: 'border-t-red-400',   dotCls: 'bg-red-400' },
];

function formatDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BoardView({ projects, tasks, onRefresh, onSelectTask, filterProjectId }: Props) {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const visibleProjects = filterProjectId ? projects.filter(p => p.id === filterProjectId) : projects;
  const mainTasks = tasks.filter(t => !t.parent_task_id);

  async function moveTask(taskId: string, newStatus: TaskStatus) {
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
    onRefresh();
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    onRefresh();
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {COLUMNS.map(col => {
        const colTasks = mainTasks.filter(t =>
          t.status === col.status &&
          (filterProjectId ? t.project_id === filterProjectId : visibleProjects.some(p => p.id === t.project_id))
        );
        return (
          <div
            key={col.status}
            className={`flex-shrink-0 w-72 bg-gray-50 rounded-xl border-t-4 ${col.headerCls} shadow-sm`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              const taskId = e.dataTransfer.getData('taskId');
              if (taskId) moveTask(taskId, col.status);
            }}
          >
            <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200">
              <span className={`w-2.5 h-2.5 rounded-full ${col.dotCls}`} />
              <span className="text-sm font-semibold text-gray-700">{col.label}</span>
              <span className="ml-auto text-xs font-medium text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                {colTasks.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 min-h-32">
              {colTasks.map(task => {
                const project = projects.find(p => p.id === task.project_id);
                return (
                  <div
                    key={task.id}
                    draggable={canEdit}
                    onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                    onClick={() => onSelectTask(task)}
                    className="bg-white rounded-lg p-3.5 border border-gray-100 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-blue-200 group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
                      {canEdit && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteTask(task.id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {project && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                        <span className="text-xs text-gray-400">{project.name}</span>
                      </div>
                    )}
                    {(task.planned_start || task.planned_end) && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {formatDate(task.planned_start)} {task.planned_end ? `→ ${formatDate(task.planned_end)}` : ''}
                      </div>
                    )}
                    {canEdit && (
                      <div className="mt-2.5 flex gap-1">
                        {(['todo', 'doing', 'done', 'hold'] as TaskStatus[])
                          .filter(s => s !== task.status)
                          .slice(0, 2)
                          .map(s => (
                            <button
                              key={s}
                              onClick={e => { e.stopPropagation(); moveTask(task.id, s); }}
                              className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
