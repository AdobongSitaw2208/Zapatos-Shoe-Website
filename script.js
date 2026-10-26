/* =====================================================================
   ZOPATOS – script.js
   ---------------------------------------------------------------------
   JavaScript features in this file:
     1. Form validation ........ login, sign up, checkout, contact
     2. Interactive navigation . active link highlight, mobile menu,
                                 sticky-header shadow, back-to-top button
     3. Dynamic content ........ product filter / search / sort, slide-out
                                 cart, show/hide login & sign-up sections,
                                 toast notifications, order pop-up
     4. Calculations ........... cart subtotal, promo discount,
                                 delivery fee, order total
     5. Local storage .......... cart, user accounts, login session,
                                 "remember me", orders, contact messages

     Event handlers used: click, submit, input, change, blur, keydown,
                          scroll, error
     ===================================================================== */

'use strict';

/* =====================================================================
   SECTION 1: CONSTANTS, SHORTCUTS AND HELPER FUNCTIONS
   ===================================================================== */

// Keys used to save data in the browser's localStorage
const STORAGE_KEYS = {
    cart: 'zopatosCart',
    promo: 'zopatosPromo',
    users: 'zopatosUsers',
    currentUser: 'zopatosCurrentUser',
    rememberedEmail: 'zopatosRememberedEmail',
    orders: 'zopatosOrders',
    messages: 'zopatosMessages'
};

// Valid promo codes and the discount rate each one gives
const PROMO_CODES = {
    ZOPATOS10: 0.10,   // 10% off
    STEP20: 0.20,      // 20% off
    SAVE30: 0.30       // 30% off
};

const DELIVERY_FEE = 150;          // flat delivery fee in pesos
const FREE_DELIVERY_MIN = 5000;    // orders at or above this get free delivery
const MAX_QTY = 10;                // max quantity per cart item

// Used if a product image fails to load (e.g. a missing local file)
// FIX: corrected the broken image URL (it was missing a character)
const FALLBACK_IMAGE =
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80';

// Shortcut for document.getElementById()
const $ = (id) => document.getElementById(id);

/* ---------- localStorage helpers (wrapped in try/catch so the page
   never crashes if storage is blocked or the data is corrupted) ---------- */

// Read a JSON value from localStorage, or return the fallback
function loadData(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
}

// Save a value to localStorage as JSON
function saveData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('Could not save to localStorage:', error);
    }
}

// Remove a key from localStorage
function removeData(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('Could not remove from localStorage:', error);
    }
}

/* ---------- Formatting helpers ---------- */

// 2499 -> "₱2,499"
function formatPeso(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH');
}

// "₱2,499" -> 2499
function parsePrice(text) {
    return Number(String(text).replace(/[^0-9.]/g, ''));
}

