import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, textAlign:'center', background:'#07090f', color:'#fff' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, letterSpacing:2, marginBottom:8 }}>HATA OLUŞTU</h2>
          <p style={{ color:'rgba(255,255,255,.5)', fontSize:14, marginBottom:24 }}>
            Beklenmedik bir hata oluştu. Sayfayı yenileyerek tekrar dene.
          </p>
          <button
            style={{ background:'linear-gradient(90deg, var(--red), #f97316)', border:'none', borderRadius:12, padding:'12px 28px', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}
            onClick={() => window.location.reload()}
          >
            Sayfayı Yenile
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
