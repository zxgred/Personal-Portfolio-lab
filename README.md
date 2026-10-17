# Personal Portfolio - jQuery AJAX + Node.js + Express + MySQL (XAMPP)

Flow: Browser (jQuery AJAX) -> Express -> MySQL -> JSON / image -> jQuery updates the page

## 1. Start MySQL
Open the XAMPP Control Panel and click Start next to MySQL (Apache is not needed).

## 2. Run the server (from inside the backend folder)
    cd backend
    npm install
    npm start

The server creates the database (portfolio_db) and all tables by itself.
You will see:
    Database ready: portfolio_db
    Portfolio running at http://localhost:3000

(Optional) database.sql has the same tables. Import it in phpMyAdmin
(Import tab) if you want to create the database manually.

## 3. Open the website
Go to http://localhost:3000
The first time, a setup form asks for your details. After that the portfolio
appears. Click "Edit" in the top bar to add, edit or delete anything.

Your data is stored in MySQL, so it stays after refreshing the page or
restarting the server.

## Files
- backend/server.js   Express + mysql2 + multer: API, validation, image storage
- frontend/           index.html, style.css, script.js (jQuery AJAX)
- database.sql        manual database script (optional)

## API
- GET    /api/portfolio             all data (profile, skills, education, experience, projects)
- POST   /api/profile               first-time setup (with optional photo)
- PUT    /api/profile               edit profile / change or remove photo
- GET    /api/profile/image         the profile photo from MySQL
- POST / PUT / DELETE  /api/skills, /api/education, /api/experience  (/:id for PUT and DELETE)
- POST / PUT / DELETE  /api/projects  (with optional image)
- GET    /api/projects/:id/image    the project image from MySQL
- DELETE /api/portfolio             delete everything and start again
