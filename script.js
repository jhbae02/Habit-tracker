const STORAGE_KEY = 'habitTrackerData';
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const PALETTE = ['#2da44e', '#0969da', '#cf222e', '#bf8700', '#8250df', '#bc4c00', '#1a7f8e', '#57606a'];
const DEFAULT_COLOR = PALETTE[0];
const MILESTONES = [
  { days: 7, emoji: '🥉' },
  { days: 21, emoji: '🥈' },
  { days: 66, emoji: '🥇' },
  { days: 100, emoji: '🏆' },
];

let habits = loadHabits();
const calendarView = {};
let selectedNewColor = DEFAULT_COLOR;
let editingHabitId = null;
let editNameDraft = '';
let editColorDraft = DEFAULT_COLOR;
let isStatsOpen = false;

const THEME_KEY = 'habitTrackerTheme';

const habitListEl = document.getElementById('habit-list');
const emptyMessageEl = document.getElementById('empty-message');
const addHabitForm = document.getElementById('add-habit-form');
const habitInput = document.getElementById('habit-input');
const addColorPickerEl = document.getElementById('add-color-picker');
const themeToggleBtn = document.getElementById('theme-toggle');
const statsToggleBtn = document.getElementById('stats-toggle-btn');
const statsPanelEl = document.getElementById('stats-panel');

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
});

statsToggleBtn.addEventListener('click', () => {
  isStatsOpen = !isStatsOpen;
  renderStatsPanel();
});

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.map((h) => ({ color: DEFAULT_COLOR, ...h }));
  } catch (e) {
    return [];
  }
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

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
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
    .map((habit) => ({ habit, total: Object.keys(habit.completed).length }))
    .sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(...counts.map((c) => c.total), 1);

  counts.forEach(({ habit, total }) => {
    const row = document.createElement('div');
    row.className = 'stats-row';

    const label = document.createElement('span');
    label.className = 'stats-label';
    label.textContent = habit.name;

    const track = document.createElement('div');
    track.className = 'stats-bar-track';
    const fill = document.createElement('div');
    fill.className = 'stats-bar-fill';
    fill.style.width = `${(total / maxTotal) * 100}%`;
    fill.style.background = habit.color;
    track.appendChild(fill);

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

  habits.forEach((habit) => {
    const card = document.createElement('div');
    card.className = 'habit-card';

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

      nameGroup.appendChild(nameEl);
      nameGroup.appendChild(streakEl);

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

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '삭제';
      deleteBtn.addEventListener('click', () => deleteHabit(habit.id));

      actions.appendChild(checkBtn);
      actions.appendChild(deleteBtn);

      header.appendChild(nameGroup);
      header.appendChild(actions);
    }

    card.appendChild(header);
    if (habit.id !== editingHabitId) {
      card.appendChild(renderBadges(habit));
    }
    card.appendChild(renderCalendar(habit));

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

function saveEdit(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  const trimmed = editNameDraft.trim();
  if (trimmed) habit.name = trimmed;
  habit.color = editColorDraft;
  editingHabitId = null;
  saveHabits();
  renderHabits();
}

function addHabit(name, color) {
  habits.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    color,
    completed: {},
  });
  saveHabits();
  renderHabits();
}

function deleteHabit(id) {
  habits = habits.filter((h) => h.id !== id);
  saveHabits();
  renderHabits();
}

function toggleDate(id, key) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  if (habit.completed[key]) {
    delete habit.completed[key];
  } else {
    habit.completed[key] = true;
  }
  saveHabits();
  renderHabits();
}

addHabitForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = habitInput.value.trim();
  if (!name) return;
  addHabit(name, selectedNewColor);
  habitInput.value = '';
  selectedNewColor = DEFAULT_COLOR;
  renderAddColorPicker();
  habitInput.focus();
});

renderAddColorPicker();
renderHabits();
