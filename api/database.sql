-- NexAmuse Database Setup
-- Run this in your MySQL database (phpMyAdmin)

-- Create database
CREATE DATABASE IF NOT EXISTS nexamuse_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nexamuse_db;

-- Articles table
CREATE TABLE IF NOT EXISTS `articles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `excerpt` TEXT,
  `content` LONGTEXT,
  `category` VARCHAR(100) DEFAULT 'industry',
  `meta_title` VARCHAR(255) DEFAULT '',
  `meta_desc` VARCHAR(500) DEFAULT '',
  `meta_keywords` VARCHAR(500) DEFAULT '',
  `word_count` INT(11) DEFAULT 0,
  `seo_score` INT(11) DEFAULT 0,
  `status` ENUM('draft','published') DEFAULT 'draft',
  `featured` TINYINT(1) DEFAULT 0,
  `views` INT(11) DEFAULT 0,
  `author` VARCHAR(100) DEFAULT 'AI Writer',
  `source` ENUM('manual','ai') DEFAULT 'ai',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `published_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `status` (`status`),
  KEY `category` (`category`),
  KEY `published_at` (`published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products table (for future use)
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) DEFAULT 'arcade',
  `description` TEXT,
  `price` DECIMAL(10,2) DEFAULT 0,
  `supplier_id` INT(11) DEFAULT NULL,
  `status` ENUM('active','inactive') DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Members table
CREATE TABLE IF NOT EXISTS `members` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `company` VARCHAR(200) DEFAULT '',
  `phone` VARCHAR(50) DEFAULT '',
  `role` ENUM('user','supplier','admin') DEFAULT 'user',
  `level` VARCHAR(50) DEFAULT 'free',
  `points` INT(11) DEFAULT 0,
  `status` ENUM('active','pending','banned') DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email` (`email`),
  KEY `role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Settings table
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT,
  PRIMARY KEY (`id`),
  KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default settings
INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES 
('site_name', 'NexAmuse Global'),
('site_url', 'http://43.153.114.121'),
('admin_email', 'admin@nexamuse.com');

-- Demo admin user (password: admin123)
INSERT INTO `members` (`name`, `email`, `password`, `role`, `status`, `level`) VALUES 
('Administrator', 'admin@nexamuse.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active', 'vip');
