import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- FIREBASE KONFIGURATSIYASI ---
const firebaseConfig = {
    apiKey: "AIzaSyBijn4YAYVsEaTTDqJhhlZ7i8R4HnK0vlM",
    authDomain: "test-course-cdde6.firebaseapp.com",
    projectId: "test-course-cdde6",
    storageBucket: "test-course-cdde6.firebasestorage.app",
    messagingSenderId: "558737934912",
    appId: "1:558737934912:web:96bef39662f3325d3aeda5",
    measurementId: "G-H8ZVHFFH5G"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// HTML elementlarini tanib olish
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");
const appSection = document.getElementById("appSection");
const addBtn = document.getElementById("addBtn");
const taskList = document.getElementById("taskList");
const taskInput = document.getElementById("taskInput");

let currentView = 'my'; 

// ==========================================
// YANGI FUNKSIYALAR: OVOZ VA PROGRESS
// ==========================================

function playSound(type) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'add') {
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'complete') {
        oscillator.frequency.setValueAtTime(523, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    }
}

function updateProgress() {
    const tasks = document.querySelectorAll('.task-item');
    const completedTasks = document.querySelectorAll('.task-item.completed');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    
    if (!progressBar || !progressPercent) return;

    if (tasks.length === 0) {
        progressBar.style.width = "0%";
        progressPercent.innerText = "0%";
        return;
    }

    const percent = Math.round((completedTasks.length / tasks.length) * 100);
    progressBar.style.width = percent + "%";
    progressPercent.innerText = percent + "%";
}

// ==========================================
// AUTH (KIRISH-CHIQISH) TIZIMI
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginBtn.style.display = "none";
        userInfo.style.display = "flex";
        appSection.style.display = "block";
        document.getElementById("userName").innerText = user.displayName;
        document.getElementById("userImg").src = user.photoURL;
        
        // Progress barni yoqish
        const progCont = document.getElementById("progressContainer");
        if(progCont) progCont.style.display = "block";

        loadTasks(user.uid);
    } else {
        loginBtn.style.display = "block";
        userInfo.style.display = "none";
        appSection.style.display = "none";
        taskList.innerHTML = "";
        
        // Progress barni yashirish
        const progCont = document.getElementById("progressContainer");
        if(progCont) progCont.style.display = "none";
    }
});

loginBtn.onclick = () => signInWithPopup(auth, provider).catch(err => alert("Xato: " + err.message));
logoutBtn.onclick = () => signOut(auth);

// ==========================================
// REJA QO'SHISH
// ==========================================
addBtn.onclick = async () => {
    const text = taskInput.value;
    const deadline = document.getElementById("taskDeadline")?.value || "";
    const priority = document.getElementById("taskPriority")?.value || "medium";
    const visibility = document.getElementById("taskVisibility")?.value || "private";

    if (text.trim() !== "" && auth.currentUser) {
        try {
            await addDoc(collection(db, "tasks"), {
                text: text,
                deadline: deadline,
                priority: priority,
                visibility: visibility, 
                uid: auth.currentUser.uid,
                userName: auth.currentUser.displayName,
                completed: false,
                createdAt: serverTimestamp()
            });
            taskInput.value = "";
            playSound('add'); // <--- YANGI VAZIFA QO'SHILGANDA OVOZ
        } catch (e) {
            console.error("Xato yuz berdi: ", e);
        }
    } else {
        alert("Reja mazmunini kiriting!");
    }
};

// ==========================================
// REJALARNI BAZADAN YUKLASH
// ==========================================
function loadTasks(uid) {
    let q;
    if (currentView === 'my') {
        q = query(collection(db, "tasks"), where("uid", "==", uid), orderBy("createdAt", "desc"));
    } else {
        q = query(collection(db, "tasks"), where("visibility", "==", "public"), orderBy("createdAt", "desc"));
    }

    onSnapshot(q, (snapshot) => {
        taskList.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const task = docSnap.data();
            const id = docSnap.id;
            const isComp = task.completed ? "completed" : "";
            
            const deadlineText = task.deadline ? 
                new Date(task.deadline).toLocaleString('uz-UZ', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }) : '';

            const li = document.createElement("li");
            li.className = `task-item ${task.priority || 'medium'} ${isComp}`;
            
            const ownerInfo = (currentView === 'public' && task.userName) ? `<br><small style="color:#1a73e8">👤 ${task.userName}</small>` : "";

            li.innerHTML = `
                <div class="task-info">
                    <b class="task-text">${task.text}</b> ${ownerInfo}
                    <small class="task-time">${deadlineText ? '⏰ ' + deadlineText : ''}</small>
                </div>
                <div class="actions">
                    ${currentView === 'my' ? `
                        <button onclick="window.toggleTask('${id}', ${task.completed})">✅</button>
                        <button onclick="window.deleteTask('${id}')">🗑️</button>
                    ` : ""}
                </div>
            `;
            taskList.appendChild(li);
        });
        
        updateProgress(); // <--- RO'YXAT YUKLANGANDA PROGRESS HISOBIDAN O'TADI
    });
}

