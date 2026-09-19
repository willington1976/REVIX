// Shown while Firebase checks auth state
export default function Splash() {
  return (
    <div style={{minHeight:'100vh',background:'#0A0F1E',display:'flex',flexDirection:'column',
                 alignItems:'center',justifyContent:'center',
                 backgroundImage:'radial-gradient(ellipse at 50% 40%,rgba(29,111,232,0.07) 0%,transparent 65%)'}}>
      <div style={{height:2,position:'fixed',top:0,left:0,right:0,
                   background:'linear-gradient(90deg,#1D6FE8,#15803D)',opacity:0.7}}/>

      {/* Logo */}
      <div style={{width:80,height:80,borderRadius:20,overflow:'hidden',
                   border:'1px solid rgba(255,255,255,0.08)',marginBottom:20,
                   background:'#111827',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <img src="/pwa-192x192.png" alt="REVIX"
             style={{width:'100%',height:'100%',objectFit:'cover'}}
             onError={e=>{
               e.target.style.display='none'
               e.target.parentElement.innerHTML='<span style="font-size:36px;font-weight:800;color:#1D6FE8;font-family:Inter,sans-serif">R</span>'
             }}/>
      </div>

      <h1 style={{fontSize:26,fontWeight:800,color:'#F1F5F9',margin:'0 0 4px',
                  letterSpacing:'-0.03em'}}>REVIX</h1>
      <p style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'#334155',
                 margin:'0 0 40px',textTransform:'uppercase',letterSpacing:'0.12em'}}>
        ARFF · UAEAC · Colombia
      </p>

      {/* Loading dots */}
      <div style={{display:'flex',gap:6}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{
            width:6,height:6,borderRadius:'50%',background:'#1D6FE8',
            animation:`dot-pulse 1.4s ease-in-out ${i*0.2}s infinite`
          }}/>
        ))}
      </div>

      <style>{`
        @keyframes dot-pulse {
          0%,80%,100% { opacity:.2; transform:scale(0.8) }
          40%          { opacity:1;  transform:scale(1.2) }
        }
      `}</style>

      <p style={{position:'fixed',bottom:16,fontFamily:'JetBrains Mono,monospace',
                 fontSize:10,color:'#1E293B',textTransform:'uppercase',letterSpacing:'0.08em'}}>
        Sistema de Inspección de Extintores
      </p>
    </div>
  )
}
