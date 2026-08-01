import React, { useEffect, useState } from 'react';
import {
  Users,
  // Package,
  ClipboardList, FileText, TrendingUp, Clock, IndianRupee
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../utils/api';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [chart, setChart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/dashboard/stats', { params: { month: filterMonth } }),
      api.get('/dashboard/revenue-chart')
    ])
      .then(([s, c]) => {
        setStats(s.data.data);
        setChart(c.data.data.map(d => ({
          name: `${MONTHS[d._id.month]} ${d._id.year}`,
          revenue: d.total, bills: d.count
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterMonth]);

  if (loading) return <div className="loading-page"><div className="spinner"/><span>Loading dashboard…</span></div>;

  const cards = [
    { label:'Active Clients',   value: stats?.activeClients  ?? 0, icon: Users,         cls:'si-blue' },
    // { label:'Products',         value: stats?.totalProducts  ?? 0, icon: Package,        cls:'si-teal' },
    { label:'Inventory Entries',value: stats?.totalInventoryEntries ?? 0, icon: ClipboardList, cls:'si-amber' },
    { label: 'Pending Bills', value: stats?.pendingBills ?? 0, icon: Clock, cls: 'si-red' },
    { label: 'Pending Bills Value', value: `₹${(stats?.pendingBillsValue ?? 0).toLocaleString('en-IN')}`, icon: IndianRupee, cls: 'si-red' },
    { label: 'Paid Bills', value: stats?.paidBills ?? 0, icon: IndianRupee, cls: 'si-green' },
    { label: 'Paid Bills Value', value: `₹${(stats?.paidBillsValue ?? 0).toLocaleString('en-IN')}`, icon: IndianRupee, cls: 'si-green' },
    { label:'Total Bills', value: stats?.totalBills ?? 0, icon: FileText, cls:'si-blue' },
    { label: 'Monthly Invoice Value', value: `₹${(stats?.monthlyRevenue ?? 0).toLocaleString('en-IN')}`, icon: TrendingUp, cls: 'si-green' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Showing data for {new Date(`${filterMonth}-01`).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="card-body" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div style={{fontSize:'.82rem',fontWeight:600,color:'var(--gray600)'}}>Select month</div>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            style={{padding:'9px 14px',border:'1.5px solid var(--gray200)',borderRadius:9,fontSize:'.82rem',minWidth:170}}
          />
        </div>
      </div>

      <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div>
              <div className="label">{c.label}</div>
              <div className="value">{c.value}</div>
            </div>
            <div className={`stat-icon ${c.cls}`}><c.icon size={20}/></div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
        <div className="card">
          <div className="card-header"><span className="card-title">Monthly Revenue</span></div>
          <div className="card-body">
            {chart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="name" tick={{fontSize:11}} />
                  <YAxis tick={{fontSize:11}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                  <Tooltip formatter={(v)=>[`₹${v.toLocaleString('en-IN')}`,'Revenue']}/>
                  <Bar dataKey="revenue" fill="#1565C0" radius={[6,6,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty"><p>No billing data yet</p></div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Recent Inventory</span></div>
          <div className="card-body">
            {stats?.recentEntries?.length > 0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {stats.recentEntries.map((e,i) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--gray100)'}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:'.8rem'}}>{e.client?.name}</div>
                      <div style={{fontSize:'.7rem',color:'var(--gray400)'}}>
                        {new Date(e.date).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    <div style={{fontWeight:700,fontSize:'.82rem',color:'var(--navy)'}}>
                      ₹{e.totalAmount?.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty"><p>No entries yet</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
