import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, CheckCircle, AlertTriangle, XCircle,
  FileSpreadsheet, FileText, Send, Eye, Download,
  ChevronRight, RefreshCw, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

// ── Step indicator ──────────────────────────────────────────────────────────
const STEPS = ['Upload Excel', 'Validate Data', 'Preview Bills', 'Send via WhatsApp'];

function StepBar({ current }) {
  return (
    <div style={{ display:'flex', alignItems:'center', marginBottom:22 }}>
      {STEPS.map((label, i) => {
        const done    = i + 1 < current;
        const active  = i + 1 === current;
        return (
          <React.Fragment key={label}>
            <div style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'7px 14px', borderRadius:9,
              background: done ? 'var(--green)' : active ? 'var(--blue)' : 'var(--gray100)',
              color: (done || active) ? '#fff' : 'var(--gray400)',
              fontSize:'.78rem', fontWeight:600, whiteSpace:'nowrap',
              transition:'all .25s'
            }}>
              {done ? <CheckCircle size={14}/> : <span style={{fontFamily:'monospace'}}>{i+1}</span>}
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex:1, height:2, background: done ? 'var(--green)' : 'var(--gray200)', margin:'0 4px', transition:'background .3s' }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Validation badge ────────────────────────────────────────────────────────
function ValBadge({ row }) {
  if (!row.valid)              return <span className="badge badge-red"><XCircle size={10}/>Error</span>;
  if (row.warnings?.length)    return <span className="badge badge-amber"><AlertTriangle size={10}/>Warning</span>;
  return                              <span className="badge badge-green"><CheckCircle size={10}/>Valid</span>;
}

// ── Bill mini-preview modal ─────────────────────────────────────────────────
function BillModal({ row, onClose }) {
  if (!row) return null;
  const fmt = n => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>Preview — Invoice #{row.invoiceNo} — {row.clientName}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={15}/></button>
        </div>
        <div className="modal-body">
          <div style={{border:'2px solid #000',fontFamily:'Arial,sans-serif',fontSize:11,maxWidth:540,margin:'0 auto'}}>
            {/* Header */}
            <div style={{display:'grid',gridTemplateColumns:'70px 1fr 70px',alignItems:'center',padding:'10px 12px',borderBottom:'2px solid #000'}}>
              <div style={{textAlign:'center',fontSize:20,fontWeight:900,color:'#00008B'}}>🐄<br/><span style={{fontSize:8}}>aavin</span></div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:900,color:'#CC0000'}}>PATTATHARI PALAGAM</div>
                <div style={{fontSize:11,fontWeight:700,color:'#1F3864'}}>AAVIN PALAGAM</div>
              </div>
              <div style={{textAlign:'center',fontSize:20,fontWeight:900,color:'#00008B'}}>🐄<br/><span style={{fontSize:8}}>aavin</span></div>
            </div>
            <div style={{textAlign:'center',padding:'5px',borderBottom:'1px solid #000',fontWeight:700,fontSize:10,letterSpacing:1}}>
              INVOICE / CASH / CHEQUE BILL
            </div>
            {/* Details */}
            <div style={{display:'grid',gridTemplateColumns:'55% 45%',borderBottom:'1px solid #000'}}>
              <div style={{padding:'8px 10px',borderRight:'1px solid #000',fontSize:10}}>
                <div style={{fontWeight:700}}>TO ; {row.periodStart ? new Date(row.periodStart).toLocaleString('en-IN',{month:'long'}).toLowerCase() : ''}</div>
                <div style={{fontWeight:700,marginBottom:4}}>
                  {row.periodStart ? new Date(row.periodStart).toLocaleDateString('en-IN') : ''} TO {row.periodEnd ? new Date(row.periodEnd).toLocaleDateString('en-IN') : ''}
                </div>
                <div style={{fontWeight:700}}>M.NO ; {row.phone}</div>
                <div style={{marginTop:3}}>{row.clientName}</div>
                <div style={{color:'#555',fontSize:9}}>{row.address}</div>
              </div>
              <div style={{padding:'6px 10px',fontSize:9}}>
                {[['Invoice No.',row.invoiceNo||'Auto'],['DATE :',row.billDate?new Date(row.billDate).toLocaleDateString('en-IN'):''],['OWNER PARTY ID',row.ownerPartyId||'—'],['SHOP No',row.shopNo||'—']].map(([k,v])=>(
                  <div key={k} style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderBottom:'1px solid #eee',padding:'3px 0'}}>
                    <span style={{fontWeight:700}}>{k}</span><span style={{textAlign:'right',fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Table */}
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
              <thead>
                <tr style={{background:'#1F3864'}}>
                  {['S.No.','Particulars','Qty','Rate','Amount'].map((h,i)=>(
                    <th key={h} style={{padding:'6px 8px',color:'#fff',fontWeight:700,textAlign:i<2?'left':'center'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row.items?.map((item,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid #eee',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'4px 8px',textAlign:'center'}}>{i+1}</td>
                    <td style={{padding:'4px 8px'}}>{item.particulars}</td>
                    <td style={{padding:'4px 8px',textAlign:'center'}}>{item.quantity}</td>
                    <td style={{padding:'4px 8px',textAlign:'right'}}>{fmt(item.rate)}</td>
                    <td style={{padding:'4px 8px',textAlign:'right',fontWeight:600}}>{fmt(item.amount)}</td>
                  </tr>
                ))}
                {Array.from({length:Math.max(0,5-row.items?.length)}).map((_,i)=>(
                  <tr key={'e'+i}><td colSpan={5} style={{height:18}}></td></tr>
                ))}
                <tr style={{borderTop:'2px solid #000',background:'#f5f5f5'}}>
                  <td colSpan={3} style={{padding:'4px 8px'}}/>
                  <td style={{padding:'4px 8px',fontWeight:700,fontStyle:'italic',textAlign:'center'}}>SUBTOTAL</td>
                  <td style={{padding:'4px 8px',fontWeight:700,textAlign:'right'}}>{fmt(row.subtotal)}</td>
                </tr>
                <tr style={{background:'#1F3864'}}>
                  <td colSpan={3} style={{padding:'5px 8px'}}/>
                  <td style={{padding:'5px 8px',color:'#fff',fontWeight:700,textAlign:'center'}}>GRAND TOTAL</td>
                  <td style={{padding:'5px 8px',color:'#fff',fontWeight:900,textAlign:'right',fontSize:12}}>Rs.{fmt(row.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{padding:'6px 10px',borderTop:'1px solid #000',fontWeight:700,fontSize:9,borderBottom:'1px solid #000'}}>
              Rupees (In Words) : {row.grandTotalWords || ''}
            </div>
            <div style={{background:'#FFFF00',padding:'5px 10px',borderBottom:'1px solid #000',display:'flex',gap:24,fontWeight:700,fontSize:9,color:'#CC0000'}}>
              <span>A/C NUMBER &nbsp;<span style={{color:'#000'}}>{'●'.repeat(12)}</span></span>
              <span>IFSC : &nbsp;<span style={{color:'#000'}}>{'●'.repeat(10)}</span></span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'62% 38%',fontSize:9}}>
              <div style={{padding:'7px 10px',fontWeight:700,lineHeight:1.5}}>Notes :- If you Pay Money To Bank Account or G-Pay or Phone pay ,paytm please Send the Screenshot of Payment for Verification</div>
              <div style={{padding:'7px 10px',borderLeft:'1px solid #000',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
                <span>For</span><span style={{fontWeight:700}}>Authorized Signature</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function BulkSend() {
  const [step,       setStep]       = useState(1);
  const [dragging,   setDragging]   = useState(false);
  const [parsed,     setParsed]     = useState(null);   // { rows, totalRows, validCount, … }
  const [generated,  setGenerated]  = useState(null);   // array of generated bill info
  const [sendResults,setSendResults]= useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [sendProgress, setSendProgress] = useState({});  // billId → 'sending'|'sent'|'failed'
  const [selected,   setSelected]   = useState({});      // rowIndex → bool
  const fileRef = useRef();

  const uploadFile = useCallback(async (file) => {
    if (!file) return;
    if (!['.xlsx','.xls'].some(ext => file.name.toLowerCase().endsWith(ext)))
      return toast.error('Only .xlsx or .xls files supported');
    setLoading(true);
    const fd = new FormData();
    fd.append('excel', file);
    try {
      const res = await api.post('/bulk/parse', fd, { headers:{'Content-Type':'multipart/form-data'} });
      const data = res.data.data;
      setParsed(data);
      // Pre-select all valid rows
      const sel = {};
      data.rows.forEach(r => { if (r.valid) sel[r.rowIndex] = true; });
      setSelected(sel);
      setStep(2);
      toast.success(`Parsed ${data.totalRows} rows — ${data.validCount} valid`);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    uploadFile(e.dataTransfer.files[0]);
  }, [uploadFile]);

  const generatePDFs = async () => {
    const rows = parsed.rows.filter(r => r.valid && selected[r.rowIndex]);
    if (!rows.length) return toast.error('No valid rows selected');
    setLoading(true);
    try {
      const res = await api.post('/bulk/generate-pdfs', { rows });
      setGenerated(res.data.data);
      setStep(3);
      toast.success(`${res.data.generated} bills generated!`);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const sendAll = async () => {
    const toSend = generated.filter(b => b.status === 'generated');
    if (!toSend.length) return toast.error('No bills to send');
    setLoading(true);
    // Reset progress
    const prog = {};
    toSend.forEach(b => prog[b.rowIndex] = 'queued');
    setSendProgress({...prog});
    try {
      // Send one by one so UI updates
      const results = [];
      for (const bill of toSend) {
        setSendProgress(p => ({...p, [bill.rowIndex]:'sending'}));
        try {
          await api.post('/bulk/send', {
            phone:      bill.phone,
            pdfPath:    bill.pdfPath,
            clientName: bill.clientName,
            invoiceNo:  bill.invoiceNo,
            grandTotal: bill.grandTotal,
            dbBillId:   bill.dbBillId,
          });
          setSendProgress(p => ({...p, [bill.rowIndex]:'sent'}));
          results.push({ ...bill, sendStatus:'sent' });
        } catch (e) {
          setSendProgress(p => ({...p, [bill.rowIndex]:'failed'}));
          results.push({ ...bill, sendStatus:'failed', sendError: e.message });
        }
        await new Promise(r => setTimeout(r, 400));
      }
      setSendResults(results);
      setStep(4);
      const sentCount = results.filter(r=>r.sendStatus==='sent').length;
      toast.success(`✅ ${sentCount} bills sent via WhatsApp!`);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const downloadSample = () => {
    window.open('/api/bulk/sample-template', '_blank');
  };

  const downloadPDF = (filename) => {
    window.open(`/api/bulk/download/${filename}`, '_blank');
  };

  const toggleAll = (check) => {
    const sel = {};
    parsed?.rows.filter(r=>r.valid).forEach(r => { sel[r.rowIndex] = check; });
    setSelected(sel);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Bulk Excel → WhatsApp Bills</div>
          <div className="page-sub">Upload Excel → Auto-generate Aavin bills → Send PDFs to all clients via WhatsApp</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={downloadSample}>
          <Download size={13}/>Download Sample Template
        </button>
      </div>

      <StepBar current={step}/>

      {/* ── STEP 1: Upload ── */}
      {step === 1 && (
        <div className="card">
          <div className="card-body">
            <div
              style={{
                border:`2px dashed ${dragging?'var(--blue)':'var(--gray200)'}`,
                borderRadius:12, padding:'48px 24px', textAlign:'center', cursor:'pointer',
                background: dragging ? 'var(--blue-lt)' : 'var(--gray50)',
                transition:'all .2s'
              }}
              onClick={() => fileRef.current.click()}
              onDragOver={e=>{e.preventDefault();setDragging(true)}}
              onDragLeave={()=>setDragging(false)}
              onDrop={onDrop}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>uploadFile(e.target.files[0])}/>
              <FileSpreadsheet size={48} style={{color:'var(--gray400)',margin:'0 auto 12px'}}/>
              {loading ? (
                <><div className="spinner" style={{margin:'0 auto 10px'}}/><div style={{fontWeight:600}}>Parsing Excel…</div></>
              ) : (
                <>
                  <div style={{fontWeight:700,fontSize:'1rem',color:'var(--navy)'}}>Drop your Excel file here</div>
                  <div style={{color:'var(--gray400)',fontSize:'.82rem',marginTop:5}}>or click to browse — .xlsx / .xls supported</div>
                  <button className="btn btn-primary" style={{marginTop:16}} onClick={e=>{e.stopPropagation();fileRef.current.click()}}>
                    <Upload size={14}/>Choose Excel File
                  </button>
                </>
              )}
            </div>
            <div style={{marginTop:16,background:'var(--gray50)',borderRadius:10,padding:'12px 16px',fontSize:'.8rem',color:'var(--gray600)',lineHeight:1.8}}>
              <strong style={{color:'var(--navy)'}}>Required columns in your Excel (one row per client):</strong><br/>
              <code style={{fontFamily:'monospace',fontSize:'.75rem'}}>
                Client Name | Phone | Address | Period Start | Period End | Invoice No | Bill Date | Shop No | Owner Party ID | Particulars1 | Qty1 | Rate1 | Amount1 | Particulars2 | Qty2 | Rate2 | Amount2
              </code>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Validate ── */}
      {step === 2 && parsed && (
        <>
          {/* Summary stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
            {[
              { label:'Total Rows',  value:parsed.totalRows,    color:'var(--navy)',   bg:'var(--blue-lt)' },
              { label:'Valid',       value:parsed.validCount,   color:'var(--green)',  bg:'#DCFCE7' },
              { label:'Warnings',   value:parsed.warningCount, color:'#D97706',       bg:'#FEF3C7' },
              { label:'Errors',     value:parsed.errorCount,   color:'#DC2626',       bg:'#FFE4E6' },
            ].map(s=>(
              <div key={s.label} className="stat-card" style={{background:s.bg,border:'none',padding:'14px 16px'}}>
                <div className="label">{s.label}</div>
                <div className="value" style={{color:s.color,fontSize:'1.6rem'}}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Parsed & Validated Excel Data</span>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>toggleAll(true)}>Select All</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>toggleAll(false)}>Deselect All</button>
                <span style={{fontSize:'.75rem',color:'var(--gray400)'}}>{selectedCount} selected</span>
              </div>
            </div>
            <div className="card-body">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{width:36}}>
                        <input type="checkbox" checked={selectedCount===parsed.validCount&&selectedCount>0}
                          onChange={e=>toggleAll(e.target.checked)}/>
                      </th>
                      <th>Row</th><th>Client Name</th><th>Phone</th>
                      <th>Period</th><th>Inv No</th><th>Items</th>
                      <th>Grand Total</th><th>Status</th><th>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map(row=>(
                      <tr key={row.rowIndex} style={{
                        background: !row.valid ? '#FFF5F5' : row.warnings?.length ? '#FFFBEB' : 'transparent'
                      }}>
                        <td>
                          {row.valid && (
                            <input type="checkbox" checked={!!selected[row.rowIndex]}
                              onChange={e=>setSelected(p=>({...p,[row.rowIndex]:e.target.checked}))}/>
                          )}
                        </td>
                        <td><span style={{fontFamily:'monospace',fontSize:'.75rem',color:'var(--gray400)'}}>{row.rowIndex}</span></td>
                        <td><strong>{row.clientName}</strong></td>
                        <td style={{fontFamily:'monospace',fontSize:'.78rem'}}>{row.phone}</td>
                        <td style={{fontSize:'.75rem'}}>
                          {row.periodStart ? new Date(row.periodStart).toLocaleDateString('en-IN') : '—'} →<br/>
                          {row.periodEnd   ? new Date(row.periodEnd).toLocaleDateString('en-IN')   : '—'}
                        </td>
                        <td>{row.invoiceNo||<span style={{color:'var(--gray400)'}}>Auto</span>}</td>
                        <td style={{fontSize:'.75rem'}}>
                          {row.items?.map((it,i)=><div key={i}>{it.particulars} × {it.quantity}</div>)}
                        </td>
                        <td><strong style={{color:'var(--navy)'}}>₹{Number(row.grandTotal||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></td>
                        <td>
                          <ValBadge row={row}/>
                          {row.errors?.map((e,i)=><div key={i} style={{fontSize:'.68rem',color:'#DC2626',marginTop:2}}>{e}</div>)}
                          {row.warnings?.map((w,i)=><div key={i} style={{fontSize:'.68rem',color:'#D97706',marginTop:2}}>{w}</div>)}
                        </td>
                        <td>
                          {row.valid && (
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setPreviewRow(row)} title="Preview Bill">
                              <Eye size={13}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14,paddingTop:12,borderTop:'1px solid var(--gray200)'}}>
                <button className="btn btn-ghost" onClick={()=>setStep(1)}><Upload size={13}/>Re-upload</button>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <span style={{fontSize:'.8rem',color:'var(--gray400)'}}>
                    Generating PDFs for <strong>{selectedCount}</strong> selected clients
                  </span>
                  <button className="btn btn-primary" onClick={generatePDFs} disabled={loading||!selectedCount}>
                    {loading ? <><div className="spinner"/>Generating…</> : <><FileText size={14}/>Generate {selectedCount} Bills<ChevronRight size={13}/></>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 3: Preview & Send ── */}
      {step === 3 && generated && (
        <>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:14}}>
            <span className="badge badge-green"><CheckCircle size={11}/>{generated.filter(b=>b.status==='generated').length} bills ready</span>
            <span className="badge badge-gray"><FileText size={11}/>PDFs generated</span>
            {generated.filter(b=>b.status==='failed').length > 0 &&
              <span className="badge badge-red"><XCircle size={11}/>{generated.filter(b=>b.status==='failed').length} failed</span>
            }
            <div style={{marginLeft:'auto',display:'flex',gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setStep(2)}><RefreshCw size={12}/>Back</button>
              <button className="btn btn-success" onClick={sendAll} disabled={loading}>
                {loading ? <><div className="spinner"/>Sending…</> : <><Send size={14}/>Send All via WhatsApp</>}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Generated Bills — Ready to Send</span></div>
            <div className="card-body">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Inv No</th><th>Client</th><th>Phone</th><th>Grand Total</th><th>PDF</th><th>Send Status</th></tr>
                  </thead>
                  <tbody>
                    {generated.map(b => {
                      const ps = sendProgress[b.rowIndex];
                      return (
                        <tr key={b.rowIndex} style={{
                          background: ps==='sent'?'#F0FDF4':ps==='failed'?'#FFF5F5':ps==='sending'?'#FEF9C3':'transparent'
                        }}>
                          <td><span style={{fontFamily:'monospace',fontWeight:700,background:'var(--navy)',color:'#fff',padding:'2px 7px',borderRadius:5,fontSize:'.72rem'}}>#{b.invoiceNo}</span></td>
                          <td><strong>{b.clientName}</strong></td>
                          <td style={{fontFamily:'monospace',fontSize:'.8rem'}}>{b.phone}</td>
                          <td><strong style={{color:'var(--navy)'}}>₹{Number(b.grandTotal||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></td>
                          <td>
                            {b.status==='generated' ? (
                              <div style={{display:'flex',gap:5}}>
                                <button className="btn btn-ghost btn-sm btn-icon" title="Preview" onClick={()=>setPreviewRow({...parsed?.rows.find(r=>r.rowIndex===b.rowIndex), invoiceNo:b.invoiceNo})}>
                                  <Eye size={13}/>
                                </button>
                                <button className="btn btn-ghost btn-sm btn-icon" title="Download PDF" onClick={()=>downloadPDF(b.filename)}>
                                  <Download size={13}/>
                                </button>
                              </div>
                            ) : (
                              <span className="badge badge-red"><XCircle size={10}/>Failed: {b.error}</span>
                            )}
                          </td>
                          <td>
                            {!ps && <span className="badge badge-gray">Queued</span>}
                            {ps==='sending' && <span className="badge badge-amber"><div className="spinner" style={{width:10,height:10,borderWidth:2}}/>Sending…</span>}
                            {ps==='sent'    && <span className="badge badge-green"><CheckCircle size={10}/>Sent ✓</span>}
                            {ps==='failed'  && <span className="badge badge-red"><XCircle size={10}/>Failed</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 4 && sendResults && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center',padding:'40px 20px'}}>
            <CheckCircle size={56} style={{color:'var(--green)',margin:'0 auto 16px'}}/>
            <div style={{fontSize:'1.3rem',fontWeight:800,color:'var(--navy)'}}>All Bills Sent!</div>
            <div style={{color:'var(--gray400)',fontSize:'.85rem',marginTop:6,marginBottom:24}}>
              {sendResults.filter(r=>r.sendStatus==='sent').length} bills delivered via WhatsApp PDF
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,maxWidth:400,margin:'0 auto 24px'}}>
              <div style={{padding:'14px',background:'#DCFCE7',borderRadius:10}}>
                <div style={{fontSize:'1.5rem',fontWeight:800,color:'var(--green)'}}>{sendResults.filter(r=>r.sendStatus==='sent').length}</div>
                <div style={{fontSize:'.75rem',color:'var(--green)'}}>Sent</div>
              </div>
              <div style={{padding:'14px',background:'#FFE4E6',borderRadius:10}}>
                <div style={{fontSize:'1.5rem',fontWeight:800,color:'#DC2626'}}>{sendResults.filter(r=>r.sendStatus==='failed').length}</div>
                <div style={{fontSize:'.75rem',color:'#DC2626'}}>Failed</div>
              </div>
              <div style={{padding:'14px',background:'var(--blue-lt)',borderRadius:10}}>
                <div style={{fontSize:'1.5rem',fontWeight:800,color:'var(--blue)'}}>₹{sendResults.filter(r=>r.sendStatus==='sent').reduce((s,b)=>s+Number(b.grandTotal||0),0).toLocaleString('en-IN')}</div>
                <div style={{fontSize:'.75rem',color:'var(--blue)'}}>Total Billed</div>
              </div>
            </div>
            {sendResults.filter(r=>r.sendStatus==='failed').length > 0 && (
              <div style={{marginBottom:20}}>
                <div style={{fontWeight:600,color:'#DC2626',marginBottom:8,fontSize:'.85rem'}}>Failed sends:</div>
                {sendResults.filter(r=>r.sendStatus==='failed').map((r,i)=>(
                  <div key={i} style={{fontSize:'.8rem',color:'#DC2626',marginBottom:4}}>{r.clientName} ({r.phone}): {r.sendError}</div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={()=>{ setStep(1); setParsed(null); setGenerated(null); setSendResults(null); setSendProgress({}); }}>
              <Upload size={14}/>Upload New Excel
            </button>
          </div>
        </div>
      )}

      {/* Bill preview modal */}
      {previewRow && <BillModal row={previewRow} onClose={()=>setPreviewRow(null)}/>}
    </div>
  );
}
