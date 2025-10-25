const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  minStock: {
    type: Number,
    required: true,
    min: 0,
    default: 10
  },
  maxStock: {
    type: Number,
    required: true,
    min: 0,
    default: 100
  },
  reorderPoint: {
    type: Number,
    required: true,
    min: 0,
    default: 20
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  location: {
    type: String,
    trim: true,
    default: 'Main Warehouse'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  tags: [{
    type: String,
    trim: true
  }],
  images: [{
    type: String
  }],
  lastRestocked: {
    type: Date
  },
  totalSold: {
    type: Number,
    default: 0
  },
  totalPurchased: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for stock status
inventorySchema.virtual('stockStatus').get(function() {
  if (this.currentStock <= 0) return 'out_of_stock';
  if (this.currentStock <= this.reorderPoint) return 'low_stock';
  if (this.currentStock <= this.minStock) return 'critical';
  return 'in_stock';
});

// Virtual for reorder needed
inventorySchema.virtual('needsReorder').get(function() {
  return this.currentStock <= this.reorderPoint;
});

// Index for better performance
inventorySchema.index({ sku: 1 });
inventorySchema.index({ category: 1 });
inventorySchema.index({ supplier: 1 });
inventorySchema.index({ status: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
