export default function StatsCard({ title, value, subtitle, icon, trend, colorClass = 'text-primary', onClick, clickable = false }) {
  return (
    <div
      className={`card ${clickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${colorClass}`}>{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClass} bg-opacity-10`}>
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <span className={`text-sm ${trend.positive ? 'text-success' : 'text-danger'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-sm text-gray-500 ml-2">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
