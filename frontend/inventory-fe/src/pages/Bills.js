import React, { useEffect, useState, useCallback } from "react";

import {
  Plus,
  Download,
  MessageCircle,
  X,
  FileText,
  CheckCircle,
  Clock,
  Users,
  RefreshCw,
  Eye,
  Send,
  IndianRupee,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { buildWhatsAppLink } from "../utils/whatsapp";

function BillStates({ bills }) {
  const total = bills.reduce((s, b) => s + b.grandTotal, 0);
  const paid = bills
    .filter((b) => b.status === "paid")
    .reduce((s, b) => s + b.grandTotal, 0);
  const pending = bills.filter((b) =>
    ["Draft", "Sent", "Overdue"].includes(b.status),
  ).length;
  const waSent = bills.filter((b) => b.whatsappSent).length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: 12,
        marginBottom: 20,
      }}
    >
      {[
        {
          label: "Total Invoiced",
          value: `₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
          icon: IndianRupee,
          cls: "si-blue",
        },
        {
          label: "Collected",
          value: `₹${paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
          icon: TrendingUp,
          cls: "si-green",
        },
        {
          label: "Pending Bills",
          value: pending,
          icon: AlertCircle,
          cls: "si-orange",
        },
        {
          label: "WhatsApp Sent",
          value: `${waSent} / ${bills.length}`,
          icon: MessageCircle,
          cls: "si-teal",
        },
      ].map((c) => (
        <div
          key={c.label}
          className="stat-card"
          style={{ padding: "14px 16px" }}
        >
          <div>
            <div className="label"> {c.label}</div>
            <div className="value" style={{ fontSize: ".9rem" }}>
              {c.value}
            </div>
          </div>
          <div className={`stat-icon ${c.cls}`}>
            <c.icon size={18} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Bills() {
  const [bills, setBills]     = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [genModal, setGenModal] = useState(false);
  const [genMode, setGenMode]   = useState('single');
  const [genForm, setGenForm]   = useState({ clientId:'', periodStart:'', periodEnd:'', billDate: new Date().toISOString().slice(0,10) });
  const [generating, setGenerating] = useState(false);
  const [previewBill, setPreviewBill] = useState(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkBills, setBulkBills] = useState([]);
  const [sendingIdx, setSendingIdx] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/bills', { params: { ...params, limit:200 } });
      setBills(res.data.data);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/clients',{params:{active:true}}).then(r=>setClients(r.data.data)).catch(()=>{});
  }, []);

  const openGen = (mode) => {
    setGenMode(mode);
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    setGenForm({
      clientId: '',
      periodStart: new Date(y, m-1, 1).toISOString().slice(0,10),
      periodEnd:   new Date(y, m,   0).toISOString().slice(0,10),
      billDate:    now.toISOString().slice(0,10)
    });
    setGenModal(true);
  };

  const generate = async () => {
    if (!genForm.periodStart || !genForm.periodEnd) return toast.error('Select billing period');
    if (genMode==='single' && !genForm.clientId)   return toast.error('Select a client');
    setGenerating(true);
    try {
      if (genMode==='single') {
        const res = await api.post('/bills/generate', genForm);
        toast.success(`✅ Bill #${res.data.data.invoiceNo} generated!`);
      } else {
        const res = await api.post('/bills/generate-all', genForm);
        toast.success(`✅ ${res.data.generated} bills generated!`);
        if (res.data.errors?.length)
          toast.error(`⚠️ ${res.data.errors.length} client(s) had no entries`);
      }
      setGenModal(false);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  const download = async (bill) => {
    try {
      toast.loading('Preparing Excel…', { id:'dl' });
      const res = await api.get(`/bills/${bill._id}/download`, { responseType:'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${bill.invoiceNo||bill.billId}_${(bill.client?.name||'').replace(/\s+/g,'_')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Downloaded!', { id:'dl' });
    } catch (e) { toast.error('Download failed: '+e.message, { id:'dl' }); }
  };

  const sendWhatsApp = async (bill, skipReload=false) => {
    const phone = bill.client?.mobileNo || bill.client?.phone;
    if (!phone) { toast.error('No phone number for '+bill.client?.name); return; }
    const link = buildWhatsAppLink(phone, bill, bill.client.name);
    window.open(link, '_blank');
    try {
      await api.post(`/bills/${bill._id}/mark-whatsapp`);
      if (!skipReload) { toast.success('Marked as sent ✓'); load(); }
    } catch(e) {}
  };

  const openBulkSend = () => {
    const unsent = bills.filter(b => !b.whatsappSent && b.client?.phone);
    if (!unsent.length) return toast.error('All bills already sent via WhatsApp');
    setBulkBills(unsent.map(b=>({...b, selected:true})));
    setBulkModal(true);
  };

  const runBulkSend = async () => {
    const toSend = bulkBills.filter(b=>b.selected);
    if (!toSend.length) return toast.error('No bills selected');
    for (let i=0; i<toSend.length; i++) {
      setSendingIdx(i);
      await sendWhatsApp(toSend[i], true);
      await new Promise(r=>setTimeout(r,600));
    }
    setSendingIdx(null);
    toast.success(`✅ WhatsApp opened for ${toSend.length} clients`);
    setBulkModal(false);
    load();
  };

  const updateStatus = async (bill, status) => {
    try {
      await api.put(`/bills/${bill._id}/status`, { status });
      setBills(prev => prev.map(b => b._id===bill._id ? {...b,status} : b));
    } catch (e) { toast.error(e.message); }
  };

  const deleteBill = async bill => {
    if (!window.confirm('Delete this bill permanently?')) return;
    try {
      await api.delete(`/bills/${bill._id}`);
      toast.success('Bill deleted');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const GF = k => ({ value: genForm[k], onChange: e => setGenForm(p=>({...p,[k]:e.target.value})) });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Bills & Invoices</div>
          <div className="page-sub">{bills.length} bills total</div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="btn btn-ghost" onClick={openBulkSend}><Send size={14}/>Bulk WhatsApp</button>
          <button className="btn btn-ghost" onClick={()=>openGen('single')}><Plus size={14}/>Single Bill</button>
          <button className="btn btn-primary" onClick={()=>openGen('all')}><Users size={14}/>Generate All Bills</button>
        </div>
      </div>

      {!loading && bills.length > 0 && <BillStates bills={bills}/>}

      <div className="card">
        <div className="card-body">
          <div className="filter-bar">
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
              style={{padding:'9px 14px',border:'1.5px solid var(--gray200)',borderRadius:9,fontSize:'.82rem',minWidth:150}}>
              <option value="">All Statuses</option>
              {['Draft','Sent','Paid','Overdue'].map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13}/>Refresh</button>
            <span style={{marginLeft:'auto',fontSize:'.75rem',color:'var(--gray400)'}}>
              {bills.filter(b=>b.whatsappSent).length} of {bills.length} WhatsApp sent
            </span>
          </div>

          {loading ? (
            <div className="loading-page"><div className="spinner"/><span>Loading bills…</span></div>
          ) : bills.length===0 ? (
            <div className="empty">
              <FileText size={48}/>
              <p style={{marginTop:8,fontWeight:600}}>No bills yet</p>
              <p>Use "Generate All Bills" to create invoices from inventory data</p>
              <button className="btn btn-primary" style={{marginTop:16}} onClick={()=>openGen('all')}>
                <FileText size={14}/>Generate Bills
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Inv No.</th>
                    <th>Client</th>
                    <th>Billing Period</th>
                    <th>Bill Date</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th>WhatsApp</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(b=>(
                    <tr key={b._id}>
                      <td>
                        <span style={{fontFamily:'monospace',fontWeight:700,background:'var(--navy)',color:'#fff',padding:'2px 8px',borderRadius:5,fontSize:'.75rem'}}>
                          #{b.invoiceNo||b.billId}
                        </span>
                      </td>
                      <td>
                        <div style={{fontWeight:700,fontSize:'.85rem'}}>{b.client?.name}</div>
                        <div style={{fontSize:'.71rem',color:'var(--gray400)'}}>{b.client?.phone}</div>
                      </td>
                      <td style={{fontSize:'.78rem'}}>
                        <span style={{background:'var(--blue-lt)',color:'var(--blue)',padding:'2px 8px',borderRadius:5,fontWeight:600}}>
                          {new Date(b.periodStart).toLocaleDateString('en-IN')} → {new Date(b.periodEnd).toLocaleDateString('en-IN')}
                        </span>
                      </td>
                      <td style={{fontSize:'.8rem'}}>{new Date(b.billDate).toLocaleDateString('en-IN')}</td>
                      <td>
                        <div style={{fontWeight:800,fontSize:'.95rem',color:'var(--navy)'}}>
                          ₹{b.grandTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}
                        </div>
                        <div style={{fontSize:'.68rem',color:'var(--gray400)'}}>{b.items?.length} items</div>
                      </td>
                      <td>
                        <select value={b.status} onChange={e=>updateStatus(b,e.target.value)}
                          style={{border:'none',padding:'3px 8px',borderRadius:99,fontWeight:700,fontSize:'.68rem',cursor:'pointer',
                            background: b.status==='Paid'?'#DCFCE7':b.status==='Sent'?'var(--blue-lt)':b.status==='Overdue'?'#FFE4E6':'var(--gray100)',
                            color: b.status==='Paid'?'#16A34A':b.status==='Sent'?'var(--blue)':b.status==='Overdue'?'#DC2626':'var(--gray600)'
                          }}>
                          {['Draft','Sent','Paid','Overdue'].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        {b.whatsappSent ? (
                          <span className="badge badge-green"><CheckCircle size={11}/>Sent</span>
                        ) : (
                          <span className="badge badge-gray"><Clock size={11}/>Pending</span>
                        )}
                      </td>
                      <td>
                        <div style={{display:'flex',gap:5}}>
                          <button className="btn btn-ghost btn-sm btn-icon" title="Preview bill" onClick={()=>setPreviewBill(b)}>
                            <Eye size={13}/>
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" title="Download Excel" onClick={()=>download(b)}>
                            <Download size={13}/>
                          </button>
                          <button className="btn btn-wa btn-sm btn-icon" title="Send via WhatsApp" onClick={()=>sendWhatsApp(b)}>
                            <MessageCircle size={13}/>
                          </button>
                          <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={()=>deleteBill(b)}>
                            <X size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Generate Modal ── */}
      {genModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setGenModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{genMode==='single'?'Generate Single Bill':'Generate Bills — All Clients'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={()=>setGenModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              {genMode==='all' && (
                <div style={{background:'#FEF3C7',border:'1.5px solid #FDE68A',borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:'.8rem',color:'#92400E',display:'flex',gap:8,alignItems:'flex-start'}}>
                  <AlertCircle size={16} style={{flexShrink:0,marginTop:1}}/>
                  <span>This will generate bills for <strong>all active clients</strong> who have inventory data in the selected period. Existing bills for the same period will not be duplicated.</span>
                </div>
              )}
              <div className="form-grid">
                {genMode==='single' && (
                  <div className="field">
                    <label>Client *</label>
                    <select {...GF('clientId')}>
                      <option value="">Select client…</option>
                      {clients.map(c=><option key={c._id} value={c._id}>{c.name} — {c.phone}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-grid g2">
                  <div className="field">
                    <label>Period Start *</label>
                    <input type="date" {...GF('periodStart')}/>
                  </div>
                  <div className="field">
                    <label>Period End *</label>
                    <input type="date" {...GF('periodEnd')}/>
                  </div>
                </div>
                <div className="field">
                  <label>Bill Date (printed on invoice)</label>
                  <input type="date" {...GF('billDate')}/>
                </div>
              </div>
              <div style={{marginTop:14,background:'var(--gray50)',border:'1px solid var(--gray200)',borderRadius:9,padding:'10px 14px',fontSize:'.78rem',color:'var(--gray600)',lineHeight:1.6}}>
                <strong>📋 What happens:</strong><br/>
                • Aggregates all daily inventory entries for the period<br/>
                • Generates an Excel file matching your Aavin bill template<br/>
                • Calculates totals & amount in words automatically<br/>
                • Excel is ready to download & send via WhatsApp
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setGenModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={generate} disabled={generating}>
                {generating
                  ? <><div className="spinner"/>Generating…</>
                  : <><FileText size={14}/>Generate {genMode==='all'?'All Bills':'Bill'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk WhatsApp Modal ── */}
      {bulkModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setBulkModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>Bulk WhatsApp Send ({bulkBills.filter(b=>b.selected).length} selected)</h3>
              <button className="btn btn-ghost btn-icon" onClick={()=>setBulkModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div style={{background:'#DCFCE7',border:'1px solid #86EFAC',borderRadius:9,padding:'10px 14px',marginBottom:14,fontSize:'.8rem',color:'#166534'}}>
                📱 WhatsApp will open for each client one by one. Each message includes the full invoice details. You click <strong>Send</strong> in WhatsApp for each.
              </div>
              <div style={{maxHeight:340,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      <th style={{padding:'8px 12px',textAlign:'left',background:'var(--gray50)',fontSize:'.7rem',color:'var(--gray600)',fontWeight:700,textTransform:'uppercase'}}>
                        <input type="checkbox" checked={bulkBills.every(b=>b.selected)}
                          onChange={e=>setBulkBills(prev=>prev.map(b=>({...b,selected:e.target.checked})))}/>
                      </th>
                      <th style={{padding:'8px 12px',textAlign:'left',background:'var(--gray50)',fontSize:'.7rem',color:'var(--gray600)',fontWeight:700,textTransform:'uppercase'}}>Client</th>
                      <th style={{padding:'8px 12px',textAlign:'left',background:'var(--gray50)',fontSize:'.7rem',color:'var(--gray600)',fontWeight:700,textTransform:'uppercase'}}>Phone</th>
                      <th style={{padding:'8px 12px',textAlign:'right',background:'var(--gray50)',fontSize:'.7rem',color:'var(--gray600)',fontWeight:700,textTransform:'uppercase'}}>Amount</th>
                      <th style={{padding:'8px 12px',textAlign:'center',background:'var(--gray50)',fontSize:'.7rem',color:'var(--gray600)',fontWeight:700,textTransform:'uppercase'}}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkBills.map((b,i)=>(
                      <tr key={b._id} style={{background: sendingIdx===i?'#DCFCE7':'transparent',borderBottom:'1px solid var(--gray100)'}}>
                        <td style={{padding:'8px 12px'}}>
                          <input type="checkbox" checked={b.selected}
                            onChange={e=>setBulkBills(prev=>prev.map((x,xi)=>xi===i?{...x,selected:e.target.checked}:x))}/>
                        </td>
                        <td style={{padding:'8px 12px',fontWeight:600,fontSize:'.83rem'}}>{b.client?.name}</td>
                        <td style={{padding:'8px 12px',fontSize:'.8rem',color:'var(--gray600)'}}>{b.client?.phone}</td>
                        <td style={{padding:'8px 12px',textAlign:'right',fontWeight:700,fontSize:'.85rem'}}>₹{b.grandTotal?.toLocaleString('en-IN')}</td>
                        <td style={{padding:'8px 12px',textAlign:'center'}}>
                          {sendingIdx===i
                            ? <span className="badge badge-amber">Sending…</span>
                            : <span className="badge badge-gray">#{b.invoiceNo}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setBulkModal(false)}>Cancel</button>
              <button className="btn btn-wa" onClick={runBulkSend} disabled={sendingIdx!==null}>
                {sendingIdx!==null
                  ? <><div className="spinner"/>Sending {sendingIdx+1}/{bulkBills.filter(b=>b.selected).length}…</>
                  : <><MessageCircle size={14}/>Send to {bulkBills.filter(b=>b.selected).length} Clients</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewBill && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setPreviewBill(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div>
                <h3>Invoice #{previewBill.invoiceNo} — {previewBill.client?.name}</h3>
                <div style={{fontSize:'.72rem',color:'var(--gray400)',marginTop:2}}>
                  Period: {new Date(previewBill.periodStart).toLocaleDateString('en-IN')} to {new Date(previewBill.periodEnd).toLocaleDateString('en-IN')}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setPreviewBill(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              {/* Exact template replica */}
              <div style={{border:'2.5px solid #000',fontFamily:'Arial,sans-serif',fontSize:12,maxWidth:600,margin:'0 auto'}}>
                {/* Logo + Title header */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr',alignItems:'center',padding:'10px 14px',borderBottom:'2px solid #000'}}>
                  <div style={{fontSize:22,fontWeight:900,color:'#00008B',textAlign:'center'}}>🐄<br/><span style={{fontSize:11}}>aavin</span></div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:20,fontWeight:900,color:'#CC0000',letterSpacing:1}}>PATTATHARI PALAGAM</div>
                    <div style={{fontSize:13,fontWeight:700,color:'#1F3864'}}>AAVIN PALAGAM</div>
                  </div>
                  <div style={{textAlign:'center',fontSize:22,fontWeight:900,color:'#00008B'}}>🐄<br/><span style={{fontSize:11}}>aavin</span></div>
                </div>

                {/* INVOICE / CASH / CHEQUE BILL */}
                <div style={{textAlign:'center',padding:'5px',borderBottom:'1px solid #000',fontWeight:700,fontSize:11,letterSpacing:1}}>
                  INVOICE / CASH / CHEQUE BILL
                </div>

                {/* Client & Invoice details */}
                <div style={{display:'grid',gridTemplateColumns:'55% 45%',borderBottom:'1px solid #000'}}>
                  <div style={{padding:'8px 10px',borderRight:'1px solid #000',fontSize:11}}>
                    <div style={{fontWeight:700}}>TO ; {new Date(previewBill.periodStart).toLocaleString('en-IN',{month:'long'}).toLowerCase()}</div>
                    <div style={{fontWeight:700,marginBottom:4}}>
                      {new Date(previewBill.periodStart).toLocaleDateString('en-IN')} TO {new Date(previewBill.periodEnd).toLocaleDateString('en-IN')}
                    </div>
                    <div style={{fontWeight:700}}>M.NO ; {previewBill.client?.mobileNo||previewBill.client?.phone}</div>
                    <div style={{color:'#333',marginTop:3}}>{previewBill.client?.name}</div>
                    <div style={{color:'#555',fontSize:10}}>{previewBill.client?.address}</div>
                  </div>
                  <div style={{padding:'6px 10px',fontSize:10}}>
                    {[
                      ['Invoice No.', previewBill.invoiceNo||previewBill.billId],
                      ['DATE :', new Date(previewBill.billDate).toLocaleDateString('en-IN')],
                      ['OWNER PARTY ID', previewBill.client?.ownerPartyId||'F2670'],
                      ['SHOP No', previewBill.client?.shopNo||'SR 67'],
                    ].map(([k,v])=>(
                      <div key={k} style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderBottom:'1px solid #eee',padding:'3px 0'}}>
                        <span style={{fontWeight:700}}>{k}</span>
                        <span style={{textAlign:'right',fontWeight:700}}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Items table */}
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr style={{background:'#1F3864'}}>
                      {['S.No.','Particulars','Qty','Rate','Amount'].map((h,i)=>(
                        <th key={h} style={{padding:'7px 8px',color:'#fff',fontWeight:700,textAlign: i<2?'left':'center',borderRight:'1px solid rgba(255,255,255,.2)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewBill.items?.map((item,i)=>(
                      <tr key={i} style={{borderBottom:'1px solid #eee',background:i%2===0?'#fff':'#fafafa'}}>
                        <td style={{padding:'5px 8px',textAlign:'center'}}>{i+1}</td>
                        <td style={{padding:'5px 8px',fontWeight:500}}>{item.particulars}</td>
                        <td style={{padding:'5px 8px',textAlign:'center',fontWeight:600}}>{item.quantity}</td>
                        <td style={{padding:'5px 8px',textAlign:'right'}}>{Number(item.rate).toFixed(2)}</td>
                        <td style={{padding:'5px 8px',textAlign:'right',fontWeight:600}}>
                          {Number(item.amount).toLocaleString('en-IN',{minimumFractionDigits:2})}
                        </td>
                      </tr>
                    ))}
                    {/* Empty rows */}
                    {Array.from({length: Math.max(0, 5-previewBill.items?.length)}).map((_,i)=>(
                      <tr key={'e'+i} style={{borderBottom:'1px solid #eee'}}><td colSpan={5} style={{height:22}}></td></tr>
                    ))}
                    {/* Subtotal */}
                    <tr style={{borderTop:'2px solid #000'}}>
                      <td colSpan={3} style={{padding:'5px 8px'}}/>
                      <td style={{padding:'5px 8px',fontWeight:700,fontStyle:'italic',textAlign:'center',background:'#f5f5f5'}}>SUBTOTAL</td>
                      <td style={{padding:'5px 8px',textAlign:'right',fontWeight:700,background:'#f5f5f5'}}>
                        {previewBill.subtotal?.toLocaleString('en-IN',{minimumFractionDigits:2})}
                      </td>
                    </tr>
                    {/* Grand Total */}
                    <tr>
                      <td colSpan={3} style={{padding:'6px 8px'}}/>
                      <td style={{padding:'6px 8px',textAlign:'center',fontWeight:700,fontSize:12}}>GRAND TOTAL</td>
                      <td style={{padding:'6px 8px',background:'#1F3864',color:'#fff',textAlign:'right',fontWeight:900,fontSize:13}}>
                        Rs.{previewBill.grandTotal?.toLocaleString('en-IN',{minimumFractionDigits:2})}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Rupees in words */}
                <div style={{padding:'6px 10px',borderTop:'1px solid #000',fontWeight:700,fontSize:10,borderBottom:'1px solid #000'}}>
                  Rupees (In Words) :&nbsp;&nbsp;{previewBill.grandTotalWords}
                </div>

                {/* Account details - yellow */}
                <div style={{background:'#FFFF00',padding:'6px 10px',borderBottom:'1px solid #000',display:'flex',gap:30,fontWeight:700,fontSize:10}}>
                  <span style={{color:'#CC0000'}}>A/C NUMBER &nbsp;<span style={{color:'#000'}}>{'●'.repeat(12)}</span></span>
                  <span style={{color:'#CC0000'}}>IFSC : &nbsp;<span style={{color:'#000'}}>{'●'.repeat(10)}</span></span>
                </div>

                {/* Notes + Signature */}
                <div style={{display:'grid',gridTemplateColumns:'62% 38%',fontSize:10}}>
                  <div style={{padding:'8px 10px',fontWeight:700,lineHeight:1.5}}>
                    Notes :- If you Pay Money To Bank Account or G-Pay or Phone pay ,paytm please Send the Screenshot of Payment for Verification
                  </div>
                  <div style={{padding:'8px 10px',borderLeft:'1px solid #000',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
                    <div>For</div>
                    <div style={{fontWeight:700,alignSelf:'flex-end'}}>Authorized Signature</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setPreviewBill(null)}>Close</button>
              <button className="btn btn-ghost" onClick={()=>download(previewBill)}>
                <Download size={14}/>Download Excel
              </button>
              <button className="btn btn-wa" onClick={()=>{ sendWhatsApp(previewBill); setPreviewBill(null); }}>
                <MessageCircle size={14}/>Send WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
