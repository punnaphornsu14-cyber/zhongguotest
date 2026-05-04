# 🚀 คู่มือการติดตั้ง Firebase RBAC System
## สำหรับครูภาษาจีน รัตนราษฎร์บำรุง ม.1

---

## 📁 โครงสร้างไฟล์

```
your-project/
├── index.html              ← หน้า Login
├── teacher-dashboard.html  ← หน้าครู
├── student-portal.html     ← หน้านักเรียน
├── admin-panel.html        ← หน้า Dev (God Mode)
├── style.css               ← ไฟล์ style ทั้งหมด
├── auth.js                 ← Firebase config + Route Guard
└── img/                    ← รูปภาพเดิมของคุณ
```

---

## 1️⃣ ตั้งค่า Firebase Console

### ขั้นตอน 1: เปิดใช้ Authentication

1. ไปที่ [Firebase Console](https://console.firebase.google.com) → เลือกโปรเจกต์ `zhonggou-nihao`
2. เมนูซ้าย → **Build → Authentication**
3. คลิก **Get started**
4. แท็บ **Sign-in method** → เลือก **Email/Password**
5. เปิดสวิตช์ Enable → **Save**
6. กลับไปที่แท็บ **Sign-in method** → คลิก **Add new provider** → เลือก **Google**
7. เปิดสวิตช์ Enable → กรอก **Project support email** → **Save**

### ขั้นตอน 2: ดู Firebase Config

1. ⚙️ (Settings) → **Project settings**
2. เลื่อนลงมาที่ **Your apps** → คลิก `</>` (Web)
3. Copy ค่า `firebaseConfig` ทั้งหมด

### ขั้นตอน 3: ใส่ Config ใน auth.js

เปิดไฟล์ `auth.js` บรรทัด 18–25 แล้วแทนที่ด้วยค่าจริง:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",           // ← ค่าจริงของคุณ
  authDomain:        "zhonggou-nihao.firebaseapp.com",
  databaseURL:       "https://zhonggou-nihao-default-rtdb.firebaseio.com/",
  projectId:         "zhonggou-nihao",
  storageBucket:     "zhonggou-nihao.appspot.com",
  messagingSenderId: "123456789",           // ← ค่าจริงของคุณ
  appId:             "1:123456789:web:abc"  // ← ค่าจริงของคุณ
};
```

---

## 2️⃣ โครงสร้าง Database (JSON Schema)

เส้นทางหลัก: `/users/{uid}`

```json
{
  "users": {
    "UID_ของผู้ใช้": {
      "displayName": "อาจารย์สมชาย",
      "email": "somchai@school.ac.th",
      "role": "teacher",
      "online": false,
      "createdAt": 1714500000000,
      "createdBy": "UID_ของ_admin"
    },
    "UID_นักเรียน_01": {
      "displayName": "เด็กชายมานะ",
      "email": "mana@student.ac.th",
      "role": "student",
      "online": true,
      "createdAt": 1714500000001,
      "createdBy": "UID_ของ_admin"
    }
  },
  "quizzes": {
    "QUIZ_ID": {
      "question": "你好 แปลว่าอะไร?",
      "options": ["สวัสดี", "ขอบคุณ", "ลาก่อน", "ขอโทษ"],
      "answer": "สวัสดี",
      "type": "choice",
      "chapter": 1,
      "createdAt": 1714500000002,
      "createdBy": "UID_ของครู"
    }
  }
}
```

### ค่า role ที่รองรับ:
| Role | หน้าที่ redirect ไป | สิทธิ์ |
|------|---------------------|--------|
| `student` | student-portal.html | ดูสไลด์ + เล่นแบบทดสอบ |
| `teacher` | teacher-dashboard.html | อัปโหลดสื่อ + สร้างแบบทดสอบ |
| `dev` | admin-panel.html | จัดการผู้ใช้ทั้งหมด |

---

## 3️⃣ Database Security Rules

ไปที่ Firebase Console → **Realtime Database → Rules**  
วาง Rules นี้ลงไปแล้ว **Publish**:

```json
{
  "rules": {
    "users": {
      // ★ อ่านทั้ง collection ได้ถ้า: role=dev หรือ role=teacher
      ".read": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'dev' || root.child('users').child(auth.uid).child('role').val() == 'teacher')",
      // ★ จำเป็นสำหรับ orderByChild('role') ในหน้า Teacher
      ".indexOn": ["role", "email"],
      "$uid": {
        // อ่านได้ถ้า: เป็นเจ้าของ (กรณี student อ่านข้อมูลตัวเอง)
        ".read": "auth != null && auth.uid == $uid",
        // เขียนได้ถ้า: เป็นเจ้าของ หรือ role=dev
        ".write": "auth != null && (auth.uid == $uid || root.child('users').child(auth.uid).child('role').val() == 'dev')",
        "role": {
          // เปลี่ยน role ได้เฉพาะ dev เท่านั้น
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'dev'"
        }
      }
    },
    "quizzes": {
      // อ่านได้ทุกคนที่ login
      ".read": "auth != null",
      // เขียนได้เฉพาะ teacher และ dev
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'teacher' || root.child('users').child(auth.uid).child('role').val() == 'dev')"
    }
  }
}
```

---

## 4️⃣ สร้างบัญชีผู้ใช้แรก (Dev Account)

เนื่องจาก Admin Panel ต้องการบัญชี `dev` ก่อน ให้สร้างด้วยตนเองครั้งแรก:

### วิธีที่ 1: ผ่าน Firebase Console (แนะนำ)

1. **Authentication → Users → Add user**
2. กรอกอีเมลและรหัสผ่านของคุณ → **Add user**
3. Copy **UID** ที่ได้
4. **Realtime Database → Data** → คลิก ➕ เพิ่ม node:
   ```
   /users/{UID_ที่ copy มา}/
     displayName: "Admin"
     email: "your@email.com"
     role: "dev"
     online: false
     createdAt: 1714500000000
   ```

### วิธีที่ 2: ใช้หน้า Admin Panel
หลังจากสร้างบัญชี dev แรกด้วยตนเองแล้ว  
ล็อกอินด้วยบัญชี dev → ใช้ฟอร์ม **"สร้างบัญชีผู้ใช้ใหม่"** สร้างครู/นักเรียนได้เลย

---

## 5️⃣ วิธีลิงก์ Scripts ในไฟล์ HTML

ทุกหน้าต้องมี 4 script นี้ **ก่อนปิด `</body>`** เรียงตามลำดับ:

```html
<!-- 1. Firebase Core -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<!-- 2. Firebase Auth -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
<!-- 3. Firebase Realtime Database -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>
<!-- 4. auth.js (config + route guard) — ต้องมาหลัง Firebase scripts -->
<script src="auth.js"></script>
```

### หน้า Dashboard ใช้ Route Guard แบบนี้:

```javascript
// teacher-dashboard.html
routeGuard('teacher', (user, userData) => {
  // โค้ดที่รันหลังจากตรวจสิทธิ์ผ่านแล้ว
  console.log('ยินดีต้อนรับ', userData.displayName);
});

