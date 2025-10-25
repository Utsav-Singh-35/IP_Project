# Smart Inventory Management System

Simple inventory, suppliers, purchases, analytics, and user management app.

## Setup
- Install dependencies: `npm install`
- Copy `.env.example` to `.env` and set values:
  - `MONGODB_URI=mongodb://localhost:27017/inventory_management`
  - `JWT_SECRET=change_me`
  - `PORT=3000`

## Run
- Development: `npm run dev`
- Production: `npm start`
- App: http://localhost:3000

## API (quick)
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Inventory: `GET/POST/PUT/DELETE /api/inventory`
- Suppliers: `GET/POST/PUT/DELETE /api/suppliers`
- Purchases: `GET/POST/DELETE /api/purchases`

## Notes
- Roles: `admin`, `manager`, `staff`
- Frontend lives in `public/`; server entry `server.js`.
