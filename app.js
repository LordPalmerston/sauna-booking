import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, where, onSnapshot, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === FIREBASE CONFIGURATION ===
const firebaseConfig = {
    apiKey: "AIzaSyB7dQJSakQv3EBqSL2GxsF7KL_5SFbSHIw",
    authDomain: "sauna-tranholmen-v2.firebaseapp.com",
    projectId: "sauna-tranholmen-v2",
    storageBucket: "sauna-tranholmen-v2.firebasestorage.app",
    messagingSenderId: "681183297576",
    appId: "1:681183297576:web:a1a0a17c7d84a056f4351d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// === APP STATE ===
const INVITE_CODE_USER = "TRANHOLMEN";
const INVITE_CODE_ADMIN = "ADMIN777";

let currentUser = null;
let currentRole = 'user';
let currentMembership = null; // { expiresAt, isRemoved }
let currentWeekOffset = 0;
let unsubscribeBookings = null;
let unsubscribeMyBookings = null;
let currentBookings = []; 

// Modal State
let targetSlot = null;
let existingBooking = null;
let newBookingTimesToBook = []; // array of time strings dynamically set by the select dropdown
let targetBlockIds = []; // array of doc IDs for entire blocks to delete/modify at once

// Precompute valid times array (00:00 to 24:00)
const allTimes = [];
for(let h=0; h<24; h++) {
    for(let m=0; m<60; m+=30) { allTimes.push(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`); }
}
allTimes.push("24:00"); // Bound limit for midnight

// === UI ELEMENTS ===
const views = { 
    loading: document.getElementById('loading-view'), 
    auth: document.getElementById('auth-view'), 
    main: document.getElementById('main-view'), 
    admin: document.getElementById('admin-view') 
};
const btns = { logout: document.getElementById('btn-logout'), admin: document.getElementById('btn-admin-panel'), backCal: document.getElementById('btn-back-calendar') };
const calGrid = document.getElementById('calendar-grid');
const weekLabel = document.getElementById('current-week-label');
const modal = document.getElementById('booking-modal');
const modalTitle = document.getElementById('modal-title');
const modalTime = document.getElementById('modal-time-label');
const modalErr = document.getElementById('modal-error');
const endTimeContainer = document.getElementById('end-time-container');
const endTimeSelect = document.getElementById('modal-end-time');
const membershipBadge = document.getElementById('membership-badge');
const planModal = document.getElementById('plan-selection-modal');

// === FEATURE TOGGLES ===
const MEMBERSHIP_ENFORCEMENT_ENABLED = true; // Set to false to allow everyone to book and see the door code (except restricted users)

let currentDoorCode = "";
let unsubscribeDoorCode = null;
const doorCodeBadge = document.getElementById('door-code-badge');
const doorCodeValue = document.getElementById('door-code-value');
const adminDoorCodeInput = document.getElementById('admin-door-code-input');
const btnUpdateDoorCode = document.getElementById('btn-update-door-code');
const adminDoorCodeMsg = document.getElementById('admin-door-code-msg');

function formatEuroDate(date) {
    if (!date) return "";
    // If it's already a YYYY-MM-DD string, just reformat it without Date object conversion to avoid timezone shifts
    if (typeof date === 'string' && date.includes('-') && date.length === 10) {
        const [y, m, d] = date.split('-');
        return `${d}/${m}/${y}`;
    }
    const d = date.toDate ? date.toDate() : new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active-view'));
    views[viewName].classList.add('active-view');
}

// === AUTH LOGIC ===
document.getElementById('btn-show-register').addEventListener('click', () => { document.getElementById('login-form').classList.remove('active-form'); document.getElementById('register-form').classList.add('active-form'); document.getElementById('btn-show-login').classList.remove('active'); document.getElementById('btn-show-register').classList.add('active'); });
document.getElementById('btn-show-login').addEventListener('click', () => { document.getElementById('register-form').classList.remove('active-form'); document.getElementById('login-form').classList.add('active-form'); document.getElementById('btn-show-register').classList.remove('active'); document.getElementById('btn-show-login').classList.add('active'); });

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const invite = document.getElementById('reg-invite').value.trim();
    const scren = document.getElementById('reg-screenname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-password').value;
    const errEl = document.getElementById('reg-error');
    errEl.textContent = "";

    let role = 'user';
    if (invite === INVITE_CODE_ADMIN) role = 'admin';
    else if (invite !== INVITE_CODE_USER) return errEl.textContent = "Invalid Invite Code.";

    errEl.textContent = "Creating account...";
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: scren });
        await setDoc(doc(db, "users", cred.user.uid), { 
            screenname: scren, 
            email: email, 
            role: role,
            hasPaidFullMembership: false,
            membership: { expiresAt: null, isRemoved: false, status: 'none', plan: null, pendingPlan: null }
        });
        errEl.textContent = "";
    } catch (err) { errEl.textContent = err.message; }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.textContent = "Signing in...";
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); 
        errEl.textContent = "";
    }
    catch (err) { errEl.textContent = "Invalid credentials."; }
});

document.getElementById('btn-forgot-password').addEventListener('click', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('login-email').value;
    const errEl = document.getElementById('login-error');
    if (!emailInput) {
        errEl.textContent = "Please enter your email address first.";
        return;
    }
    errEl.textContent = "Sending reset email...";
    try {
        await sendPasswordResetEmail(auth, emailInput);
        errEl.textContent = "Password reset email sent! Check your inbox.";
        errEl.style.color = "var(--success-color)";
    } catch (err) {
        errEl.textContent = "Failed to send reset email: " + err.message;
        errEl.style.color = "var(--danger-color)";
    }
});

btns.logout.addEventListener('click', () => signOut(auth));

document.getElementById('btn-edit-name').addEventListener('click', async () => {
    if(!currentUser) return;
    const newName = prompt("Enter your new screenname:", currentUser.displayName);
    if (newName && newName.trim() !== "" && newName.trim() !== currentUser.displayName) {
        try {
            const finalName = newName.trim();
            await updateProfile(currentUser, { displayName: finalName });
            await updateDoc(doc(db, "users", currentUser.uid), { screenname: finalName });
            document.getElementById('user-display-name').textContent = `Hello, ${finalName}`;
            
            // Retroactively update all previous bookings dynamically
            const q = query(collection(db, "bookings"), where("userId", "==", currentUser.uid));
            const snap = await getDocs(q);
            const promises = snap.docs.map(d => updateDoc(doc(db, "bookings", d.id), { screenname: finalName }));
            await Promise.all(promises);
            
            alert("Screenname successfully updated!");
        } catch(e) { alert("Failed to update screenname."); }
    }
});

function updateMembershipUI(membership) {
    if (!membershipBadge) return;
    membershipBadge.className = 'badge';
    
    if (!MEMBERSHIP_ENFORCEMENT_ENABLED) {
        if (membership && membership.isRemoved) {
            membershipBadge.textContent = "Access Restricted";
            membershipBadge.classList.add('expired');
        } else {
            membershipBadge.textContent = "Unlimited Access";
            membershipBadge.classList.add('active');
        }
        updateDoorCodeUI();
        return;
    }
    
    if (membership && membership.isRemoved) {
        membershipBadge.textContent = "Access Restricted";
        membershipBadge.classList.add('expired');
    } else if (membership && membership.status === 'pending_payment') {
        membershipBadge.textContent = "Pending Approval";
        membershipBadge.classList.add('expired');
    } else if (membership && membership.status === 'approved_pending_start') {
        membershipBadge.textContent = "Ready to Start";
        membershipBadge.classList.add('active');
    } else if (membership && membership.expiresAt) {
        const exp = membership.expiresAt.toDate ? membership.expiresAt.toDate() : new Date(membership.expiresAt);
        if (exp < new Date()) {
            membershipBadge.textContent = "Expired";
            membershipBadge.classList.add('expired');
        } else {
            membershipBadge.textContent = `Active until ${formatEuroDate(exp)}`;
            membershipBadge.classList.add('active');
        }
    } else {
        membershipBadge.textContent = "No Active Plan";
        membershipBadge.classList.add('none');
    }
    
    updateDoorCodeUI();
}

function updateDoorCodeUI() {
    if (!doorCodeBadge || !doorCodeValue) return;
    
    let hasAccess = false;
    if (!MEMBERSHIP_ENFORCEMENT_ENABLED) {
        if (['admin', 'moderator'].includes(currentRole) || (currentMembership && !currentMembership.isRemoved)) {
            hasAccess = true;
        }
    } else {
        if (['admin', 'moderator'].includes(currentRole)) {
            hasAccess = true;
        } else if (currentMembership) {
            if (currentMembership.status === 'approved_pending_start') {
                hasAccess = true;
            } else if (currentMembership.status === 'active' && currentMembership.expiresAt) {
                const exp = currentMembership.expiresAt.toDate ? currentMembership.expiresAt.toDate() : new Date(currentMembership.expiresAt);
                if (exp > new Date()) hasAccess = true;
            }
        }
    }
    
    if (hasAccess && currentDoorCode) {
        doorCodeValue.textContent = currentDoorCode;
        doorCodeBadge.className = 'badge active';
    } else {
        doorCodeValue.textContent = "Hidden";
        doorCodeBadge.className = 'badge none';
    }
}

// Handle persistent login immediately
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('user-display-name').textContent = `Hello, ${user.displayName || user.email}`;
        btns.admin.classList.toggle('hidden', !['admin', 'moderator'].includes(currentRole));
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (uDoc.exists()) {
                const data = uDoc.data();
                currentRole = data.role;
                currentMembership = data.membership || { expiresAt: null, isRemoved: false, status: 'none' };
                
                if (currentMembership.isRemoved && !['admin', 'moderator'].includes(currentRole)) {
                    alert("Your account has been removed. Please contact the administrator.");
                    signOut(auth);
                    return;
                }
                updateMembershipUI(currentMembership);

                if (MEMBERSHIP_ENFORCEMENT_ENABLED && !['admin', 'moderator'].includes(currentRole)) {
                    let hasAccess = false;
                    if (currentMembership.status === 'approved_pending_start') hasAccess = true;
                    if (currentMembership.status === 'pending_payment') hasAccess = true;
                    if (currentMembership.status === 'active' && currentMembership.expiresAt) {
                        const exp = currentMembership.expiresAt.toDate ? currentMembership.expiresAt.toDate() : new Date(currentMembership.expiresAt);
                        if (exp > new Date()) hasAccess = true;
                    }

                    if (!hasAccess) {
                        document.getElementById('main-view').classList.add('blur-background');
                        const hasPaidFull = data.hasPaidFullMembership === true;
                        
                        document.getElementById('plan-card-full').style.display = hasPaidFull ? 'none' : 'flex';
                        document.getElementById('plan-card-full-yearly').style.display = hasPaidFull ? 'none' : 'flex';
                        
                        const yearlyInput = document.querySelector('input[value="annual_renew"]');
                        if (hasPaidFull) {
                            yearlyInput.disabled = false;
                            document.getElementById('plan-card-annual-renew').style.display = 'flex';
                        } else {
                            yearlyInput.disabled = true;
                            document.getElementById('plan-card-annual-renew').style.display = 'none';
                        }
                        
                        // Reset selection
                        document.querySelectorAll('input[name="plan_choice"]').forEach(r => r.checked = false);
                        document.getElementById('payment-instructions').style.display = 'none';
                        document.getElementById('btn-submit-plan').disabled = true;
                        document.getElementById('btn-cancel-plan').style.display = 'none';
                        
                        planModal.classList.add('active');
                    } else {
                        document.getElementById('main-view').classList.remove('blur-background');
                        planModal.classList.remove('active');
                    }
                } else {
                    document.getElementById('main-view').classList.remove('blur-background');
                    planModal.classList.remove('active');
                }
            }
        } catch(e) { console.error(e); }
        
        btns.admin.classList.toggle('hidden', !['admin', 'moderator'].includes(currentRole));
        switchView('main');
        initCalendar();
        listenToMyBookings();
        listenToDoorCode();
    } else {
        if (unsubscribeBookings) unsubscribeBookings();
        if (unsubscribeMyBookings) unsubscribeMyBookings();
        if (unsubscribeDoorCode) unsubscribeDoorCode();
        currentUser = null; currentRole = 'user'; currentMembership = null; currentDoorCode = "";
        switchView('auth');
    }
});

// === PLAN MODAL LOGIC ===
document.querySelectorAll('input[name="plan_choice"]').forEach(radio => {
    radio.addEventListener('change', () => {
        document.getElementById('payment-instructions').style.display = 'block';
        document.getElementById('btn-submit-plan').disabled = false;
    });
});

document.getElementById('btn-cancel-plan').addEventListener('click', () => {
    planModal.classList.remove('active');
});

document.getElementById('btn-submit-plan').addEventListener('click', async () => {
    const selectedPlan = document.querySelector('input[name="plan_choice"]:checked').value;
    const errEl = document.getElementById('plan-modal-error');
    errEl.textContent = "Submitting request...";
    
    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            "membership.status": "pending_payment",
            "membership.pendingPlan": selectedPlan
        });
        currentMembership.status = 'pending_payment';
        currentMembership.pendingPlan = selectedPlan;
        updateMembershipUI(currentMembership);
        planModal.classList.remove('active');
        document.getElementById('main-view').classList.remove('blur-background');
        alert("Your request has been sent! Please ensure you've emailed the screenshot to saunatranholmen@gmail.com.");
    } catch (e) {
        errEl.textContent = e.message;
    }
});

// === CALENDAR LOGIC ===
function getStartOfWeek(offset = 0) {
    const d = new Date();
    const day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0,0,0,0);
    monday.setDate(monday.getDate() + (offset * 7));
    return monday;
}
function formatDate(date) { 
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

document.getElementById('btn-prev-week').addEventListener('click', () => { currentWeekOffset--; initCalendar(); });
document.getElementById('btn-next-week').addEventListener('click', () => { currentWeekOffset++; initCalendar(); });

function initCalendar() {
    const monday = getStartOfWeek(currentWeekOffset);
    weekLabel.textContent = `Week of ${formatEuroDate(monday)}`;
    
    let html = `<div class="cal-cell cal-header-cell" style="background:var(--bg-color); z-index:30; position:sticky; top:0; left:0;">Time</div>`;
    const days = [];
    for(let i=0; i<7; i++) {
        const d = new Date(monday); d.setDate(d.getDate() + i);
        days.push(d);
        const dayStr = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
        html += `<div class="cal-cell cal-header-cell">${dayStr} <br> ${d.getDate()}/${d.getMonth()+1}</div>`;
    }

    const times = allTimes.slice(0, 48); // 00:00 to 23:30
    times.forEach(t => {
        html += `<div class="cal-cell cal-time-cell">${t}</div>`;
        days.forEach(d => {
            const fDate = formatDate(d);
            const slotId = `${fDate}_${t}`;
            html += `<div class="cal-cell cal-slot" data-id="${slotId}" data-date="${fDate}" data-time="${t}">Available</div>`;
        });
    });

    calGrid.innerHTML = html;
    
    document.querySelectorAll('.cal-slot').forEach(el => {
        el.addEventListener('click', (e) => handleSlotClick(e.currentTarget));
    });

    listenToBookings(monday);
}

// === DATABASE SYNC ===
function listenToDoorCode() {
    if (unsubscribeDoorCode) unsubscribeDoorCode();
    unsubscribeDoorCode = onSnapshot(doc(db, "settings", "door"), (docSnap) => {
        if (docSnap.exists()) {
            currentDoorCode = docSnap.data().currentCode || "";
        } else {
            currentDoorCode = "";
        }
        if (adminDoorCodeInput) adminDoorCodeInput.value = currentDoorCode;
        updateDoorCodeUI();
    });
}

function listenToMyBookings() {
    if (unsubscribeMyBookings) unsubscribeMyBookings();
    const q = query(collection(db, "bookings"), where("userId", "==", currentUser.uid));
    
    unsubscribeMyBookings = onSnapshot(q, (snapshot) => {
        const todayStr = formatDate(new Date());
        const now = new Date();
        
        const upcomingDocs = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(b => {
                if (b.date < todayStr) return false;
                if (b.date === todayStr) {
                    const [y, m, dNum] = b.date.split('-').map(Number);
                    const [hrs, mins] = b.time.split(':').map(Number);
                    const slotDateTime = new Date(y, m - 1, dNum, hrs, mins);
                    if (slotDateTime < now) return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.time.localeCompare(b.time);
            });
            
        renderMyBookingsUI(upcomingDocs);
    });
}

function renderMyBookingsUI(slots) {
    const container = document.getElementById('my-upcoming-bookings');
    const list = document.getElementById('my-bookings-list');
    
    if (!slots || slots.length === 0) {
        container.style.display = 'block';
        list.innerHTML = `<div style="color:var(--text-muted); font-size: 0.85rem; padding: 10px 0;">No upcoming bookings.</div>`;
        return;
    }
    
    container.style.display = 'block';
    
    const sessions = [];
    let currentSession = null;
    
    slots.forEach(slot => {
        if (slot.status === 'maintenance') return;
        
        const slotIndex = allTimes.indexOf(slot.time);
        const nextTimeStr = allTimes[slotIndex + 1] || "24:00";
        
        if (currentSession && 
            currentSession.date === slot.date && 
            currentSession.endTime === slot.time) {
            currentSession.endTime = nextTimeStr;
        } else {
            if (currentSession) sessions.push(currentSession);
            currentSession = {
                date: slot.date,
                startTime: slot.time,
                endTime: nextTimeStr
            };
        }
    });
    if (currentSession) sessions.push(currentSession);
    
    list.innerHTML = "";
    sessions.forEach(s => {
        const card = document.createElement('div');
        card.className = 'my-booking-card';
        card.innerHTML = `
            <div class="my-booking-date">${formatEuroDate(s.date)}</div>
            <div class="my-booking-time">${s.startTime} - ${s.endTime}</div>
        `;
        list.appendChild(card);
    });
}

function listenToBookings(monday) {
    if (unsubscribeBookings) unsubscribeBookings();
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
    const q = query(collection(db, "bookings"), where("date", ">=", formatDate(monday)), where("date", "<=", formatDate(sunday)));
    
    unsubscribeBookings = onSnapshot(q, (snapshot) => {
        currentBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateCalendarUI();
    });
}

function updateCalendarUI() {
    document.querySelectorAll('.cal-slot').forEach(el => {
        el.className = "cal-cell cal-slot";
        el.innerHTML = "Available";
        el.style.borderBottom = "";
        el.style.borderTop = "";
    });

    const bMap = {};
    currentBookings.forEach(b => {
        if (!bMap[b.date]) bMap[b.date] = {};
        bMap[b.date][b.time] = b;
    });

    const days = [...new Set(Array.from(document.querySelectorAll('.cal-slot')).map(el => el.getAttribute('data-date')))];
    const times = allTimes.slice(0, 48);

    const now = new Date();
    days.forEach(date => {
        let prevBooking = null;
        let prevSlotEl = null;

        times.forEach(t => {
            const el = document.querySelector(`.cal-slot[data-date="${date}"][data-time="${t}"]`);
            if (!el) return;

            const [y, m, dNum] = date.split('-').map(Number);
            const [hrs, mins] = t.split(':').map(Number);
            const slotDateTime = new Date(y, m - 1, dNum, hrs, mins);
            const isPast = slotDateTime < now;

            if (isPast) {
                el.innerHTML = "Passed";
                if (!['admin', 'moderator'].includes(currentRole)) {
                    el.classList.add('past-slot');
                }
            }

            const b = bMap[date] && bMap[date][t];
            if (b) {
                if (b.status === 'maintenance') {
                    el.classList.add('maintenance');
                    el.innerHTML = "Maintenance";
                } else if (b.userId === currentUser.uid) {
                    el.classList.add('booked-me');
                    if (isPast && !['admin', 'moderator'].includes(currentRole)) {
                        el.innerHTML = `Booked by Me`;
                    } else {
                        el.innerHTML = `Booked by Me<div class="slot-label">(Click to delete)</div>`;
                    }
                } else {
                    el.classList.add('booked-other');
                    let txt = b.screenname;
                    if (['admin', 'moderator'].includes(currentRole)) txt += `<br><span style="font-size:0.6rem">${b.email}</span>`;
                    el.innerHTML = `Booked<br><span class="slot-label">${txt}</span>`;
                }

                if (prevBooking && prevBooking.userId === b.userId && prevBooking.status === b.status) {
                    prevSlotEl.style.borderBottom = "none";
                    el.style.borderTop = "none";
                    el.innerHTML = ""; 
                } else {
                    prevBooking = b;
                }
            } else {
                prevBooking = null;
            }
            prevSlotEl = el;
        });
    });
}
// === BOOKING ACTION (MODAL) ===
window.handleSlotClick = function(el) {
    const date = el.getAttribute('data-date');
    const time = el.getAttribute('data-time');
    
    const now = new Date();
    const [y, m, dNum] = date.split('-').map(Number);
    const [hrs, mins] = time.split(':').map(Number);
    const slotDateTime = new Date(y, m - 1, dNum, hrs, mins);
    const isPast = slotDateTime < now;

    if (isPast && !['admin', 'moderator'].includes(currentRole)) return;
    
    if (MEMBERSHIP_ENFORCEMENT_ENABLED && !['admin', 'moderator'].includes(currentRole) && currentMembership && currentMembership.status === 'pending_payment') {
        alert("Your payment is currently pending approval. You cannot book or modify slots until an admin approves it.");
        return;
    }

    targetSlot = { date, time };
    existingBooking = currentBookings.find(b => b.date === date && b.time === time);
    modalErr.textContent = "";
    targetBlockIds = [];

    if (existingBooking) {
        targetBlockIds = [existingBooking.id];
        const startIndex = allTimes.indexOf(time);
        
        // Trace backward
        for (let i = startIndex - 1; i >= 0; i--) {
            const checkTime = allTimes[i];
            const [checkHrs, checkMins] = checkTime.split(':').map(Number);
            const checkDateTime = new Date(y, m - 1, dNum, checkHrs, checkMins);
            
            if (checkDateTime < now && !['admin', 'moderator'].includes(currentRole)) {
                break;
            }

            const b = currentBookings.find(b => b.date === date && b.time === checkTime);
            if (b && b.userId === existingBooking.userId && b.status === existingBooking.status) {
                targetBlockIds.push(b.id);
            } else { break; }
        }
        
    // Trace forward
    for (let i = startIndex + 1; i < 48; i++) {
        const checkTime = allTimes[i];
        const b = currentBookings.find(b => b.date === date && b.time === checkTime);
        if (b && b.userId === existingBooking.userId && b.status === existingBooking.status) {
            targetBlockIds.push(b.id);
        } else { break; }
    }
}

// Membership Enforcement
if (!['admin', 'moderator'].includes(currentRole) && !existingBooking) {
    if (currentMembership && currentMembership.isRemoved) {
        modalTitle.textContent = "Access Restricted";
        modalTime.textContent = "Your account access has been restricted.";
        modalErr.textContent = "Please contact the administrator for support.";
        endTimeContainer.style.display = "none";
        document.querySelector('.modal-actions').innerHTML = `<button id="btn-close-membership" class="primary-btn">Close</button>`;
        document.getElementById('btn-close-membership').addEventListener('click', () => modal.classList.remove('active'));
        modal.classList.add('active');
        return;
    }
    
    let isExpired = true;
    if (!MEMBERSHIP_ENFORCEMENT_ENABLED) {
        isExpired = false;
    } else if (currentMembership) {
        if (currentMembership.status === 'approved_pending_start') {
            isExpired = false;
        } else if (currentMembership.status === 'active' && currentMembership.expiresAt) {
            const exp = currentMembership.expiresAt.toDate ? currentMembership.expiresAt.toDate() : new Date(currentMembership.expiresAt);
            if (exp > new Date()) isExpired = false;
        }
    }
    
    if (isExpired) {
        if (currentMembership && currentMembership.status === 'pending_payment') {
            alert("Your payment is currently pending approval by an admin. You will be able to book once it is approved.");
        } else {
            planModal.classList.add('active');
            document.querySelectorAll('input[name="plan_choice"]').forEach(r => r.checked = false);
            document.getElementById('payment-instructions').style.display = 'none';
            document.getElementById('btn-submit-plan').disabled = true;
            document.getElementById('plan-modal-error').textContent = "";
        }
        return;
    }
}

// Reject foreign click normally
const modalActions = document.querySelector('.modal-actions');
modalActions.innerHTML = "";

if (existingBooking && existingBooking.userId !== currentUser.uid && !['admin', 'moderator'].includes(currentRole) && existingBooking.status !== 'maintenance') {
        modalErr.textContent = "Booked by another user.";
        return; 
    }
    if (existingBooking && existingBooking.status === 'maintenance' && !['admin', 'moderator'].includes(currentRole)) {
        modalErr.textContent = "Under maintenance.";
        return;
    }

    modalTime.textContent = `Starts at: ${date} ${time}`;
    
    let primaryAction = "Confirm Booking";
    let extraBtnHTML = "";

    if (existingBooking) {
        // We are clicking on an already booked slot (mostly to delete or convert to maintanance)
        endTimeContainer.style.display = "none";
        modalTitle.textContent = "Manage Booking";
        primaryAction = existingBooking.status === 'maintenance' ? "Remove Maintenance" : "Delete Booking";
        if (['admin', 'moderator'].includes(currentRole) && existingBooking.status !== 'maintenance') {
            extraBtnHTML = `<button id="btn-admin-maint" class="outline-btn" style="color:var(--danger-color)">Convert to Maintenance</button>`;
        }
    } else {
        // We are creating a NEW booking. Show end time dropdown.
        modalTitle.textContent = "Book Sauna Slot";
        endTimeContainer.style.display = "block";
        
        if (['admin', 'moderator'].includes(currentRole)) {
            extraBtnHTML = `<button id="btn-admin-maint" class="outline-btn" style="color:var(--danger-color)">Set Maintenance</button>`;
        }

        // Generate dropdown options dynamically
        const startIndex = allTimes.indexOf(time);
        endTimeSelect.innerHTML = "";
        newBookingTimesToBook = []; // Reset

        let maxSlots = 48; // Max possible per booking theoretically
        const [y, m, d] = targetSlot.date.split('-').map(Number);
        const dObj = new Date(y, m - 1, d);
        const dayOfWeek = dObj.getDay(); 

        // Apply Fri/Sat 1.5h (3 slots) limits 
        if (!['admin', 'moderator'].includes(currentRole) && (dayOfWeek === 5 || dayOfWeek === 6)) {
            const weekendBookings = currentBookings.filter(b => {
                const [by, bm, bd_num] = b.date.split('-').map(Number);
                const dayObj = new Date(by, bm - 1, bd_num);
                const bd_day = dayObj.getDay();
                return b.userId === currentUser.uid && b.status !== 'maintenance' && (bd_day === 5 || bd_day === 6);
            });
            maxSlots = Math.max(0, 3 - weekendBookings.length);
        }

        if (maxSlots === 0) {
            modalTitle.textContent = "Limit Reached";
            endTimeContainer.style.display = "none";
            primaryAction = null;
            modalErr.textContent = "You have already reached your 1.5 hour limit for this Friday/Saturday.";
        } else {
            // Check forward availability
            const availableEndTimes = [];
            for (let step = 0; step < maxSlots; step++) {
                const checkTime = allTimes[startIndex + step];
                
                // Break if we hit midnight
                if (!checkTime || (checkTime === "24:00" && step > 0)) {
                    break;
                }
                
                // Break if we hit someone else's booking natively in the grid
                const isBooked = currentBookings.find(b => b.date === targetSlot.date && b.time === checkTime);
                if (isBooked && step > 0) {
                    break;
                }
                
                availableEndTimes.push({
                    slotsCount: step + 1,
                    endStr: allTimes[startIndex + step + 1] || "24:00",
                    timeArrayStr: JSON.stringify(allTimes.slice(startIndex, startIndex + step + 1))
                });
            }

            availableEndTimes.forEach(et => {
                const opt = document.createElement('option');
                opt.value = et.timeArrayStr; // store the array of times to easily fetch on submit
                opt.textContent = `${et.endStr} (${et.slotsCount * 30} mins)`;
                endTimeSelect.appendChild(opt);
            });
        }
    }

    const actionsContainer = document.querySelector('.modal-actions');
    actionsContainer.innerHTML = "";
    if (primaryAction) {
        actionsContainer.innerHTML += `<button id="btn-action-primary" class="primary-btn">${primaryAction}</button>`;
    }
    actionsContainer.innerHTML += `${extraBtnHTML} <button id="btn-cancel-action" class="outline-btn" style="margin-left: auto;">Cancel</button>`;

    // Add listeners
    document.getElementById('btn-cancel-action').addEventListener('click', () => modal.classList.remove('active'));
    if (document.getElementById('btn-action-primary')) {
        document.getElementById('btn-action-primary').addEventListener('click', executeBookingAction);
    }
    const maintBtn = document.getElementById('btn-admin-maint');
    if(maintBtn) maintBtn.addEventListener('click', markAsMaintenance);

    modal.classList.add('active');
}

async function executeBookingAction() {
    modalErr.textContent = "Processing...";
    document.getElementById('btn-action-primary').disabled = true;
    
    if (existingBooking) {
        // Delete action (entire block)
        try {
            const promises = targetBlockIds.map(id => deleteDoc(doc(db, "bookings", id)));
            await Promise.all(promises);
            
            // Unbook reset logic
            if (MEMBERSHIP_ENFORCEMENT_ENABLED && !['admin', 'moderator'].includes(currentRole) && currentMembership && currentMembership.status === 'active') {
                let actDate = null;
                if (currentMembership.activatedAt) {
                    actDate = currentMembership.activatedAt.toDate ? currentMembership.activatedAt.toDate() : new Date(currentMembership.activatedAt);
                } else if (currentMembership.expiresAt && currentMembership.plan) {
                    let exp = currentMembership.expiresAt.toDate ? currentMembership.expiresAt.toDate() : new Date(currentMembership.expiresAt);
                    actDate = new Date(exp);
                    if (currentMembership.plan === 'full_yearly' || currentMembership.plan.startsWith('annual')) {
                        actDate.setFullYear(actDate.getFullYear() - 1);
                        actDate.setDate(actDate.getDate() + 1);
                    } else if (currentMembership.plan === 'monthly') {
                        actDate.setDate(actDate.getDate() - 30 + 1);
                    } else if (currentMembership.plan === 'weekly') {
                        actDate.setDate(actDate.getDate() - 7 + 1);
                    }
                    actDate.setHours(0,0,0,0);
                }
                
                const now = new Date();
                
                // ONLY shift if the membership hasn't started yet!
                if (actDate && actDate > now) {
                    const userQuery = query(collection(db, "bookings"), where("userId", "==", currentUser.uid));
                    const userSnap = await getDocs(userQuery);
                    let remainingBookings = userSnap.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .filter(b => !targetBlockIds.includes(b.id));
                    
                    let earliestFutureBooking = null;

                    remainingBookings.forEach(b => {
                        const [y, mNum, dNum] = b.date.split('-').map(Number);
                        const [hrs, mins] = b.time.split(':').map(Number);
                        const bDate = new Date(y, mNum - 1, dNum, hrs, mins);
                        
                        if (bDate > now) {
                            if (!earliestFutureBooking || bDate < earliestFutureBooking) {
                                earliestFutureBooking = bDate;
                            }
                        }
                    });

                    if (earliestFutureBooking) {
                        // Shift activation to this new future booking
                        let newActDate = new Date(earliestFutureBooking.getFullYear(), earliestFutureBooking.getMonth(), earliestFutureBooking.getDate(), 0, 0, 0);
                        
                        // If it's different from the current actDate, update it!
                        if (newActDate.getTime() !== actDate.getTime()) {
                            let expDate = new Date(newActDate);
                            expDate.setHours(23, 59, 59, 999);
                            
                            if (currentMembership.plan && (currentMembership.plan === 'full_yearly' || currentMembership.plan.startsWith('annual'))) {
                                expDate.setFullYear(expDate.getFullYear() + 1);
                                expDate.setDate(expDate.getDate() - 1);
                            } else if (currentMembership.plan === 'monthly') {
                                expDate.setDate(expDate.getDate() + 30 - 1);
                            } else if (currentMembership.plan === 'weekly') {
                                expDate.setDate(expDate.getDate() + 7 - 1);
                            }
                            
                            await updateDoc(doc(db, "users", currentUser.uid), {
                                "membership.activatedAt": newActDate,
                                "membership.expiresAt": expDate
                            });
                            currentMembership.activatedAt = newActDate;
                            currentMembership.expiresAt = expDate;
                            updateMembershipUI(currentMembership);
                        }
                    } else {
                        // Completely revert to approved_pending_start
                        await updateDoc(doc(db, "users", currentUser.uid), {
                            "membership.status": "approved_pending_start",
                            "membership.activatedAt": null,
                            "membership.expiresAt": null
                        });
                        currentMembership.status = "approved_pending_start";
                        currentMembership.activatedAt = null;
                        currentMembership.expiresAt = null;
                        updateMembershipUI(currentMembership);
                    }
                }
            }
            
            modal.classList.remove('active');
        } catch(e) { modalErr.textContent = "Error: " + e.message; }
    } else {
        // Create new bookings via Promise.all
        try {
            if (MEMBERSHIP_ENFORCEMENT_ENABLED && !['admin', 'moderator'].includes(currentRole) && currentMembership) {
                const [y, mm, dNum] = targetSlot.date.split('-').map(Number);
                let activeDate = new Date(y, mm - 1, dNum, 0, 0, 0);

                let shouldUpdateMembership = false;
                
                if (currentMembership.status === 'approved_pending_start') {
                    shouldUpdateMembership = true;
                } else if (currentMembership.status === 'active') {
                    let currentActDate = null;
                    if (currentMembership.activatedAt) {
                        currentActDate = currentMembership.activatedAt.toDate ? currentMembership.activatedAt.toDate() : new Date(currentMembership.activatedAt);
                    } else if (currentMembership.expiresAt && currentMembership.plan) {
                        let exp = currentMembership.expiresAt.toDate ? currentMembership.expiresAt.toDate() : new Date(currentMembership.expiresAt);
                        currentActDate = new Date(exp);
                        if (currentMembership.plan === 'full_yearly' || currentMembership.plan.startsWith('annual')) {
                            currentActDate.setFullYear(currentActDate.getFullYear() - 1);
                            currentActDate.setDate(currentActDate.getDate() + 1);
                        } else if (currentMembership.plan === 'monthly') {
                            currentActDate.setDate(currentActDate.getDate() - 30 + 1);
                        } else if (currentMembership.plan === 'weekly') {
                            currentActDate.setDate(currentActDate.getDate() - 7 + 1);
                        }
                        currentActDate.setHours(0,0,0,0);
                    }
                    
                    if (currentActDate && activeDate < currentActDate && currentActDate > new Date()) {
                        shouldUpdateMembership = true;
                    }
                }

                if (shouldUpdateMembership) {
                    let expDate = new Date(activeDate);
                    expDate.setHours(23, 59, 59, 999);
                    
                    if (currentMembership.plan && (currentMembership.plan === 'full_yearly' || currentMembership.plan.startsWith('annual'))) {
                        expDate.setFullYear(expDate.getFullYear() + 1);
                        expDate.setDate(expDate.getDate() - 1);
                    } else if (currentMembership.plan === 'monthly') {
                        expDate.setDate(expDate.getDate() + 30 - 1);
                    } else if (currentMembership.plan === 'weekly') {
                        expDate.setDate(expDate.getDate() + 7 - 1);
                    }
                    
                    await updateDoc(doc(db, "users", currentUser.uid), {
                        "membership.status": "active",
                        "membership.expiresAt": expDate,
                        "membership.activatedAt": activeDate
                    });
                    currentMembership.status = "active";
                    currentMembership.expiresAt = expDate;
                    currentMembership.activatedAt = activeDate;
                    updateMembershipUI(currentMembership);
                }
            }

            const timesToBook = JSON.parse(endTimeSelect.value);
            
            const promises = timesToBook.map(timeSlot => {
                return addDoc(collection(db, "bookings"), {
                    date: targetSlot.date,
                    time: timeSlot,
                    userId: currentUser.uid,
                    screenname: currentUser.displayName,
                    email: currentUser.email,
                    status: 'booked',
                    timestamp: new Date()
                });
            });

            await Promise.all(promises);
            modal.classList.remove('active');
        } catch(e) { modalErr.textContent = "Error: " + e.message; }
    }
    
    if(document.getElementById('btn-action-primary')) document.getElementById('btn-action-primary').disabled = false;
}

// Admin specifically marking an entire block as maintenance uses the selected dropdown!
async function markAsMaintenance() {
    modalErr.textContent = "Processing maintenance...";
    try {
        if (existingBooking) {
            const promises = targetBlockIds.map(id => updateDoc(doc(db, "bookings", id), { status: 'maintenance', screenname: 'Admin', userId: 'ADMIN' }));
            await Promise.all(promises);
        } else {
            const timesToBook = JSON.parse(endTimeSelect.value);
            const promises = timesToBook.map(timeSlot => {
                return addDoc(collection(db, "bookings"), {
                    date: targetSlot.date,
                    time: timeSlot,
                    userId: 'ADMIN',
                    screenname: 'Admin',
                    email: '',
                    status: 'maintenance',
                    timestamp: new Date()
                });
            });
            await Promise.all(promises);
        }
        modal.classList.remove('active');
    } catch(e) { modalErr.textContent = "Error: " + e.message; }
}

// === ADMIN PANEL ===
btns.admin.addEventListener('click', () => {
    switchView('admin');
    renderAdminUsers();
    renderUpcomingBookings();
    renderBookingStats();
});
btns.backCal.addEventListener('click', () => switchView('main'));

async function renderBookingStats() {
    try {
        const snap = await getDocs(query(collection(db, "bookings")));
        const allBookings = snap.docs.map(d => d.data());

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12

        let bookingsThisMonth = 0;
        let bookingsThisYear = 0;
        const allTimeBookings = allBookings.length;

        // Sort all bookings first to correctly identify session starts
        const sortedBookings = allBookings.sort((a,b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });

        const userCountsThisYear = {};
        const timeCountsThisYear = {};
        const lastSessionEnd = {}; // Tracking per user per date: { "userId_date": "HH:MM" }

        sortedBookings.forEach(b => {
            if (b.status === 'maintenance') return;

            const [y, m, d] = b.date.split('-').map(Number);

            if (y === currentYear) {
                bookingsThisYear++;
                
                if (m === currentMonth) {
                    bookingsThisMonth++;
                }

                // Tally user hours
                if (b.userId && b.screenname) {
                    if (!userCountsThisYear[b.userId]) {
                        userCountsThisYear[b.userId] = { count: 0, screenname: b.screenname, email: b.email || "" };
                    }
                    userCountsThisYear[b.userId].count++;
                }

                // Tally popular STARTING times
                const sessionKey = `${b.userId}_${b.date}`;
                if (lastSessionEnd[sessionKey] !== b.time) {
                    // This slot doesn't immediately follow the previous one for this user -> it's a START
                    if (b.time) {
                        timeCountsThisYear[b.time] = (timeCountsThisYear[b.time] || 0) + 1;
                    }
                }
                // Update the "next expected slot" for this user's current session
                const slotIndex = allTimes.indexOf(b.time);
                lastSessionEnd[sessionKey] = allTimes[slotIndex + 1] || "24:00";
            }
        });

        // Sort Top Users
        const topUsers = Object.values(userCountsThisYear)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Sort Popular Times
        const popularTimes = Object.entries(timeCountsThisYear)
            .map(([time, count]) => ({ time, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Update UI
        document.getElementById('stat-bookings-month').textContent = (bookingsThisMonth * 0.5).toFixed(1);
        document.getElementById('stat-bookings-year').textContent = (bookingsThisYear * 0.5).toFixed(1);
        document.getElementById('stat-bookings-alltime').textContent = (allTimeBookings * 0.5).toFixed(1);

        const usersList = document.getElementById('stat-top-users');
        usersList.innerHTML = topUsers.length > 0 
            ? topUsers.map((u, i) => `<li style="padding: 5px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;"><div><strong>${i+1}.</strong> ${u.screenname} <br><span style="font-size:0.7rem; color:var(--text-muted);">${u.email}</span></div> <span style="color:var(--text-muted); font-size: 0.8rem;">${(u.count * 0.5).toFixed(1)} h</span></li>`).join('')
            : '<li>No bookings this year</li>';

        const timesList = document.getElementById('stat-popular-times');
        timesList.innerHTML = popularTimes.length > 0
            ? popularTimes.map((t, i) => `<li style="padding: 5px 0; border-bottom: 1px solid var(--border-color);"><strong>${i+1}.</strong> ${t.time} <span style="color:var(--text-muted);">(${t.count} bookings)</span></li>`).join('')
            : '<li>No bookings this year</li>';

    } catch (e) {
        console.error("Failed to load booking stats:", e);
    }
}

async function renderUpcomingBookings() {
    const tbody = document.getElementById('upcoming-management-rows');
    tbody.innerHTML = "<tr><td colspan='3'>Loading upcoming sessions...</td></tr>";
    try {
        const todayStr = formatDate(new Date());
        const q = query(collection(db, "bookings"), where("date", ">=", todayStr));
        const snap = await getDocs(q);
        
        // Sort slots: Date then Time
        const allSlots = snap.docs.map(d => d.data()).sort((a,b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });

        const sessions = [];
        let currentSession = null;

        allSlots.forEach(slot => {
            if (slot.status === 'maintenance') return; // Skip maintenance blocks

            const slotIndex = allTimes.indexOf(slot.time);
            const nextTimeStr = allTimes[slotIndex + 1] || "24:00";

            if (currentSession && 
                currentSession.date === slot.date && 
                currentSession.userId === slot.userId && 
                currentSession.endTime === slot.time) {
                // Extend current session
                currentSession.endTime = nextTimeStr;
            } else {
                // Start NEW session
                if (currentSession) sessions.push(currentSession);
                currentSession = {
                    date: slot.date,
                    startTime: slot.time,
                    endTime: nextTimeStr,
                    userId: slot.userId,
                    screenname: slot.screenname,
                    email: slot.email
                };
            }
        });
        if (currentSession) sessions.push(currentSession);

        tbody.innerHTML = "";
        if (sessions.length === 0) {
            tbody.innerHTML = "<tr><td colspan='3'>No upcoming sessions.</td></tr>";
            return;
        }

        sessions.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatEuroDate(s.date)}</td>
                <td>${s.startTime} - ${s.endTime}</td>
                <td>
                    <div class="user-info">
                        <strong>${s.screenname}</strong>
                        <span class="user-email">${s.email}</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { tbody.innerHTML = `<tr><td colspan='3'>Error: ${e.message}</td></tr>`; }
}

async function renderAdminUsers() {
    const tbody = document.getElementById('user-management-rows');
    const ptbody = document.getElementById('pending-management-rows');
    if(tbody) tbody.innerHTML = "<tr><td colspan='3'>Loading users...</td></tr>";
    if(ptbody) ptbody.innerHTML = "<tr><td colspan='3'>Loading pending requests...</td></tr>";
    try {
        const snap = await getDocs(collection(db, "users"));
        
        let totalUsers = 0;
        let activeMembers = 0;
        let restrictedUsers = 0;
        let pendingUsers = [];
        const now = new Date();

        // Categorize Users
        const adminUsers = [];
        const moderatorUsers = [];
        const yearlyUsers = [];
        const monthlyUsers = [];
        const weeklyUsers = [];
        const noMembershipUsers = [];
        const restrictedUsersList = [];

        snap.docs.forEach(docSnap => {
            const u = docSnap.data();
            const uid = docSnap.id;
            const m = u.membership || { expiresAt: null, isRemoved: false, status: 'none' };
            
            totalUsers++;
            if (m.isRemoved) {
                restrictedUsers++;
            } else if (m.status === 'active' && m.expiresAt) {
                const exp = m.expiresAt.toDate ? m.expiresAt.toDate() : new Date(m.expiresAt);
                if (exp > now) activeMembers++;
            } else if (m.status === 'approved_pending_start') {
                activeMembers++;
            }
            
            if (m.status === 'pending_payment') {
                pendingUsers.push({ uid, ...u });
            }

            const userObj = { uid, ...u, membership: m };

            if (u.role === 'admin') {
                adminUsers.push(userObj);
            } else if (u.role === 'moderator') {
                moderatorUsers.push(userObj);
            } else if (m.isRemoved) {
                restrictedUsersList.push(userObj);
            } else if (m.status === 'none' || m.status === 'pending_payment') {
                noMembershipUsers.push(userObj);
            } else {
                const p = m.plan || '';
                if (p.includes('annual') || p.includes('full') || p === 'yearly') {
                    yearlyUsers.push(userObj);
                } else if (p === 'monthly') {
                    monthlyUsers.push(userObj);
                } else if (p === 'weekly') {
                    weeklyUsers.push(userObj);
                } else {
                    noMembershipUsers.push(userObj);
                }
            }
        });

        const sorter = (a, b) => (a.screenname || '').localeCompare(b.screenname || '');
        adminUsers.sort(sorter);
        moderatorUsers.sort(sorter);
        yearlyUsers.sort(sorter);
        monthlyUsers.sort(sorter);
        weeklyUsers.sort(sorter);
        noMembershipUsers.sort(sorter);
        restrictedUsersList.sort(sorter);

        const groups = [
            { title: "Admins", data: adminUsers },
            { title: "Moderators", data: moderatorUsers },
            { title: "Yearly Memberships", data: yearlyUsers },
            { title: "Monthly Memberships", data: monthlyUsers },
            { title: "Weekly Memberships", data: weeklyUsers },
            { title: "No Membership", data: noMembershipUsers },
            { title: "Restricted Accounts", data: restrictedUsersList }
        ];

        // Apply Moderator UI restrictions
        const adminStatsContainer = document.getElementById('admin-booking-stats-container');
        if (adminStatsContainer) adminStatsContainer.style.display = currentRole === 'moderator' ? 'none' : 'block';

        const btnExportCsv = document.getElementById('btn-export-csv');
        if (btnExportCsv && btnExportCsv.parentElement) {
            btnExportCsv.parentElement.style.display = currentRole === 'moderator' ? 'none' : 'flex';
        }

        const actionsTh = document.getElementById('admin-user-actions-th');
        if (actionsTh) {
            actionsTh.style.display = currentRole === 'moderator' ? 'none' : '';
        }

        if(ptbody) {
            ptbody.innerHTML = "";
            if (pendingUsers.length === 0) {
                ptbody.innerHTML = "<tr><td colspan='3'>No pending approvals.</td></tr>";
            } else {
                pendingUsers.forEach(u => {
                    const m = u.membership;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <strong>${u.screenname}</strong><br>
                            <span class="user-email">${u.email}</span>
                        </td>
                        <td><strong>${m.pendingPlan}</strong></td>
                        <td>
                            <div class="mgt-btn-group">
                                <button class="mgt-btn primary" data-action="approve_plan" data-id="${u.uid}">Approve</button>
                                <button class="mgt-btn danger" data-action="reject_plan" data-id="${u.uid}">Reject</button>
                            </div>
                        </td>
                    `;
                    ptbody.appendChild(tr);
                });
            }
        }

        // Update stats UI
        document.getElementById('stat-total-users').textContent = totalUsers;
        document.getElementById('stat-active-members').textContent = activeMembers;
        document.getElementById('stat-restricted-accounts').textContent = restrictedUsers;

        tbody.innerHTML = "";

        groups.forEach(group => {
            if (group.data.length === 0) return;

            const separator = document.createElement('tr');
            separator.innerHTML = `
                <td colspan="3" style="background:rgba(0,0,0,0.04); font-weight:700; color:var(--text-color); font-size:0.8rem; text-transform:uppercase; border-bottom: 2px solid var(--border-color); padding: 15px 12px 5px 12px;">
                    ${group.title} (${group.data.length})
                </td>
            `;
            tbody.appendChild(separator);

            group.data.forEach(u => {
                const uid = u.uid;
                const m = u.membership;
                
                const tr = document.createElement('tr');
                if (m.isRemoved) tr.className = 'row-removed';
                
                let expiryStr = "No Membership";
                if (m.status === 'approved_pending_start') {
                    expiryStr = "Pending First Booking";
                } else if (m.expiresAt) {
                    expiryStr = formatEuroDate(m.expiresAt);
                }
                
                let actionsHTML = '';
                if (currentRole === 'admin') {
                    const isMod = u.role === 'moderator';
                    const modBtnHTML = isMod 
                        ? `<button class="mgt-btn primary" data-action="remove_mod" data-id="${uid}" style="font-size:0.7rem; padding: 4px;">Demote Mod</button>`
                        : (u.role !== 'admin' ? `<button class="mgt-btn primary" data-action="make_mod" data-id="${uid}" style="font-size:0.7rem; padding: 4px;">Appoint Mod</button>` : '');
                        
                    actionsHTML = `
                        <td style="white-space:nowrap;">
                            <div class="mgt-btn-group" style="gap:5px;">
                                <button class="mgt-btn danger" data-action="revoke_plan" data-id="${uid}" style="font-size:0.7rem; padding: 4px;">Revoke Plan</button>
                                ${modBtnHTML}
                            </div>
                        </td>
                    `;
                }

                tr.innerHTML = `
                    <td>
                        <div class="user-info">
                            <div style="display:flex; align-items:center; gap:5px;">
                                <strong>${u.screenname}</strong>
                                ${m.isRemoved ? `<span style="font-size:0.6rem; background:var(--danger-color); color:white; padding:2px 6px; border-radius:4px;">RESTRICTED</span>` : ''}
                            </div>
                            <span class="user-email">${u.email}</span>
                            <span style="font-size:0.6rem; color:var(--primary-color)">${u.role.toUpperCase()}</span>
                        </div>
                    </td>
                    <td>${expiryStr}</td>
                    ${actionsHTML}
                `;
                tbody.appendChild(tr);
            });
        });

        // Add event listeners to all buttons
        document.querySelectorAll('.mgt-btn').forEach(btn => {
            btn.addEventListener('click', handleAdminAction);
        });

    } catch (e) {
        console.error(e);
        if(tbody) tbody.innerHTML = `<tr><td colspan='3'>Error: ${e.message}</td></tr>`;
        if(ptbody) ptbody.innerHTML = `<tr><td colspan='3'>Error: ${e.message}</td></tr>`;
    }
}

