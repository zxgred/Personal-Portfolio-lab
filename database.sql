-- Personal Portfolio database for XAMPP (MySQL / MariaDB)
-- The server also creates all of this automatically on first start.
-- Manual option: phpMyAdmin > Import tab > choose this file > Go
CREATE DATABASE IF NOT EXISTS portfolio_db CHARACTER SET utf8mb4;
USE portfolio_db;

-- 1. Profile (only ever one row, id = 1). The photo is stored inside MySQL.
CREATE TABLE IF NOT EXISTS profile (
  id INT UNSIGNED NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  title VARCHAR(100) NOT NULL,
  tagline VARCHAR(255) NOT NULL DEFAULT '',
  about TEXT NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  location VARCHAR(100) NOT NULL DEFAULT '',
  github VARCHAR(255) NOT NULL DEFAULT '',
  linkedin VARCHAR(255) NOT NULL DEFAULT '',
  image LONGBLOB NULL,
  image_type VARCHAR(50) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 2. Skills
CREATE TABLE IF NOT EXISTS skills (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  level TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 3. Education
CREATE TABLE IF NOT EXISTS education (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  degree VARCHAR(150) NOT NULL,
  institution VARCHAR(150) NOT NULL,
  start_year VARCHAR(4) NOT NULL,
  end_year VARCHAR(4) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 4. Experience
CREATE TABLE IF NOT EXISTS experience (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role VARCHAR(150) NOT NULL,
  company VARCHAR(150) NOT NULL,
  start_year VARCHAR(4) NOT NULL,
  end_year VARCHAR(4) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 5. Projects (each project can have its own image)
CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  tech VARCHAR(255) NOT NULL DEFAULT '',
  link VARCHAR(255) NOT NULL DEFAULT '',
  image LONGBLOB NULL,
  image_type VARCHAR(50) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- No sample data on purpose: you enter your own information when you
-- first open the website.
