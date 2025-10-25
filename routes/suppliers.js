const express = require('express');
const { body, validationResult } = require('express-validator');
const Supplier = require('../models/Supplier');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all suppliers
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    // Apply filters
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { contactPerson: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const suppliers = await Supplier.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Supplier.countDocuments(filter);

    res.json({
      suppliers,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single supplier
router.get('/:id', auth, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new supplier
router.post('/', [
  auth,
  authorize('admin', 'manager'),
  body('name').notEmpty().withMessage('Supplier name is required'),
  body('contactPerson').notEmpty().withMessage('Contact person is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('leadTime').isNumeric().withMessage('Lead time must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const supplier = new Supplier(req.body);
    await supplier.save();

    res.status(201).json(supplier);
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update supplier
router.put('/:id', [
  auth,
  authorize('admin', 'manager'),
  body('name').optional().notEmpty().withMessage('Supplier name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    Object.assign(supplier, req.body);
    await supplier.save();

    res.json(supplier);
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete supplier
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    await Supplier.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get supplier statistics
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Get inventory items from this supplier
    const Inventory = require('../models/Inventory');
    const inventoryItems = await Inventory.find({ supplier: req.params.id });
    
    const stats = {
      totalItems: inventoryItems.length,
      totalValue: inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0),
      lowStockItems: inventoryItems.filter(item => item.currentStock <= item.reorderPoint).length,
      totalOrders: supplier.totalOrders,
      totalOrderValue: supplier.totalValue,
      averageRating: supplier.rating
    };

    res.json(stats);
  } catch (error) {
    console.error('Get supplier stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
