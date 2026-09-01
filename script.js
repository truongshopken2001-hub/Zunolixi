import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    increment,
    collection,
    addDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCFwSPxqgGD7GGTalZCzDy81Z51UlZ447s",
    authDomain: "zuno-li-xi.firebaseapp.com",
    projectId: "zuno-li-xi",
    storageBucket: "zuno-li-xi.firebasestorage.app",
    messagingSenderId: "240073073112",
    appId: "1:240073073112:web:0253a525d4514fdfc992ad"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentBalance = 0;
let currentUser = null; // Tài khoản đang đăng nhập
let isLoginMode = true; // Mode true: Đăng nhập | false: Đăng ký
let timerInterval = null;
const REFERRAL_BONUS = 1000;

// ===============================================
// 1. CHỨC NĂNG TỰ ĐỘNG ĐỔI HIỆU ỨNG NGÀY LỄ VIỆT NAM
// ===============================================
function initHolidayTheme() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    let theme = "default";
    let badgeText = "";
    let particles = [];

    if (month === 1 || month === 2) { 
        theme = "theme-tet";
        badgeText = "🧧 Sự Kiện Mừng Xuân Tết Giáp Thìn";
        particles = ['🌸', '🧧', '✨', '🪙'];
    } else if ((month === 3 && day === 8) || (month === 10 && day === 20)) {
        theme = "theme-women";
        badgeText = "🌹 Chúc Mừng Ngày Phụ Nữ Việt Nam";
        particles = ['🌹', '🌸', '💖', '✨'];
    } else if ((month === 4 && day >= 28) || (month === 5 && day <= 2)) {
        theme = "theme-national";
        badgeText = "⭐ Mừng Ngày Giải Phóng & Quốc Tế Lao Động";
        particles = ['⭐', '🇻🇳', '✨'];
    } else if (month === 9 && (day >= 1 && day <= 3)) {
        theme = "theme-national";
        badgeText = "🇻🇳 Mừng Ngày Quốc Khánh 2/9";
        particles = ['🇻🇳', '⭐', '🎈'];
    } else if (month === 9 || month === 8) {
        theme = "theme-midautumn";
        badgeText = "🥮 Sự Kiện Mừng Đêm Hội Trung Thu";
        particles = ['🏮', '🌕', '🥮', '✨'];
    } else {
        badgeText = "🎉 Sự Kiện Lì Xì May Mắn";
        particles = ['✨', '🪙', '⭐'];
    }

    document.body.className = theme;

    const badge = document.getElementById('holidayBadge');
    if (badge) {
        badge.innerText = badgeText;
        badge.style.display = 'inline-block';
    }

    startHolidayCanvas(particles);
}

function startHolidayCanvas(symbols) {
    const canvas = document.getElementById('holidayCanvas');
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const items = [];
    const maxItems = 25;

    for (let i = 0; i < maxItems; i++) {
        items.push({
            x: Math.random() * width,
            y: Math.random() * height - height,
            size: Math.random() * 14 + 14,
            speedY: Math.random() * 1.5 + 0.8,
            speedX: Math.random() * 1 - 0.5,
            symbol: symbols[Math.floor(Math.random() * symbols.length)]
        });
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        items.forEach(item => {
            item.y += item.speedY;
            item.x += item.speedX;

            if (item.y > height) {
                item.y = -20;
                item.x = Math.random() * width;
            }

            ctx.font = `${item.size}px serif`;
            ctx.fillText(item.symbol, item.x, item.y);
        });

        requestAnimationFrame(animate);
    }

    animate();
}

// ===============================================
// 2. TÍNH NĂNG ĐĂNG NHẬP / ĐĂNG KÝ FIREBASE
// ===============================================
document.addEventListener('DOMContentLoaded', async () => {
    initHolidayTheme();

    document.getElementById('lixiBtn').addEventListener('click', grabLixi);
    document.getElementById('btnCopy').addEventListener('click', copyRefLink);
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    document.getElementById('withdrawForm').addEventListener('submit', handleWithdraw);

    // Sự kiện Modal Đăng Nhập
    document.getElementById('btnOpenAuth').addEventListener('click', handleAuthButtonClick);
    document.getElementById('btnCloseAuthModal').addEventListener('click', () => {
        document.getElementById('authModal').style.display = 'none';
    });
    document.getElementById('tabLogin').addEventListener('click', () => switchAuthMode(true));
    document.getElementById('tabRegister').addEventListener('click', () => switchAuthMode(false));
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);

    // Kiểm tra tài khoản đã lưu trong LocalStorage
    const savedUser = localStorage.getItem('app_username');
    if (savedUser) {
        currentUser = savedUser;
        await loadUserData();
    } else {
        updateUserUI(null);
    }

    await checkAndRewardReferral();
});

