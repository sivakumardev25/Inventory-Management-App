import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X, Phone, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const EMPTY = { name:'', phone:'', mobileNo:'', address:'', area:'', shopNo:'', ownerPartyId:'', notes:'' };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/clients', { params: { search, active: true } });
      setClients(res.data.data);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name:c.name,phone:c.phone,mobileNo:c.mobileNo||'',address:c.address||'',area:c.area||'',shopNo:c.shopNo||'',ownerPartyId:c.ownerPartyId||'',notes:c.notes||'' }); setModal(true); };

  const save = async () => {
    if (!form.name || !form.phone) return toast.error('Name and phone are required');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/clients/${editing._id}`, form);
        toast.success('Client updated');
      } else {
        await api.post('/clients', form);
        toast.success('Client added');
      }
      setModal(false); load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Deactivate ${c.name}?`)) return;
    try {
      await api.delete(`/clients/${c._id}`);
      toast.success('Client deactivated');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const F = (k) => ({ value: form[k], onChange: e => setForm(p=>({...p,[k]:e.target.value})) });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Clients</div>
          <div className="page-sub">{clients.length} active clients</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15}/>Add Client</button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="filter-bar">
            <div className="search-box">
              <Search className="si" size={15}/>
              <input placeholder="Search by name, phone, ID…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>

          {loading ? (
            <div className="loading-page"><div className="spinner"/></div>
          ) : clients.length === 0 ? (
            <div className="empty"><User size={48}/><p>No clients found</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client ID</th><th>Name</th><th>Phone / M.NO</th>
                    <th>Address</th><th>Shop No</th><th>Owner Party ID</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c=>(
                    <tr key={c._id}>
                      <td><span className="badge badge-blue font-mono">{c.clientId}</span></td>
                      <td><strong>{c.name}</strong></td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:5}}><Phone size={12} style={{color:'var(--gray400)'}}/>{c.phone}</div>
                        {c.mobileNo && <div className="text-sm text-muted">M.NO: {c.mobileNo}</div>}
                      </td>
                      <td>{[c.address,c.area].filter(Boolean).join(', ')||'—'}</td>
                      <td>{c.shopNo||'—'}</td>
                      <td>{c.ownerPartyId||'—'}</td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(c)} title="Edit"><Edit2 size={13}/></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={()=>remove(c)} title="Deactivate"><Trash2 size={13}/></button>
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
              <h3>{editing?'Edit Client':'Add New Client'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={()=>setModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="form-grid g2">
                <div className="field"><label>Full Name *</label><input placeholder="e.g. Ravi Kumar" {...F('name')}/></div>
                <div className="field"><label>Phone *</label><input placeholder="+91 9XXXXXXXXX" {...F('phone')}/></div>
                <div className="field"><label>M.NO (on bill)</label><input placeholder="Mobile No shown on bill" {...F('mobileNo')}/></div>
                <div className="field"><label>Shop No</label><input placeholder="e.g. SR 67" {...F('shopNo')}/></div>
                <div className="field"><label>Owner Party ID</label><input placeholder="e.g. F2670" {...F('ownerPartyId')}/></div>
                <div className="field"><label>Area</label><input placeholder="Area / Route" {...F('area')}/></div>
                <div className="field" style={{gridColumn:'1/-1'}}><label>Address</label><input placeholder="Door No, Street" {...F('address')}/></div>
                <div className="field" style={{gridColumn:'1/-1'}}><label>Notes</label><textarea placeholder="Any notes…" {...F('notes')}/></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving?<><div className="spinner"/>Saving…</>:<>{editing?'Update':'Add'} Client</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
