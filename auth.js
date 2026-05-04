/**
 * auth.js — Firebase RBAC Authentication Core
 * ─────────────────────────────────────────────
 * Handles:
 *  1. Firebase initialization
 *  2. Session persistence (onAuthStateChanged)
 *  3. Route Guard middleware
 *  4. Role-based redirect logic
 *  5. Online presence tracking (Realtime Database)
 *
 * Usage:
 *   Include this script on EVERY page (login + dashboards).
 *   Call routeGuard('teacher') | routeGuard('student') | routeGuard('dev')
 *   on protected pages to enforce access control.
 */

// ═══════════════════════════════════════════════════════
// 1. Firebase Configuration
//    ⚠️ Replace these values with your actual Firebase project config
//    Found in: Firebase Console → Project Settings → Your Apps
// ═══════════════════════════════════════════════════════
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCqfGIojx_jrTSkWxrgqhfrhmFEQExJbFA",
  authDomain: "zhonggou-nihao.firebaseapp.com",
  databaseURL: "https://zhonggou-nihao-default-rtdb.firebaseio.com",
  projectId: "zhonggou-nihao",
  storageBucket: "zhonggou-nihao.firebasestorage.app",
  messagingSenderId: "975813566943",
  appId: "1:975813566943:web:46c244a1cd5cffc331246a",
  measurementId: "G-4D0BGWK5WD"
};
// Initialize Firebase (guard against double-init in SPAs)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.database();

// ═══════════════════════════════════════════════════════
// 2. Role → Page Routing Map
// ═══════════════════════════════════════════════════════
const ROLE_ROUTES = {
  teacher: 'teacher-dashboard.html',
  student: 'student-portal.html',
  dev:     'admin-panel.html',
};

// ═══════════════════════════════════════════════════════
// 3. Online Presence Tracking
//    Writes user's online/offline status to DB in real time.
//    Path: /users/{uid}/online  (true | false)
// ═══════════════════════════════════════════════════════
function trackPresence(uid) {
  const userRef    = db.ref(`/users/${uid}/online`);
  const connRef    = db.ref('.info/connected');

  connRef.on('value', snap => {
    if (!snap.val()) return; // Not connected
    // When disconnected → mark offline
    userRef.onDisconnect().set(false);
    // Mark online now
    userRef.set(true);
  });
}

// ═══════════════════════════════════════════════════════
// 4. Route Guard Middleware
//    Call on every protected dashboard page:
//      routeGuard('teacher')  — only teachers allowed
//      routeGuard('student')  — only students allowed
//      routeGuard('dev')      — only dev/admin allowed
//
//    Behaviour:
//      - Not logged in        → redirect to index.html
//      - Wrong role           → redirect to index.html + alert
//      - Correct role         → allow, render page, call onReady(user, userData)
// ═══════════════════════════════════════════════════════
function routeGuard(requiredRole, onReady) {
  // Show a loading overlay while we verify auth
  showGuardOverlay('กำลังตรวจสอบสิทธิ์…', 'fa-circle-notch fa-spin');

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // Not authenticated → back to login
      sessionStorage.setItem('guardMessage', 'กรุณาเข้าสู่ระบบก่อน');
      window.location.replace('index.html');
      return;
    }

    // ★ ตรวจสอบว่าอีเมลได้รับการยืนยันแล้วหรือยัง
    if (!user.emailVerified) {
      await auth.signOut();
      sessionStorage.setItem('guardMessage', 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ โดยเปิดอีเมลและคลิกลิงก์ยืนยัน');
      window.location.replace('index.html');
      return;
    }

    try {
      const snap = await db.ref(`/users/${user.uid}`).get();
      if (!snap.exists()) {
        await auth.signOut();
        sessionStorage.setItem('guardMessage', 'ไม่พบข้อมูลผู้ใช้');
        window.location.replace('index.html');
        return;
      }

      const userData = snap.val();
      const role     = userData.role;

      // ★ อัปเดตสถานะ emailVerified ใน Database ถ้ายังไม่ได้อัปเดต
      if (!userData.emailVerified) {
        await db.ref(`/users/${user.uid}/emailVerified`).set(true);
      }

      // Check role match
      if (role !== requiredRole) {
        // Wrong role — redirect to their correct page or login
        if (ROLE_ROUTES[role]) {
          window.location.replace(ROLE_ROUTES[role]);
        } else {
          sessionStorage.setItem('guardMessage', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
          window.location.replace('index.html');
        }
        return;
      }

      // ✅ Authorized — track presence, remove overlay, call callback
      trackPresence(user.uid);
      removeGuardOverlay();

      if (typeof onReady === 'function') {
        onReady(user, userData);
      }

    } catch (err) {
      console.error('Route guard error:', err);
      sessionStorage.setItem('guardMessage', 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์');
      window.location.replace('index.html');
    }
  });
}

// ═══════════════════════════════════════════════════════
// 5. Sign Out
// ═══════════════════════════════════════════════════════
async function signOut() {
  const uid = auth.currentUser?.uid;
  if (uid) {
    await db.ref(`/users/${uid}/online`).set(false);
  }
  await auth.signOut();
  window.location.replace('index.html');
}

// ═══════════════════════════════════════════════════════
// 6. Guard Overlay Helpers (internal)
// ═══════════════════════════════════════════════════════
function showGuardOverlay(message, iconClass) {
  if (document.getElementById('__guardOverlay')) return;
  const div = document.createElement('div');
  div.id = '__guardOverlay';
  div.className = 'guard-overlay';
  div.innerHTML = `
    <i class="fas ${iconClass}" style="font-size:48px;color:#b8a38b;"></i>
    <h2>${message}</h2>
    <p>กรุณารอสักครู่…</p>
  `;
  document.body.appendChild(div);
}

function removeGuardOverlay() {
  const el = document.getElementById('__guardOverlay');
  if (el) el.remove();
}

// ═══════════════════════════════════════════════════════
// 7. Login page: Show guard message if redirected here
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const msg = sessionStorage.getItem('guardMessage');
  if (msg) {
    sessionStorage.removeItem('guardMessage');
    const banner = document.getElementById('errorBanner');
    const text   = document.getElementById('errorText');
    if (banner && text) {
      text.textContent = msg;
      banner.classList.remove('hidden');
    }
  }
});
