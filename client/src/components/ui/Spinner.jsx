/** src/components/ui/Spinner.jsx — accessible loading spinner */
export default function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <svg
      className={`animate-spin text-brand-600 ${sizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      role="status" aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

/** Full-area loading overlay */
export function LoadingOverlay({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
      <Spinner size="lg" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
