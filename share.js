// share.js

// 0) Firebase 초기화
const firebaseConfig = {
    apiKey: "AIzaSyBhY_SahLirkpQzisR0O-xAX8VL7qnT_g4",
    authDomain: "valproject-d2535.firebaseapp.com",
    projectId: "valproject-d2535",
    storageBucket: "valproject-d2535.appspot.com",
    messagingSenderId: "224252093990",
    appId: "1:224252093990:web:00bc2b8b6fcbf85e8e7",
    measurementId: "G-WZ6NC63222"
};
firebase.initializeApp(firebaseConfig);

// 1) Firebase 서비스 참조
const auth = firebase.auth();
const db = firebase.firestore();

// 2) DOM 요소 가져오기
const btnGoogle = document.getElementById("btn-google");
const btnLogout = document.getElementById("btn-logout");
const btnMenu = document.getElementById("btn-menu");
const sidebar = document.getElementById("sidebar");
const btnCloseSb = document.getElementById("btn-close-sidebar");
const btnResetNick = document.getElementById("btn-reset-nickname");
const appDiv = document.getElementById("app");
const shareTitleEl = document.getElementById("share-title");
const planSelect = document.getElementById("plan-select");
const descInput = document.getElementById("share-description");
const btnSharePlan = document.getElementById("btn-share-plan");
const btnSortNew = document.getElementById("btn-sort-new");
const btnSortLike = document.getElementById("btn-sort-like");
const sharedList = document.getElementById("shared-plans-list");
const emptyMsg = document.getElementById("empty-msg");
const nicknameModal = document.getElementById("nickname-modal");
const nicknameInput = document.getElementById("nickname-input");
const btnSaveNickname = document.getElementById("btn-save-nickname");

let currentSort = "createdAt";
let userNickname = "";

// 3) 로그인 상태 처리
auth.onAuthStateChanged(async (user) => {
    if (user) {
        btnGoogle.classList.add("hidden");
        btnLogout.classList.remove("hidden");
        // 닉네임 있는지 체크
        const uref = db.collection("users").doc(user.uid);
        const usnap = await uref.get();
        if (!usnap.exists || !usnap.data().nickname) {
            // 첫 설정 모드
            nicknameModal.classList.remove("hidden");
            return;
        }
        userNickname = usnap.data().nickname;
        appDiv.classList.remove("hidden");
        loadUserPlans();
        loadSharedPlans();
    } else {
        btnGoogle.classList.remove("hidden");
        btnLogout.classList.add("hidden");
        appDiv.classList.add("hidden");
    }
});
btnGoogle.onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
btnLogout.onclick = () => auth.signOut();

// 4) 사이드바 토글
btnMenu.onclick = () => {
    if (sidebar.classList.contains("-translate-x-full")) {
        sidebar.classList.remove("-translate-x-full");
        sidebar.classList.add("translate-x-0");
    } else {
        sidebar.classList.add("-translate-x-full");
        sidebar.classList.remove("translate-x-0");
    }
};
btnCloseSb.onclick = () => {
    sidebar.classList.add("-translate-x-full");
    sidebar.classList.remove("translate-x-0");
};

// 5) 닉네임 변경 클릭
btnResetNick.onclick = () => {
    // 닫기 버튼 보여주기
    document.getElementById("btn-close-nickname-modal").classList.remove("hidden");
    nicknameInput.value = userNickname;
    nicknameModal.classList.remove("hidden");
    appDiv.classList.add("hidden");
};

// 6) 닉네임 저장 (중복 검사 포함)
btnSaveNickname.onclick = async () => {
    const nick = nicknameInput.value.trim();
    if (!nick) return alert("닉네임을 입력해주세요.");

    // **중복 검사**
    const conflict = await db
        .collection("users")
        .where("nickname", "==", nick)
        .get()
        .then((q) => q.docs.some((d) => d.id !== auth.currentUser.uid));
    if (conflict) {
        return alert("이미 사용 중인 닉네임입니다.");
    }

    // 저장
    const uid = auth.currentUser.uid;
    await db.collection("users").doc(uid).set({ nickname: nick });
    userNickname = nick;
    nicknameModal.classList.add("hidden");
    appDiv.classList.remove("hidden");
    loadUserPlans();
    loadSharedPlans();
};

// 7) 내 플랜 드롭다운 채우기
async function loadUserPlans() {
    planSelect.innerHTML = `<option value="" disabled selected>플랜을 선택하세요</option>`;
    const snap = await db.collection("plans").where("uid", "==", auth.currentUser.uid).get();
    snap.forEach((doc) => {
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = doc.data().name;
        planSelect.append(opt);
    });
}

