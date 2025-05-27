const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;

// Настройка шаблонизатора EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'bookCover') {
            cb(null, 'public/images/book-covers/');
        } else if (file.fieldname === 'authorPhoto') {
            cb(null, 'public/images/author-photos/');
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Подключение к базе данных
const db = new sqlite3.Database('./book-catalog.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Подключено к базе данных book-catalog.');
});

// Главная страница
app.get('/', (req, res) => {
    db.all(`SELECT * FROM books ORDER BY rating DESC LIMIT 5`, [], (err, popularBooks) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Ошибка сервера');
        }
        
        db.all(`SELECT * FROM authors ORDER BY rating DESC LIMIT 5`, [], (err, popularAuthors) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Ошибка сервера');
            }
            
            // Изменяем запрос - сортируем по ID в убывающем порядке
            db.all(`SELECT * FROM books ORDER BY id DESC LIMIT 5`, [], (err, latestBooks) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Ошибка сервера');
                }
                
                res.render('index', { 
                    user: req.session.user,
                    popularBooks: popularBooks,
                    popularAuthors: popularAuthors,
                    latestBooks: latestBooks
                });
            });
        });
    });
});

// Регистрация
app.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/profile');
    }
    res.render('register', { user: req.session.user, error: null });
});

app.post('/register', async (req, res) => {
    if (req.session.user) {
        return res.redirect('/profile');
    }
    
    const { username, email, password } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, 
            [username, email, hashedPassword], function(err) {
                if (err) {
                    return res.render('register', { 
                        user: req.session.user,
                        error: 'Пользователь с таким именем или email уже существует'
                    });
                }
                
                res.redirect('/login');
            });
    } catch (err) {
        console.error(err);
        res.redirect('/register');
    }
});

// Вход
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/profile');
    }
    res.render('login', { user: req.session.user, error: null });
});

app.post('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/profile');
    }
    
    const { username, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) {
            return res.render('login', { 
                user: req.session.user,
                error: 'Неверное имя пользователя или пароль'
            });
        }
        
        try {
            if (await bcrypt.compare(password, user.password)) {
                req.session.user = user;
                res.redirect('/');
            } else {
                res.render('login', { 
                    user: req.session.user,
                    error: 'Неверное имя пользователя или пароль'
                });
            }
        } catch (err) {
            console.error(err);
            res.redirect('/login');
        }
    });
});

// Выход
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Страница книг
app.get('/books', (req, res) => {
    const { search, genre, sort } = req.query;
    let query = `SELECT books.*, authors.name as author_name FROM books JOIN authors ON books.author_id = authors.id`;
    const params = [];
    
    // Фильтрация
    if (search) {
        query += ` WHERE books.title LIKE ?`;
        params.push(`%${search}%`);
    }
    
    if (genre) {
        query += search ? ` AND` : ` WHERE`;
        query += ` books.genre = ?`;
        params.push(genre);
    }
    
    // Сортировка
    switch(sort) {
        case 'title_asc':
            query += ` ORDER BY books.title ASC`;
            break;
        case 'title_desc':
            query += ` ORDER BY books.title DESC`;
            break;
        case 'year_asc':
            query += ` ORDER BY books.published_year ASC`;
            break;
        case 'year_desc':
            query += ` ORDER BY books.published_year DESC`;
            break;
        case 'rating_desc':
        default:
            query += ` ORDER BY books.rating DESC`;
    }
    
    // Получаем книги
    db.all(query, params, (err, books) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Ошибка сервера');
        }
        
        // Получаем список жанров для фильтра
        db.all(`SELECT DISTINCT genre FROM books WHERE genre IS NOT NULL ORDER BY genre`, [], (err, genreRows) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Ошибка сервера');
            }
            
            const genres = genreRows.map(row => row.genre);
            
            res.render('books', { 
                user: req.session.user,
                books: books,
                genres: genres,
                selectedGenre: genre,
                searchQuery: search,
                sortBy: sort || 'rating_desc'
            });
        });
    });
});

