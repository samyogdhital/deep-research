export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full border-2 border-gray-900 border-t-transparent ${className}`} />
  );
}
