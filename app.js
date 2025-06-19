// app.js

// 1. Firebase 초기화
const firebaseConfig = {
  apiKey: "AIzaSyBhY_SahLirkpQzisR0O-xAX8VL7qnT_g4",
  authDomain: "valproject-d2535.firebaseapp.com",
  projectId: "valproject-d2535",
  storageBucket: "valproject-d2535.firebasestorage.app",
  messagingSenderId: "224252093990",
  appId: "1:224252093990:web:00bc2b8f6b33fcbf85e8e7",
  measurementId: "G-WZ6NC63222"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. DOM 요소 참조
const btnGoogle = document.getElementById("btn-google");
const btnLogout = document.getElementById("btn-logout");
const appDiv = document.getElementById("app");
const planName = document.getElementById("plan-name");
const btnAddPlan = document.getElementById("btn-add-plan");
const shareCodeIn = document.getElementById("share-code");
const btnImportPlan = document.getElementById("btn-import-plan");
const planList = document.getElementById("plan-list");
const planDescEl = document.getElementById("plan-desc");
const btnSaveDesc = document.getElementById("btn-save-desc");
const displayDescEl = document.getElementById("display-desc");
const playlistLinkEl = document.getElementById("playlist-link");
const btnSavePlaylist = document.getElementById("btn-save-playlist");
const displayPlaylist = document.getElementById("display-playlist");
const calendarEl = document.getElementById("calendar");
const routineSelect = document.getElementById("routine-select");
const ctx = document.getElementById("score-chart").getContext("2d");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modal-content");
const modalDate = document.getElementById("modal-date");
const routineList = document.getElementById("routine-list");
const nameInput = document.getElementById("routine-name");
const timeInput = document.getElementById("routine-time");
const btnAddRut = document.getElementById("btn-add-routine");
const btnClose = document.getElementById("btn-close-modal");
const btnSaveTpl = document.getElementById("btn-save-template");
const btnLoadTpl = document.getElementById("btn-load-template");

let calendar, currentDate, selectedPlanId, scoreChart;

// helper: stats 컬렉션 참조
const statsCol = () => db.collection("plans").doc(selectedPlanId).collection("stats");

// 랜덤 색상 생성
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  return (
    "#" +
    Array.from({ length: 6 })
      .map(() => letters[Math.floor(Math.random() * 16)])
      .join("")
  );
}

// 플랜 설명 & 플레이리스트 로드
async function loadDescription() {
  if (!selectedPlanId) return;
  const snap = await db.collection("plans").doc(selectedPlanId).get();
  const data = snap.exists ? snap.data() : {};

  // 설명
  const desc = data.description || "";
  planDescEl.value = desc;
  displayDescEl.textContent = desc;

  // 플레이리스트 링크
  const link = data.playlistLink || "";
  playlistLinkEl.value = link;
  if (link) {
    displayPlaylist.innerHTML = `<a href="${link}" target="_blank" class="underline">${link}</a>`;
  } else {
    displayPlaylist.textContent = "등록된 링크가 없습니다.";
  }
}

// 3. 로그인/로그아웃
btnGoogle.onclick = () => {
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch((e) => alert(e.message));
};
btnLogout.onclick = () => auth.signOut();

// 4. 인증 상태 변화
auth.onAuthStateChanged((user) => {
  if (user) {
    btnGoogle.classList.add("hidden");
    btnLogout.classList.remove("hidden");
    appDiv.classList.remove("hidden");
    loadPlans();
    initCalendar();
    drawChart();
  } else {
    btnGoogle.classList.remove("hidden");
    btnLogout.classList.add("hidden");
    appDiv.classList.add("hidden");
  }
});

// 5. 플랜 추가 & 공유 가져오기
btnAddPlan.onclick = async () => {
  const name = planName.value.trim();
  if (!name) return;
  await db.collection("plans").add({ name, uid: auth.currentUser.uid });
  planName.value = "";
  await loadPlans();
};

btnImportPlan.onclick = async () => {
  const code = shareCodeIn.value.trim();
  if (!code) return alert("공유 코드를 입력해주세요.");
  try {
    const src = await db.collection("plans").doc(code).get();
    if (!src.exists) throw new Error("유효하지 않은 코드입니다.");
    const data = src.data();
    const newRef = await db.collection("plans").add({ name: data.name, uid: auth.currentUser.uid });
    const rutSnap = await db.collection("plans").doc(code).collection("routines").get();
    const batch = db.batch();
    rutSnap.forEach((r) => {
      batch.set(db.collection("plans").doc(newRef.id).collection("routines").doc(), r.data());
    });
    await batch.commit();
    alert("플랜을 가져왔습니다!");
    shareCodeIn.value = "";
    await loadPlans();
  } catch (e) {
    alert("가져오기 실패: " + e.message);
  }
};