// Turn "Air Runner X1" into "air-runner-x1" (used for cart item ids)
function slugify(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Prevent special characters from breaking the HTML we build in strings
function escapeHTML(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

// Smoothly scroll to a section by its id
function scrollToSection(id) {
    const section = $(id);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

/* ---------- Toast notification (small message in the corner) ---------- */
function showToast(message, type = 'success') {
    const container = $('toast-container');
    const toast = document.createElement('div');

    // Pick an icon depending on the type of message
    let icon = 'fa-circle-check';
    if (type === 'error') {
        icon = 'fa-circle-exclamation';
    } else if (type === 'info') {
        icon = 'fa-circle-info';
    }

    toast.className = 'toast ' + type;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    // Slide in, then slide out and remove after a short time
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}


/* =====================================================================
   SECTION 2: FORM VALIDATION
   Every input with a data-rule="..." attribute is checked by one of the
   validator functions below. Each validator returns an error message,
   or an empty string when the value is valid.
   ===================================================================== */

const VALIDATORS = {
    // Letters, spaces, apostrophes, hyphens and dots only
    name(value) {
        if (!value) return 'This field is required.';
        if (!/^[A-Za-zÀ-ÿ.'\- ]{2,}$/.test(value)) {
            return 'Enter a valid name (letters only, at least 2 characters).';
        }
        return '';
    },

    // Basic email format: something@something.domain
    email(value) {
        if (!value) return 'Email address is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
            return 'Enter a valid email address (e.g., juan@email.com).';
        }
        return '';
    },

    // At least 8 characters with at least one letter and one number
    password(value) {
        if (!value) return 'Password is required.';
        if (value.length < 8) return 'Password must be at least 8 characters.';
        if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
            return 'Password must contain both letters and numbers.';
        }
        return '';
    },

    loginPassword(value) {
        if (!value) return 'Password is required.';
        if (value.length < 6) return 'Password must be at least 6 characters.';
        return '';
    },

    // Must match the sign-up password field
    confirm(value) {
        if (!value) return 'Please confirm your password.';
        if (value !== $('signup-password').value) return 'Passwords do not match.';
        return '';
    },

    required(value) {
        return value ? '' : 'This field is required.';
    },

    // Philippine mobile number: 11 digits starting with 09
    phone(value) {
        if (!value) return 'Phone number is required.';
        const digits = value.replace(/[\s-]/g, '');
        if (!/^09\d{9}$/.test(digits)) {
            return 'Use an 11-digit mobile number starting with 09 (e.g., 09171234567).';
        }
        return '';
    },

    gcash(value) {
        if (!value) return 'GCash number is required.';
        const digits = value.replace(/\D/g, '');
        if (!/^09\d{9}$/.test(digits)) {
            return 'Use a valid 11-digit GCash number starting with 09.';
        }
        return '';
    },

    address(value) {
        if (!value) return 'Delivery address is required.';
        if (value.length < 10) return 'Please enter your complete address (at least 10 characters).';
        return '';
    },

    message(value) {
        if (!value) return 'Please write a message.';
        if (value.length < 10) return 'Your message must be at least 10 characters.';
        return '';
    },

    cardNumber(value) {
        const digits = value.replace(/\D/g, '');
        if (!digits) return 'Card number is required.';
        if (digits.length < 13 || digits.length > 19) {
            return 'Enter a valid card number.';
        }
        return '';
    },

    cardExpiry(value) {
        if (!value) return 'Expiry date is required.';
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) {
            return 'Use the format MM/YY.';
        }

        const [month, year] = value.split('/').map(Number);
        const expiryDate = new Date(2000 + year, month, 0, 23, 59, 59, 999);
        const now = new Date();

        if (expiryDate < now) {
            return 'This card has expired.';
        }
        return '';
    },

    cardCvv(value) {
        const digits = value.replace(/\D/g, '');
        if (!digits) return 'CVV is required.';
        if (digits.length < 3 || digits.length > 4) {
            return 'Enter a valid CVV.';
        }
        return '';
    }
};

// Show or clear the error message under one input
function setFieldError(field, errorText) {
    const group = field.closest('.form-group');
    let errorEl = group && group.querySelector('.error-msg');

    // Create the error element the first time it is needed
    if (group && !errorEl) {
        errorEl = document.createElement('small');
        errorEl.className = 'error-msg';
        group.appendChild(errorEl);
    }

    if (!group || !errorEl) return;

    errorEl.textContent = errorText;
    field.classList.toggle('invalid', errorText !== '');
    field.classList.toggle('valid', errorText === '' && field.value !== '');
}

// Validate a single field. Returns true when valid.
function validateField(field) {
    if (!field || !field.dataset || !field.dataset.rule) return true;

    const rule = field.dataset.rule;
    const validator = VALIDATORS[rule];
    if (!validator) return true;

    // Passwords keep their spaces; everything else is trimmed
    const value = field.type === 'password' ? field.value : field.value.trim();
    const errorText = validator(value);
    setFieldError(field, errorText);
    return errorText === '';
}

// Validate every [data-rule] field inside a form. Returns true when all pass.
function validateForm(form) {
    let allValid = true;
    let firstInvalid = null;

    form.querySelectorAll('[data-rule]').forEach((field) => {
        // FIX: skip fields inside a hidden panel (e.g. the GCash / card
        // fields when another payment method is selected). Before, these
        // hidden empty fields always failed and blocked "Place Order".
        if (field.closest('[hidden]')) return;

        if (!validateField(field)) {
            allValid = false;
            if (!firstInvalid) firstInvalid = field;
        }
    });

    // Move the cursor to the first problem so the user can fix it
    if (firstInvalid) firstInvalid.focus();
    return allValid;
}

// Re-check fields while the user types / leaves a field
function enableLiveValidation(form) {
    form.querySelectorAll('[data-rule]').forEach((field) => {
        // blur = the user leaves the field
        field.addEventListener('blur', () => {
            if (field.value !== '' || field.classList.contains('invalid')) {
                validateField(field);
            }
        });

        // input = the user types; only re-check fields already marked
        field.addEventListener('input', () => {
            if (field.classList.contains('invalid') || field.classList.contains('valid')) {
                validateField(field);
            }
        });
    });
}

// Remove all error/valid styling from a form
function resetFormState(form) {
    form.querySelectorAll('.invalid, .valid').forEach((el) => el.classList.remove('invalid', 'valid'));
    form.querySelectorAll('.error-msg').forEach((el) => { el.textContent = ''; });
}

// Show a success/error box inside a form (pass '' to hide it)
function showFormMessage(element, text, type) {
    element.textContent = text;
    element.className = 'form-message ' + (type || '');
    element.hidden = text === '';
}


/* =====================================================================
   SECTION 3: USER ACCOUNTS (sign up, log in, log out)
   Accounts and the current session are saved in localStorage.
   NOTE: storing plain-text passwords is only acceptable for a school
   demo. A real website must hash passwords on a server.
   ===================================================================== */

function getCurrentUser() {
    return loadData(STORAGE_KEYS.currentUser, null);
}

// Show or hide parts of the page depending on login status
function updateAuthUI() {
    const user = getCurrentUser();
    const loggedIn = user !== null;

    // Dynamic content: hide the login/sign-up sections once logged in
    $('login').hidden = loggedIn;
    $('signup').hidden = loggedIn;
    $('login-btn').hidden = loggedIn;
    $('signup-btn').hidden = loggedIn;
    $('user-greeting').hidden = !loggedIn;
    $('logout-btn').hidden = !loggedIn;

    if (loggedIn) {
        $('user-name').textContent = user.firstName;
        $('hero-welcome').textContent = 'WELCOME BACK, ' + user.firstName.toUpperCase();

        // Pre-fill forms with the saved user data (only if still empty)
        if (!$('checkout-name').value) $('checkout-name').value = user.firstName + ' ' + user.lastName;
        if (!$('contact-name').value) $('contact-name').value = user.firstName + ' ' + user.lastName;
        if (!$('contact-email').value) $('contact-email').value = user.email;
    } else {
        $('hero-welcome').textContent = 'WELCOME TO ZOPATOS';
    }
}

// Pre-fill the login email if "Remember me" was used before
function loadRememberedEmail() {
    const savedEmail = loadData(STORAGE_KEYS.rememberedEmail, '');
    if (savedEmail) {
        $('login-email').value = savedEmail;
        $('remember-me').checked = true;
    }
}

// SIGN UP form submit
function handleSignup(event) {
    event.preventDefault();
    const form = event.target;
    const messageBox = $('signup-message');

    if (!validateForm(form)) {
        showFormMessage(messageBox, 'Please fix the highlighted fields.', 'error');
        return;
    }

    const users = loadData(STORAGE_KEYS.users, []);
    const email = $('signup-email').value.trim().toLowerCase();

    // Do not allow two accounts with the same email
    if (users.some((user) => user.email === email)) {
        showFormMessage(messageBox, 'An account with this email already exists. Please log in instead.', 'error');
        return;
    }

    const newUser = {
        firstName: $('signup-first').value.trim(),
        lastName: $('signup-last').value.trim(),
        email: email,
        password: $('signup-password').value
    };

    users.push(newUser);
    saveData(STORAGE_KEYS.users, users);

    // Log the new user in right away (the password is not kept in the session)
    saveData(STORAGE_KEYS.currentUser, {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email
    });

    form.reset();
    resetFormState(form);
    showFormMessage(messageBox, '', '');
    updateAuthUI();
    showToast('Account created! Welcome, ' + newUser.firstName + '.');
    scrollToSection('products');
}

// LOG IN form submit
function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const messageBox = $('login-message');

    if (!validateForm(form)) {
        showFormMessage(messageBox, 'Please fix the highlighted fields.', 'error');
        return;
    }

    const email = $('login-email').value.trim().toLowerCase();
    const password = $('login-password').value;
    const users = loadData(STORAGE_KEYS.users, []);

    // Look for an account with a matching email AND password
    const matchedUser = users.find((user) => user.email === email && user.password === password);

    if (!matchedUser) {
        showFormMessage(messageBox, 'Incorrect email or password. Please try again.', 'error');
        return;
    }

    saveData(STORAGE_KEYS.currentUser, {
        firstName: matchedUser.firstName,
        lastName: matchedUser.lastName,
        email: matchedUser.email
    });

    // "Remember me" saves the email so it is pre-filled next visit
    if ($('remember-me').checked) {
        saveData(STORAGE_KEYS.rememberedEmail, email);
    } else {
        removeData(STORAGE_KEYS.rememberedEmail);
    }

    form.reset();
    resetFormState(form);
    showFormMessage(messageBox, '', '');
    loadRememberedEmail();
    updateAuthUI();
    showToast('Welcome back, ' + matchedUser.firstName + '!');
    scrollToSection('products');
}