async function handleAdminAction(e) {
    const btn = e.currentTarget;
    const uid = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    const unit = btn.getAttribute('data-unit');
    
    btn.disabled = true;
    try {
        const uRef = doc(db, "users", uid);
        const uDoc = await getDoc(uRef);
        const uData = uDoc.data();
        let m = uData.membership || { expiresAt: null, isRemoved: false };
        let hasPaid = uData.hasPaidFullMembership || false;
        let uRole = uData.role || 'user';
        
        if (action === 'make_mod') {
            if (currentRole !== 'admin') { btn.disabled = false; return; }
            uRole = 'moderator';
        } else if (action === 'remove_mod') {
            if (currentRole !== 'admin') { btn.disabled = false; return; }
            uRole = 'user';
        } else if (action === 'approve_plan') {
            if (!['admin', 'moderator'].includes(currentRole)) { btn.disabled = false; return; }
            m.status = 'approved_pending_start';
            m.plan = m.pendingPlan;
            if (m.plan === 'full' || m.plan === 'full_yearly') hasPaid = true;
            m.pendingPlan = null;
        } else if (action === 'reject_plan') {
            if (!['admin', 'moderator'].includes(currentRole)) { btn.disabled = false; return; }
            m.status = 'none';
            m.pendingPlan = null;
        } else if (action === 'revoke_plan') {
            if (currentRole !== 'admin') { btn.disabled = false; return; }
            if (!confirm("Are you sure you want to completely revoke this user's membership plan? They will immediately lose access and have to purchase a new plan.")) {
                btn.disabled = false;
                return;
            }
            m.status = 'none';
            m.plan = null;
            m.expiresAt = null;
            m.activatedAt = null;
            m.pendingPlan = null;
        } else if (action === 'remove') {
            if (currentRole !== 'admin') { btn.disabled = false; return; }
            m.isRemoved = true;
        } else if (action === 'restore') {
            if (currentRole !== 'admin') { btn.disabled = false; return; }
            m.isRemoved = false;
        }
        
        await updateDoc(uRef, { membership: m, hasPaidFullMembership: hasPaid, role: uRole });
        renderAdminUsers(); // Refresh list
    } catch (err) {
        alert("Action failed: " + err.message);
        btn.disabled = false;
    }
}

