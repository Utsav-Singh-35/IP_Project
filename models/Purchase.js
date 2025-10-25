const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  purchaseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  items: [{
    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  shipping: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'ordered', 'received', 'cancelled'],
    default: 'pending'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDate: {
    type: Date
  },
  receivedDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Calculate totals before saving
purchaseSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.total = this.subtotal + this.tax + this.shipping;
  next();
});

// Generate purchase number
purchaseSchema.pre('save', async function(next) {
  if (this.isNew && !this.purchaseNumber) {
    const count = await this.constructor.countDocuments();
    this.purchaseNumber = `PO-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Index for better performance
purchaseSchema.index({ purchaseNumber: 1 });
purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ orderDate: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
