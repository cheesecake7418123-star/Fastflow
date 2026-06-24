import { useEffect, useState } from 'react';
import { LayoutGrid, List, BarChart2, Plus, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Task, Project, ViewMode } from '../types';
import ListView from '../components/tasks/ListView';
import BoardView from '../components/tasks/BoardView';
import GanttView from '../components/tasks/GanttView';
import TaskDetailPanel from '../components/tasks/TaskDetailPanel';
import AddTaskModal from '../components/tasks/AddTaskModal';
import { useAuth } from '../context/AuthContext';

interface Props {
  projects: Project[];
  filterProjectId?: string;
  onProjectIdChange?: (id?: string) => void;
}

export default function TasksPage({ projects, filterProjectId, onProjectIdChange }: Props) {
  const { profile } = useAuth();
  const [view, setView] = useState<ViewMode>('list');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  const canCreate = profile?.role === 'admin' || profile?.role === 'manager';

  async function loadTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('position')
      .order('created_at');
    setTasks(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadTasks(); }, []);

  // Filter tasks by project if active, then by search
  const filteredTasks = tasks.filter(t => {
    const matchesProject = filterProjectId ? t.project_id === filterProjectId : true;
    const matchesSearch = search.trim()
      ? t.title.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchesProject && matchesSearch;
  });

  // When selectedTask data changes after update, refresh it
  function handleTaskUpdate() {
    loadTasks();
    if (selectedTask) {
      supabase.from('tasks').select('*').eq('id', selectedTask.id).maybeSingle().then(({ data }) => {
        if (data) setSelectedTask(data as Task);
      });
    }
  }

  const activeProject = filterProjectId ? projects.find(p => p.id === filterProjectId) : null;

  const viewButtons: { id: ViewMode; label: string; icon: typeof List }[] = [
    { id: 'list', label: 'List View', icon: List },
    { id: 'board', label: 'Board View', icon: LayoutGrid },
    { id: 'gantt', label: 'Gantt Chart', icon: BarChart2 },
  ];

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-1 text-sm text-gray-400 mb-3">
            <button onClick={() => onProjectIdChange?.(undefined)} className="hover:text-blue-600 transition-colors">Home</button>
            <span>/</span>
            <span className="text-gray-700 font-medium">
              {activeProject ? activeProject.name : 'Tasks'}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View toggles */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
              {viewButtons.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors">
              <Search className="w-3.5 h-3.5" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="bg-transparent text-xs focus:outline-none w-36 text-gray-700 placeholder-gray-400"
              />
            </div>

            {/* Project filter */}
            {!filterProjectId && projects.length > 0 && (
              <select
                onChange={e => onProjectIdChange?.(e.target.value || undefined)}
                className="px-3 py-1.5 bg-gray-100 text-xs text-gray-600 rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-200"
              >
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Filter className="w-3.5 h-3.5" />
              {activeProject?.name ?? 'All'}
            </div>

            {/* Add task */}
            {canCreate && (
              <button
                onClick={() => setShowAddModal(true)}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add New Task
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl h-32 animate-pulse" />
              ))}
            </div>
          ) : view === 'list' ? (
            <ListView
              projects={filterProjectId ? projects.filter(p => p.id === filterProjectId) : projects}
              tasks={filteredTasks}
              onRefresh={loadTasks}
              onSelectTask={setSelectedTask}
              selectedTaskId={selectedTask?.id}
              filterProjectId={filterProjectId}
            />
          ) : view === 'board' ? (
            <BoardView
              projects={filterProjectId ? projects.filter(p => p.id === filterProjectId) : projects}
              tasks={filteredTasks}
              onRefresh={loadTasks}
              onSelectTask={setSelectedTask}
              filterProjectId={filterProjectId}
            />
          ) : (
            <GanttView
              projects={filterProjectId ? projects.filter(p => p.id === filterProjectId) : projects}
              tasks={filteredTasks}
              filterProjectId={filterProjectId}
            />
          )}
        </div>
      </div>

      {/* Task detail side panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}

      {showAddModal && (
        <AddTaskModal
          projects={filterProjectId ? projects.filter(p => p.id === filterProjectId) : projects}
          defaultProjectId={filterProjectId}
          onClose={() => setShowAddModal(false)}
          onCreated={loadTasks}
        />
      )}
    </div>
  );
}
