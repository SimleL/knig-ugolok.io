const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Создаем подключение к базе данных
const db = new sqlite3.Database('./book-catalog.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Подключено к базе данных book-catalog.');
});

// Создаем таблицы, если они не существуют
db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица авторов// AUTOINCREMENT
    db.run(`CREATE TABLE IF NOT EXISTS authors (
        id INTEGER PRIMARY KEY, 
        name TEXT NOT NULL,
        bio TEXT,
        birth_date TEXT,
        death_date TEXT,
        photo TEXT,
        rating REAL DEFAULT 0
    )`);

    // Таблица книг
    db.run(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author_id INTEGER NOT NULL,
        description TEXT,
        published_year INTEGER,
        genre TEXT,
        cover_image TEXT,
        rating REAL DEFAULT 0,
        FOREIGN KEY (author_id) REFERENCES authors(id)
    )`);

    // Таблица отзывов
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Таблица избранного
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (book_id) REFERENCES books(id),
        UNIQUE(user_id, book_id)
    )`);

    // Заполняем базу данных тестовыми данными
    initializeDatabase();
});

function initializeDatabase() {
    // Проверяем, есть ли уже данные в базе
    db.get(`SELECT COUNT(*) as count FROM authors`, (err, row) => {
        if (err) throw err;
        if (row.count === 0) {
            // Добавляем авторов
            const authors = [
                { id: 1, name: "Лев Толстой", bio: "Русский писатель, мыслитель, философ и публицист.", birth_date: "1828-09-09", death_date: "1910-11-20", photo: "tolstoy.jpg" },
                { id: 2, name: "Фёдор Достоевский", bio: "Русский писатель, мыслитель, философ и публицист.", birth_date: "1821-11-11", death_date: "1881-02-09", photo: "dostoevsky.jpg" },
                { id: 3, name: "Антон Чехов", bio: "Русский писатель, драматург, врач.", birth_date: "1860-01-29", death_date: "1904-07-15", photo: "chekhov.jpg" },
                { id: 4, name: "Александр Пушкин", bio: "Русский поэт, драматург и прозаик.", birth_date: "1799-06-06", death_date: "1837-02-10", photo: "pushkin.jpg" },
                { id: 5, name: "Михаил Булгаков", bio: "Русский писатель, драматург, театральный режиссёр и актёр.", birth_date: "1891-05-15", death_date: "1940-03-10", photo: "bulgakov.jpg" },
                { id: 6, name: "Иван Тургенев", bio: "Русский писатель-реалист, поэт, публицист, драматург, переводчик.", birth_date: "1818-11-09", death_date: "1883-09-03", photo: "turgenev.jpg" },
                { id: 7, name: "Николай Гоголь", bio: "Русский прозаик, драматург, поэт, критик, публицист.", birth_date: "1809-04-01", death_date: "1852-03-04", photo: "gogol.jpg" },
                { id: 8, name: "Александр Солженицын", bio: "Русский писатель, драматург, публицист, поэт, общественный и политический деятель.", birth_date: "1918-12-11", death_date: "2008-08-03", photo: "solzhenitsyn.jpg" },
                { id: 9, name: "Владимир Набоков", bio: "Русский и американский писатель, поэт, переводчик, литературовед и энтомолог.", birth_date: "1899-04-22", death_date: "1977-07-02", photo: "nabokov.jpg" },
                { id: 10, name: "Иван Бунин", bio: "Русский писатель, поэт и переводчик.", birth_date: "1870-10-22", death_date: "1953-11-08", photo: "bunin.jpg" }
            ];

            authors.forEach(author => {
                db.run(`INSERT INTO authors (id, name, bio, birth_date, death_date, photo) VALUES (?, ?, ?, ?, ?, ?)`, 
                    [author.id, author.name, author.bio, author.birth_date, author.death_date, author.photo]);
            });

            // Добавляем книги
            const books = [
                { title: "Война и мир", author_id: 1, description: "Роман-эпопея, описывающий русское общество в эпоху войн против Наполеона.", published_year: 1869, genre: "Роман-эпопея", cover_image: "war_and_peace.jpg" },
                { title: "Анна Каренина", author_id: 1, description: "Роман о трагической любви замужней женщины Анны Карениной и блестящего офицера Вронского.", published_year: 1877, genre: "Роман", cover_image: "anna_karenina.jpg" },
                { title: "Преступление и наказание", author_id: 2, description: "Роман о бывшем студенте Родионе Раскольникове, совершившем убийство.", published_year: 1866, genre: "Роман", cover_image: "crime_and_punishment.jpg" },
                { title: "Идиот", author_id: 2, description: "Роман, представляющий собой историю князя Мышкина, человека с доброй душой и открытым сердцем.", published_year: 1869, genre: "Роман", cover_image: "idiot.jpg" },
                { title: "Вишнёвый сад", author_id: 3, description: "Пьеса о вынужденной продаже родового имения.", published_year: 1904, genre: "Драма", cover_image: "cherry_orchard.jpg" },
                { title: "Дама с собачкой", author_id: 3, description: "Рассказ о любви между женатым мужчиной и молодой замужней женщиной.", published_year: 1899, genre: "Рассказ", cover_image: "lady_with_dog.jpg" },
                { title: "Евгений Онегин", author_id: 4, description: "Роман в стихах, одно из самых значительных произведений русской словесности.", published_year: 1833, genre: "Роман в стихах", cover_image: "eugene_onegin.jpg" },
                { title: "Мастер и Маргарита", author_id: 5, description: "Роман, соединяющий в себе сатиру на советскую действительность и философскую притчу.", published_year: 1967, genre: "Роман", cover_image: "master_and_margarita.jpg" },
                { title: "Отцы и дети", author_id: 6, description: "Роман, отражающий идеологический конфликт между либералами и нигилистами.", published_year: 1862, genre: "Роман", cover_image: "fathers_and_sons.jpg" },
                { title: "Мёртвые души", author_id: 7, description: "Поэма, представляющая собой сатирическое изображение российской действительности.", published_year: 1842, genre: "Поэма", cover_image: "dead_souls.jpg" },
                { title: "Архипелаг ГУЛАГ", author_id: 8, description: "Художественно-историческое произведение о репрессиях в СССР.", published_year: 1973, genre: "Историческая проза", cover_image: "gulag_archipelago.jpg" },
                { title: "Лолита", author_id: 9, description: "Роман о трагической страсти взрослого мужчины к двенадцатилетней девочке.", published_year: 1955, genre: "Роман", cover_image: "lolita.jpg" },
                { title: "Господин из Сан-Франциско", author_id: 10, description: "Рассказ о внезапной смерти богатого американца.", published_year: 1915, genre: "Рассказ", cover_image: "gentleman_from_sf.jpg" },
                { title: "Воскресение", author_id: 1, description: "Последний роман Льва Толстого, рассказывающий о судьбе дворянина и крестьянки.", published_year: 1899, genre: "Роман", cover_image: "resurrection.jpg" },
                { title: "Братья Карамазовы", author_id: 2, description: "Последний роман Достоевского, затрагивающий вопросы веры, морали и свободы.", published_year: 1880, genre: "Роман", cover_image: "karamazov_brothers.jpg" },
                { title: "Чайка", author_id: 3, description: "Пьеса о любви и искусстве.", published_year: 1896, genre: "Драма", cover_image: "seagull.jpg" },
                { title: "Капитанская дочка", author_id: 4, description: "Исторический роман о событиях крестьянского восстания под предводительством Пугачёва.", published_year: 1836, genre: "Роман", cover_image: "captains_daughter.jpg" },
                { title: "Собачье сердце", author_id: 5, description: "Повесть о последствиях научного эксперимента по очеловечиванию собаки.", published_year: 1925, genre: "Повесть", cover_image: "dogs_heart.jpg" },
                { title: "Ася", author_id: 6, description: "Повесть о любви между молодым человеком и юной девушкой.", published_year: 1858, genre: "Повесть", cover_image: "asya.jpg" }
            ];

            books.forEach(book => {
                db.run(`INSERT INTO books (title, author_id, description, published_year, genre, cover_image) VALUES (?, ?, ?, ?, ?, ?)`, 
                    [book.title, book.author_id, book.description, book.published_year, book.genre, book.cover_image]);
            });

            console.log("База данных заполнена тестовыми данными.");
        }
    });
}

module.exports = db;