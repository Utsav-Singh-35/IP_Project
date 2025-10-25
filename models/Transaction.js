const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['sale', 'purchase', 'adjustment', 'transfer', 'return'],
    required: true
  },
  inventory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  quantity: {
    type: Number,
    required: true
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
  },
  reference: {
    type: String,
    trim: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
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
  location: {
    type: String,
    trim: true,
    default: 'Main Warehouse'
  }
}, {
  timestamps: true
});

// Index for better performance
transactionSchema.index({ type: 1 });
transactionSchema.index({ inventory: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
