import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{minHeight:'100vh',background:'#0A0F1E',display:'flex',flexDirection:'column',
                 alignItems:'center',justifyContent:'center',padding:'0 32px',
                 backgroundImage:'radial-gradient(ellipse at 50% 30%,rgba(29,111,232,0.06) 0%,transparent 60%)'}}>
      <div style={{height:2,position:'fixed',top:0,left:0,right:0,
                   background:'linear-gradient(90deg,#1D6FE8,#15803D)',opacity:0.7}}/>

      {/* Code */}
      <p style={{fontFamily:'JetBrains Mono,monospace',fontSize:96,fontWeight:700,
                 color:'rgba(255,255,255,0.04)',margin:0,lineHeight:1,
                 position:'absolute',userSelect:'none'}}>
        404
      </p>

      {/* Icon */}
      <div style={{width:64,height:64,borderRadius:16,background:'#111827',
                   border:'1px solid rgba(255,255,255,0.06)',
                   display:'flex',alignItems:'center',justifyContent:'center',
                   marginBottom:24,position:'relative'}}>
        <svg width="28" height="28" fill="none" stroke="#334155" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>

      <h1 style={{fontSize:20,fontWeight:700,color:'#F1F5F9',margin:'0 0 8px',
                  letterSpacing:'-0.02em',textAlign:'center'}}>
        Página no encontrada
      </h1>
      <p style={{fontSize:14,color:'#475569',margin:'0 0 32px',textAlign:'center',lineHeight:1.6}}>
        La ruta que buscas no existe o fue movida.
      </p>

      <button onClick={()=>navigate('/')}
        style={{minHeight:48,padding:'0 28px',borderRadius:10,border:'none',
                background:'#1D6FE8',color:'white',fontWeight:600,fontSize:14,
                cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
        Volver al inicio
      </button>

      <p style={{position:'fixed',bottom:16,fontFamily:'JetBrains Mono,monospace',
                 fontSize:10,color:'#1E293B',textTransform:'uppercase',letterSpacing:'0.08em'}}>
        REVIX v1.0 · ARFF
      </p>
    </div>
  )
}