function handleAuthButtonClick() {
    if (currentUser) {
        // Đăng xuất
        localStorage.removeItem('app_username');
        currentUser = null;
        currentBalance = 0;
        updateBalanceUI();
        updateUserUI(null);
        alert("Đã đăng xuất tài khoản!");
    } else {
        document.getElementById('authModal').style.display = 'flex';
    }
}

function switchAuthMode(isLogin) {
    isLoginMode = isLogin;
    document.getElementById('tabLogin').className = isLogin ? 'auth-tab active' : 'auth-tab';
    document.getElementById('tabRegister').className = !isLogin ? 'auth-tab active' : 'auth-tab';
    document.getElementById('btnAuthSubmit').innerText = isLogin ? 'ĐĂNG NHẬP' : 'ĐĂNG KÝ TÀI KHOẢN';
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('authUsername').value.trim().toLowerCase();
    const password = document.getElementById('authPassword').value.trim();

    if (!username || !password) {
        alert("Vui lòng điền đầy đủ tài khoản và mật khẩu!");
        return;
    }

    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (isLoginMode) {
        // XỬ LÝ ĐĂNG NHẬP
        if (!userSnap.exists()) {
            alert("❌ Tài khoản không tồn tại!");
            return;
        }

        const data = userSnap.data();
        if (data.password !== password) {
            alert("❌ Mật khẩu không chính xác!");
            return;
        }

        currentUser = username;
        localStorage.setItem('app_username', username);
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('authForm').reset();
        alert("✅ Đăng nhập thành công!");
        await loadUserData();

    } else {
        // XỬ LÝ ĐĂNG KÝ
        if (userSnap.exists()) {
            alert("❌ Tên tài khoản này đã được sử dụng!");
            return;
        }

        await setDoc(userRef, {
            password: password,
            balance: 0,
            lastClaimDate: "",
            createdAt: new Date().toISOString()
        });

        currentUser = username;
        localStorage.setItem('app_username', username);
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('authForm').reset();
        alert("🎉 Đăng ký tài khoản thành công!");
        await loadUserData();
    }
}

function updateUserUI(username) {
    const userInfoText = document.getElementById('userInfoText');
    const btnOpenAuth = document.getElementById('btnOpenAuth');
    const refInput = document.getElementById('refLink');

    if (username) {
        userInfoText.innerText = `👤 Xin chào: ${username}`;
        btnOpenAuth.innerText = "Đăng Xuất";
        if (refInput) {
            refInput.value = `${window.location.origin}${window.location.pathname}?ref=${username}`;
        }
    } else {
        userInfoText.innerText = "👤 Khách (Chưa đăng nhập)";
        btnOpenAuth.innerText = "Đăng Nhập";
        if (refInput) {
            refInput.value = "Vui lòng đăng nhập để lấy link...";
        }
    }
}

// ===============================================
// 3. LOGIC TÀI KHOẢN FIREBASE & LÌ XÌ HÀNG NGÀY
// ===============================================
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function loadUserData() {
    if (!currentUser) return;

    try {
        const userRef = doc(db, "users", currentUser);
        const userSnap = await getDoc(userRef);
        const todayStr = getTodayString();

        if (userSnap.exists()) {
            const data = userSnap.data();
            currentBalance = data.balance || 0;
            updateBalanceUI();
            updateUserUI(currentUser);

            if (data.lastClaimDate === todayStr) {
                disableLixiBtn();
                startCountdown();
            } else {
                enableLixiBtn();
            }
        }
    } catch (error) {
        console.error("Lỗi kết nối Firebase:", error);
    }
}

async function checkAndRewardReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const referrerId = urlParams.get('ref');

    if (referrerId && referrerId !== currentUser) {
        const hasBeenReferred = localStorage.getItem('is_referred_processed');
        
        if (!hasBeenReferred) {
            try {
                const referrerRef = doc(db, "users", referrerId);
                const referrerSnap = await getDoc(referrerRef);

                if (referrerSnap.exists()) {
                    await updateDoc(referrerRef, {
                        balance: increment(REFERRAL_BONUS),
                        totalReferrals: increment(1)
                    });

                    await addDoc(collection(db, "referral_logs"), {
                        referrerId: referrerId,
                        refereeUser: currentUser || "guest",
                        bonusAmount: REFERRAL_BONUS,
                        createdAt: new Date().toISOString()
                    });

                    localStorage.setItem('is_referred_processed', 'true');
                }
            } catch (error) {
                console.error("Lỗi xử lý cộng tiền giới thiệu:", error);
            }
        }
    }
}

