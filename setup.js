#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Smart Inventory Management System...\n');

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  const envContent = `MONGODB_URI=mongodb://localhost:27017/inventory_management
JWT_SECRET=your_jwt_secret_key_here_change_this_in_production
PORT=3000
NODE_ENV=development
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with default configuration');
} else {
  console.log('ℹ️  .env file already exists');
}

// Create logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
  console.log('✅ Created logs directory');
}

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('✅ Created uploads directory');
}

console.log('\n🎉 Setup complete!');
console.log('\n📋 Next steps:');
console.log('1. Make sure MongoDB is running on your system');
console.log('2. Update the .env file with your configuration');
console.log('3. Run: npm install');
console.log('4. Run: npm run dev');
console.log('5. Open http://localhost:3000 in your browser');
console.log('\n📚 For more information, see README.md');
