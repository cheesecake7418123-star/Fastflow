import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, MessageSquare } from 'lucide-react';
import { Task, Project } from '../../types';
import TaskStatusBadge from './TaskStatusBadge';
import AddTaskRow from './AddTaskRow';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Props {
  projects: Project[];
  tasks: Task[];
  onRefresh: () => void;
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string;
  filterProjectId?: string;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', d: undefined, day: 'numeric', year: 'numeric' });
}

function formatDuration(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return '';
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const days = Math.round((e.getTime() - s.getTime()) / 86400000);
  if (days <= 0) return '1 Day';
  return `${days} Day${days !== 1 ? 's' : ''}`;
}

export default function ListView({ projects, tasks, onRefresh, onSelectTask, selectedTaskId, filterProjectId }: Props) {
  const { user, profile } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const visibleProjects = filterProjectId
    ? projects.filter(p => p.id === filterProjectId)
    : projects;

  async function addTask(projectId: string, title: string) {
    await supabase.from('tasks').insert({
      project_id: projectId,
      title,
      status: 'todo',
      created_by: user!.id,
    });
    setAddingTaskFor(null);
    onRefresh();
  }

  async function addSubtask(projectId: string, parentId: string, title: string) {
    await supabase.from('tasks').insert({
      project_id: projectId,
      parent_task_id: parentId,
      title,
      status: 'todo',
      created_by: user!.id,
    });
    setAddingSubtaskFor(null);
    onRefresh();
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    onRefresh();
  }

  const mainTasks = tasks.filter(t => !t.parent_task_id);
  const subtasks = tasks.filter(t => !!t.parent_task_id);

  return (
    <div className="space-y-6">
      {visibleProjects.map(project => {
        const projectMainTasks = mainTasks.filter(t => t.project_id === project.id);
        const isCollapsed = collapsed[project.id];

        return (
          <div key={project.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Project header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <button onClick={() => setCollapsed(c => ({ ...c, [project.id]: !c[project.id] }))}>
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                  }
                </button>
                <span className="font-bold text-sm" style={{ color: project.color }}>{project.name}</span>
              </div>
              <span className="text-xs text-gray-400">
                {projectMainTasks.length} Main Task{projectMainTasks.length !== 1 ? 's' : ''} / {subtasks.filter(s => projectMainTasks.some(m => m.id === s.parent_task_id)).length} Sub Task
              </span>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 w-8"></th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">Main Task</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 w-28">Status</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 w-32">Planned Start</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 w-32">Planned End</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 w-32">Actual Start</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 w-32">Actual End</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 w-24"># Of Hrs</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectMainTasks.map(task => {
                      const taskSubtasks = subtasks.filter(s => s.parent_task_id === task.id);
                      const isTaskCollapsed = collapsed[task.id];
                      return (
                        <>
                          {/* Main task row */}
                          <tr
                            key={task.id}
                            onClick={() => onSelectTask(task)}
                            className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors ${selectedTaskId === task.id ? 'bg-blue-50' : ''}`}
                          >
                            <td className="px-4 py-2.5">
                              <button
                                onClick={e => { e.stopPropagation(); setCollapsed(c => ({ ...c, [task.id]: !c[task.id] })); }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {isTaskCollapsed
                                  ? <ChevronRight className="w-4 h-4" />
                                  : <ChevronDown className="w-4 h-4" />
                                }
                              </button>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-800 font-medium">{task.title}</span>
                                <button
                                  onClick={e => { e.stopPropagation(); onSelectTask(task); }}
                                  className="opacity-0 hover:opacity-100 group-hover:opacity-100"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-2.5"><TaskStatusBadge status={task.status} /></td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(task.planned_start)}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(task.planned_end)}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(task.actual_start)}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(task.actual_end)}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">
                              {task.estimated_hours ? `${task.estimated_hours}h` : formatDuration(task.planned_start, task.planned_end)}
                            </td>
                            <td className="px-4 py-2.5">
                              {canEdit && (
                                <button
                                  onClick={e => { e.stopPropagation(); deleteTask(task.id); }}
                                  className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* Subtasks */}
                          {!isTaskCollapsed && (
                            <>
                              {taskSubtasks.length > 0 && (
                                <tr key={`${task.id}-sub-header`}>
                                  <td colSpan={9} className="bg-gray-50/80 px-0">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="border-b border-gray-100">
                                          <th className="w-12"></th>
                                          <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2">Sub Task</th>
                                          <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2 w-28">Status</th>
                                          <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2 w-32">Planned Start</th>
                                          <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2 w-32">Planned End</th>
                                          <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2 w-32">Actual Start</th>
                                          <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2 w-32">Actual End</th>
                                          <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2 w-24"># Of Hrs</th>
                                          <th className="w-16"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {taskSubtasks.map(sub => (
                                          <tr
                                            key={sub.id}
                                            onClick={() => onSelectTask(sub)}
                                            className={`border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors ${selectedTaskId === sub.id ? 'bg-blue-50' : ''}`}
                                          >
                                            <td className="pl-8 pr-4 py-2"></td>
                                            <td className="px-4 py-2 text-sm text-gray-700">{sub.title}</td>
                                            <td className="px-4 py-2"><TaskStatusBadge status={sub.status} /></td>
                                            <td className="px-4 py-2 text-xs text-gray-600">{formatDate(sub.planned_start)}</td>
                                            <td className="px-4 py-2 text-xs text-gray-600">{formatDate(sub.planned_end)}</td>
                                            <td className="px-4 py-2 text-xs text-gray-600">{formatDate(sub.actual_start)}</td>
                                            <td className="px-4 py-2 text-xs text-gray-600">{formatDate(sub.actual_end)}</td>
                                            <td className="px-4 py-2 text-xs text-gray-600">
                                              {sub.estimated_hours ? `${sub.estimated_hours}h` : formatDuration(sub.planned_start, sub.planned_end)}
                                            </td>
                                            <td className="px-4 py-2">
                                              {canEdit && (
                                                <button
                                                  onClick={e => { e.stopPropagation(); deleteTask(sub.id); }}
                                                  className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                              {/* Add subtask */}
                              {canEdit && (
                                <tr key={`${task.id}-add-sub`}>
                                  <td colSpan={9} className="px-8 py-1.5 bg-gray-50/50">
                                    {addingSubtaskFor === task.id ? (
                                      <AddTaskRow
                                        label="New subtask title..."
                                        onSave={title => addSubtask(project.id, task.id, title)}
                                        onCancel={() => setAddingSubtaskFor(null)}
                                      />
                                    ) : (
                                      <button
                                        onClick={() => setAddingSubtaskFor(task.id)}
                                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors py-1"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add SubTask
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </>
                          )}
                        </>
                      );
                    })}

                    {/* Add task row */}
                    {canEdit && (
                      <tr>
                        <td colSpan={9} className="px-4 py-2">
                          {addingTaskFor === project.id ? (
                            <AddTaskRow
                              label="New task title..."
                              onSave={title => addTask(project.id, title)}
                              onCancel={() => setAddingTaskFor(null)}
                            />
                          ) : (
                            <button
                              onClick={() => setAddingTaskFor(project.id)}
                              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors py-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Task
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {visibleProjects.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p>No projects to show. Create a project first.</p>
        </div>
      )}
    </div>
  );
}
