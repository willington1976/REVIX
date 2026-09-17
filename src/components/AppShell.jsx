// Shared header + footer shell
import { useNavigate } from 'react-router-dom'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function TopBar({ title, back }) {
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-10 bg-[#0F172A]/95 backdrop-blur border-b border-white/5 px-4 flex items-center gap-3" style={{minHeight:56}}>
      {back && (
        <button onClick={() => navigate(-1)} className="tap-target flex items-center justify-center w-10 text-slate-400 hover:text-white">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
      )}
      <span className="text-white font-semibold text-sm tracking-wide flex-1">{title}</span>
    </div>
  )
}

export function AppFooter() {
  const online = useOnlineStatus()
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0F172A] border-t border-white/5 px-4 py-2 flex items-center justify-between z-10">
      <span className="font-mono text-[10px] text-slate-600">REVIX v1.0</span>
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`}/>
        <span className="font-mono text-[10px] text-slate-600">{online ? 'EN LÍNEA' : 'SIN CONEXIÓN'}</span>
      </div>
    </div>
  )
}