// LOG OUT button click
function handleLogout() {
    removeData(STORAGE_KEYS.currentUser);
    updateAuthUI();
    showToast('You have been logged out.', 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


/* =====================================================================
   SECTION 4: PRODUCTS (size picker, filter, search, sort)
   ===================================================================== */

// One object per product card, built once from the HTML
const products = [];

// Current filter settings
const filterState = {
    category: 'ALL',
    search: '',
    sort: 'default'
};

// Read each product card in the HTML and store its data in the products array
function initProducts() {
    const cards = document.querySelectorAll('.product-card');

    cards.forEach((card, index) => {
        const sizeText = card.querySelector('.details span').textContent;   // e.g. "Size: 6-12"
        const sizeMatch = sizeText.match(/(\d+)\s*-\s*(\d+)/);
        const minSize = sizeMatch ? Number(sizeMatch[1]) : 6;
        const maxSize = sizeMatch ? Number(sizeMatch[2]) : 12;

        const product = {
            card: card,
            index: index,
            name: card.querySelector('h3').textContent.trim(),
            category: card.querySelector('.category').textContent.trim().toUpperCase(),
            price: parsePrice(card.querySelector('.price').textContent),
            searchText: (card.querySelector('h3').textContent + ' ' +
                         card.querySelector('.category').textContent + ' ' +
                         card.querySelector('.details').textContent).toLowerCase()
        };
        products.push(product);

        // Build the size drop-down using a loop
        let sizeOptions = '<option value="">Select size</option>';
        for (let size = minSize; size <= maxSize; size++) {
            sizeOptions += `<option value="${size}">Size ${size}</option>`;
        }

        // Insert the size picker above the buttons
        const picker = document.createElement('div');
        picker.className = 'size-picker';
        picker.innerHTML =
            `<label for="size-${index}">Size</label>` +
            `<select id="size-${index}">${sizeOptions}</select>`;
        card.querySelector('.product-buttons').before(picker);

        // If the image is missing, show a fallback picture
        const image = card.querySelector('img');
        const useFallback = () => { image.src = card.dataset.fallback || FALLBACK_IMAGE; };
        image.addEventListener('error', useFallback, { once: true });
        if (image.complete && image.naturalWidth === 0) {
            useFallback();
        }
    });
}

// Show/hide and re-order product cards based on the current filter settings
function applyProductFilters() {
    const grid = $('product-grid');
    const searchTerm = filterState.search.toLowerCase();

    // 1) Decide which products match the category + search
    const visibleProducts = products.filter((product) => {
        const matchesCategory = filterState.category === 'ALL' || product.category === filterState.category;
        const matchesSearch = searchTerm === '' || product.searchText.includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    // 2) Sort a copy of the full list
    const sortedProducts = [...products];
    if (filterState.sort === 'low') {
        sortedProducts.sort((a, b) => a.price - b.price);
    } else if (filterState.sort === 'high') {
        sortedProducts.sort((a, b) => b.price - a.price);
    } else if (filterState.sort === 'name') {
        sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        sortedProducts.sort((a, b) => a.index - b.index);   // original order
    }

    // 3) Re-append cards in sorted order and hide those that do not match
    sortedProducts.forEach((product) => {
        grid.appendChild(product.card);
        product.card.hidden = !visibleProducts.includes(product);
    });

    // 4) Update the result count and the "no results" message
    $('results-count').textContent =
        'Showing ' + visibleProducts.length + ' of ' + products.length + ' shoes';
    $('no-results').hidden = visibleProducts.length !== 0;
}

// Highlight the chosen filter button and apply the filter
function setCategoryFilter(category) {
    filterState.category = category;
    document.querySelectorAll('.filter-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.filter === category);
    });
    applyProductFilters();
}

// Put everything back to the default view
function resetFilters() {
    filterState.search = '';
    filterState.sort = 'default';
    $('search-input').value = '';
    $('sort-select').value = 'default';
    setCategoryFilter('ALL');
}

// Handle clicks on "Add to Cart" / "Buy Now" (event delegation on the grid)
function handleProductButtonClick(event) {
    const button = event.target.closest('.add-btn, .buy-btn');
    if (!button) return;

    event.preventDefault();   // stop the link from jumping to #checkout

    const card = button.closest('.product-card');
    const product = products.find((item) => item.card === card);
    const sizeSelect = card.querySelector('.size-picker select');

    // Validation: a size must be chosen first
    if (sizeSelect.value === '') {
        sizeSelect.classList.add('invalid');
        sizeSelect.focus();
        showToast('Please select a size first.', 'error');
        return;
    }

    addToCart(product, sizeSelect.value);

    if (button.classList.contains('buy-btn')) {
        // Buy Now: go straight to the checkout form
        scrollToSection('checkout');
    }
}


/* =====================================================================
   SECTION 5: SHOPPING CART (add, remove, quantity, totals)
   The cart is saved in localStorage so it survives page refreshes.
   ===================================================================== */

let cart = loadData(STORAGE_KEYS.cart, []);
if (!Array.isArray(cart)) cart = [];

let activePromo = loadData(STORAGE_KEYS.promo, '');
if (!PROMO_CODES[activePromo]) activePromo = '';

// Save the cart and the promo code
function saveCart() {
    saveData(STORAGE_KEYS.cart, cart);
    saveData(STORAGE_KEYS.promo, activePromo);
}

// Add a product (in a chosen size) to the cart
function addToCart(product, size) {
    const id = slugify(product.name) + '-' + size;
    const existingItem = cart.find((item) => item.id === id);

    if (existingItem) {
        // Same shoe + same size: increase the quantity (up to the limit)
        if (existingItem.qty >= MAX_QTY) {
            showToast('You can only order up to ' + MAX_QTY + ' of the same item.', 'error');
            return;
        }
        existingItem.qty += 1;
    } else {
        cart.push({
            id: id,
            name: product.name,
            size: size,
            price: product.price,
            image: product.card.querySelector('img').getAttribute('src'),
            qty: 1
        });
    }

    saveCart();
    renderCart(true);
    showToast(product.name + ' (Size ' + size + ') added to cart.');
}

// Change an item's quantity by +1 or -1
function updateQuantity(id, change) {
    const item = cart.find((cartItem) => cartItem.id === id);
    if (!item) return;

    const newQty = item.qty + change;

    if (newQty < 1) {
        removeFromCart(id);
        return;
    }
    if (newQty > MAX_QTY) {
        showToast('Maximum of ' + MAX_QTY + ' per item.', 'error');
        return;
    }

    item.qty = newQty;
    saveCart();
    renderCart(false);
}

// Remove one item from the cart
function removeFromCart(id) {
    cart = cart.filter((item) => item.id !== id);
    saveCart();
    renderCart(false);
}

// CALCULATIONS: subtotal, discount, delivery fee and total
function calculateTotals() {
    let subtotal = 0;

    // Loop through every cart item and add up price x quantity
    for (const item of cart) {
        subtotal += item.price * item.qty;
    }

    const rate = PROMO_CODES[activePromo] || 0;
    const discount = Math.round(subtotal * rate);
    const afterDiscount = subtotal - discount;

    // Free delivery for big orders (or when the cart is empty)
    let delivery = DELIVERY_FEE;
    if (subtotal === 0 || afterDiscount >= FREE_DELIVERY_MIN) {
        delivery = 0;
    }

    return {
        subtotal: subtotal,
        rate: rate,
        discount: discount,
        afterDiscount: afterDiscount,
        delivery: delivery,
        total: afterDiscount + delivery
    };
}

// Redraw everything that depends on the cart (badge, drawer, checkout summary)
function renderCart(bumpBadge) {
    const totals = calculateTotals();
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    /* ----- Cart badge on the header cart button ----- */
    const badge = $('cart-count');
    badge.textContent = itemCount;
    badge.hidden = itemCount === 0;
    if (bumpBadge) {
        badge.classList.remove('bump');
        void badge.offsetWidth;          // restart the CSS animation
        badge.classList.add('bump');
    }

    /* ----- Items list inside the cart drawer ----- */
    const itemsContainer = $('cart-items');
    if (cart.length === 0) {
        itemsContainer.innerHTML =
            '<div class="empty-cart"><i class="fa-solid fa-bag-shopping"></i>' +
            'Your cart is empty.<br>Pick a pair you love!</div>';
    } else {
        itemsContainer.innerHTML = cart.map((item) => `
            <div class="cart-item" data-id="${escapeHTML(item.id)}">
                <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}">
                <div class="cart-item-info">
                    <h4>${escapeHTML(item.name)}</h4>
                    <p>Size ${escapeHTML(item.size)} · ${formatPeso(item.price)}</p>
                    <div class="qty-controls">
                        <button type="button" data-action="dec" aria-label="Decrease quantity">−</button>
                        <span>${item.qty}</span>
                        <button type="button" data-action="inc" aria-label="Increase quantity">+</button>
                    </div>
                </div>
                <div class="cart-item-right">
                    <strong>${formatPeso(item.price * item.qty)}</strong>
                    <button type="button" data-action="remove" aria-label="Remove item">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>`).join('');
    }

    /* ----- Totals in the drawer ----- */
    $('cart-subtotal').textContent = formatPeso(totals.subtotal);
    $('cart-delivery').textContent = (totals.subtotal > 0 && totals.delivery === 0) ? 'FREE' : formatPeso(totals.delivery);
    $('cart-total').textContent = formatPeso(totals.total);

    // Show the discount row only when a promo code is active
    $('discount-row').hidden = totals.discount === 0;
    $('promo-label').textContent = activePromo;
    $('cart-discount').textContent = '-' + formatPeso(totals.discount);

    // Hint about free delivery
    const hint = $('delivery-hint');
    if (totals.subtotal === 0) {
        hint.textContent = 'Free delivery on orders of ' + formatPeso(FREE_DELIVERY_MIN) + ' or more.';
    } else if (totals.afterDiscount >= FREE_DELIVERY_MIN) {
        hint.textContent = 'You qualify for free delivery!';
    } else {
        hint.textContent = 'Add ' + formatPeso(FREE_DELIVERY_MIN - totals.afterDiscount) + ' more for free delivery.';
    }

    renderOrderSummary(totals);
}

// Order summary shown at the top of the checkout form
function renderOrderSummary(totals) {
    const box = $('order-summary');

    if (!box) return;

    if (cart.length === 0) {
        box.innerHTML =
            '<h3>Order Summary</h3>' +
            '<p class="summary-empty">Your cart is empty. Add shoes from the Featured Shoes section.</p>';
        return;
    }

    const lines = cart.map((item) => `
        <div class="summary-row">
            <span>${escapeHTML(item.name)} (Size ${escapeHTML(item.size)}) × ${item.qty}</span>
            <span>${formatPeso(item.price * item.qty)}</span>
        </div>`).join('');

    let discountLine = '';
    if (totals.discount > 0) {
        discountLine = `
        <div class="summary-row">
            <span>Discount (${escapeHTML(activePromo)})</span>
            <span>-${formatPeso(totals.discount)}</span>
        </div>`;
    }

    box.innerHTML = `
        <h3>Order Summary</h3>
        ${lines}
        <div class="summary-row"><span>Subtotal</span><span>${formatPeso(totals.subtotal)}</span></div>
        ${discountLine}
        <div class="summary-row">
            <span>Delivery</span>
            <span>${totals.delivery === 0 ? 'FREE' : formatPeso(totals.delivery)}</span>
        </div>
        <div class="summary-row total"><span>Total</span><span>${formatPeso(totals.total)}</span></div>`;
}

function renderPendingOrders() {
    const list = $('pending-order-list');
    if (!list) return;

    const orders = loadData(STORAGE_KEYS.orders, []);
    if (!Array.isArray(orders) || orders.length === 0) {
        list.innerHTML = '<div class="empty-cart"><i class="fa-solid fa-box-open"></i>No pending orders yet.</div>';
        return;
    }

    list.innerHTML = [...orders].reverse().map((order) => {
        const itemsMarkup = (order.items || []).map((item) => `
            <div class="pending-order-item">
                <span>${escapeHTML(item.name)} × ${item.qty}</span>
                <small>Size ${escapeHTML(item.size)}</small>
            </div>
        `).join('');

        return `
            <article class="pending-order-card">
                <div class="pending-order-header">
                    <div>
                        <p class="pending-order-id">Order ${escapeHTML(order.id)}</p>
                        <small>${escapeHTML(order.date)}</small>
                    </div>
                    <span class="pending-order-status">Pending</span>
                </div>
                <div class="pending-order-items">${itemsMarkup}</div>
                <div class="pending-order-footer">
                    <strong>${formatPeso(order.total)}</strong>
                    <button type="button" class="restore-order-btn" data-order-id="${escapeHTML(order.id)}">Add to cart again</button>
                </div>
            </article>
        `;
    }).join('');
}

function restorePendingOrder(orderId) {
    const orders = loadData(STORAGE_KEYS.orders, []);
    const order = Array.isArray(orders) ? orders.find((item) => item.id === orderId) : null;

    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        showToast('No items were available in that order.', 'error');
        return;
    }

    order.items.forEach((item) => {
        const fallbackId = slugify(item.name) + '-' + item.size;
        const matchId = item.id || fallbackId;
        const existingItem = cart.find((cartItem) => cartItem.id === matchId);

        if (existingItem) {
            existingItem.qty = Math.min(existingItem.qty + Number(item.qty || 1), MAX_QTY);
        } else {
            cart.push({
                id: matchId,
                name: item.name,
                size: item.size,
                price: Number(item.price),
                image: item.image || FALLBACK_IMAGE,
                qty: Number(item.qty || 1)
            });
        }
    });

    saveCart();
    renderCart(true);
    showToast('Pending order restored to cart.');
}

/* ----- Open / close the cart drawer ----- */
function openCart() {
    $('cart-drawer').classList.add('open');
    $('cart-drawer').setAttribute('aria-hidden', 'false');
    $('overlay').classList.add('show');
    document.body.classList.add('no-scroll');
}

function closeCart() {
    $('cart-drawer').classList.remove('open');
    $('cart-drawer').setAttribute('aria-hidden', 'true');
    $('overlay').classList.remove('show');
    document.body.classList.remove('no-scroll');
}

// Apply a promo code typed in the cart
function handlePromoSubmit(event) {
    event.preventDefault();
    const code = $('promo-input').value.trim().toUpperCase();
    const message = $('promo-msg');

    if (code === '') {
        message.textContent = 'Please enter a promo code.';
        message.className = 'promo-msg error';
    } else if (PROMO_CODES[code]) {
        activePromo = code;
        saveCart();
        renderCart(false);
        message.textContent = code + ' applied: ' + (PROMO_CODES[code] * 100) + '% off!';
        message.className = 'promo-msg success';
        $('promo-input').value = '';
    } else {
        message.textContent = 'Sorry, that promo code is not valid.';
        message.className = 'promo-msg error';
    }
}


/* =====================================================================
   SECTION 6: CHECKOUT AND CONTACT FORMS
   ===================================================================== */

function togglePaymentPanels() {
    const selected = document.querySelector('input[name="payment"]:checked');
    const panels = {
        'Cash on Delivery': $('payment-cod-note'),
        GCash: $('payment-gcash-fields'),
        'Credit/Debit Card': $('payment-card-fields')
    };

    Object.values(panels).forEach((panel) => {
        if (panel) panel.hidden = true;
    });

    if (selected && panels[selected.value]) {
        panels[selected.value].hidden = false;
    }
}

// CHECKOUT form submit
function handleCheckout(event) {
    event.preventDefault();
    const form = event.target;
    const messageBox = $('checkout-message');

    // Validate the text fields (hidden payment panels are skipped)
    let formIsValid = validateForm(form);

    // Validate the payment method radio buttons
    const chosenPayment = form.querySelector('input[name="payment"]:checked');
    if (!chosenPayment) {
        $('payment-error').textContent = 'Please choose a payment method.';
        formIsValid = false;
    } else {
        $('payment-error').textContent = '';
    }

    if (chosenPayment && chosenPayment.value === 'GCash') {
        if (!validateField($('gcash-number'))) formIsValid = false;
    }

    if (chosenPayment && chosenPayment.value === 'Credit/Debit Card') {
        ['card-name', 'card-number', 'card-expiry', 'card-cvv'].forEach((id) => {
            if (!validateField($(id))) formIsValid = false;
        });
    }

    if (!formIsValid) {
        showFormMessage(messageBox, 'Please fix the highlighted fields.', 'error');
        return;
    }

    // The cart must not be empty
    if (cart.length === 0) {
        showFormMessage(messageBox, 'Your cart is empty. Add at least one pair of shoes first.', 'error');
        return;
    }

    // Build the order and save it
    const totals = calculateTotals();
    const customerName = $('checkout-name').value.trim();
    const order = {
        id: 'ZP-' + Date.now().toString().slice(-6),
        date: new Date().toLocaleString('en-PH'),
        customer: customerName,
        phone: $('checkout-phone').value.trim(),
        address: $('checkout-address').value.trim(),
        payment: chosenPayment.value,
        items: cart.map((item) => ({ ...item })),
        promo: activePromo,
        total: totals.total
    };

    const orders = loadData(STORAGE_KEYS.orders, []);
    orders.push(order);
    saveData(STORAGE_KEYS.orders, orders);

    // Show the confirmation pop-up
    $('order-modal-text').textContent =
        'Thank you, ' + customerName + '! Your order ' + order.id + ' (' + formatPeso(totals.total) +
        ') has been placed successfully. Payment: ' + order.payment + '.';
    $('order-modal').hidden = false;
    showToast('Order placed successfully!', 'success');

    // Save the order in the pending list and clear the cart
    renderPendingOrders();
    cart = [];
    activePromo = '';
    saveCart();
    renderCart(false);
    form.reset();
    resetFormState(form);
    form.querySelectorAll('.payment-option').forEach((option) => option.classList.remove('selected'));
    togglePaymentPanels();
    showFormMessage(messageBox, '', '');
    updateAuthUI();   // re-fills the name if the user is logged in
}

// CONTACT form submit
function handleContact(event) {
    event.preventDefault();
    const form = event.target;
    const messageBox = $('contact-feedback');

    if (!validateForm(form)) {
        showFormMessage(messageBox, 'Please fix the highlighted fields.', 'error');
        return;
    }

    const messages = loadData(STORAGE_KEYS.messages, []);
    messages.push({
        name: $('contact-name').value.trim(),
        email: $('contact-email').value.trim(),
        message: $('contact-message').value.trim(),
        date: new Date().toLocaleString('en-PH')
    });
    saveData(STORAGE_KEYS.messages, messages);

    form.reset();
    resetFormState(form);
    showFormMessage(messageBox, 'Thank you! Your message has been sent. We will get back to you soon.', 'success');
    showToast('Message sent!');
    updateAuthUI();
}


/* =====================================================================
   SECTION 7: NAVIGATION (active link, sticky header, back-to-top)
   ===================================================================== */

// Highlight the nav link of the section currently on screen
function updateActiveNavLink() {
    const links = document.querySelectorAll('.navbar a');
    const scrollPosition = window.scrollY + 140;
    let currentId = 'home';

    // Find the last section whose top has passed the scroll position
    links.forEach((link) => {
        const section = document.querySelector(link.getAttribute('href'));
        if (section && section.offsetTop <= scrollPosition) {
            currentId = section.id;
        }
    });

    // At the very bottom of the page, highlight the last link
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 2) {
        currentId = 'contact';
    }

    links.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + currentId);
    });
}

