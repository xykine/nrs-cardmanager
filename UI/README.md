# NRS Card Manager

A full-stack application for managing employee cards with photo uploads.

## Features

- View employee list with details
- Send invitation links to employees
- Upload and edit employee photos
- Print employee cards
- View detailed employee information

## Tech Stack

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- Vite
- Lucide React (icons)

### Backend
- Node.js
- Express
- TypeScript
- Sequelize TypeScript
- MySQL

## Prerequisites

- Node.js 18+ installed
- MySQL 8+ installed and running
- npm or yarn package manager

## Setup Instructions

### 1. Database Setup

Create a MySQL database:

```sql
CREATE DATABASE nrs_card_manager;
```

### 2. Backend Setup

```bash
cd server
npm install
```

Configure the database connection in `server/.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nrs_card_manager
DB_USER=root
DB_PASSWORD=your_password
APP_URL=http://localhost:5173
```

Start the backend server:

```bash
npm run dev
```

The server will run on http://localhost:3000 and will automatically create database tables.

### 3. Frontend Setup

In the project root:

```bash
npm install
```

The frontend is configured in `.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

Start the development server:

```bash
npm run dev
```

The frontend will run on http://localhost:5173

## API Endpoints

### Employees

- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get employee by ID
- `POST /api/employees` - Create new employee
- `POST /api/employees/:id/invitation` - Send invitation link
- `PATCH /api/employees/:id/photo-status` - Update photo status

### Cards

- `GET /api/cards/employee/:employeeId` - Get card by employee ID
- `POST /api/cards/employee/:employeeId` - Create or update card
- `GET /api/cards/:id/print` - Get card for printing

## Usage

1. The database tables will be created automatically when you start the backend server
2. You can add employees by creating them through the API or database
3. Access the frontend at http://localhost:5173
4. Use the interface to manage employees and their cards

## Sample Data

You have three options to add sample employees to your database:

### Option 1: Using the seed script (Recommended)

```bash
cd server
npm run seed
```

This will add 8 sample employees automatically.

### Option 2: Using the SQL file

```bash
mysql -u root -p nrs_card_manager < server/sample-data.sql
```

### Option 3: Using the API

```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "employeeId": "EMP001",
    "email": "john.doe@example.com"
  }'
```

## Building for Production

### Frontend

```bash
npm run build
```

### Backend

```bash
cd server
npm run build
npm start
```
