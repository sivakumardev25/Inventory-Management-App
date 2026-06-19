import React, { useEffect, useState, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, LogOut, Smartphone, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const STATUS_INFO = {
  not_started:   { label:'Not Connected',    icon: WifiOff,    color:'var(--gray400)',  bg:'var(--gray100)',  badge:'badge-gray'  },
  initialising:  { label:'Initialising…',   icon: Clock,      color:'#D97706',         bg:'#FEF3C7',         badge:'badge-amber' },
  qr_pending:    { label:'Scan QR Code',     icon: Smartphone, color:'var(--blue)',     bg:'var(--blue-lt)',  badge:'badge-blue'  },
  authenticated: { label:'Authenticated',    icon: CheckCircle,color:'var(--green)',    bg:'#DCFCE7',         badge:'badge-green' },
  ready:         { label:'Connected & Ready',icon: Wifi,       color:'var(--green)',    bg:'#DCFCE7',         badge:'badge-green' },
  auth_failed:   { label:'Auth Failed',      icon: AlertCircle,color:'#DC2626',         bg:'#FFE4E6',         badge:'badge-red'   },
  disconnected:  { label:'Disconnected',     icon: WifiOff,    color:'#DC2626',         bg:'#FFE4E6',         badge:'badge-red'   },
  error:         { label:'Error',            icon: AlertCircle,color:'#DC2626',         bg:'#FFE4E6',         badge:'badge-red'   },
};

export default function WhatsAppSetup() {
  const [status, setStatus]   = useState('not_started');
  const [qr,     setQR]       = useState(null);
  const [loading, setLoading] = useState(false);
  

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/whatsapp/status');
      const { status: s, qr } = res.data.data;
      setStatus(s || 'not_started');
      setQR(qr || null);
    } catch (e) { /* server may not be running */ }
  }, []);

  // Poll every 3s when not ready
  useEffect(() => {
    fetchStatus();
    const id = setInterval(() => {
      if (!['ready','auth_failed','error'].includes(status)) fetchStatus();
    }, 3000);
    return () => clearInterval(id);
  }, [fetchStatus, status]);

  const connect = async () => {
    setLoading(true);
    try {
      await api.post('/whatsapp/init');
      toast.success('WhatsApp initialising — QR will appear shortly');
      setStatus('initialising');
      setTimeout(fetchStatus, 2000);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect WhatsApp? You will need to scan QR again.')) return;
    setLoading(true);
    try {
      await api.post('/whatsapp/logout');
      setStatus('not_started'); setQR(null);
      toast.success('Disconnected');
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const info = STATUS_INFO[status] || STATUS_INFO.not_started;
  const Icon = info.icon;
  const isReady = status === 'ready';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">WhatsApp Setup</div>
          <div className="page-sub">Connect once — session stays active. Bills will be sent automatically.</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchStatus}><RefreshCw size={13}/>Refresh Status</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* STATUS CARD */}
        <div className="card">
          <div className="card-header"><span className="card-title">Connection Status</span></div>
          <div className="card-body">
            {/* Big status indicator */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'24px 0',gap:12}}>
              <div style={{width:72,height:72,borderRadius:'50%',background:info.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon size={34} color={info.color}/>
              </div>
              <div>
                <span className={`badge ${info.badge}`} style={{fontSize:'.85rem',padding:'5px 16px'}}>
                  {info.label}
                </span>
              </div>
              {isReady && (
                <div style={{textAlign:'center',fontSize:'.8rem',color:'var(--gray600)',lineHeight:1.7}}>
                  <CheckCircle size={13} style={{color:'var(--green)',verticalAlign:'middle',marginRight:4}}/>Session active — no re-scan needed<br/>
                  <CheckCircle size={13} style={{color:'var(--green)',verticalAlign:'middle',marginRight:4}}/>PDFs sent directly to clients<br/>
                  <CheckCircle size={13} style={{color:'var(--green)',verticalAlign:'middle',marginRight:4}}/>Uses your existing WhatsApp number
                </div>
              )}
            </div>

            <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:8}}>
              {!isReady && (
                <button className="btn btn-success" onClick={connect} disabled={loading || status==='initialising'}>
                  {loading ? <><div className="spinner"/>Connecting…</> : <><Wifi size={14}/>Connect WhatsApp</>}
                </button>
              )}
              {isReady && (
                <button className="btn btn-danger" onClick={disconnect} disabled={loading}>
                  <LogOut size={14}/>Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* QR CODE CARD */}
        <div className="card">
          <div className="card-header"><span className="card-title">
            {qr ? 'Scan QR Code with WhatsApp' : 'QR Code'}
          </span></div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',alignItems:'center',minHeight:240,justifyContent:'center'}}>
            {qr ? (
              <>
                <img src={qr} alt="WhatsApp QR Code" style={{width:200,height:200,borderRadius:12,border:'4px solid var(--green)',boxShadow:'0 4px 20px rgba(37,211,102,.25)'}}/>
                <div style={{marginTop:12,textAlign:'center',fontSize:'.8rem',color:'var(--gray600)',lineHeight:1.7}}>
                  <strong style={{color:'var(--navy)'}}>Scan with your phone:</strong><br/>
                  WhatsApp → ⋮ Menu → Linked Devices → Link a Device
                </div>
                <div style={{marginTop:8,display:'flex',alignItems:'center',gap:6,fontSize:'.75rem',color:'var(--green)'}}>
                  <div style={{width:7,height:7,background:'var(--green)',borderRadius:'50%',animation:'pulse 1.5s infinite'}}/>
                  Waiting for scan…
                </div>
              </>
            ) : isReady ? (
              <div style={{textAlign:'center'}}>
                <CheckCircle size={56} style={{color:'var(--green)',margin:'0 auto 12px'}}/>
                <div style={{fontWeight:700,color:'var(--green)'}}>WhatsApp Connected!</div>
                <div style={{fontSize:'.78rem',color:'var(--gray400)',marginTop:6}}>Session is active. You can now send bulk bills.</div>
              </div>
            ) : (
              <div style={{textAlign:'center',color:'var(--gray400)'}}>
                <Smartphone size={48} style={{opacity:.3,margin:'0 auto 12px'}}/>
                <div style={{fontSize:'.85rem'}}>
                  {status==='initialising' ? 'Starting WhatsApp… QR loading' : 'Click "Connect WhatsApp" to begin'}
                </div>
                {status==='initialising' && <div className="spinner" style={{margin:'12px auto 0'}}/>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SETUP GUIDE */}
      <div className="card" style={{marginTop:0}}>
        <div className="card-header"><span className="card-title">Setup Guide</span></div>
        <div className="card-body">
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
            {[
              { num:1, title:'Start Server',   desc:'Run npm run dev in the backend folder', icon:'⚙️' },
              { num:2, title:'Click Connect',  desc:'Press "Connect WhatsApp" button above',  icon:'🔌' },
              { num:3, title:'Scan QR',        desc:'Open WhatsApp → Linked Devices → Scan', icon:'📱' },
              { num:4, title:'Send Bills!',    desc:'Go to Bulk Excel Send and upload your Excel', icon:'✅' },
            ].map(s=>(
              <div key={s.num} style={{textAlign:'center',padding:'16px 12px',background:'var(--gray50)',borderRadius:10,border:'1px solid var(--gray200)'}}>
                <div style={{fontSize:'1.8rem',marginBottom:8}}>{s.icon}</div>
                <div style={{fontWeight:700,fontSize:'.85rem',color:'var(--navy)',marginBottom:4}}>{s.title}</div>
                <div style={{fontSize:'.75rem',color:'var(--gray400)',lineHeight:1.5}}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:14,padding:'10px 14px',background:'#FEF3C7',borderRadius:9,fontSize:'.78rem',color:'#92400E',display:'flex',gap:8,alignItems:'flex-start'}}>
            <AlertCircle size={15} style={{flexShrink:0,marginTop:1}}/>
            <span>
              <strong>Note:</strong> whatsapp-web.js uses your personal WhatsApp number — keep your phone connected to internet.
              The session is saved locally so you only need to scan once. If you logout from WhatsApp Linked Devices, re-scan here.
            </span>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
