/**
 * Doraemon Fansub Vietnam - Core System & Firebase Configuration
 * Bảo mật cấu hình, khởi tạo Firebase và kiểm tra phân quyền.
 */

// Cloudinary Configuration (Giữ đồng bộ giữa các trang)
const CLOUDINARY_CONFIG = {
    cloudName: 'gntkeeno',
    uploadPreset: 'doraemon_fansub_vn',
    folder: 'posts'
};

// Firebase Web SDK Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBt3G9n5JYu3EsvqJR9IoW2vRAc_Es3-ws",
    authDomain: "doraemon-fansub-vietnam.firebaseapp.com",
    projectId: "doraemon-fansub-vietnam",
    storageBucket: "doraemon-fansub-vietnam.firebasestorage.app",
    messagingSenderId: "380840935390",
    appId: "1:380840935390:web:60fab4722a9fba5053a74f",
    measurementId: "G-0S2Z4XRK0B"
};

// Email hỗ trợ công khai (Thay thế email cá nhân của Super Admin trên giao diện)
const SUPPORT_CONTACT_EMAIL = 'hotro.doraemonfansub@gmail.com';

// Mã hóa an toàn danh tính quản trị viên cấp cao (Tránh bị bot quét email trực tiếp trong mã nguồn HTML)
const _SA_ENC = 'dHVhbmtoYWltb2kxMjM0NUBnbWFpbC5jb20=';
function getSuperAdminEmail() {
    try {
        return atob(_SA_ENC);
    } catch (e) {
        return '';
    }
}
const SUPER_ADMIN_EMAIL = getSuperAdminEmail();

function isSuperAdminEmail(email) {
    if (!email) return false;
    return email.toLowerCase().trim() === getSuperAdminEmail();
}

// Global Firebase Instances
let auth, db, provider;

function initFirebaseApp() {
    if (typeof firebase !== 'undefined' && (!firebase.apps || !firebase.apps.length)) {
        try {
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();

            // Offline Cache Persistence
            db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
                if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
                    console.warn('Firestore persistence error:', err);
                }
            });

            provider = new firebase.auth.GoogleAuthProvider();

            // Tự động kiểm tra IP bị cấm khi trang tải xong
            if (typeof checkBannedIp === 'function') {
                checkBannedIp();
            }
        } catch (e) {
            console.error('Firebase init error:', e);
        }
    }
}

// Khởi tạo ngay hoặc sau khi DOM sẵn sàng
initFirebaseApp();
if (typeof firebase === 'undefined') {
    window.addEventListener('DOMContentLoaded', initFirebaseApp);
}

// ============================================================
// HỆ THỐNG KIỂM TRA IP BỊ CẤM (BẢO VỆ CLIENT)
// ============================================================
let cachedUserIp = null;

async function getUserIpAddress() {
    if (cachedUserIp) return cachedUserIp;
    const sessionIp = sessionStorage.getItem('user_client_ip');
    if (sessionIp) {
        cachedUserIp = sessionIp;
        return sessionIp;
    }

    const providers = [
        async () => {
            const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
            const data = await res.json();
            return data.ip;
        },
        async () => {
            const res = await fetch('https://api64.ipify.org?format=json', { cache: 'no-store' });
            const data = await res.json();
            return data.ip;
        },
        async () => {
            const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
            const data = await res.json();
            return data.ip;
        }
    ];

    for (const fetchIp of providers) {
        try {
            const ip = await fetchIp();
            if (ip && typeof ip === 'string' && ip.trim().length >= 7) {
                const cleanIp = ip.trim();
                cachedUserIp = cleanIp;
                sessionStorage.setItem('user_client_ip', cleanIp);
                return cleanIp;
            }
        } catch (e) {
            // Thử provider kế tiếp
        }
    }
    return '';
}

function showIpBanScreen(ip) {
    document.body.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0f172a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;font-family:sans-serif;text-align:center;padding:20px;">
            <div style="background:rgba(239,68,68,0.1);border:2px solid #ef4444;border-radius:16px;padding:40px;max-width:550px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <div style="font-size:64px;margin-bottom:16px;">🚫</div>
                <h1 style="color:#ef4444;font-size:24px;margin-bottom:12px;font-weight:700;">ĐỊA CHỈ IP CỦA BẠN ĐÃ BỊ CẤM</h1>
                <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:20px;">
                    Địa chỉ IP <strong style="color:#f87171;background:rgba(239,68,68,0.2);padding:2px 8px;border-radius:4px;">${ip}</strong> đã bị quản trị viên cấm khỏi hệ thống do vi phạm điều khoản dịch vụ hoặc thực hiện hành vi bất thường.
                </p>
                <div style="font-size:13px;color:#94a3b8;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
                    Nếu bạn cho rằng đây là sự nhầm lẫn, vui lòng liên hệ Admin qua email hỗ trợ: <strong style="color:#38bdf8;">${SUPPORT_CONTACT_EMAIL}</strong> hoặc qua Fanpage chính thức.
                </div>
            </div>
        </div>
    `;
}

async function checkBannedIp() {
    try {
        if (!db) return false;
        const clientIp = await getUserIpAddress();
        if (!clientIp) return false;

        const safeIpDoc = clientIp.replace(/\./g, '_');
        const docRef = await db.collection('banned_ips').doc(safeIpDoc).get();
        if (docRef.exists) {
            showIpBanScreen(clientIp);
            return true;
        }
        const docRaw = await db.collection('banned_ips').doc(clientIp).get();
        if (docRaw.exists) {
            showIpBanScreen(clientIp);
            return true;
        }
        return false;
    } catch (e) {
        // Nếu rules cấm đọc danh sách, tiếp tục bình thường
        return false;
    }
}

// ============================================================
// HỆ THỐNG XÁC THỰC 2FA (BẢO VỆ PHIÊN AN TOÀN TRÊN CLIENT)
// ============================================================
const TWO_FACTOR_SESSION_KEY = 'twoFactorVerifiedUid';

function setTwoFactorVerifiedUid(uid) {
    if (!uid) return;
    try {
        const payload = JSON.stringify({
            uid: uid,
            ts: Date.now(),
            checksum: btoa(uid + '_dfvn_2fa_ok')
        });
        sessionStorage.setItem(TWO_FACTOR_SESSION_KEY, btoa(payload));
        // Khả năng tương thích ngược
        localStorage.setItem(TWO_FACTOR_SESSION_KEY, uid);
    } catch (e) {
        localStorage.setItem(TWO_FACTOR_SESSION_KEY, uid);
    }
}

function getTwoFactorVerifiedUid() {
    try {
        const sessionVal = sessionStorage.getItem(TWO_FACTOR_SESSION_KEY);
        if (sessionVal) {
            try {
                const parsed = JSON.parse(atob(sessionVal));
                if (parsed && parsed.uid && parsed.checksum === btoa(parsed.uid + '_dfvn_2fa_ok')) {
                    return parsed.uid;
                }
            } catch (err) {
                return sessionVal;
            }
        }
        return localStorage.getItem(TWO_FACTOR_SESSION_KEY);
    } catch (e) {
        return null;
    }
}

function clearTwoFactorVerifiedUid() {
    try {
        sessionStorage.removeItem(TWO_FACTOR_SESSION_KEY);
        localStorage.removeItem(TWO_FACTOR_SESSION_KEY);
    } catch (e) {}
}

function isTwoFactorVerified(uid) {
    return Boolean(uid && getTwoFactorVerifiedUid() === uid);
}
