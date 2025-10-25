const express = require('express');
const Inventory = require('../models/Inventory');
const Purchase = require('../models/Purchase');
const Transaction = require('../models/Transaction');
const Supplier = require('../models/Supplier');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', auth, async (req, res) => {
  try {
    const [
      totalItems,
      lowStockItems,
      outOfStockItems,
      totalSuppliers,
      activeSuppliers,
      totalValue,
      recentPurchases,
      topSellingItems
    ] = await Promise.all([
      Inventory.countDocuments({ status: 'active' }),
      Inventory.countDocuments({
        $expr: { $lte: ['$currentStock', '$reorderPoint'] },
        status: 'active'
      }),
      Inventory.countDocuments({
        currentStock: 0,
        status: 'active'
      }),
      Supplier.countDocuments(),
      Supplier.countDocuments({ status: 'active' }),
      Inventory.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$currentStock', '$costPrice'] } } } }
      ]),
      Purchase.find({ status: 'received' })
        .populate('supplier', 'name')
        .sort({ receivedDate: -1 })
        .limit(5),
      Inventory.find({ status: 'active' })
        .sort({ totalSold: -1 })
        .limit(5)
        .populate('supplier', 'name')
    ]);

    const inventoryValue = totalValue.length > 0 ? totalValue[0].total : 0;

    res.json({
      overview: {
        totalItems,
        lowStockItems,
        outOfStockItems,
        totalSuppliers,
        activeSuppliers,
        inventoryValue
      },
      recentPurchases,
      topSellingItems
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get sales trends
router.get('/sales-trends', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const salesData = await Transaction.aggregate([
      {
        $match: {
          type: 'sale',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalSales: { $sum: '$totalPrice' },
          totalQuantity: { $sum: '$quantity' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.json(salesData);
  } catch (error) {
    console.error('Get sales trends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get inventory turnover
router.get('/inventory-turnover', auth, async (req, res) => {
  try {
    const turnoverData = await Inventory.aggregate([
      { $match: { status: 'active' } },
      {
        $project: {
          name: 1,
          sku: 1,
          currentStock: 1,
          totalSold: 1,
          totalPurchased: 1,
          turnoverRate: {
            $cond: {
              if: { $gt: ['$currentStock', 0] },
              then: { $divide: ['$totalSold', '$currentStock'] },
              else: 0
            }
          }
        }
      },
      { $sort: { turnoverRate: -1 } },
      { $limit: 20 }
    ]);

    res.json(turnoverData);
  } catch (error) {
    console.error('Get inventory turnover error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get supplier performance
router.get('/supplier-performance', auth, async (req, res) => {
  try {
    const supplierData = await Supplier.aggregate([
      {
        $lookup: {
          from: 'purchases',
          localField: '_id',
          foreignField: 'supplier',
          as: 'purchases'
        }
      },
      {
        $project: {
          name: 1,
          rating: 1,
          totalOrders: 1,
          totalValue: 1,
          averageOrderValue: {
            $cond: {
              if: { $gt: ['$totalOrders', 0] },
              then: { $divide: ['$totalValue', '$totalOrders'] },
              else: 0
            }
          },
          onTimeDelivery: {
            $cond: {
              if: { $gt: [{ $size: '$purchases' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$purchases',
                            cond: {
                              $and: [
                                { $eq: ['$$this.status', 'received'] },
                                { $lte: ['$$this.receivedDate', '$$this.expectedDate'] }
                              ]
                            }
                          }
                        }
                      },
                      { $size: '$purchases' }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      { $sort: { rating: -1, totalValue: -1 } }
    ]);

    res.json(supplierData);
  } catch (error) {
    console.error('Get supplier performance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get category analysis
router.get('/category-analysis', auth, async (req, res) => {
  try {
    const categoryData = await Inventory.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$category',
          totalItems: { $sum: 1 },
          totalStock: { $sum: '$currentStock' },
          totalValue: { $sum: { $multiply: ['$currentStock', '$costPrice'] } },
          totalSold: { $sum: '$totalSold' },
          averagePrice: { $avg: '$unitPrice' }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    res.json(categoryData);
  } catch (error) {
    console.error('Get category analysis error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get low stock alerts
router.get('/alerts', auth, async (req, res) => {
  try {
    const alerts = await Inventory.find({
      $expr: { $lte: ['$currentStock', '$reorderPoint'] },
      status: 'active'
    })
      .populate('supplier', 'name contactPerson email phone')
      .sort({ currentStock: 1 });

    const alertData = alerts.map(item => ({
      ...item.toObject(),
      urgency: item.currentStock <= item.minStock ? 'critical' : 'warning',
      daysUntilOutOfStock: item.currentStock > 0 ? 
        Math.ceil(item.currentStock / (item.totalSold / 30)) : 0
    }));

    res.json(alertData);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
