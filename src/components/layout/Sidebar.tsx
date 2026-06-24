import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, FolderOpen, CheckSquare, Settings,
  ChevronDown, Plus, LogOut, User, Users, Trash2, MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Project } from '../../types';
import { supabase } from '../../lib/supabase';
import ProjectMembersModal from '../modals/ProjectMembersModal';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string, projectId?: string) => void;
  projects: Project[];
  activeProjectId?: string;
  onAddProject: () => void;
  onRefreshProjects: () => void;
}

export default function Sidebar({
  activePage, onNavigate, projects, activeProjectId, onAddProject, onRefreshProjects,
}: SidebarProps) {
  const { profile, user, signOut } = useAuth();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [managingProject, setManagingProject] = useState<Project | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const canCreate = profile?.role === 'admin' || profile?.role === 'manager';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuProjectId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function deleteProject(id: string) {
    if (!confirm('Delete this project and all its tasks?')) return;
    setMenuProjectId(null);
    await supabase.from('projects').delete().eq('id', id);
    onRefreshProjects();
  }

  function canManageProject(p: Project) {
    return profile?.role === 'admin' || profile?.role === 'manager' || p.created_by === user?.id;
  }

  const roleColor = profile?.role === 'admin'
    ? 'bg-red-100 text-red-700'
    : profile?.role === 'manager'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-blue-100 text-blue-700';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  ];

  return (
    <>
      <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col h-full">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-base tracking-tight">TaskFlow</span>
          </div>
        </div>

        {/* Main nav */}
        <nav className="px-3 py-4 space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activePage === id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-2">
          <div className="h-px bg-slate-800" />
        </div>

        {/* My Projects */}
        <div className="px-3 flex-1 overflow-y-auto">
          <button
            onClick={() => setProjectsOpen(!projectsOpen)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400"
          >
            <span>My Projects</span>
            <div className="flex items-center gap-1">
              {canCreate && (
                <button
                  onClick={e => { e.stopPropagation(); onAddProject(); }}
                  className="p-0.5 rounded hover:bg-slate-800 hover:text-slate-300 text-slate-500"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${projectsOpen ? '' : '-rotate-90'}`} />
            </div>
          </button>

          {projectsOpen && (
            <div className="mt-1 space-y-0.5" ref={menuRef}>
              {projects.map(p => (
                <div key={p.id} className="relative group">
                  <button
                    onClick={() => onNavigate('tasks', p.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeProjectId === p.id && activePage === 'tasks'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="flex-1 text-left truncate">{p.name}</span>
                    {canManageProject(p) && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setMenuProjectId(menuProjectId === p.id ? null : p.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </button>

                  {/* Dropdown menu */}
                  {menuProjectId === p.id && (
                    <div className="absolute left-full top-0 ml-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-44">
                      <button
                        onClick={() => { setMenuProjectId(null); setManagingProject(p); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Manage Members
                      </button>
                      <div className="h-px bg-gray-100 my-1" />
                      <button
                        onClick={() => deleteProject(p.id)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Project
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {projects.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-600">No projects yet</p>
              )}
            </div>
          )}
        </div>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-800 space-y-1">
          <button
            onClick={() => onNavigate('settings')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{profile?.full_name || 'User'}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleColor}`}>
                {profile?.role}
              </span>
            </div>
            <button onClick={signOut} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Members modal rendered outside aside to avoid z-index issues */}
      {managingProject && (
        <ProjectMembersModal
          project={managingProject}
          onClose={() => { setManagingProject(null); onRefreshProjects(); }}
        />
      )}
    </>
  );
}