// Страница авторов
app.get('/authors', (req, res) => {
    const { search, sort } = req.query;
    let query = `SELECT * FROM authors`;
    const params = [];
    
    // Фильтрация
    if (search) {
        query += ` WHERE name LIKE ?`;
        params.push(`%${search}%`);
    }
    
    // Сортировка
    switch(sort) {
        case 'name_asc':
            query += ` ORDER BY name ASC`;
            break;
        case 'name_desc':
            query += ` ORDER BY name DESC`;
            break;
        case 'rating_desc':
        default:
            query += ` ORDER BY rating DESC`;
    }
    
    db.all(query, params, (err, authors) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Ошибка сервера');
        }
        
        res.render('authors', { 
            user: req.session.user,
            authors: authors,
            searchQuery: search,
            sortBy: sort || 'rating_desc'
        });
    });
});

// Добавление новой книги (форма)
// В маршруте добавления книги
app.get('/books/add', (req, res) => {
    db.all(`SELECT id, name FROM authors ORDER BY name`, [], (err, authors) => {
        if (err || !authors.length) {
            return res.render('add-book', {
                user: req.session.user,
                authors: [],
                error: 'Нет доступных авторов. Сначала добавьте автора.'
            });
        }
        res.render('add-book', { 
            user: req.session.user,
            authors: authors
        });
    });
});

// Добавление новой книги (обработка)
app.post('/books/add', upload.single('bookCover'), (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const { title, author_id, description, published_year, genre } = req.body;
    const cover_image = req.file ? req.file.filename : null;
    
    db.run(`INSERT INTO books (title, author_id, description, published_year, genre, cover_image) VALUES (?, ?, ?, ?, ?, ?)`, 
        [title, author_id, description, published_year, genre, cover_image], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).send('Ошибка при добавлении книги');
            }
            
            res.redirect(`/books/${this.lastID}`);
        });
});

// Добавление нового автора (форма)
app.get('/authors/add', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    res.render('add-author', { user: req.session.user });
});

// Добавление нового автора (обработка)
app.post('/authors/add', upload.single('authorPhoto'), (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const { name, bio, birth_date, death_date } = req.body;
    const photo = req.file ? req.file.filename : null;
    
    db.run(`INSERT INTO authors (name, bio, birth_date, death_date, photo) VALUES (?, ?, ?, ?, ?)`, 
        [name, bio, birth_date, death_date, photo], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).send('Ошибка при добавлении автора');
            }
            
            res.redirect(`/authors/${this.lastID}`);
        });
});

// Детальная страница книги
app.get('/books/:id', (req, res) => {
    const bookId = req.params.id;
    const userId = req.session.user?.id;
    
    // Получаем информацию о книге
    db.get(`
        SELECT books.*, authors.name as author_name, authors.id as author_id 
        FROM books 
        JOIN authors ON books.author_id = authors.id 
        WHERE books.id = ?
    `, [bookId], (err, book) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Ошибка сервера');
        }
        
        if (!book) {
            return res.status(404).send('Книга не найдена');
        }
        
        // Получаем отзывы
        db.all(`
            SELECT reviews.*, users.username 
            FROM reviews JOIN users ON reviews.user_id = users.id 
            WHERE book_id = ? 
            ORDER BY created_at DESC
        `, [bookId], (err, reviews) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Ошибка сервера');
            }
            
            // Проверяем, есть ли книга в избранном у пользователя
            let isFavorite = false;
            if (userId) {
                db.get(`SELECT id FROM favorites WHERE user_id = ? AND book_id = ?`, 
                    [userId, bookId], (err, row) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).send('Ошибка сервера');
                        }
                        
                        isFavorite = !!row;
                        
                        res.render('book-detail', { 
                            user: req.session.user,
                            book: book,
                            reviews: reviews,
                            isFavorite: isFavorite
                        });
                    });
            } else {
                res.render('book-detail', { 
                    user: req.session.user,
                    book: book,
                    reviews: reviews,
                    isFavorite: false
                });
            }
        });
    });
});

// Маршруты
app.get('/', (req, res) => {
    db.all(`SELECT * FROM books ORDER BY rating DESC LIMIT 5`, [], (err, popularBooks) => {
        db.all(`SELECT * FROM authors ORDER BY rating DESC LIMIT 5`, [], (err, popularAuthors) => {
            res.render('index', { 
                user: req.session.user,
                popularBooks: popularBooks,
                popularAuthors: popularAuthors
            });
        });
    });
});