// ==========================================
// GLOBAL FUNKSIYALAR (HTML DAN CHAQIRILADI)
// ==========================================
window.changeView = (view) => {
    currentView = view;
    document.getElementById("myTasksTab")?.classList.toggle("active", view === 'my');
    document.getElementById("publicTasksTab")?.classList.toggle("active", view === 'public');
    
    if (auth.currentUser) loadTasks(auth.currentUser.uid);
};

window.deleteTask = (id) => confirm("O'chirasizmi?") && deleteDoc(doc(db, "tasks", id));

window.toggleTask = (id, status) => {
    updateDoc(doc(db, "tasks", id), { completed: !status });
    if (!status) {
        playSound('complete'); // <--- VAZIFA BAJARILGANDA OVOZ CHIQADI
    }
};

// ==========================================
// SMART ALARM (ESLATMA)
// ==========================================
setInterval(() => {
    const hozir = new Date();
    document.querySelectorAll('.task-item:not(.completed)').forEach(item => {
        const timeEl = item.querySelector('.task-time');
        if (timeEl && timeEl.innerText !== "") {
            const cleanTime = timeEl.innerText.replace('⏰ ', '').replace(' ', 'T');
            const taskDate = new Date(cleanTime);
            
            if (taskDate <= hozir && taskDate > new Date(hozir - 30000)) { 
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play();
                alert("ESLATMA: " + item.querySelector('.task-text').innerText);
            }
        }
    });
}, 30000); 

// ==========================================
// DARK MODE
// ==========================================
const toggleSwitch = document.querySelector('#checkbox');

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    if(toggleSwitch) toggleSwitch.checked = true;
}

if(toggleSwitch) {
    toggleSwitch.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    });
}





// onSnapshot ichidagi li yaratish qismiga kategoriya tegini qo'shing:
const li = document.createElement("li");
li.className = `task-item ${task.priority || 'medium'} ${isComp}`;
li.setAttribute('data-cat', task.category); // CSS ranglar uchun

li.innerHTML = `
    <div class="task-info">
        <span class="category-tag">${task.category || '💡 Umumiy'}</span><br>
        <b class="task-text">${task.text}</b> ${ownerInfo}
        <small class="task-time">${deadlineText ? '⏰ ' + deadlineText : ''}</small>
    </div>
    <div class="actions">
        ${currentView === 'my' ? `
            <button onclick="window.toggleTask('${id}', ${task.completed})">✅</button>
            <button onclick="window.deleteTask('${id}')">🗑️</button>
        ` : ""}
    </div>
`;


// --- DILSHOD UCHUN MAXSUS: "TERMINATOR" TIL KODI ---
// Bu kod hamma narsani chetlab o'tib, to'g'ridan-to'g'ri elementlarga yopishadi

const dilsDict = {
    uz: { w: "Xush kelibsiz", s: "Rejalaringizni tartibga soling", a: "Qo'shish" },
    ru: { w: "Добро пожаловать", s: "Организуйте свои планы", a: "Добавить" },
    en: { w: "Welcome", s: "Organize your plans", a: "Add Task" }
};

// Funksiyani window ob'ektiga bog'laymiz (HTML ko'rishi uchun)
window.changeLanguage = function(lang) {
    const t = dilsDict[lang];
    if (!t) return;

    // ID-ga qarab emas, ekrandagi matnga qarab ham qidirib ko'ramiz
    const allH1 = document.getElementsByTagName('h1');
    for (let h1 of allH1) {
        if (h1.innerText.includes("Xush") || h1.innerText.includes("Welcome") || h1.innerText.includes("Добро")) {
            h1.innerText = t.w;
        }
    }

    const allP = document.getElementsByTagName('p');
    for (let p of allP) {
        if (p.innerText.includes("Reja") || p.innerText.includes("Organize") || p.innerText.includes("Организуйте")) {
            p.innerText = t.s;
        }
    }

    const allBtn = document.getElementsByTagName('button');
    for (let b of allBtn) {
        if (b.id === 'addBtn' || b.innerText.includes("Qo'shish") || b.innerText.includes("Add") || b.innerText.includes("Добавить")) {
            b.innerText = t.a;
        }
    }
    
    localStorage.setItem('saved_lang', lang);
};

// Select o'zgarganda ishlatish
document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('langSelect');
    if (sel) {
        sel.addEventListener('change', (e) => window.changeLanguage(e.target.value));
        const saved = localStorage.getItem('saved_lang') || 'uz';
        sel.value = saved;
        window.changeLanguage(saved);
    }
});

