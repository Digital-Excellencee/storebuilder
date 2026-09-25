# StoreBuilder

A full-stack multi-store ecommerce platform for small businesses to launch and manage their own online storefronts.

The project combines a **React dashboard**, **Express/Node.js backend**, **Supabase**, authentication, store customization, ecommerce operations, and third-party integration modules in one application.

## Highlights

- Vendor authentication and role-based access
- Customer and super-admin authentication flows
- Multi-store architecture with store-specific data
- Visual storefront builder with configurable sections
- Product, inventory, variant and category management
- Orders, customers and store analytics
- Coupons, reviews and marketing features
- Store theme, colors, fonts and custom CSS settings
- SEO settings, redirects, robots.txt and policy controls
- Custom-domain and subdomain configuration flows
- Image/file handling with Cloudinary support
- Supabase-backed persistence and authentication helpers
- Integration modules for Razorpay, Shiprocket, email, SMS and webhooks
- Security middleware including Helmet, rate limiting and origin checks

## Tech stack

### Frontend
- React
- React Router
- Vite
- JavaScript / JSX
- Custom responsive CSS

### Backend
- Node.js
- Express
- JWT + session authentication
- Supabase / PostgreSQL
- Cloudinary
- REST APIs

### Integrations
- Razorpay
- Shiprocket
- Nodemailer
- Webhooks
- Analytics / tracking integration hooks

## Architecture

```text
frontend/
  src/
    components/
    pages/
    lib/

controllers/
routes/
middleware/
services/
helpers/
server.js
supabase-relational-schema.sql
```

The frontend handles the merchant dashboard and visual builder. The Express API manages authentication, store data, products, customers, orders, settings, integrations and persistence.

## Local setup

### Backend

```bash
npm install
cp .env.example .env
npm start
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Environment variables are intentionally not committed. Configure the required Supabase and integration credentials locally.

## Why I built this

This project demonstrates my ability to work beyond landing pages and build a larger product with frontend state, backend APIs, authentication, database persistence, ecommerce workflows, security controls and third-party integrations.

## Developer

Built by **Kartavya Agarwal**.

- Portfolio: https://kartavyaagarwal.in
- GitHub: https://github.com/Digital-Excellencee
- Email: hello@kartavyaagarwal.in
