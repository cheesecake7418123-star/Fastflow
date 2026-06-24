import { TaskStatus } from '../../types';

const CONFIG: Record<TaskStatus, { label: string; cls: string }> = {
  todo:  { label: 'TO DO',  cls: 'bg-gray-100 text-gray-600' },
  doing: { label: 'DOING',  cls: 'bg-amber-100 text-amber-700' },
  done:  { label: 'DONE',   cls: 'bg-emerald-100 text-emerald-700' },
  hold:  { label: 'HOLD',   cls: 'bg-red-100 text-red-700' },
};

export default function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { label, cls } = CONFIG[status] ?? CONFIG.todo;
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded ${cls}`}>{label}</span>
  );
}

export function statusSelectClass(status: TaskStatus) {
  return CONFIG[status]?.cls ?? CONFIG.todo.cls;
}
