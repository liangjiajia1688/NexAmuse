<?php
/**
 * Database Installation Script
 * 
 * Usage: Upload to server and visit: http://your-domain.com/api/install.php
 * 
 * This script will:
 * 1. Create the database if not exists
 * 2. Create all required tables
 * 3. Insert default data
 */

require_once 'config.php';

$message = '';
$error = '';

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Connect without database first
        $pdo = new PDO(
            "mysql:host={$db_config['host']}",
            $db_config['username'],
            $db_config['password'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        
        // Create database
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$db_config['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `{$db_config['database']}`");
        
        // Create articles table
        $pdo->exec("
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // Create settings table
        $pdo->exec("
        CREATE TABLE IF NOT EXISTS `settings` (
          `id` INT(11) NOT NULL AUTO_INCREMENT,
          `setting_key` VARCHAR(100) NOT NULL UNIQUE,
          `setting_value` TEXT,
          PRIMARY KEY (`id`),
          KEY `setting_key` (`setting_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // Insert default settings
        $pdo->exec("INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`) VALUES 
            ('site_name', 'NexAmuse Global'),
            ('site_url', 'http://43.153.114.121'),
            ('admin_email', 'admin@nexamuse.com')
        ");
        
        $message = "✅ Database installed successfully! Tables created: articles, settings";
        
    } catch (PDOException $e) {
        $error = "❌ Error: " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Install - NexAmuse</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: #1e1e2f;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
        }
        h1 { color: #c9a227; font-size: 24px; margin-bottom: 8px; }
        p { color: #9aa0b4; margin-bottom: 24px; line-height: 1.6; }
        .form-group { margin-bottom: 20px; }
        label { display: block; color: #e2e8f0; margin-bottom: 8px; font-weight: 500; }
        input { 
            width: 100%; 
            padding: 12px 16px; 
            background: #111827; 
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            color: #e2e8f0;
            font-size: 14px;
        }
        input:focus { outline: none; border-color: #c9a227; }
        .btn {
            width: 100%;
            padding: 14px 24px;
            background: linear-gradient(135deg, #c9a227, #f5d06e);
            border: none;
            border-radius: 8px;
            color: #0a0e1a;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .btn:hover { transform: translateY(-2px); }
        .message { 
            padding: 16px; 
            border-radius: 8px; 
            margin-bottom: 24px; 
            font-size: 14px;
        }
        .success { background: rgba(86, 171, 47, 0.1); border: 1px solid rgba(86, 171, 47, 0.3); color: #56ab2f; }
        .error { background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3); color: #f87171; }
        .info { background: rgba(201, 162, 39, 0.1); border: 1px solid rgba(201, 162, 39, 0.3); color: #c9a227; }
        code { background: #111827; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
        .step { margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
        .step h3 { color: #e2e8f0; font-size: 14px; margin-bottom: 12px; }
        .step ol { color: #9aa0b4; font-size: 13px; padding-left: 20px; line-height: 2; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🗄️ NexAmuse Database Setup</h1>
        <p>Install the database to enable AI article generation and frontend features.</p>
        
        <?php if ($message): ?>
            <div class="message success"><?php echo $message; ?></div>
        <?php endif; ?>
        
        <?php if ($error): ?>
            <div class="message error"><?php echo $error; ?></div>
        <?php endif; ?>
        
        <?php if (!$message): ?>
            <form method="POST">
                <div class="form-group">
                    <label>Database Host</label>
                    <input type="text" name="host" value="<?php echo $db_config['host']; ?>" readonly>
                </div>
                <div class="form-group">
                    <label>Database Username</label>
                    <input type="text" name="username" value="<?php echo $db_config['username']; ?>" readonly>
                </div>
                <div class="form-group">
                    <label>Database Name</label>
                    <input type="text" name="database" value="<?php echo $db_config['database']; ?>" readonly>
                </div>
                <button type="submit" class="btn">🚀 Install Database</button>
            </form>
        <?php else: ?>
            <div class="message info">
                <strong>Next Steps:</strong><br>
                1. Go to <a href="admin/articles-ai.html" style="color:#c9a227">Admin → AI Writer</a><br>
                2. Generate and publish articles<br>
                3. Visit homepage to see AI articles
            </div>
        <?php endif; ?>
        
        <div class="step">
            <h3>📝 Manual Setup (Alternative)</h3>
            <ol>
                <li>Open phpMyAdmin in 宝塔面板</li>
                <li>Create database: <code>nexamuse_db</code></li>
                <li>Import <code>api/database.sql</code></li>
                <li>Edit <code>api/config.php</code> with your credentials</li>
            </ol>
        </div>
    </div>
</body>
</html>
