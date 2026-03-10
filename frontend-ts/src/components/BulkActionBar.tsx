import Icon from './Icons';

interface BulkActionBarProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  deleting?: boolean;
  children?: React.ReactNode;
}

export default function BulkActionBar({ count, onDelete, onClear, deleting, children }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-3 mb-4 bg-forest-50 border border-forest-200 rounded-lg px-4 py-3 animate-[fadeInUp_0.2s_ease-out]">
      <span className="text-sm font-semibold text-forest-700">{count} selected</span>
      {children}
      <button
        onClick={onDelete}
        disabled={deleting}
        className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
      >
        <Icon name="trash" className="w-3.5 h-3.5" />
        {deleting ? 'Deleting…' : 'Delete Selected'}
      </button>
      <button onClick={onClear} className="text-gray-500 text-sm hover:underline ml-auto">
        Clear selection
      </button>
    </div>
  );
}