// Runs on scroll: header shadow, back-to-top button, active link
function handleScroll() {
    $('site-header').classList.toggle('scrolled', window.scrollY > 10);
    $('back-to-top').classList.toggle('visible', window.scrollY > 400);
    updateActiveNavLink();
}

// Open/close the mobile menu
function toggleMobileMenu() {
    const navbar = $('navbar');
    const isOpen = navbar.classList.toggle('open');
    $('menu-toggle').innerHTML = isOpen
        ? '<i class="fa-solid fa-xmark"></i>'
        : '<i class="fa-solid fa-bars"></i>';
}


/* =====================================================================
   SECTION 8: EVENT LISTENERS
   All user actions are linked to their outcomes here.
   ===================================================================== */

function bindEvents() {
    /* ---------- Forms: submit events ---------- */
    $('login-form').addEventListener('submit', handleLogin);
    $('signup-form').addEventListener('submit', handleSignup);
    $('checkout-form').addEventListener('submit', handleCheckout);
    $('contact-form').addEventListener('submit', handleContact);
    $('promo-form').addEventListener('submit', handlePromoSubmit);

    // Live validation (blur + input events) for each form
    ['login-form', 'signup-form', 'checkout-form', 'contact-form'].forEach((formId) => {
        enableLiveValidation($(formId));
    });

    // Re-check "confirm password" when the password changes
    $('signup-password').addEventListener('input', () => {
        if ($('signup-confirm').value !== '') validateField($('signup-confirm'));
    });

    // Highlight the chosen payment option (change event)
    document.querySelectorAll('input[name="payment"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.payment-option').forEach((option) => {
                option.classList.toggle('selected', option.contains(radio) && radio.checked);
            });
            $('payment-error').textContent = '';
            togglePaymentPanels();
        });
    });

    $('forgot-password').addEventListener('click', (event) => {
        event.preventDefault();
        showToast('Password reset is not available in this demo.', 'info');
    });

    /* ---------- Search, filter and sort ---------- */
    // input event: filter while typing
    $('search-input').addEventListener('input', (event) => {
        filterState.search = event.target.value.trim();
        applyProductFilters();
    });

    // submit event: pressing Enter scrolls down to the results
    $('search-form').addEventListener('submit', (event) => {
        event.preventDefault();
        filterState.search = $('search-input').value.trim();
        applyProductFilters();
        scrollToSection('products');
    });

    // click on a filter button
    $('filter-buttons').addEventListener('click', (event) => {
        const button = event.target.closest('.filter-btn');
        if (button) setCategoryFilter(button.dataset.filter);
    });

    // change event on the sort drop-down
    $('sort-select').addEventListener('change', (event) => {
        filterState.sort = event.target.value;
        applyProductFilters();
    });

    $('reset-filters').addEventListener('click', resetFilters);

    // Category cards also filter the product list
    document.querySelectorAll('.category-card').forEach((card) => {
        card.addEventListener('click', (event) => {
            event.preventDefault();
            const category = card.querySelector('h3').textContent.trim().toUpperCase();
            filterState.search = '';
            $('search-input').value = '';
            setCategoryFilter(category);
            scrollToSection('products');
        });
    });

    /* ---------- Product buttons and size pickers ---------- */
    $('product-grid').addEventListener('click', handleProductButtonClick);
    $('product-grid').addEventListener('change', (event) => {
        if (event.target.matches('.size-picker select')) {
            event.target.classList.remove('invalid');   // clear the error once a size is chosen
        }
    });

    /* ---------- Cart drawer ---------- */
    $('cart-btn').addEventListener('click', (event) => {
        event.preventDefault();
        openCart();
    });
    $('close-cart').addEventListener('click', closeCart);
    $('overlay').addEventListener('click', closeCart);

    // Quantity (+/-) and remove buttons inside the cart (event delegation)
    $('cart-items').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const itemId = button.closest('.cart-item').dataset.id;
        if (button.dataset.action === 'inc') {
            updateQuantity(itemId, 1);
        } else if (button.dataset.action === 'dec') {
            updateQuantity(itemId, -1);
        } else if (button.dataset.action === 'remove') {
            removeFromCart(itemId);
        }
    });

    $('remove-promo').addEventListener('click', () => {
        activePromo = '';
        saveCart();
        renderCart(false);
        $('promo-msg').textContent = '';
    });

    $('clear-cart').addEventListener('click', () => {
        if (cart.length === 0) {
            showToast('Your cart is already empty.', 'info');
        } else if (window.confirm('Remove all items from your cart?')) {
            cart = [];
            activePromo = '';
            saveCart();
            renderCart(false);
        }
    });

    $('go-checkout').addEventListener('click', (event) => {
        event.preventDefault();
        if (cart.length === 0) {
            showToast('Your cart is empty. Add some shoes first!', 'error');
            return;
        }
        closeCart();
        scrollToSection('checkout');
    });

    $('pending-order-list').addEventListener('click', (event) => {
        const button = event.target.closest('.restore-order-btn');
        if (!button) return;
        restorePendingOrder(button.dataset.orderId);
    });

    /* ---------- Order confirmation pop-up ---------- */
    $('close-modal').addEventListener('click', () => {
        $('order-modal').hidden = true;
        // FIX: after the order pop-up, take the user to their pending orders
        scrollToSection('pending-orders');
    });
    $('order-modal').addEventListener('click', (event) => {
        if (event.target === $('order-modal')) $('order-modal').hidden = true;   // click outside the box
    });

    /* ---------- Account buttons ---------- */
    $('logout-btn').addEventListener('click', handleLogout);

    /* ---------- Navigation ---------- */
    $('menu-toggle').addEventListener('click', toggleMobileMenu);

    // Close the mobile menu after choosing a link
    document.querySelectorAll('.navbar a').forEach((link) => {
        link.addEventListener('click', () => {
            if ($('navbar').classList.contains('open')) toggleMobileMenu();
        });
    });

    $('back-to-top').addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // scroll event (throttled with requestAnimationFrame for smooth performance)
    let scrollQueued = false;
    window.addEventListener('scroll', () => {
        if (!scrollQueued) {
            scrollQueued = true;
            requestAnimationFrame(() => {
                handleScroll();
                scrollQueued = false;
            });
        }
    });

    // keydown event: the Escape key closes the cart and the pop-up
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCart();
            $('order-modal').hidden = true;
        }
    });
}


/* =====================================================================
   SECTION 9: START THE APP
   ===================================================================== */

function init() {
    initProducts();         // read product cards and add size pickers
    bindEvents();           // connect all events
    loadRememberedEmail();  // pre-fill login email if saved
    updateAuthUI();         // show the right login/logout state
    applyProductFilters();  // draw the product list + result count
    renderCart(false);      // draw the cart from localStorage
    renderPendingOrders();  // render saved pending orders
    handleScroll();         // set the initial nav highlight
    togglePaymentPanels();  // show the correct payment details panel
}

init();
