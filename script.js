const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const PALETTE = ['#2da44e', '#0969da', '#cf222e', '#bf8700', '#8250df', '#bc4c00', '#1a7f8e', '#57606a'];
const DEFAULT_COLOR = PALETTE[0];
const MILESTONES = [
  { days: 7, emoji: '🥉' },
  { days: 21, emoji: '🥈' },
  { days: 66, emoji: '🥇' },
  { days: 100, emoji: '🏆' },
];

let habits = [];
let currentUserId = null;
const calendarView = {};
let selectedNewColor = DEFAULT_COLOR;
let editingHabitId = null;
let editNameDraft = '';
let editColorDraft = DEFAULT_COLOR;
let confirmDeleteId = null;
let confirmDeleteTimer = null;

const THEME_KEY = 'habitTrackerTheme';
const STATS_OPEN_KEY = 'habitTrackerStatsOpen';
let isStatsOpen = localStorage.getItem(STATS_OPEN_KEY) !== 'false';

const authScreenEl = document.getElementById('auth-screen');
const appEl = document.getElementById('app');
const authFormEl = document.getElementById('auth-form');
const authEmailInputEl = document.getElementById('auth-email-input');
const authMessageEl = document.getElementById('auth-message');
const signoutBtn = document.getElementById('signout-btn');

const habitListEl = document.getElementById('habit-list');
const emptyMessageEl = document.getElementById('empty-message');
const addHabitForm = document.getElementById('add-habit-form');
const habitInput = document.getElementById('habit-input');
const addColorPickerEl = document.getElementById('add-color-picker');
const themeToggleBtn = document.getElementById('theme-toggle');
const statsToggleBtn = document.getElementById('stats-toggle-btn');
const statsPanelEl = document.getElementById('stats-panel');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file-input');

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
});

statsToggleBtn.addEventListener('click', () => {
  isStatsOpen = !isStatsOpen;
  localStorage.setItem(STATS_OPEN_KEY, String(isStatsOpen));
  renderStatsPanel();
});

exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(habits, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `habit-tracker-backup-${todayStr()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => importFileInput.click());

importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);
      const isValid =
        Array.isArray(parsed) &&
        parsed.every((h) => h && typeof h.name === 'string' && typeof h.completed === 'object');
      if (!isValid) throw new Error('invalid backup file');

      const confirmed = confirm(`${parsed.length}개 습관으로 현재 데이터를 덮어씁니다. 계속할까요?`);
      if (!confirmed) return;

      const { error: deleteError } = await supabaseClient.from('habits').delete().eq('user_id', currentUserId);
      if (deleteError) throw deleteError;

      const rows = parsed.map((h, index) => ({
        user_id: currentUserId,
        name: h.name,
        color: h.color || DEFAULT_COLOR,
        collapsed: !!h.collapsed,
        completed: h.completed || {},
        position: index,
      }));

      const { data, error: insertError } = await supabaseClient.from('habits').insert(rows).select();
      if (insertError) throw insertError;

      habits = data.sort((a, b) => a.position - b.position);
      renderHabits();
    } catch (err) {
      alert('올바른 백업 파일이 아니거나 가져오기에 실패했어요.');
    }
  };
  reader.readAsText(file);
  importFileInput.value = '';
});

authFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = authEmailInputEl.value.trim();
  if (!email) return;
  authMessageEl.textContent = '전송 중...';
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  authMessageEl.textContent = error
    ? '전송에 실패했어요. 다시 시도해주세요.'
    : '메일함에서 매직 링크를 확인해주세요.';
});

signoutBtn.addEventListener('click', () => {
  supabaseClient.auth.signOut();
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  handleSession(session);
});

supabaseClient.auth.getSession().then(({ data }) => handleSession(data.session));

async function handleSession(session) {
  if (session) {
    currentUserId = session.user.id;
    authScreenEl.hidden = true;
    appEl.hidden = false;
    await fetchHabits();
    renderAddColorPicker();
    renderHabits();
  } else {
    currentUserId = null;
    habits = [];
    appEl.hidden = true;
    authScreenEl.hidden = false;
  }
}

async function fetchHabits() {
  const { data, error } = await supabaseClient
    .from('habits')
    .select('*')
    .order('position', { ascending: true });
  if (error) {
    console.error(error);
    habits = [];
    return;
  }
  habits = data.map((h) => ({ ...h, completed: h.completed || {} }));
}

function getTotalDays(habit) {
  return Object.keys(habit.completed).filter((key) => habit.completed[key]).length;
}

async function moveHabit(id, direction) {
  const index = habits.findIndex((h) => h.id === id);
  const newIndex = index + direction;
  if (index === -1 || newIndex < 0 || newIndex >= habits.length) return;
  const a = habits[index];
  const b = habits[newIndex];
  const aPos = a.position;
  const bPos = b.position;
  [habits[index], habits[newIndex]] = [b, a];
  a.position = bPos;
  b.position = aPos;
  renderHabits();
  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabaseClient.from('habits').update({ position: a.position }).eq('id', a.id),
    supabaseClient.from('habits').update({ position: b.position }).eq('id', b.id),
  ]);
  if (err1 || err2) console.error(err1 || err2);
}

async function toggleCollapse(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  habit.collapsed = !habit.collapsed;
  renderHabits();
  const { error } = await supabaseClient.from('habits').update({ collapsed: habit.collapsed }).eq('id', id);
  if (error) console.error(error);
}

function handleDeleteClick(id) {
  if (confirmDeleteId === id) {
    clearTimeout(confirmDeleteTimer);
    confirmDeleteId = null;
    deleteHabit(id);
    return;
  }
  confirmDeleteId = id;
  renderHabits();
  clearTimeout(confirmDeleteTimer);
  confirmDeleteTimer = setTimeout(() => {
    confirmDeleteId = null;
    renderHabits();
  }, 3000);
}

function scrollToHabit(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  if (habit.collapsed) {
    toggleCollapse(id);
  }
  const card = document.getElementById(`habit-card-${id}`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('flash-highlight');
  setTimeout(() => card.classList.remove('flash-highlight'), 1200);
}

function createColorPicker(selectedColor, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'color-picker';

  PALETTE.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch' + (color === selectedColor ? ' selected' : '');
    swatch.style.background = color;
    swatch.setAttribute('aria-label', color);
    swatch.addEventListener('click', () => onSelect(color));
    wrap.appendChild(swatch);
  });

  return wrap;
}

function renderAddColorPicker() {
  addColorPickerEl.innerHTML = '';
  addColorPickerEl.appendChild(
    createColorPicker(selectedNewColor, (color) => {
      selectedNewColor = color;
      renderAddColorPicker();
    })
  );
}

function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return dateStr(new Date());
}

function calcStreak(habit) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cursor = new Date(today);

  if (!habit.completed[dateStr(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (habit.completed[dateStr(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calcBestStreak(habit) {
  const dates = Object.keys(habit.completed)
    .filter((key) => habit.completed[key])
    .sort();

  if (dates.length === 0) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const diffDays = Math.round((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000);
    current = diffDays === 1 ? current + 1 : 1;
    if (current > best) best = current;
  }
  return best;
}

function renderBadges(habit) {
  const wrap = document.createElement('div');
  wrap.className = 'habit-badges';

  const best = calcBestStreak(habit);
  MILESTONES.forEach((milestone) => {
    const earned = best >= milestone.days;
    const badge = document.createElement('span');
    badge.className = 'badge' + (earned ? ' earned' : ' unearned');
    badge.textContent = milestone.emoji;
    badge.title = `${milestone.days}일 연속 달성` + (earned ? ' ✓' : ' (미달성)');
    wrap.appendChild(badge);
  });

  return wrap;
}

function renderStatsPanel() {
  statsPanelEl.hidden = !isStatsOpen;
  statsToggleBtn.classList.toggle('open', isStatsOpen);
  if (!isStatsOpen) return;

  statsPanelEl.innerHTML = '';

  if (habits.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = '통계를 보려면 습관을 먼저 추가해보세요!';
    statsPanelEl.appendChild(empty);
    return;
  }

  const counts = habits
    .map((habit) => ({ habit, total: getTotalDays(habit) }))
    .sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(...counts.map((c) => c.total), 1);

  counts.forEach(({ habit, total }) => {
    const row = document.createElement('div');
    row.className = 'stats-row clickable';
    row.setAttribute('aria-label', '클릭하면 해당 습관 달력으로 이동');
    row.addEventListener('click', () => scrollToHabit(habit.id));

    const label = document.createElement('span');
    label.className = 'stats-label';
    label.textContent = habit.name;

    const track = document.createElement('div');
    track.className = 'stats-bar-track';
    const fill = document.createElement('div');
    fill.className = 'stats-bar-fill';
    fill.style.width = `${(total / maxTotal) * 100}%`;
    fill.style.background = habit.color;

    const tooltip = document.createElement('div');
    tooltip.className = 'stats-tooltip';
    tooltip.textContent = `연속 ${calcStreak(habit)}일 · 총 ${total}일`;

    track.appendChild(fill);
    track.appendChild(tooltip);

    const value = document.createElement('span');
    value.className = 'stats-value';
    value.textContent = `${total}일`;

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    statsPanelEl.appendChild(row);
  });

  const totalCheckins = counts.reduce((sum, c) => sum + c.total, 0);
  const summary = document.createElement('p');
  summary.className = 'stats-summary';
  summary.textContent = `총 ${habits.length}개 습관 · 누적 체크인 ${totalCheckins}회`;
  statsPanelEl.appendChild(summary);
}

function getCalendarView(habitId) {
  if (!calendarView[habitId]) {
    const now = new Date();
    calendarView[habitId] = { year: now.getFullYear(), month: now.getMonth() };
  }
  return calendarView[habitId];
}

function changeCalendarMonth(habitId, delta) {
  const view = getCalendarView(habitId);
  let month = view.month + delta;
  let year = view.year;
  if (month < 0) {
    month = 11;
    year -= 1;
  } else if (month > 11) {
    month = 0;
    year += 1;
  }
  view.month = month;
  view.year = year;
  renderHabits();
}

function renderCalendar(habit) {
  const view = getCalendarView(habit.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = todayStr();

  const calendar = document.createElement('div');
  calendar.className = 'calendar';

  const header = document.createElement('div');
  header.className = 'calendar-header';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'calendar-nav-btn';
  prevBtn.type = 'button';
  prevBtn.textContent = '‹';
  prevBtn.addEventListener('click', () => changeCalendarMonth(habit.id, -1));

  const label = document.createElement('span');
  label.className = 'calendar-label';
  label.textContent = `${view.year}년 ${view.month + 1}월`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'calendar-nav-btn';
  nextBtn.type = 'button';
  nextBtn.textContent = '›';
  nextBtn.addEventListener('click', () => changeCalendarMonth(habit.id, 1));

  header.appendChild(prevBtn);
  header.appendChild(label);
  header.appendChild(nextBtn);

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  WEEKDAY_LABELS.forEach((label) => {
    const weekdayEl = document.createElement('div');
    weekdayEl.className = 'calendar-weekday';
    weekdayEl.textContent = label;
    grid.appendChild(weekdayEl);
  });

  const firstOfMonth = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  for (let i = 0; i < firstOfMonth.getDay(); i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(view.year, view.month, day);
    const key = dateStr(cellDate);
    const isFuture = cellDate > today;

    const dayBtn = document.createElement('button');
    dayBtn.type = 'button';
    dayBtn.className = 'calendar-day';
    dayBtn.textContent = String(day);
    if (habit.completed[key]) {
      dayBtn.classList.add('completed');
      dayBtn.style.background = habit.color;
      dayBtn.style.borderColor = habit.color;
    }
    if (key === todayKey) dayBtn.classList.add('today');

    if (isFuture) {
      dayBtn.classList.add('future');
      dayBtn.disabled = true;
    } else {
      dayBtn.addEventListener('click', () => toggleDate(habit.id, key));
    }

    grid.appendChild(dayBtn);
  }

  calendar.appendChild(header);
  calendar.appendChild(grid);

  return calendar;
}

function renderHabits() {
  habitListEl.innerHTML = '';
  emptyMessageEl.style.display = habits.length === 0 ? 'block' : 'none';

  habits.forEach((habit, index) => {
    const card = document.createElement('div');
    card.className = 'habit-card';
    card.id = `habit-card-${habit.id}`;

    const header = document.createElement('div');
    header.className = 'habit-card-header';

    if (habit.id === editingHabitId) {
      header.appendChild(renderEditForm(habit));
    } else {
      const nameGroup = document.createElement('div');
      nameGroup.className = 'habit-name-group';

      const nameEl = document.createElement('span');
      nameEl.className = 'habit-name';
      nameEl.title = '클릭하여 이름/색상 수정';

      const dotEl = document.createElement('span');
      dotEl.className = 'habit-color-dot';
      dotEl.style.background = habit.color;

      nameEl.appendChild(dotEl);
      nameEl.appendChild(document.createTextNode(habit.name));
      nameEl.addEventListener('click', () => startEditing(habit));

      const streakEl = document.createElement('span');
      streakEl.className = 'habit-streak';
      streakEl.textContent = `연속 ${calcStreak(habit)}일`;

      const totalEl = document.createElement('span');
      totalEl.className = 'habit-total';
      totalEl.textContent = `총 ${getTotalDays(habit)}일`;

      nameGroup.appendChild(nameEl);
      nameGroup.appendChild(streakEl);
      nameGroup.appendChild(totalEl);

      const actions = document.createElement('div');
      actions.className = 'habit-actions';

      const isCheckedToday = !!habit.completed[todayStr()];
      const checkBtn = document.createElement('button');
      checkBtn.className = 'check-today-btn' + (isCheckedToday ? ' checked' : '');
      checkBtn.textContent = isCheckedToday ? '오늘 완료 ✓' : '오늘 완료';
      checkBtn.style.borderColor = habit.color;
      checkBtn.style.color = isCheckedToday ? '#fff' : habit.color;
      checkBtn.style.background = isCheckedToday ? habit.color : '#fff';
      checkBtn.addEventListener('click', () => toggleDate(habit.id, todayStr()));

      const isConfirmingDelete = confirmDeleteId === habit.id;
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn' + (isConfirmingDelete ? ' confirming' : '');
      deleteBtn.textContent = isConfirmingDelete ? '정말 삭제?' : '삭제';
      deleteBtn.addEventListener('click', () => handleDeleteClick(habit.id));

      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'collapse-toggle-btn' + (habit.collapsed ? ' collapsed' : '');
      collapseBtn.textContent = '▾';
      collapseBtn.title = habit.collapsed ? '펼치기' : '접기';
      collapseBtn.addEventListener('click', () => toggleCollapse(habit.id));

      const moveUpBtn = document.createElement('button');
      moveUpBtn.type = 'button';
      moveUpBtn.className = 'order-btn';
      moveUpBtn.textContent = '▲';
      moveUpBtn.title = '위로 이동';
      moveUpBtn.disabled = index === 0;
      moveUpBtn.addEventListener('click', () => moveHabit(habit.id, -1));

      const moveDownBtn = document.createElement('button');
      moveDownBtn.type = 'button';
      moveDownBtn.className = 'order-btn';
      moveDownBtn.textContent = '▼';
      moveDownBtn.title = '아래로 이동';
      moveDownBtn.disabled = index === habits.length - 1;
      moveDownBtn.addEventListener('click', () => moveHabit(habit.id, 1));

      actions.appendChild(moveUpBtn);
      actions.appendChild(moveDownBtn);
      actions.appendChild(checkBtn);
      actions.appendChild(deleteBtn);
      actions.appendChild(collapseBtn);

      header.appendChild(nameGroup);
      header.appendChild(actions);
    }

    card.appendChild(header);
    if (habit.id !== editingHabitId && !habit.collapsed) {
      card.appendChild(renderBadges(habit));
      card.appendChild(renderCalendar(habit));
    }

    habitListEl.appendChild(card);
  });

  renderStatsPanel();
}

function startEditing(habit) {
  editingHabitId = habit.id;
  editNameDraft = habit.name;
  editColorDraft = habit.color;
  renderHabits();
}

function renderEditForm(habit) {
  const form = document.createElement('div');
  form.className = 'edit-form';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'edit-name-input';
  nameInput.maxLength = 30;
  nameInput.value = editNameDraft;
  nameInput.addEventListener('input', (e) => {
    editNameDraft = e.target.value;
  });

  const colorPicker = createColorPicker(editColorDraft, (color) => {
    editColorDraft = color;
    renderHabits();
  });

  const actions = document.createElement('div');
  actions.className = 'edit-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'save-btn';
  saveBtn.textContent = '저장';
  saveBtn.addEventListener('click', () => saveEdit(habit.id));

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => {
    editingHabitId = null;
    renderHabits();
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  form.appendChild(nameInput);
  form.appendChild(colorPicker);
  form.appendChild(actions);

  requestAnimationFrame(() => {
    nameInput.focus();
    nameInput.select();
  });

  return form;
}

async function saveEdit(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  const trimmed = editNameDraft.trim();
  if (trimmed) habit.name = trimmed;
  habit.color = editColorDraft;
  editingHabitId = null;
  renderHabits();
  const { error } = await supabaseClient
    .from('habits')
    .update({ name: habit.name, color: habit.color })
    .eq('id', id);
  if (error) alert('저장에 실패했어요.');
}

async function addHabit(name, color) {
  const { data, error } = await supabaseClient
    .from('habits')
    .insert({ user_id: currentUserId, name, color, position: habits.length, completed: {} })
    .select()
    .single();
  if (error) {
    alert('습관을 추가하지 못했어요.');
    return;
  }
  habits.push({ ...data, completed: data.completed || {} });
  renderHabits();
}

async function deleteHabit(id) {
  habits = habits.filter((h) => h.id !== id);
  renderHabits();
  const { error } = await supabaseClient.from('habits').delete().eq('id', id);
  if (error) alert('삭제에 실패했어요. 새로고침 후 다시 시도해주세요.');
}

async function toggleDate(id, key) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  if (habit.completed[key]) {
    delete habit.completed[key];
  } else {
    habit.completed[key] = true;
  }
  renderHabits();
  const { error } = await supabaseClient.from('habits').update({ completed: habit.completed }).eq('id', id);
  if (error) alert('저장에 실패했어요. 네트워크를 확인해주세요.');
}

addHabitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = habitInput.value.trim();
  if (!name) return;
  await addHabit(name, selectedNewColor);
  habitInput.value = '';
  selectedNewColor = DEFAULT_COLOR;
  renderAddColorPicker();
  habitInput.focus();
});