async function grabLixi() {
    if (!currentUser) {
        alert("⚠️ Vui lòng ĐĂNG NHẬP để giật lì xì!");
        document.getElementById('authModal').style.display = 'flex';
        return;
    }

    const lixiBtn = document.getElementById('lixiBtn');
    lixiBtn.style.pointerEvents = 'none';

    try {
        const userRef = doc(db, "users", currentUser);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            alert("❌ Lỗi tài khoản, vui lòng đăng nhập lại!");
            return;
        }

        const userData = userSnap.data();
        const todayStr = getTodayString();

        if (userData.lastClaimDate === todayStr) {
            alert("❌ Hôm nay bạn đã nhận lì xì rồi! Hãy quay lại vào ngày mai.");
            disableLixiBtn();
            startCountdown();
            return;
        }

        const randomBonus = Math.floor(Math.random() * (20000 - 1000 + 1)) + 1000;

        await updateDoc(userRef, {
            balance: increment(randomBonus),
            lastClaimDate: todayStr,
            claimedAt: new Date().toISOString()
        });

        currentBalance += randomBonus;
        updateBalanceUI();

        document.getElementById('rewardDisplay').innerText = "+" + randomBonus.toLocaleString('vi-VN') + " VNĐ";
        document.getElementById('resultModal').style.display = 'flex';

        disableLixiBtn();
        startCountdown();

    } catch (error) {
        alert("❌ Thao tác thất bại: " + error.message);
        lixiBtn.style.pointerEvents = 'auto';
    }
}

function disableLixiBtn() {
    const lixiBtn = document.getElementById('lixiBtn');
    lixiBtn.style.pointerEvents = 'none';
    lixiBtn.style.opacity = '0.5';
    document.getElementById('lixiHint').innerText = "🔒 Bạn đã hết lượt giật hôm nay!";
    document.getElementById('countdownBox').style.display = 'block';
}

function enableLixiBtn() {
    const lixiBtn = document.getElementById('lixiBtn');
    lixiBtn.style.pointerEvents = 'auto';
    lixiBtn.style.opacity = '1';
    document.getElementById('lixiHint').innerText = "Nhấn vào bao lì xì để nhận tiền!";
    document.getElementById('countdownBox').style.display = 'none';
}

function startCountdown() {
    if (timerInterval) clearInterval(timerInterval);

    function updateTimer() {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        const diffMs = tomorrow - now;

        if (diffMs <= 0) {
            clearInterval(timerInterval);
            enableLixiBtn();
            return;
        }

        const hours = String(Math.floor(diffMs / (1000 * 60 * 60))).padStart(2, '0');
        const minutes = String(Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
        const seconds = String(Math.floor((diffMs % (1000 * 60)) / 1000)).padStart(2, '0');

        document.getElementById('timerText').innerText = `${hours}:${minutes}:${seconds}`;
    }

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

async function handleWithdraw(e) {
    e.preventDefault();

    if (!currentUser) {
        alert("⚠️ Vui lòng ĐĂNG NHẬP để gửi yêu cầu rút tiền!");
        document.getElementById('authModal').style.display = 'flex';
        return;
    }

    const bank = document.getElementById('bankName').value;
    const accNo = document.getElementById('accNumber').value;
    const accHolder = document.getElementById('accHolder').value;
    const amount = parseInt(document.getElementById('withdrawAmount').value);

    if (amount < 10000) {
        alert("❌ Số tiền rút tối thiểu là 10.000 VNĐ!");
        return;
    }

    if (amount > 50000) {
        alert("❌ Số tiền rút tối đa cho mỗi lần là 50.000 VNĐ!");
        return;
    }

    if (amount > currentBalance) {
        alert("❌ Số dư ví không đủ để rút!");
        return;
    }

    try {
        const userRef = doc(db, "users", currentUser);

        await updateDoc(userRef, {
            balance: increment(-amount)
        });

        await addDoc(collection(db, "withdrawals"), {
            username: currentUser,
            bankName: bank,
            accountNumber: accNo,
            accountHolder: accHolder,
            amount: amount,
            status: "pending",
            createdAt: new Date().toISOString()
        });

        currentBalance -= amount;
        updateBalanceUI();

        alert(`✅ Đã gửi lệnh rút ${amount.toLocaleString('vi-VN')} VNĐ! Đơn đang chờ Admin duyệt.`);
        document.getElementById('withdrawForm').reset();

    } catch (error) {
        alert("❌ Lỗi gửi yêu cầu rút tiền: " + error.message);
    }
}

function updateBalanceUI() {
    document.getElementById('userBalance').innerText = currentBalance.toLocaleString('vi-VN') + " VNĐ";
}

function closeModal() {
    document.getElementById('resultModal').style.display = 'none';
}

function copyRefLink() {
    if (!currentUser) {
        alert("⚠️ Vui lòng ĐĂNG NHẬP để lấy link giới thiệu!");
        document.getElementById('authModal').style.display = 'flex';
        return;
    }
    const copyText = document.getElementById("refLink");
    copyText.select();
    document.execCommand("copy");
    alert("Đã chép link giới thiệu của bạn!");
}
