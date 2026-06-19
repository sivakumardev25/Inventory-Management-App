import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const CATS  = ['Milk','Curd','Butter','Ghee','Paneer','Other'];
const EMPTY = { name:'', category:'Milk', unit:'Litre', pricePerUnit:'', active:true };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/products', { params:{ active:true } });
      setProducts(res.data.data);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit = p  => { setEditing(p); setForm({ name:p.name, category:p.category, unit:p.unit, pricePerUnit:p.pricePerUnit, active:p.active }); setModal(true); };

  const save = async () => {
    if (!form.name || !form.pricePerUnit) return toast.error('Name and price are required');
    setSaving(true);
    try {
      if (editing) { await api.put(`/products/${editing._id}`, form); toast.success('Product updated'); }
      else          { await api.post('/products', form); toast.success('Product added'); }
      setModal(false); load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async p => {
    if (!window.confirm(`Deactivate "${p.name}"?`)) return;
    try { await api.delete(`/products/${p._id}`); toast.success('Deactivated'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const F = k => ({ value: form[k], onChange: e => setForm(p=>({...p,[k]:e.target.value})) });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Products</div>
          <div className="page-sub">{products.length} active products</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/>Add Product</button>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? <div className="loading-page"><div className="spinner"/></div>
          : products.length===0 ? <div className="empty"><Package size={48}/><p>No products yet</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Code</th><th>Name / Particulars</th><th>Category</th><th>Unit</th><th>Price / Unit</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {products.map(p=>(
                    <tr key={p._id}>
                      <td><span className="badge badge-gray font-mono">{p.productCode}</span></td>
                      <td><strong>{p.name}</strong></td>
                      <td><span className="badge badge-blue">{p.category}</span></td>
                      <td>{p.unit}</td>
                      <td><strong style={{color:'var(--navy)'}}>₹{p.pricePerUnit.toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(p)}><Edit2 size={13}/></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={()=>remove(p)}><Trash2 size={13}/></button>
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
          <div className="modal">
            <div className="modal-header">
              <h3>{editing?'Edit Product':'Add Product'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="form-grid g2">
                <div className="field" style={{gridColumn:'1/-1'}}>
                  <label>Product Name / Particulars *</label>
                  <input placeholder="e.g. Green, Blue, Token Milk…" {...F('name')}/>
                </div>
                <div className="field">
                  <label>Category</label>
                  <select {...F('category')}>
                    {CATS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Unit</label>
                  <select {...F('unit')}>
                    {['Litre','500ml','200ml','Kg','Piece','Packet'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field" style={{gridColumn:'1/-1'}}>
                  <label>Price per Unit (₹) *</label>
                  <input type="number" placeholder="24.00" min="0" step="0.5" {...F('pricePerUnit')}/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving?<><div className="spinner"/>Saving…</>:<>{editing?'Update':'Add'} Product</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
