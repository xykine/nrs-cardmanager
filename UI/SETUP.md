# Setup Guide for NRS Card Manager

## Prerequisites

Before running this application, ensure you have the following installed:

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/

2. **MySQL** (v8 or higher)
   - macOS: `brew install mysql`
   - Ubuntu/Debian: `sudo apt install mysql-server`
   - Windows: Download from https://dev.mysql.com/downloads/mysql/

## Quick Start

### Step 1: Install MySQL and Create Database

Start MySQL service:
```bash
# macOS
brew services start mysql

# Ubuntu/Debian
sudo systemctl start mysql

# Windows
# Use Services app to start MySQL
```

Create the database:
```bash
mysql -u root -p
```

Then run:
```sql
CREATE DATABASE nrs_card_manager;
EXIT;
```

### Step 2: Configure Backend

Navigate to the server directory and copy the example environment file:
```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your MySQL credentials:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nrs_card_manager
DB_USER=root
DB_PASSWORD=your_mysql_password
APP_URL=http://localhost:5173
```

### Step 3: Install Dependencies

Install backend dependencies:
```bash
cd server
npm install
```

Install frontend dependencies:
```bash
cd ..
npm install
```

### Step 4: Start Backend Server

The backend will automatically create all required database tables:
```bash
cd server
npm run dev
```

You should see:
```
Database connection established successfully.
Database synchronized.
Server running on port 3000
```

### Step 5: Add Sample Data

In a new terminal, run the seed script:
```bash
cd server
npm run seed
```

This will add 8 sample employees to your database.

### Step 6: Start Frontend

In a new terminal, from the project root:
```bash
npm run dev
```

### Step 7: Access Application

Open your browser and navigate to:
```
http://localhost:5173
```

You should see the employee list with 8 sample employees!

## Troubleshooting

### MySQL Connection Error

If you see `ECONNREFUSED 127.0.0.1:3306`:
1. Verify MySQL is running: `mysql -u root -p`
2. Check your credentials in `server/.env`
3. Ensure the database `nrs_card_manager` exists

### Port Already in Use

If port 3000 or 5173 is already in use:
1. Change the `PORT` in `server/.env`
2. Update `VITE_API_URL` in the root `.env` file

### Dependencies Issues

If you encounter dependency errors:
```bash
# Clean install backend
cd server
rm -rf node_modules package-lock.json
npm install

# Clean install frontend
cd ..
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

Once the application is running:

1. **View Employees**: See the list of all employees
2. **Send Invitations**: Click the mail icon to generate invitation links
3. **Upload Photos**: Click the card icon to upload and edit employee photos
4. **Print Cards**: Once a photo is uploaded, print professional employee cards
5. **View Details**: Click the eye icon to see detailed employee information

## API Testing

You can also interact with the API directly:

```bash
# Get all employees
curl http://localhost:3000/api/employees

# Create a new employee
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "employeeId": "EMP999",
    "email": "test@company.com"
  }'

# Send invitation
curl -X POST http://localhost:3000/api/employees/{employee-id}/invitation
```

## Production Deployment

For production deployment:

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Build the backend:
   ```bash
   cd server
   npm run build
   ```

3. Set production environment variables
4. Deploy using your preferred hosting service (AWS, DigitalOcean, Heroku, etc.)
5. Use a production MySQL database
6. Set up proper security (HTTPS, authentication, CORS restrictions)

Enjoy using the NRS Card Manager!
