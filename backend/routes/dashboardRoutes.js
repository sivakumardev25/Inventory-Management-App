const router = require('express').Router();
const Client = require('../models/Client');
const Product = require('../models/Product');
const InventoryEntry = require('../models/InventoryEntry');
const Bill = require('../models/Bill');

router.get('/stats', async (req, res) => {
  try {
    const { month } = req.query;
    const selectedDate = month ? new Date(`${month}-01T00:00:00`) : new Date();
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthMatch = { billDate: { $gte: monthStart, $lte: monthEnd } };

    const [totalClients, activeClients, totalProducts, totalBills, totalInventoryEntries,
           monthlyRevenue, pendingBills, pendingBillsValue, paidBills, paidBillsValue, recentEntries] = await Promise.all([
      Client.countDocuments(),
      Client.countDocuments({ active: true }),
      Product.countDocuments({ active: true }),
      Bill.countDocuments(monthMatch),
      InventoryEntry.countDocuments({ date: { $gte: monthStart, $lte: monthEnd } }),
      Bill.aggregate([
        { $match: { ...monthMatch, status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Bill.countDocuments({ ...monthMatch, status: { $in: ['Draft', 'Sent', 'Overdue'] } }),
      Bill.aggregate([
        { $match: { ...monthMatch, status: { $in: ['Draft', 'Sent', 'Overdue'] } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Bill.countDocuments({ ...monthMatch, status: 'Paid' }),
      Bill.aggregate([
        { $match: { ...monthMatch, status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      InventoryEntry.find({ date: { $gte: monthStart, $lte: monthEnd } }).populate('client','name').populate('lines.product','name').sort({ date:-1 }).limit(5)
    ]);

    res.json({
      success: true,
      data: {
        totalClients, activeClients, totalProducts, totalBills, totalInventoryEntries,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        pendingBills,
        pendingBillsValue: pendingBillsValue[0]?.total || 0,
        paidBills,
        paidBillsValue: paidBillsValue[0]?.total || 0,
        recentEntries
      }
    });
  } catch (e) { res.status(500).json({ success:false, message: e.message }); }
});

// Revenue chart - last 6 months
router.get('/revenue-chart', async (req, res) => {
  try {
    const { month } = req.query;
    const match = { status: { $ne: 'Cancelled' } };

    if (month) {
      const selectedDate = new Date(`${month}-01T00:00:00`);
      const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);
      match.billDate = { $gte: monthStart, $lte: monthEnd };
    }

    const data = await Bill.aggregate([
      { $match: match },
      { $group: {
        _id: { year: { $year:'$billDate' }, month: { $month:'$billDate' } },
        total: { $sum: '$grandTotal' }, count: { $sum: 1 }
      }},
      { $sort: { '_id.year':1, '_id.month':1 } }
    ]);
    res.json({ success:true, data });
  } catch (e) { res.status(500).json({ success:false, message: e.message }); }
});

module.exports = router;
