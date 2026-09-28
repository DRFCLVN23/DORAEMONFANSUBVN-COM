/**
 * Doraemon Fansub Vietnam - Firebase & System Configuration
 * Lưu ý: Firebase API Keys được Google thiết kế để công khai ở Client-side.
 * Hàng rào bảo mật thực sự nằm ở Firestore Security Rules trên máy chủ.
 */
(function() {
    'use strict';

    // Cấu hình Cloudinary
    if (!window.CLOUDINARY_CONFIG) {
        window.CLOUDINARY_CONFIG = {
            cloudName: 'gntkeeno',
            uploadPreset: 'doraemon_fansub_vn',
            folder: 'posts'
        };
    }

    // Cấu hình Firebase Web SDK
    window.firebaseConfig = {
        apiKey: "AIzaSyBt3G9n5JYu3EsvqJR9IoW2vRAc_Es3-ws",
        authDomain: "doraemon-fansub-vietnam.firebaseapp.com",
        projectId: "doraemon-fansub-vietnam",
        storageBucket: "doraemon-fansub-vietnam.firebasestorage.app",
        messagingSenderId: "380840935390",
        appId: "1:380840935390:web:60fab4722a9fba5053a74f",
        measurementId: "G-0S2Z4XRK0B"
    };

    // Email hỗ trợ công khai (tránh hiển thị email cá nhân trên giao diện)
    window.SUPPORT_CONTACT_EMAIL = 'hotro.doraemonfansub@gmail.com';

    // Định danh Super Admin
    window.SUPER_ADMIN_EMAIL = 'tuankhaimoi12345@gmail.com';
    window.getSuperAdminEmail = function() {
        return window.SUPER_ADMIN_EMAIL;
    };
    window.isSuperAdminEmail = function(email) {
        if (!email || typeof email !== 'string') return false;
        return email.toLowerCase().trim() === window.SUPER_ADMIN_EMAIL.toLowerCase().trim();
    };

    // Khởi tạo các thực thể Firebase toàn cục
    window.auth = null;
    window.db = null;
    window.provider = null;

    window.initFirebaseApp = function() {
        if (typeof firebase !== 'undefined' && (!firebase.apps || !firebase.apps.length)) {
            try {
                firebase.initializeApp(window.firebaseConfig);
                window.auth = firebase.auth();
                window.db = firebase.firestore();

                // Lưu trữ offline cache
                window.db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
                    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
                        console.warn('Firestore persistence warning:', err);
                    }
                });

                window.provider = new firebase.auth.GoogleAuthProvider();

                if (typeof window.checkBannedIp === 'function') {
                    window.checkBannedIp();
                }
            } catch (e) {
                console.error('Lỗi khởi tạo Firebase:', e);
            }
        } else if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
            window.auth = firebase.auth();
            window.db = firebase.firestore();
            window.provider = new firebase.auth.GoogleAuthProvider();
        }
    };

    // Tự động khởi tạo ngay khi nạp script
    window.initFirebaseApp();
    if (typeof firebase === 'undefined') {
        window.addEventListener('DOMContentLoaded', window.initFirebaseApp);
    }

    // Kiểm tra IP bị cấm
    var cachedIp = '';
    window.getUserIpAddress = async function() {
        if (cachedIp) return cachedIp;
        var sessionIp = sessionStorage.getItem('user_client_ip');
        if (sessionIp && sessionIp.trim().length >= 7) {
            cachedIp = sessionIp.trim();
            return cachedIp;
        }

        var providers = [
            async function() {
                var res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
                var data = await res.json();
                return data.ip;
            },
            async function() {
                var res = await fetch('https://api64.ipify.org?format=json', { cache: 'no-store' });
                var data = await res.json();
                return data.ip;
            },
            async function() {
                var res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
                var data = await res.json();
                return data.ip;
            }
        ];

        for (var i = 0; i < providers.length; i++) {
            try {
                var ip = await providers[i]();
                if (ip && typeof ip === 'string' && ip.trim().length >= 7) {
                    var cleanIp = ip.trim();
                    cachedIp = cleanIp;
                    sessionStorage.setItem('user_client_ip', cleanIp);
                    return cleanIp;
                }
            } catch (e) {}
        }
        return '';
    };

    window.showIpBanScreen = function(ip) {
        document.body.innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0f172a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;font-family:sans-serif;text-align:center;padding:20px;">
                <div style="background:rgba(239,68,68,0.1);border:2px solid #ef4444;border-radius:16px;padding:40px;max-width:550px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                    <div style="font-size:64px;margin-bottom:16px;">🚫</div>
                    <h1 style="color:#ef4444;font-size:24px;margin-bottom:12px;font-weight:700;">ĐỊA CHỈ IP CỦA BẠN ĐÃ BỊ CẤM</h1>
                    <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:20px;">
                        Địa chỉ IP <strong style="color:#f87171;background:rgba(239,68,68,0.2);padding:2px 8px;border-radius:4px;">${ip}</strong> đã bị cấm khỏi hệ thống do vi phạm điều khoản dịch vụ hoặc hành vi bất thường.
                    </p>
                    <div style="font-size:13px;color:#94a3b8;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
                        Nếu bạn cho rằng đây là sự nhầm lẫn, vui lòng liên hệ Admin qua email hỗ trợ: <strong style="color:#38bdf8;">${window.SUPPORT_CONTACT_EMAIL}</strong> hoặc qua Fanpage chính thức.
                    </div>
                </div>
            </div>
        `;
    };

    window.checkBannedIp = async function() {
        try {
            if (!window.db) return false;
            var clientIp = await window.getUserIpAddress();
            if (!clientIp) return false;

            var safeIpDoc = clientIp.replace(/\\./g, '_');
            var docRef = await window.db.collection('banned_ips').doc(safeIpDoc).get();
            if (docRef.exists) {
                window.showIpBanScreen(clientIp);
                return true;
            }
            var docRaw = await window.db.collection('banned_ips').doc(clientIp).get();
            if (docRaw.exists) {
                window.showIpBanScreen(clientIp);
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    };
})();
