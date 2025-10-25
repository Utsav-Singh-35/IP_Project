const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Purchase = require('../models/Purchase');
const Inventory = require('../models/Inventory');
const Transaction = require('../models/Transaction');
const Supplier = require('../models/Supplier');
const path = require('path');
let purchasesSeedMap = {};
try {
  const seed = require(path.join(__dirname, '..', 'data', 'purchases.json'));
  if (Array.isArray(seed)) {
    purchasesSeedMap = seed.reduce((acc, p) => { if (p.purchaseNumber && p.supplier) acc[p.purchaseNumber] = p.supplier; return acc; }, {});
  }
} catch (e) {
  purchasesSeedMap = {};
}
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all purchases
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build match
    const match = {};
    if (req.query.status) match.status = req.query.status;
    if (req.query.search) {
      match.$or = [
        { purchaseNumber: { $regex: req.query.search, $options: 'i' } },
        { notes: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    // Count total using native collection (to avoid schema/type issues)
    const total = await Purchase.collection.countDocuments(match);

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      // Supplier when stored as ObjectId
      { $lookup: { from: 'suppliers', localField: 'supplier', foreignField: '_id', as: 'supplierDoc' } },
      // First item (for SKU-based fallback)
      { $addFields: { firstItem: { $arrayElemAt: ['$items', 0] } } },
      // Lookup inventory by SKU when items carry sku
      { $lookup: { from: 'inventories', let: { sku: '$firstItem.sku' }, pipeline: [
        { $match: { $expr: { $and: [ { $ne: ['$$sku', null] }, { $eq: ['$sku', '$$sku'] } ] } } },
        { $project: { supplier: 1, name: 1, sku: 1 } }
      ], as: 'firstInv' } },
      // Lookup supplier of that inventory
      { $lookup: { from: 'suppliers', localField: 'firstInv.0.supplier', foreignField: '_id', as: 'invSup' } },
      // Derive supplier_name with multiple fallbacks
      { $addFields: {
        supplier_name: {
          $ifNull: [
            { $arrayElemAt: ['$supplierDoc.name', 0] },
            {
              $cond: [
                { $eq: [{ $type: '$supplier' }, 'string'] },
                '$supplier',
                null
              ]
            }
          ]
        }
      } },
      { $addFields: {
        supplier_name: { $ifNull: ['$supplier_name', { $arrayElemAt: ['$invSup.name', 0] }] }
      } },
      { $project: {
        supplierDoc: 0,
        firstItem: 0,
        firstInv: 0,
        invSup: 0
      } }
    ];

    const purchases = await Purchase.collection.aggregate(pipeline).toArray();

    // Final fallback to seed map by purchaseNumber if still missing
    for (const p of purchases) {
      if (!p.supplier_name && purchasesSeedMap[p.purchaseNumber]) {
        p.supplier_name = purchasesSeedMap[p.purchaseNumber];
      }
    }

    res.json({
      purchases,
      pagination: { current: page, pages: Math.ceil(total / limit), total }
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single purchase
router.get('/:id', auth, async (req, res) => {
  try {
    const id = req.params.id;
    let objId;
    try {
      objId = new mongoose.Types.ObjectId(id);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid purchase id' });
    }
    const pipeline = [
      { $match: { _id: objId } },
      { $lookup: { from: 'suppliers', localField: 'supplier', foreignField: '_id', as: 'supplierDoc' } },
      { $addFields: { firstItem: { $arrayElemAt: ['$items', 0] } } },
      { $lookup: { from: 'inventories', let: { sku: '$firstItem.sku' }, pipeline: [
        { $match: { $expr: { $and: [ { $ne: ['$$sku', null] }, { $eq: ['$sku', '$$sku'] } ] } } },
        { $project: { supplier: 1, name: 1, sku: 1 } }
      ], as: 'firstInv' } },
      { $lookup: { from: 'suppliers', localField: 'firstInv.0.supplier', foreignField: '_id', as: 'invSup' } },
      { $addFields: {
        supplier_name: {
          $ifNull: [
            { $arrayElemAt: ['$supplierDoc.name', 0] },
            {
              $cond: [
                { $eq: [{ $type: '$supplier' }, 'string'] },
                '$supplier',
                null
              ]
            }
          ]
        }
      } },
      { $addFields: { supplier_name: { $ifNull: ['$supplier_name', { $arrayElemAt: ['$invSup.name', 0] }] } } },
      { $project: { supplierDoc: 0, firstItem: 0, firstInv: 0, invSup: 0 } }
    ];

    let docs;
    try {
      docs = await Purchase.collection.aggregate(pipeline).toArray();
    } catch (e) {
      // Fallback for non-hex id (shouldn't happen if route called correctly)
      return res.status(400).json({ message: 'Invalid purchase id' });
    }
    if (!docs || docs.length === 0) return res.status(404).json({ message: 'Purchase not found' });
    const doc = docs[0];
    if (!doc.supplier_name && purchasesSeedMap[doc.purchaseNumber]) doc.supplier_name = purchasesSeedMap[doc.purchaseNumber];
    res.json(doc);
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new purchase
router.post('/', [
  auth,
  authorize('admin', 'manager'),
  body('supplier').isMongoId().withMessage('Valid supplier ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.inventory').isMongoId().withMessage('Valid inventory ID is required'),
  body('items.*.quantity').isNumeric().withMessage('Quantity must be a number'),
  body('items.*.unitPrice').isNumeric().withMessage('Unit price must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const purchase = new Purchase({
      ...req.body,
      createdBy: req.user._id
    });

    await purchase.save();

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'name contactPerson email')
      .populate('items.inventory', 'name sku');

    res.status(201).json(populatedPurchase);
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update purchase status
router.patch('/:id/status', [
  auth,
  authorize('admin', 'manager'),
  body('status').isIn(['pending', 'ordered', 'received', 'cancelled']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const oldStatus = purchase.status;
    purchase.status = req.body.status;

    // If status changed to received, update inventory and create transactions
    if (oldStatus !== 'received' && req.body.status === 'received') {
      purchase.receivedDate = new Date();
      
      for (const item of purchase.items) {
        // Update inventory stock
        const inventory = await Inventory.findById(item.inventory);
        if (inventory) {
          inventory.currentStock += item.quantity;
          inventory.totalPurchased += item.quantity;
          inventory.lastRestocked = new Date();
          await inventory.save();

          // Create transaction
          const transaction = new Transaction({
            type: 'purchase',
            inventory: item.inventory,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            reference: 'Purchase',
            referenceId: purchase._id,
            createdBy: req.user._id,
            notes: `Purchase order ${purchase.purchaseNumber}`
          });
          await transaction.save();
        }
      }
    }

    await purchase.save();

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'name contactPerson email')
      .populate('items.inventory', 'name sku');

    res.json(populatedPurchase);
  } catch (error) {
    console.error('Update purchase status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete purchase
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    if (purchase.status === 'received') {
      return res.status(400).json({ message: 'Cannot delete received purchase' });
    }

    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: 'Purchase deleted successfully' });
  } catch (error) {
    console.error('Delete purchase error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reorder suggestions
router.get('/suggestions/reorder', auth, async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      $expr: { $lte: ['$currentStock', '$reorderPoint'] },
      status: 'active'
    }).populate('supplier', 'name leadTime minimumOrder');

    const suggestions = lowStockItems.map(item => ({
      inventory: item,
      suggestedQuantity: Math.max(
        item.reorderPoint - item.currentStock + 10, // Add buffer
        item.supplier.minimumOrder || 1
      ),
      urgency: item.currentStock <= item.minStock ? 'critical' : 'low'
    }));

    res.json(suggestions);
  } catch (error) {
    console.error('Get reorder suggestions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