// 8) 공유하기
btnSharePlan.onclick = async () => {
    const title = shareTitleEl.value.trim();
    const planId = planSelect.value;
    const desc = descInput.value.trim();
    if (!title) return alert("공유 제목을 입력하세요.");
    if (!planId) return alert("플랜을 선택하세요.");
    if (!desc) return alert("설명을 입력하세요.");

    btnSharePlan.disabled = true;
    try {
        // 중복 공유 검사
        const dup = await db
            .collection("sharedPlans")
            .where("ownerUid", "==", auth.currentUser.uid)
            .where("planId", "==", planId)
            .get();
        if (!dup.empty) return alert("이미 이 플랜을 공유하셨습니다.");

        // 원본+루틴 읽어오기
        const pSnap = await db.collection("plans").doc(planId).get();
        const rSnap = await db.collection("plans").doc(planId).collection("routines").get();
        const routines = rSnap.docs.map((d) => d.data());
        const pdata = pSnap.data() || {};

        // 저장
        await db.collection("sharedPlans").add({
            postTitle: title,
            ownerUid: auth.currentUser.uid,
            planId,
            description: desc,
            originalDescription: pdata.description || "",
            originalPlaylistLink: pdata.playlistLink || "",
            routines,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            likesCount: 0,
            likedUsers: []
        });

        alert("공유 완료!");
        shareTitleEl.value = "";
        descInput.value = "";
        loadSharedPlans();
    } catch (e) {
        alert("공유 실패: " + e.message);
    } finally {
        btnSharePlan.disabled = false;
    }
};

// 9) 정렬
btnSortNew.addEventListener("click", () => {
    currentSort = "createdAt";
    loadSharedPlans();
});
btnSortLike.addEventListener("click", () => {
    currentSort = "likesCount";
    loadSharedPlans();
});

// 10) 공유 리스트 렌더링
async function loadSharedPlans() {
    sharedList.innerHTML = "";
    const snap = await db.collection("sharedPlans").orderBy(currentSort, "desc").get();
    if (snap.empty) {
        emptyMsg.classList.remove("hidden");
        return;
    }
    emptyMsg.classList.add("hidden");

    for (const doc of snap.docs) {
        const d = doc.data();
        const ownerSnap = await db.collection("users").doc(d.ownerUid).get();
        const ownerName = ownerSnap.exists && ownerSnap.data().nickname ? ownerSnap.data().nickname : "익명";

        const card = document.createElement("div");
        card.className = "bg-gray-800 rounded-lg p-4 shadow-lg";

        const h3 = document.createElement("h3");
        h3.textContent = d.postTitle;
        h3.className = "text-white font-semibold mb-1";

        const pDesc = document.createElement("p");
        pDesc.textContent = d.description;
        pDesc.className = "text-gray-300 text-sm mb-2";

        const pOwner = document.createElement("p");
        pOwner.textContent = `공유자: ${ownerName}`;
        pOwner.className = "text-gray-400 text-xs mb-2";

        const wrap = document.createElement("div");
        wrap.className = "flex space-x-2 text-sm";

        // 좋아요 토글
        const likeBtn = document.createElement("button");
        likeBtn.textContent = `👍 ${d.likesCount || 0}`;
        likeBtn.onclick = async () => {
            const ref = db.collection("sharedPlans").doc(doc.id);
            await db.runTransaction(async (tx) => {
                const s = await tx.get(ref);
                const users = s.data().likedUsers || [];
                if (users.includes(auth.currentUser.uid)) {
                    tx.update(ref, {
                        likesCount: firebase.firestore.FieldValue.increment(-1),
                        likedUsers: firebase.firestore.FieldValue.arrayRemove(auth.currentUser.uid)
                    });
                } else {
                    tx.update(ref, {
                        likesCount: firebase.firestore.FieldValue.increment(1),
                        likedUsers: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
                    });
                }
            });
            loadSharedPlans();
        };
        wrap.append(likeBtn);

        // 삭제/가져오기
        if (d.ownerUid === auth.currentUser.uid) {
            const del = document.createElement("button");
            del.textContent = "삭제";
            del.className = "text-red-400";
            del.onclick = async () => {
                if (confirm("정말 삭제하시겠습니까?")) {
                    await db.collection("sharedPlans").doc(doc.id).delete();
                    loadSharedPlans();
                }
            };
            wrap.append(del);
        } else {
            const imp = document.createElement("button");
            imp.textContent = "가져오기";
            imp.className = "text-blue-400";
            imp.onclick = async () => {
                imp.disabled = true;
                try {
                    await db.collection("plans").add({
                        name: d.postTitle,
                        uid: auth.currentUser.uid,
                        description: d.originalDescription,
                        playlistLink: d.originalPlaylistLink
                    });
                    alert("가져오기 완료!");
                } catch (e) {
                    alert("가져오기 실패: " + e.message);
                } finally {
                    imp.disabled = false;
                }
            };
            wrap.append(imp);
        }

        card.append(h3, pDesc, pOwner, wrap);
        sharedList.append(card);
    }
}
