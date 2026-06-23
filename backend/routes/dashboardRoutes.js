const router = require('express').Router();
const Client = require('../models/Client');
const Product = require('../models/Product');
const InventoryEntry = require('../models/InventoryEntry');
const Bill = require('../models/Bill');

router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalClients, activeClients, totalProducts, totalBills, totalInventoryEntries,
           monthlyRevenue, pendingBills, recentEntries] = await Promise.all([
      Client.countDocuments(),
      Client.countDocuments({ active: true }),
      Product.countDocuments({ active: true }),
      Bill.countDocuments(),
      InventoryEntry.countDocuments(),
      Bill.aggregate([
        { $match: { billDate: { $gte: monthStart }, status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Bill.countDocuments({ status: { $in: ['Draft', 'Sent', 'Overdue'] } }),
      InventoryEntry.find().populate('client','name').populate('lines.product','name').sort({ date:-1 }).limit(5)
    ]);

    res.json({
      success: true,
      data: {
        totalClients, activeClients, totalProducts, totalBills, totalInventoryEntries,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        pendingBills,
        recentEntries
      }
    });
  } catch (e) { res.status(500).json({ success:false, message: e.message }); }
});

// Revenue chart - last 6 months
router.get('/revenue-chart', async (req, res) => {
  try {
    const data = await Bill.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      { $group: {
        _id: { year: { $year:'$billDate' }, month: { $month:'$billDate' } },
        total: { $sum: '$grandTotal' }, count: { $sum: 1 }
      }},
      { $sort: { '_id.year':1, '_id.month':1 } },
      { $limit: 6 },
       { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    res.json({ success:true, data });
  } catch (e) { res.status(500).json({ success:false, message: e.message }); }
});

module.exports = router;
