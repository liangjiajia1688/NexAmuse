<?php
/**
 * Articles API
 * Handles CRUD operations for articles
 * 
 * Endpoints:
 * - GET    /api/articles.php          - Get all published articles
 * - GET    /api/articles.php?id=1     - Get single article
 * - POST   /api/articles.php          - Create new article
 * - PUT    /api/articles.php?id=1    - Update article
 * - DELETE /api/articles.php?id=1     - Delete article
 */

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDBConnection();

// Get request parameters
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;
$category = isset($_GET['category']) ? $_GET['category'] : null;
$status = isset($_GET['status']) ? $_GET['status'] : null;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

switch ($method) {
    case 'GET':
        getArticles($pdo, $id, $category, $status, $limit, $offset);
        break;
        
    case 'POST':
        createArticle($pdo);
        break;
        
    case 'PUT':
        updateArticle($pdo, $id);
        break;
        
    case 'DELETE':
        deleteArticle($pdo, $id);
        break;
        
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

/**
 * Get articles - list or single
 */
function getArticles($pdo, $id = null, $category = null, $status = null, $limit = 20, $offset = 0) {
    if ($id) {
        // Get single article
        $stmt = $pdo->prepare("SELECT * FROM articles WHERE id = ?");
        $stmt->execute([$id]);
        $article = $stmt->fetch();
        
        if (!$article) {
            jsonResponse(['error' => 'Article not found'], 404);
        }
        
        // Increment views
        $pdo->prepare("UPDATE articles SET views = views + 1 WHERE id = ?")->execute([$id]);
        
        jsonResponse($article);
    }
    
    // Get list of articles
    $sql = "SELECT * FROM articles WHERE 1=1";
    $params = [];
    
    if ($status) {
        $sql .= " AND status = ?";
        $params[] = $status;
    } else {
        $sql .= " AND status = 'published'";
    }
    
    if ($category) {
        $sql .= " AND category = ?";
        $params[] = $category;
    }
    
    $sql .= " ORDER BY published_at DESC, created_at DESC LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $articles = $stmt->fetchAll();
    
    // Get total count
    $countSql = "SELECT COUNT(*) as total FROM articles WHERE status = 'published'";
    $countStmt = $pdo->query($countSql);
    $total = $countStmt->fetch()['total'];
    
    jsonResponse([
        'articles' => $articles,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset
    ]);
}

/**
 * Create new article
 */
function createArticle($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['title'])) {
        jsonResponse(['error' => 'Title is required'], 400);
    }
    
    // Generate slug from title
    $slug = isset($input['slug']) ? $input['slug'] : strtolower(trim(preg_replace('/[^a-z0-9-]+/', '-', $input['title'])));
    
    // Make slug unique
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM articles WHERE slug LIKE ?");
    $stmt->execute([$slug . '%']);
    $count = $stmt->fetchColumn();
    if ($count > 0) {
        $slug .= '-' . ($count + 1);
    }
    
    $now = date('Y-m-d H:i:s');
    $publishedAt = ($input['status'] ?? 'draft') === 'published' ? $now : null;
    
    $sql = "INSERT INTO articles (title, slug, excerpt, content, category, meta_title, meta_desc, meta_keywords, word_count, seo_score, status, author, source, published_at, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $input['title'],
        $slug,
        $input['excerpt'] ?? '',
        $input['content'] ?? '',
        $input['category'] ?? 'industry',
        $input['meta_title'] ?? $input['title'],
        $input['meta_desc'] ?? $input['excerpt'] ?? '',
        $input['meta_keywords'] ?? '',
        $input['word_count'] ?? 0,
        $input['seo_score'] ?? 0,
        $input['status'] ?? 'draft',
        $input['author'] ?? 'AI Writer',
        $input['source'] ?? 'ai',
        $publishedAt,
        $now
    ]);
    
    $newId = $pdo->lastInsertId();
    
    jsonResponse([
        'success' => true,
        'id' => $newId,
        'slug' => $slug,
        'message' => 'Article created successfully'
    ], 201);
}

/**
 * Update article
 */
function updateArticle($pdo, $id) {
    if (!$id) {
        jsonResponse(['error' => 'Article ID is required'], 400);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        jsonResponse(['error' => 'No data provided'], 400);
    }
    
    // Build update query dynamically
    $allowedFields = ['title', 'slug', 'excerpt', 'content', 'category', 'meta_title', 'meta_desc', 'meta_keywords', 'word_count', 'seo_score', 'status', 'author'];
    $updates = [];
    $params = [];
    
    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            $updates[] = "$field = ?";
            $params[] = $input[$field];
        }
    }
    
    // Handle published_at
    if (isset($input['status']) && $input['status'] === 'published') {
        $updates[] = "published_at = COALESCE(published_at, NOW())";
    }
    
    if (empty($updates)) {
        jsonResponse(['error' => 'No valid fields to update'], 400);
    }
    
    $params[] = $id;
    $sql = "UPDATE articles SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = ?";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    jsonResponse([
        'success' => true,
        'message' => 'Article updated successfully'
    ]);
}

/**
 * Delete article
 */
function deleteArticle($pdo, $id) {
    if (!$id) {
        jsonResponse(['error' => 'Article ID is required'], 400);
    }
    
    $stmt = $pdo->prepare("DELETE FROM articles WHERE id = ?");
    $stmt->execute([$id]);
    
    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Article not found'], 404);
    }
    
    jsonResponse([
        'success' => true,
        'message' => 'Article deleted successfully'
    ]);
}