// student-portal.html
routeGuard('student', (user, userData) => { ... });

// admin-panel.html
routeGuard('dev', (user, userData) => { ... });
```

---

## 🔐 สรุป Flow การทำงาน

```
ผู้ใช้เปิด teacher-dashboard.html
         ↓
routeGuard('teacher') ทำงาน
         ↓
onAuthStateChanged ตรวจ session
    ├── ไม่ได้ login → redirect index.html + alert
    └── login แล้ว → ดึง /users/{uid}/role
              ├── role ≠ 'teacher' → redirect ไปหน้าของ role นั้น
              └── role = 'teacher' → ✅ แสดงหน้า + trackPresence()
```

---

## ❓ FAQ

**Q: ถ้า login แล้ว refresh หน้า จะต้อง login ใหม่ไหม?**  
A: ไม่ครับ Firebase จัดการ session ให้อัตโนมัติผ่าน `onAuthStateChanged`

**Q: ครูเปิด admin-panel.html ได้ไหม?**  
A: ไม่ได้ — Route Guard จะ redirect ไปหน้า teacher-dashboard.html ทันที

**Q: นักเรียนจะเห็น quiz ของครูคนอื่นไหม?**  
A: เห็น (เพราะ `/quizzes` อ่านได้ทุกคนที่ login) — ถ้าต้องการแยกต้องเพิ่ม filter ตาม `chapter` หรือ `createdBy`
