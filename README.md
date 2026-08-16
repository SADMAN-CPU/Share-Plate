# 🍽️ SharePlate — Food Sharing & Redistribution Platform

[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20Express%20%7C%20MySQL-emerald)](https://github.com/SADMAN-CPU/Share-Plate)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()

**SharePlate** is a full-stack web application designed to reduce food waste and combat hunger by connecting surplus food donors (restaurants, caterers, households) with receivers (NGOs, shelters, individuals in need) and volunteer deliverers.

---

## 🌟 Key Features

### 👑 Admin Management
- **User Management & Verification:** Verify donor/volunteer accounts, view role distribution.
- **Platform Analytics:** Real-time metrics on total food shared, active deliveries, and claims.
- **Content Moderation:** Review food listings and system activity logs.

### 🍲 Food Donors
- **Post Food Surplus:** Create listings with food type (cooked, packaged, beverage), quantity, pickup notes, and expiry timestamps.
- **Food Safety Checklist:** Mandatory hygiene and freshness verification prior to listing publication.
- **Claim Oversight:** Accept or decline claim requests from verified receivers.

### 🤲 Receivers
- **Interactive Food Map:** Browse nearby surplus food listings with real-time availability.
- **Request & Claim:** Submit pickup notes and reserve food items directly.
- **Order Tracking:** Monitor delivery progress from pickup to doorstep arrival.

### 🚴 Volunteers
- **Delivery Queue:** View available pickup and delivery tasks in your area.
- **Status Updates:** Update status to `picked_up` or `delivered` in real-time.
- **Rating & Feedback:** Receive community ratings and reviews for successful deliveries.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, React Router v7, Axios, TailwindCSS
- **Backend:** Node.js, Express.js (v5), JavaScript (ES6+)
- **Database:** MySQL 8.0+ with `mysql2/promise` pool
- **Authentication:** JSON Web Tokens (JWT) + HTTP Bearer Auth & `bcryptjs` password hashing
- **Automation:** `node-cron` for automated food item expiration state checks

---

## 📁 Project Structure

```
Share-Plate/
├── client/                     # React Frontend App (Vite)
│   ├── src/
│   │   ├── components/         # Navigation, Layouts, UI Modals, ProtectedRoute
│   │   ├── context/            # AuthContext (JWT & User state management)
│   │   ├── pages/
│   │   │   ├── public/         # Landing, Login, Register
│   │   │   ├── donor/          # Donor Dashboard & Food Creation
│   │   │   ├── receiver/       # Receiver Food Map & Claim Requests
│   │   │   ├── volunteer/      # Delivery Tasks & Status Updates
│   │   │   └── admin/          # Admin Oversight Panel & Statistics
│   │   └── services/           # Axios API Client & Endpoints
│   ├── package.json
│   └── vite.config.js
├── config/                     # Database Connection Pool (`db.js`)
├── controllers/                # Request logic (Auth, Food, Requests, Admin)
├── database/                   # Schema (`schema.sql`), `initDB.js`, `seed.js`
├── jobs/                       # Background Jobs (Cron tasks for expiry)
├── middleware/                 # Auth JWT validation & Role-based Access Control
├── routes/                     # REST API Route Definitions
├── .env.example                # Sample Environment Variables
├── package.json                # Backend Dependencies & Scripts
└── server.js                   # Express App Entry Point
```

---

## 🔑 Demo Login Credentials

> **Note:** All pre-seeded demo accounts share the password: `Password123!`

| Role | Name | Email | Password | Location |
| :--- | :--- | :--- | :--- | :--- |
| 👑 **Admin** | MD SADMAN SHAID | `admin@shareplate.com` | `Password123!` | Dhaka HQ |
| 🍲 **Donor** | Fatima Malik | `fatima@example.com` | `Password123!` | Gulshan, Dhaka |
| 🍲 **Donor** | Kabir Hossain | `kabir@example.com` | `Password123!` | Dhanmondi, Dhaka |
| 🤲 **Receiver** | Nasrin Akter | `nasrin@example.com` | `Password123!` | Mirpur, Dhaka |
| 🤲 **Receiver** | Rahim Uddin | `rahim@example.com` | `Password123!` | Mohammadpur, Dhaka |
| 🚴 **Volunteer**| Tariq Ahmed | `tariq@example.com` | `Password123!` | Banani, Dhaka |
| 🚴 **Volunteer**| Sumaiya Chowdhury | `sumaiya@example.com` | `Password123!` | Uttara, Dhaka |

---

## ⚡ Quick Start & Setup Guide

### 1. Prerequisites
Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MySQL Server](https://www.mysql.com/) (v8.0 or higher)

### 2. Environment Configuration
Create a `.env` file in the root directory (or copy `.env.example`):

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=share_plate_db
JWT_SECRET=your_super_secret_jwt_key
```

### 3. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 4. Database Setup & Seeding
Run the initialization script to automatically create tables and seed realistic demo data:

```bash
# Create database tables
npm run initDB

# Seed demo users, food items, requests, and deliveries
node database/seed.js
```

### 5. Launch the Application

Run the **Backend API Server**:
```bash
# From root directory
npm run dev
# Server running at http://localhost:5000
```

Run the **Frontend Client**:
```bash
# From client directory
cd client
npm run dev
# Client running at http://localhost:5173
```

---

## 🔌 Core API Endpoints

### 🔑 Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account (Donor, Receiver, Volunteer)
- `POST /api/auth/login` — User authentication & JWT issuance
- `GET /api/auth/me` — Fetch currently authenticated profile

### 🍲 Food Listings (`/api/food`)
- `GET /api/food` — List available food items
- `POST /api/food` — Create a new food listing with safety checklist
- `GET /api/food/:id` — Get details for a specific listing
- `PATCH /api/food/:id/status` — Update food availability status

### 📦 Requests & Deliveries (`/api/requests`, `/api/deliveries`)
- `POST /api/requests` — Submit claim request for a food item
- `PATCH /api/requests/:id/status` — Accept/decline claim request
- `PATCH /api/deliveries/:id/status` — Update volunteer delivery status (`picked_up`, `delivered`)

### 👑 Admin (`/api/admin`)
- `GET /api/admin/stats` — Overall platform statistics & reporting
- `PATCH /api/admin/verify-user/:id` — Approve user account verification

---

## 📝 License

Distributed under the ISC License. See `LICENSE` for more details.