// Маршрут для добавления отзыва с обновлением рейтингов
app.post('/books/:id/reviews', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const { rating, comment } = req.body;
    const bookId = req.params.id;
    const userId = req.session.user.id;

    try {
        // Добавляем отзыв
        await new Promise((resolve, reject) => {
            db.run(`INSERT INTO reviews (book_id, user_id, rating, comment) VALUES (?, ?, ?, ?)`, 
                [bookId, userId, rating, comment], function(err) {
                    if (err) return reject(err);
                    resolve();
                });
        });

        // Обновляем рейтинг книги
        await updateBookRating(bookId);
        
        // Получаем автора книги и обновляем его рейтинг
        const book = await new Promise((resolve, reject) => {
            db.get(`SELECT author_id FROM books WHERE id = ?`, [bookId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (book) {
            await updateAuthorRating(book.author_id);
        }

        res.redirect(`/books/${bookId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка при добавлении отзыва');
    }
});

// Функция обновления рейтинга книги
async function updateBookRating(bookId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT AVG(rating) as avgRating FROM reviews WHERE book_id = ?`, 
            [bookId], (err, row) => {
                if (err) return reject(err);
                
                const newRating = row.avgRating || 0;
                db.run(`UPDATE books SET rating = ? WHERE id = ?`, 
                    [newRating, bookId], (err) => {
                        if (err) return reject(err);
                        console.log(`Updated book ${bookId} rating to ${newRating}`);
                        resolve(newRating);
                    });
            });
    });
}

// Функция обновления рейтинга автора
async function updateAuthorRating(authorId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT AVG(rating) as avgRating FROM books WHERE author_id = ? AND rating > 0`, 
            [authorId], (err, row) => {
                if (err) return reject(err);
                
                const newRating = row.avgRating || 0;
                db.run(`UPDATE authors SET rating = ? WHERE id = ?`, 
                    [newRating, authorId], (err) => {
                        if (err) return reject(err);
                        console.log(`Updated author ${authorId} rating to ${newRating}`);
                        resolve(newRating);
                    });
            });
    });
}

// Добавление/удаление из избранного
app.post('/books/:id/favorite', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Необходима авторизация');
    }
    
    const bookId = req.params.id;
    const userId = req.session.user.id;
    const action = req.body.action;
    
    if (action === 'add') {
        db.run(`INSERT OR IGNORE INTO favorites (user_id, book_id) VALUES (?, ?)`, 
            [userId, bookId], function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Ошибка сервера');
                }
                res.sendStatus(200);
            });
    } else if (action === 'remove') {
        db.run(`DELETE FROM favorites WHERE user_id = ? AND book_id = ?`, 
            [userId, bookId], function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Ошибка сервера');
                }
                res.sendStatus(200);
            });
    } else {
        res.status(400).json({ error: 'Неверный запрос' });
    }
});

// Детальная страница автора
app.get('/authors/:id', (req, res) => {
    const authorId = req.params.id;
    
    // Получаем информацию об авторе
    db.get(`
        SELECT authors.*, 
        (SELECT COUNT(*) FROM books WHERE author_id = authors.id) as books_count
        FROM authors 
        WHERE authors.id = ?
        `, [authorId], (err, author) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Ошибка сервера');
        }
        
        if (!author) {
            return res.status(404).send('Автор не найден');
        }
        
        // Получаем книги автора
        db.all(`SELECT * FROM books WHERE author_id = ? ORDER BY rating DESC`, [authorId], (err, books) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Ошибка сервера');
            }
            
            res.render('author-detail', { 
                user: req.session.user,
                author: author,
                books: books
            });
        });
    });
});

// Профиль пользователя
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const userId = req.session.user.id;
    
    // Получаем избранные книги пользователя
    db.all(`
        SELECT books.*, authors.name as author_name 
        FROM favorites 
        JOIN books ON favorites.book_id = books.id 
        JOIN authors ON books.author_id = authors.id 
        WHERE favorites.user_id = ?
    `, [userId], (err, favoriteBooks) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Ошибка сервера');
        }
        

        // Получаем отзывы пользователя
        db.all(`
            SELECT reviews.*, books.title as book_title 
            FROM reviews 
            JOIN books ON reviews.book_id = books.id 
            WHERE reviews.user_id = ?
            ORDER BY reviews.created_at DESC
        `, [userId], (err, userReviews) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Ошибка сервера');
            }
            
            res.render('profile', { 
                user: req.session.user,
                favoriteBooks: favoriteBooks,
                userReviews: userReviews
            });
        });
    });
});

// Обработка 404 ошибки
app.use((req, res) => {
    res.status(404).render('404', { user: req.session.user });
});

// Обработка 500 ошибки
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('500', { user: req.session.user });
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});