// 6. loadPlans: 플랜 리스트 렌더링
async function loadPlans() {
  planList.innerHTML = "";
  const snap = await db.collection("plans").where("uid", "==", auth.currentUser.uid).get();

  if (snap.empty) {
    selectedPlanId = null;
    if (scoreChart) {
      scoreChart.data.labels = [];
      scoreChart.data.datasets = [];
      scoreChart.update();
    }
    displayDescEl.textContent = "";
    planDescEl.value = "";
    displayPlaylist.textContent = "";
    playlistLinkEl.value = "";
    return;
  }

  snap.docs.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center p-2 bg-gray-700 rounded-lg cursor-pointer";
    li.onclick = () => {
      selectedPlanId = doc.id;
      drawChart();
      populateRoutineFilter();
      loadDescription();
    };
    li.innerHTML = `
      <span>${doc.data().name}</span>
      <div class="flex space-x-2">
        <button class="text-red-400 text-sm">삭제</button>
        <button class="text-blue-400 text-sm">코드 복사</button>
      </div>`;
    // 삭제
    li.querySelector("button:nth-child(1)").onclick = async (e) => {
      e.stopPropagation();
      await db.collection("plans").doc(doc.id).delete();
      await loadPlans();
    };
    // 복사
    li.querySelector("button:nth-child(2)").onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard
        .writeText(doc.id)
        .then(() => alert("공유 코드 복사됨:\n" + doc.id))
        .catch(() => alert("복사 실패"));
    };

    planList.appendChild(li);
  });

  // 기본 선택
  selectedPlanId = snap.docs[0].id;
  drawChart();
  populateRoutineFilter();
  loadDescription();
}

// 7. FullCalendar 초기화
function initCalendar() {
  if (calendar) calendar.destroy();
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: 600,
    dateClick: (info) => {
      if (!selectedPlanId) return alert("플랜을 선택하세요.");
      currentDate = info.dateStr;
      modalDate.textContent = currentDate;
      loadRoutines(currentDate);
      modal.classList.add("show");
    }
  });
  calendar.render();
}

// 8. 루틴 추가
btnAddRut.onclick = async () => {
  const nm = nameInput.value.trim(),
    tm = +timeInput.value;
  if (!nm || !tm) return;
  await db
    .collection("plans")
    .doc(selectedPlanId)
    .collection("routines")
    .add({ date: currentDate, name: nm, time: tm });
  nameInput.value = "";
  timeInput.value = "";
  await loadRoutines(currentDate);
  populateRoutineFilter();
};

// 9. 템플릿 저장/불러오기
btnSaveTpl.onclick = async () => {
  if (!selectedPlanId || !currentDate) return alert("날짜 선택 후 저장하세요.");
  const rutSnap = await db
    .collection("plans")
    .doc(selectedPlanId)
    .collection("routines")
    .where("date", "==", currentDate)
    .get();
  if (rutSnap.empty) return alert("루틴 먼저 추가하세요.");
  const tplCol = db.collection("plans").doc(selectedPlanId).collection("templates");
  (await tplCol.get()).docs.forEach((d) => d.ref.delete());
  const batch = db.batch();
  rutSnap.forEach((d) => {
    const r = tplCol.doc();
    batch.set(r, { name: d.data().name, time: d.data().time });
  });
  await batch.commit();
  alert("템플릿 저장됨");
};
btnLoadTpl.onclick = async () => {
  if (!selectedPlanId || !currentDate) return alert("날짜 선택 후 불러오기하세요.");
  const tplSnap = await db.collection("plans").doc(selectedPlanId).collection("templates").get();
  if (tplSnap.empty) return alert("템플릿 없습니다.");
  const rutCol = db.collection("plans").doc(selectedPlanId).collection("routines");
  const batch = db.batch();
  tplSnap.forEach((d) => {
    const r = rutCol.doc();
    batch.set(r, { date: currentDate, name: d.data().name, time: d.data().time });
  });
  await batch.commit();
  await loadRoutines(currentDate);
  populateRoutineFilter();
  alert("템플릿 불러옴");
};

