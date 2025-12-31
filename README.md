# AUSU MSSN Repository Platform

A full-stack web application built for the **Muslim Students Society of Nigeria (MSSN)** at AUSU.  
The platform provides a central hub for managing **resources, announcements, donations, and user access control**.

---

## 🚀 Features

### Public
- 📚 **Resources Repository** – Browse and download PDFs, audio lectures, and videos.
- 📢 **Announcements** – Stay informed with the latest news and updates.
- ❤️ **Secure Donations** – Integrated with Paystack for seamless and safe online donations.

### Authenticated Users
- 👤 **Profile Management** – View profile, update password, and see assigned RBAC roles.
- 🔒 **Change Password** – Users can securely update their login credentials.

### Admin
- 📊 **Dashboard** – Overview of users, resources, donations, and announcements.
- 👥 **User Management**
  - Onboard new users
  - Reset passwords
  - Update roles
  - Delete accounts
- 🔑 **RBAC (Role-Based Access Control)**
  - Create, update, and delete roles
  - Assign/remove permissions for each role
  - Assign/remove roles for users
- 📂 **Resource Management** – Upload, categorize, and delete resources.
- 📢 **Announcements** – Create, publish, and manage announcements.
- 💰 **Donations** – Track and export donations to CSV.

---

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js  
- **Templating**: EJS  
- **Database**: Sequelize ORM (MySQL/Postgres/SQLite supported)  
- **Auth & Security**:
  - Session-based auth
  - CSRF protection
  - Helmet for security headers
- **UI**: Bootstrap 5 + Bootstrap Icons and CSS  
- **RBAC**: Roles & Permissions model with UserRole and RolePermission tables  
- **Payments**: Paystack API integration  

---

## 📂 Project Structure

├── server.js # App entry point
├── src/
│ ├── models/ # Sequelize models (User, Role, Permission, etc.)
│ ├── routes/ # Express routes (auth, admin, rbac, repository, etc.)
│ ├── middleware/ # Auth & RBAC middleware
│ ├── views/ # EJS templates
│ │ ├── layout.ejs # Main layout
│ │ ├── partials/ # Flash messages, reusable UI components
│ │ ├── admin/ # Admin dashboard, users, rbac, etc.
│ │ ├── repository/ # Resource list & upload
│ │ └── announcements/ # Announcements pages
│ └── views/_layout_hook.js
├── public/ # Static assets (css, images, logos)
├── uploads/ # Uploaded files (resources)
└── scripts/ # DB seeding scripts (admin, rbac, categories)


## ⚙️ Setup & Installation

### 1. Clone the repo
```bash
git clone https://github.com/abbaphy/al_istiqama_mss_website.git

cd al_istiqama_mss_website

npm install

## Create a .env file in the root directory:
SESSION_SECRET=your_secret_key
DB_DIALECT=sqlite            # or mysql / postgres
DB_STORAGE=./dev.sqlite3     # for sqlite
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=mssn_repo
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx

## Run migrations & seed data

npm run sync          # Sync DB
npm run seed:admin    # Create default superuser (admin@example.com / admin1234)
npm run seed:categories
npm run seed:rbac

## Start development server

npm run dev

Visit: http://localhost:3000


##  Default Superuser

Email: admin@example.com

Password: admin1234

Role: Superuser (bypasses all permission checks)


### Author: 

for any issue contact sadiqkabirskb@gmail.com
