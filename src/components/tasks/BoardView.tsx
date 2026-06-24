import { Task, Project, TaskStatus } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, Trash2 } from 'lucide-react';

interface Props {
  projects: Project[];
  tasks: Task[];
  onRefresh: () => void;
  onSelectTask: (task: Task) => void;
  filterProjectId?: string;
  canEdit?: boolean;
}

const COLUMNS: { status: TaskStatus; label: string; accent: string; bg: string; badge: string }[] = [
  { status: 'todo',  label: 'To Do',   accent: 'bg-slate-300',   bg: 'bg-slate-50/60',   badge: 'bg-slate-100 text-slate-500' },
  { status: 'doing', label: 'Doing',   accent: 'bg-amber-400',   bg: 'bg-amber-50/40',   badge: 'bg-amber-100 text-amber-600' },
  { status: 'done',  label: 'Done',    accent: 'bg-emerald-400', bg: 'bg-emerald-50/40', badge: 'bg-emerald-100 text-emerald-600' },
  { status: 'hold',  label: 'On Hold', accent: 'bg-rose-400',    bg: 'bg-rose-50/30',    badge: 'bg-rose-100 text-rose-600' },
];

function formatDateTime(d: string | null | undefined) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BoardView({ projects, tasks, onRefresh, onSelectTask, filterProjectId, canEdit: canEditProp }: Props) {
  const { profile } = useAuth();
  const canEdit = canEditProp || profile?.role === 'admin' || profile?.role === 'manager';

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
            className={`flex-shrink-0 w-72 ${col.bg} rounded-2xl border border-gray-200/60`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              const taskId = e.dataTransfer.getData('taskId');
              if (taskId) moveTask(taskId, col.status);
            }}
          >
            {/* Column header */}
            <div className="px-4 py-3.5 flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${col.accent}`} />
              <span className="text-sm font-semibold text-gray-700">{col.label}</span>
              <span className={`ml-auto text-xs font-semibold rounded-full px-2 py-0.5 ${col.badge}`}>
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="px-3 pb-3 space-y-2.5 min-h-24">
              {colTasks.map(task => {
                const project = projects.find(p => p.id === task.project_id);
                const subtaskCount = tasks.filter(t => t.parent_task_id === task.id).length;
                return (
                  <div
                    key={task.id}
                    draggable={canEdit}
                    onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                    onClick={() => onSelectTask(task)}
                    className="bg-white rounded-xl p-4 border border-gray-100/80 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-blue-200/60 hover:-translate-y-px group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
                      {canEdit && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteTask(task.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {project && (
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                        <span className="text-xs text-gray-400 font-medium">{project.name}</span>
                      </div>
                    )}

                    {(task.planned_start || task.planned_end) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2.5">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {formatDateTime(task.planned_start)}
                          {task.planned_end ? ` → ${formatDateTime(task.planned_end)}` : ''}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      {task.estimated_hours ? (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {task.estimated_hours}h
                        </div>
                      ) : <div />}

                      {subtaskCount > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                          {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {canEdit && (
                      <div className="mt-3 pt-2.5 border-t border-gray-100 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(['todo', 'doing', 'done', 'hold'] as TaskStatus[])
                          .filter(s => s !== task.status)
                          .slice(0, 2)
                          .map(s => (
                            <button
                              key={s}
                              onClick={e => { e.stopPropagation(); moveTask(task.id, s); }}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors capitalize"
                            >
                              {s === 'hold' ? 'On Hold' : s}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div className="flex items-center justify-center h-16 text-xs text-gray-300 border-2 border-dashed border-gray-200 rounded-xl">
                  Drop cards here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
