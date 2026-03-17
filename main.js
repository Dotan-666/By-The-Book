// --- Configuration & Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyCVC-CQK_umSHnPT5FOvvclut_WN2Ll0to",
    authDomain: "by-the-book-3120c.firebaseapp.com",
    projectId: "by-the-book-3120c",
    storageBucket: "by-the-book-3120c.firebasestorage.app",
    messagingSenderId: "795787841752",
    appId: "1:795787841752:web:52b7657d0ffe31739847ad",
    measurementId: "G-7EC8YT427C"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
let cachedBooks = null;

// --- App Startup ---
async function initApp() {
    console.log("Dr. Meow is starting the engine...");

    firebase.auth().onAuthStateChanged(user => {
        if (user && typeof updateSidebarForUser === 'function') {
            updateSidebarForUser(user);
        }
    });

    window.addEventListener('click', (event) => {
        const tooltip = document.getElementById('authTooltip');
        if (tooltip) tooltip.style.display = 'none';
    });

    const hash = window.location.hash.replace('#', '').split('?')[0] || 'home';
    navigateTo(hash);
}

window.addEventListener('DOMContentLoaded', initApp);

// --- Routing System ---
async function navigateTo(pageName) {
    try {
        const cleanPageName = pageName.split('?')[0]; 
        const response = await fetch(`${cleanPageName}.html`);
        if (!response.ok) throw new Error(`Page ${cleanPageName} missing`);
        
        const content = await response.text();
        const container = document.getElementById('load-page');
        container.innerHTML = content;
        
        window.history.pushState({}, '', `#${pageName}`);

        setTimeout(() => {
            if (typeof loadSiteData === 'function') {
                loadSiteData(cleanPageName);
            }
        }, 50); 

    } catch (err) {
        console.error("Meow! Routing error:", err);
        if (pageName !== 'home') navigateTo('home');
    }
}

// --- Data Management & Logic ---
async function loadSiteData(pageName) {
    if (!cachedBooks) {
        console.log("Dr. Meow is fetching data for the first time...");
        try {
            const snapshot = await db.collection("books").get();
            cachedBooks = [];
            snapshot.forEach(doc => {
                cachedBooks.push({ id: doc.id, ...doc.data() });
            });
        } catch (error) {
            console.error("Cloud Error:", error);
            return;
        }
    }

    switch (pageName) {
        case 'home':
            showRandomBook(cachedBooks);
            displayBooksByCategory(cachedBooks);
            break;

        case 'book':
            loadBookDetails();
            break;
    }

    if (typeof refreshUserStats === 'function') refreshUserStats();
}

// --- HomePage Functions ---
function showRandomBook(books) {
    const randomIndex = Math.floor(Math.random() * books.length);
    const book = books[randomIndex];
    const titleEl = document.getElementById('rec-full');
    if (!titleEl) return; 

    titleEl.innerText = (book.series ? book.series + ": " : "") + book.title;
    document.getElementById('rec-author').innerText = "By: " + book.author;
    document.getElementById('rec-description').innerText = book.description;
    document.getElementById('rec-rating').innerText = "Rating: " + (book.paws || "N/A");

    const img = document.getElementById('rec-img');
    if (img) {
        img.src = book.image;
        img.style.display = "block";
    }

    const btn = document.getElementById('rec-link-btn');
    if (btn) {
        btn.onclick = () => {
            window.location.hash = `book?id=${book.id}`;
            navigateTo('book');
        };
    }
}

function displayBooksByCategory(books) {
    const popularContainer = document.getElementById('popular-container');
    const newContainer = document.getElementById('new-container');
    if (!popularContainer || !newContainer) return;

    popularContainer.innerHTML = '<div style="width: 100%;"><span class="badge">Most Popular</span></div>';
    newContainer.innerHTML = '<div style="width: 100%;"><span class="badge">You Might Also Like</span></div>';

    books.forEach((book) => {
        const bookHTML = `
            <div class="book-item">
                <a href="#book?id=${book.id}" onclick="setTimeout(() => navigateTo('book'), 10)">
                    <img src="${book.image}" class="book-img">
                </a>
                <h3>${book.title}</h3>
                <a href="#book?id=${book.id}" onclick="setTimeout(() => navigateTo('book'), 10)" class="abadge">VIEW BOOK</a>
            </div>`;
        
        if (book.status === "popular") popularContainer.innerHTML += bookHTML;
        else if (book.status === "new") newContainer.innerHTML += bookHTML;
    });
}

// --- BookDetails Functions ---
function getBookIdFromURL() {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1]);
    return params.get('id');
}

async function loadBookDetails() {
    const id = getBookIdFromURL();
    if (!id) return;

    try {
        const doc = await db.collection("books").doc(id).get();
        if (!doc.exists) return;

        const book = doc.data();
        document.getElementById('rec-book-name').innerText = book.title;
        document.getElementById('rec-author').innerHTML = "By: " + book.author;
        document.getElementById('rec-summary').innerText = book.summary || book.description;
        document.getElementById('book-image').src = book.image;

        if (book.series) {
            const seriesEl = document.getElementById('rec-series');
            seriesEl.innerText = book.series + " series";
            seriesEl.style.display = "inline-block";
            loadRelatedBySeries(book.series, id);
        }
        
        if (book.tags) {
            const tagsContainer = document.getElementById('rec-tags');
            tagsContainer.innerHTML = '';
            book.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.innerText = tag;
                tagsContainer.appendChild(span);
            });
            loadRelatedByTags(book.tags, id);
        }
    } catch (e) { console.error(e); }
}

async function loadRelatedBySeries(seriesName, currentId) {
    const container = document.getElementById('otherInSeries');
    if (!container) return;
    const snap = await db.collection("books").where("series", "==", seriesName).limit(5).get();
    renderSmallCards(container, snap, currentId, "More in the Series");
}

async function loadRelatedByTags(tags, currentId) {
    const container = document.getElementById('relatedBooks');
    if (!container || !tags) return;
    const snap = await db.collection("books").where("tags", "array-contains-any", tags.slice(0, 10)).limit(6).get();
    renderSmallCards(container, snap, currentId, "You Might Also Like");
}

function renderSmallCards(container, snapshot, currentId, title) {
    let html = `<div class="related-section"><span class="abadge">${title}</span><div class="cards-grid">`;
    snapshot.forEach(doc => {
        if (doc.id !== currentId) {
            const b = doc.data();
            html += renderSmallBookCard(doc.id, b);
        }
    });
    html += '</div></div>';
    container.innerHTML = html;
}

function renderSmallBookCard(id, book) {
    return `
        <div class="small-card">
            <a href="#book?id=${id}" onclick="setTimeout(() => navigateTo('book'), 10)">
                <img src="${book.image}" class="book-img">
                <p>${book.title}</p>
            </a>
        </div>`;
}

function toggleAuthTooltip(event) {
    if (event) event.stopPropagation();
    const tooltip = document.getElementById('authTooltip');
    if (tooltip) tooltip.style.display = (tooltip.style.display === 'block') ? 'none' : 'block';
}