// 10. loadRoutines: 루틴 & 점수 UI
async function loadRoutines(date) {
  routineList.innerHTML = "";
  const rutSnap = await db
    .collection("plans")
    .doc(selectedPlanId)
    .collection("routines")
    .where("date", "==", date)
    .get();
  const statSnap = await statsCol().where("date", "==", date).get();
  const map = {};
  statSnap.forEach((d) => (map[d.data().routine] = { score: d.data().score, ref: d.ref }));

  rutSnap.forEach((doc) => {
    const { name, time } = doc.data();
    const li = document.createElement("li");
    li.className = "flex items-center justify-between mb-2";
    const label = document.createElement("div");
    label.textContent = `${name} (${time}분)`;
    label.className = "flex-1 text-white";
    const input = document.createElement("input");
    input.type = "number";
    input.placeholder = "점수";
    input.value = map[name]?.score || "";
    input.className = "w-24 h-8 px-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white";
    const btnS = document.createElement("button");
    btnS.textContent = "저장";
    btnS.className = "ml-2 h-8 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs";
    btnS.onclick = async () => {
      const s = +input.value;
      if (isNaN(s)) return alert("점수 입력");
      if (map[name]) await map[name].ref.update({ score: s });
      else await statsCol().add({ date, routine: name, score: s });
      drawChart();
    };
    const btnD = document.createElement("button");
    btnD.textContent = "삭제";
    btnD.className = "ml-2 h-8 px-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs";
    btnD.onclick = async () => {
      await doc.ref.delete();
      const ss = await statsCol().where("date", "==", date).where("routine", "==", name).get();
      ss.docs.forEach((d) => d.ref.delete());
      await loadRoutines(date);
      populateRoutineFilter();
      drawChart();
    };
    li.append(label, input, btnS, btnD);
    routineList.appendChild(li);
  });
}

// 11. 루틴 필터 채우기
function populateRoutineFilter() {
  routineSelect.innerHTML = `<option value="">전체 루틴</option>`;
  db.collection("plans")
    .doc(selectedPlanId)
    .collection("routines")
    .get()
    .then((snap) => {
      [...new Set(snap.docs.map((d) => d.data().name))].forEach((rt) => {
        const opt = document.createElement("option");
        opt.value = rt;
        opt.textContent = rt;
        routineSelect.appendChild(opt);
      });
    });
}
routineSelect.onchange = () => drawChart();

// 12. 설명 저장
btnSaveDesc.onclick = async () => {
  if (!selectedPlanId) return alert("플랜을 선택하세요.");
  const desc = planDescEl.value.trim();
  await db.collection("plans").doc(selectedPlanId).update({ description: desc });
  displayDescEl.textContent = desc;
  alert("설명 저장되었습니다.");
};

// 13. PlayList 링크 저장
btnSavePlaylist.onclick = async () => {
  if (!selectedPlanId) return alert("플랜을 선택하세요.");
  const link = playlistLinkEl.value.trim();
  if (link && !/^https?:\/\//.test(link)) {
    return alert("올바른 URL을 입력해주세요.");
  }
  await db.collection("plans").doc(selectedPlanId).update({ playlistLink: link });
  if (link) {
    displayPlaylist.innerHTML = `<a href="${link}" target="_blank" class="underline">${link}</a>`;
  } else {
    displayPlaylist.textContent = "등록된 링크가 없습니다.";
  }
  alert("플레이리스트 링크가 저장되었습니다.");
};

// 14. 모달 닫기
btnClose.onclick = () => modal.classList.remove("show");
modal.addEventListener("click", () => modal.classList.remove("show"));
modalContent.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") modal.classList.remove("show");
});

// 15. 그래프 그리기
async function drawChart() {
  if (!selectedPlanId) return;
  const snap = await statsCol().get();
  const stats = snap.docs.map((d) => d.data());
  const labels = Array.from(new Set(stats.map((s) => s.date))).sort();
  const filter = routineSelect.value;
  const datasets = [];
  let maxv = 0;

  if (filter) {
    const recs = stats.filter((s) => s.routine === filter);
    const data = labels.map((d) => {
      const r = recs.find((x) => x.date === d);
      const v = r ? r.score : null;
      if (v !== null) maxv = Math.max(maxv, v);
      return v;
    });
    datasets.push({ label: filter, data, borderColor: getRandomColor(), fill: false, tension: 0.3, pointRadius: 5 });
  } else {
    const routines = [...new Set(stats.map((s) => s.routine))];
    routines.forEach((rt) => {
      const recs = stats.filter((s) => s.routine === rt);
      const data = labels.map((d) => {
        const r = recs.find((x) => x.date === d);
        const v = r ? r.score : null;
        if (v !== null) maxv = Math.max(maxv, v);
        return v;
      });
      datasets.push({ label: rt, data, borderColor: getRandomColor(), fill: false, tension: 0.3, pointRadius: 4 });
    });
  }

  const sugMax = Math.ceil(maxv * 1.1);
  const config = {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" }, tooltip: { mode: "index", intersect: false } },
      scales: {
        x: { title: { display: true, text: "날짜" }, ticks: { maxRotation: 45, minRotation: 45 } },
        y: { title: { display: true, text: "점수" }, beginAtZero: true, suggestedMax: sugMax }
      }
    }
  };

  if (scoreChart) {
    scoreChart.options = config.options;
    scoreChart.data = config.data;
    scoreChart.update();
  } else {
    scoreChart = new Chart(ctx, config);
  }
}
