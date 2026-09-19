import { useNavigate } from 'react-router-dom'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function TopBar({ title, back, right }) {
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-10 backdrop-blur-md border-b px-4 flex items-center gap-3"
         style={{minHeight:56, background:'rgba(10,15,30,0.92)', borderColor:'rgba(255,255,255,0.06)'}}>
      {back && (
        <button onClick={() => navigate(-1)}
          style={{width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',
                  background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:8,cursor:'pointer',flexShrink:0}}>
          <svg width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
      )}
      <span style={{color:'#F1F5F9',fontWeight:600,fontSize:15,flex:1,letterSpacing:'-0.01em'}}>{title}</span>
      {right}
    </div>
  )
}

export function AppFooter() {
  const online = useOnlineStatus()
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t px-4 py-2 flex items-center justify-between z-10"
         style={{background:'rgba(10,15,30,0.95)', borderColor:'rgba(255,255,255,0.05)'}}>
      <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:'#334155'}}>REVIX v1.0 · ARFF</span>
      <div className="flex items-center gap-1.5">
        <div style={{width:6,height:6,borderRadius:'50%',background:online?'#22C55E':'#DC2626'}}/>
        <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:'#334155'}}>
          {online ? 'EN LÍNEA' : 'SIN CONEXIÓN'}
        </span>
      </div>
    </div>
  )
}
