const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  website: {
    type: String,
    trim: true
  },
  taxId: {
    type: String,
    trim: true
  },
  paymentTerms: {
    type: String,
    enum: ['net_15', 'net_30', 'net_45', 'net_60', 'cod', 'prepaid'],
    default: 'net_30'
  },
  leadTime: {
    type: Number,
    required: true,
    min: 0,
    default: 7 // days
  },
  minimumOrder: {
    type: Number,
    min: 0,
    default: 0
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalValue: {
    type: Number,
    default: 0
  },
  lastOrderDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for better performance
supplierSchema.index({ name: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ status: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