document.getElementById('btn-export-csv').addEventListener('click', async () => {
    try {
        const snap = await getDocs(query(collection(db, "bookings")));
        let csv = "Date,Time,Screenname,Email,Status\n";
        snap.docs.forEach(doc => {
            const d = doc.data();
            csv += `${d.date},${d.time},${d.screenname},${d.email},${d.status}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); 
        a.href = window.URL.createObjectURL(blob); 
        a.download = "sauna_bookings.csv";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { alert("Failed to export: " + e.message); }
});

document.getElementById('btn-export-users-csv').addEventListener('click', async () => {
    try {
        const snap = await getDocs(collection(db, "users"));
        let csv = "Screenname,Email,Role,MembershipExpiry,IsRemoved\n";
        snap.forEach(docSnap => {
            const u = docSnap.data();
            const m = u.membership || { expiresAt: null, isRemoved: false };
            const expiry = m.expiresAt ? formatEuroDate(m.expiresAt) : "None";
            csv += `"${u.screenname}","${u.email}","${u.role}","${expiry}","${m.isRemoved}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); 
        a.href = window.URL.createObjectURL(blob); 
        a.download = "sauna_user_registry.csv";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { alert("Failed to export: " + e.message); }
});

const btnFix2026 = document.getElementById('btn-fix-2026');
if (btnFix2026) {
    btnFix2026.addEventListener('click', async () => {
        btnFix2026.disabled = true;
        btnFix2026.textContent = "Fixing...";
        try {
            const snap = await getDocs(collection(db, "users"));
            let fixedCount = 0;
            const promises = [];
            
            snap.forEach(docSnap => {
                const uData = docSnap.data();
                if (uData.membership && uData.membership.plan === 'full_yearly' && uData.membership.expiresAt) {
                    let exp = uData.membership.expiresAt.toDate ? uData.membership.expiresAt.toDate() : new Date(uData.membership.expiresAt);
                    if (exp.getFullYear() === 2026) {
                        exp.setFullYear(2027);
                        promises.push(updateDoc(docSnap.ref, { 
                            "membership.expiresAt": exp,
                            "membership.status": "active",
                            "membership.pendingPlan": null
                        }));
                        fixedCount++;
                    }
                }
            });
            
            await Promise.all(promises);
            alert(`Successfully fixed ${fixedCount} user(s)!`);
            renderAdminUsers();
        } catch (e) {
            alert("Error fixing users: " + e.message);
        }
        btnFix2026.textContent = "Fix 2026 Expirations";
        btnFix2026.disabled = false;
    });
}

if (btnUpdateDoorCode) {
    btnUpdateDoorCode.addEventListener('click', async () => {
        const newCode = adminDoorCodeInput.value.trim();
        adminDoorCodeMsg.style.display = 'block';
        adminDoorCodeMsg.textContent = "Updating...";
        adminDoorCodeMsg.style.color = "var(--text-main)";
        
        try {
            await setDoc(doc(db, "settings", "door"), { currentCode: newCode }, { merge: true });
            adminDoorCodeMsg.textContent = "Code updated successfully!";
            adminDoorCodeMsg.style.color = "var(--success-color)";
            setTimeout(() => { adminDoorCodeMsg.style.display = 'none'; }, 3000);
        } catch(e) {
            adminDoorCodeMsg.textContent = e.message;
            adminDoorCodeMsg.style.color = "var(--danger-color)";
        }
    });
}
