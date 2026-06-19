import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X, ClipboardList, PlusCircle, MinusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { format } from 'date-fns';

export default function Inventory() {
  const [entries, setEntries]   = useState([]);
  const [clients, setClients]   = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterDate,   setFilterDate]   = useState('');
  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState({ client:'', date: new Date().toISOString().slice(0,10), lines:[], notes:'' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filterClient) params.client = filterClient;
      if (filterDate)   { params.startDate = filterDate; params.endDate = filterDate; }
      const res = await api.get('/inventory', { params: { ...params, limit:100 } });
      setEntries(res.data.data);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filterClient, filterDate]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{
    api.get('/clients',{params:{active:true}}).then(r=>setClients(r.data.data)).catch(()=>{});
    api.get('/products',{params:{active:true}}).then(r=>setProducts(r.data.data)).catch(()=>{});
  },[]);

  const openAdd = () => {
    setEditing(null);
    setForm({ client:'', date: new Date().toISOString().slice(0,10), lines:[{ product:'', quantity:'', priceAtTime:'' }], notes:'' });
    setModal(true);
  };

  const openEdit = e => {
    setEditing(e);
    setForm({
      client: e.client._id,
      date: new Date(e.date).toISOString().slice(0,10),
      lines: e.lines.map(l=>({ product: l.product._id, quantity: l.quantity, priceAtTime: l.priceAtTime })),
      notes: e.notes||''
    });
    setModal(true);
  };

  const addLine    = () => setForm(p=>({...p, lines:[...p.lines,{product:'',quantity:'',priceAtTime:''}]}));
  const removeLine = i  => setForm(p=>({...p, lines: p.lines.filter((_,idx)=>idx!==i)}));

  const updateLine = (i, key, val) => setForm(p=>{
    const lines = [...p.lines];
    lines[i] = { ...lines[i], [key]: val };
    if (key==='product') {
      const prod = products.find(pr=>pr._id===val);
      if (prod) lines[i].priceAtTime = prod.pricePerUnit;
    }
    return { ...p, lines };
  });

  const lineTotal = l => {
    const q = parseFloat(l.quantity)||0, r = parseFloat(l.priceAtTime)||0;
    return q*r;
  };
  const grandTotal = form.lines.reduce((s,l)=>s+lineTotal(l),0);

  const save = async () => {
    if (!form.client) return toast.error('Select a client');
    if (!form.lines.length || !form.lines[0].product) return toast.error('Add at least one product');
    setSaving(true);
    try {
      const payload = { client: form.client, date: form.date, notes: form.notes,
        lines: form.lines.filter(l=>l.product&&l.quantity).map(l=>({ product:l.product, quantity:parseFloat(l.quantity), priceAtTime:parseFloat(l.priceAtTime)||undefined }))
      };
      if (editing) { await api.put(`/inventory/${editing._id}`, payload); toast.success('Entry updated'); }
      else          { await api.post('/inventory', payload); toast.success('Entry added'); }
      setModal(false); load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async e => {
    if (!window.confirm('Delete this entry?')) return;
    try { await api.delete(`/inventory/${e._id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const filtered = entries.filter(e =>
    !search || e.client?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Daily Inventory</div>
          <div className="page-sub">Track daily milk delivery per client</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/>Add Entry</button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="filter-bar">
            <div className="search-box">
              <Search className="si" size={15}/>
              <input placeholder="Search client…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="field" style={{minWidth:180,margin:0}}>
              <select value={filterClient} onChange={e=>setFilterClient(e.target.value)}>
                <option value="">All Clients</option>
                {clients.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field" style={{margin:0}}>
              <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{padding:'9px 12px',border:'1.5px solid var(--gray200)',borderRadius:9}}/>
            </div>
            {filterDate&&<button className="btn btn-ghost btn-sm" onClick={()=>setFilterDate('')}><X size={13}/>Clear</button>}
          </div>

          {loading ? <div className="loading-page"><div className="spinner"/></div>
          : filtered.length===0 ? <div className="empty"><ClipboardList size={48}/><p>No entries found</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Client</th><th>Items</th><th>Total</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map(e=>(
                    <tr key={e._id}>
                      <td><span className="badge badge-blue">{format(new Date(e.date),'dd/MM/yyyy')}</span></td>
                      <td>
                        <div style={{fontWeight:600}}>{e.client?.name}</div>
                        <div className="text-sm text-muted">{e.client?.phone}</div>
                      </td>
                      <td>
                        {e.lines.map((l,i)=>(
                          <div key={i} className="text-sm" style={{marginBottom:2}}>
                            <strong>{l.product?.name}</strong> — {l.quantity} × ₹{l.priceAtTime} = <strong>₹{l.subtotal?.toFixed(2)}</strong>
                          </div>
                        ))}
                      </td>
                      <td><strong style={{color:'var(--navy)',fontSize:'.9rem'}}>₹{e.totalAmount?.toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(e)}><Edit2 size={13}/></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={()=>remove(e)}><Trash2 size={13}/></button>
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

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>{editing?'Edit Inventory Entry':'Add Daily Inventory Entry'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="form-grid g2 mb-16">
                <div className="field">
                  <label>Client *</label>
                  <select value={form.client} onChange={e=>setForm(p=>({...p,client:e.target.value}))}>
                    <option value="">Select client…</option>
                    {clients.map(c=><option key={c._id} value={c._id}>{c.name} ({c.phone})</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Date *</label>
                  <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{fontSize:'.78rem',fontWeight:700,color:'var(--gray600)'}}>PRODUCTS / PARTICULARS</span>
                  <button className="btn btn-ghost btn-sm" onClick={addLine}><PlusCircle size={13}/>Add Row</button>
                </div>
                {form.lines.map((line,i)=>(
                  <div key={i} className="item-row">
                    <div className="field" style={{margin:0}}>
                      <select value={line.product} onChange={e=>updateLine(i,'product',e.target.value)}>
                        <option value="">Select product…</option>
                        {products.map(p=><option key={p._id} value={p._id}>{p.name} (₹{p.pricePerUnit}/{p.unit})</option>)}
                      </select>
                    </div>
                    <div className="field" style={{margin:0}}>
                      <input type="number" placeholder="Qty" min="0" step="0.5"
                        value={line.quantity} onChange={e=>updateLine(i,'quantity',e.target.value)}/>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:2}}>
                      <span style={{fontSize:'.68rem',color:'var(--gray400)'}}>Rate: ₹{line.priceAtTime||'—'}</span>
                      <span style={{fontSize:'.8rem',fontWeight:700,color:'var(--navy)'}}>
                        {line.quantity&&line.priceAtTime ? `₹${lineTotal(line).toFixed(2)}` : '—'}
                      </span>
                    </div>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={()=>removeLine(i)} disabled={form.lines.length===1}>
                      <MinusCircle size={13}/>
                    </button>
                  </div>
                ))}
                <div style={{textAlign:'right',marginTop:10,fontWeight:800,fontSize:'1rem',color:'var(--navy)'}}>
                  Total: ₹{grandTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}
                </div>
              </div>

              <div className="field">
                <label>Notes</label>
                <textarea placeholder="Any notes…" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving?<><div className="spinner"/>Saving…</>:<>{editing?'Update':'Add'} Entry</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
