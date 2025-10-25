const express = require('express');
const { body, validationResult } = require('express-validator');
const Inventory = require('../models/Inventory');
const Transaction = require('../models/Transaction');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all inventory items with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    // Apply filters
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.supplier) filter.supplier = req.query.supplier;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const items = await Inventory.find(filter)
      .populate('supplier', 'name contactPerson email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Inventory.countDocuments(filter);

    // Build supplier name set to fetch contacts for string-based or name-based items
    const names = new Set();
    for (const it of items) {
      if (typeof it.supplier === 'string') names.add(it.supplier);
      else if (it.supplier && it.supplier.name) names.add(it.supplier.name);
      else if (it.supplier_name) names.add(it.supplier_name);
    }
    const nameList = Array.from(names);
    const Supplier = require('../models/Supplier');
    const suppliersByName = {};
    if (nameList.length) {
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const or = nameList.map(n => ({ name: { $regex: new RegExp(`^${esc(n)}$`, 'i') } }));
      const found = await Supplier.find({ $or: or }).select('name contactPerson email');
      for (const s of found) suppliersByName[s.name.toLowerCase()] = s;
    }

    const normalized = items.map(doc => {
      const obj = doc.toObject();
      const name = (obj.supplier && obj.supplier.name)
        ? obj.supplier.name
        : (typeof obj.supplier === 'string' ? obj.supplier : (obj.supplier_name || null));
      obj.supplier_name = name;
      const key = name ? String(name).toLowerCase() : null;
      const byName = key ? suppliersByName[key] : null;
      obj.supplier_contact = (obj.supplier && obj.supplier.contactPerson)
        ? obj.supplier.contactPerson
        : (byName ? byName.contactPerson : null);
      obj.supplier_email = (obj.supplier && obj.supplier.email)
        ? obj.supplier.email
        : (byName ? byName.email : null);
      return obj;
    });

    res.json({
      items: normalized,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single inventory item
router.get('/:id', auth, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id)
      .populate('supplier', 'name contactPerson email phone');
    
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const obj = item.toObject();
    const name = (obj.supplier && obj.supplier.name)
      ? obj.supplier.name
      : (typeof obj.supplier === 'string' ? obj.supplier : (obj.supplier_name || null));
    obj.supplier_name = name;
    if (!obj.supplier || !obj.supplier.contactPerson) {
      const Supplier = require('../models/Supplier');
      const s = name ? await Supplier.findOne({ name }).select('contactPerson email') : null;
      obj.supplier_contact = s ? s.contactPerson : null;
    } else {
      obj.supplier_contact = obj.supplier.contactPerson;
    }

    res.json(obj);
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new inventory item
router.post('/', [
  auth,
  authorize('admin', 'manager'),
  body('sku').notEmpty().withMessage('SKU is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('currentStock').isNumeric().withMessage('Current stock must be a number'),
  body('unitPrice').isNumeric().withMessage('Unit price must be a number'),
  body('costPrice').isNumeric().withMessage('Cost price must be a number'),
  body('supplier').isMongoId().withMessage('Valid supplier ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const item = new Inventory(req.body);
    await item.save();

    // Create initial transaction
    const transaction = new Transaction({
      type: 'adjustment',
      inventory: item._id,
      quantity: item.currentStock,
      unitPrice: item.costPrice,
      totalPrice: item.currentStock * item.costPrice,
      reference: 'Initial stock',
      createdBy: req.user._id,
      notes: 'Initial inventory entry'
    });
    await transaction.save();

    const populatedItem = await Inventory.findById(item._id)
      .populate('supplier', 'name contactPerson email');

    res.status(201).json(populatedItem);
  } catch (error) {
    console.error('Create inventory error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'SKU already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Update inventory item
router.put('/:id', [
  auth,
  authorize('admin', 'manager'),
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('currentStock').optional().isNumeric().withMessage('Current stock must be a number'),
  body('unitPrice').optional().isNumeric().withMessage('Unit price must be a number'),
  body('costPrice').optional().isNumeric().withMessage('Cost price must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const oldStock = item.currentStock;
    const newStock = req.body.currentStock !== undefined ? req.body.currentStock : oldStock;

    Object.assign(item, req.body);
    await item.save();

    // Create transaction if stock changed
    if (oldStock !== newStock) {
      const quantityChange = newStock - oldStock;
      const transaction = new Transaction({
        type: 'adjustment',
        inventory: item._id,
        quantity: quantityChange,
        unitPrice: item.costPrice,
        totalPrice: Math.abs(quantityChange) * item.costPrice,
        reference: 'Stock adjustment',
        createdBy: req.user._id,
        notes: `Stock adjusted from ${oldStock} to ${newStock}`
      });
      await transaction.save();
    }

    const populatedItem = await Inventory.findById(item._id)
      .populate('supplier', 'name contactPerson email');

    res.json(populatedItem);
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete inventory item
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    await Inventory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Delete inventory error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get low stock items
router.get('/alerts/low-stock', auth, async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      $expr: { $lte: ['$currentStock', '$reorderPoint'] },
      status: 'active'
    }).populate('supplier', 'name contactPerson email phone');

    res.json(lowStockItems);
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get categories
router.get('/data/categories', auth, async (req, res) => {
  try {
    const categories = await Inventory.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
