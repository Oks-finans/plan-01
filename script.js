const STORAGE_KEY = 'planner_tasks';

let lastDeletedTask = null;

function getTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized = parsed.map((task) => ({
      id: task.id || generateTaskId(),
      text: String(task.text || '').trim(),
      day: Number(task.day) || 1,
      date: typeof task.date === 'string' ? task.date : '',
      priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'low',
      is_completed: Boolean(task.is_completed),
      is_carried_over: Boolean(task.is_carried_over),
      created_at: task.created_at || new Date().toISOString(),
    }));

    const shouldResave = normalized.some((task, index) => {
      const original = parsed[index] || {};
      return (
        task.id !== original.id ||
        task.text !== original.text ||
        task.day !== Number(original.day) ||
        task.date !== original.date ||
        task.priority !== original.priority ||
        task.is_completed !== Boolean(original.is_completed) ||
        task.is_carried_over !== Boolean(original.is_carried_over) ||
        task.created_at !== original.created_at
      );
    });

    if (shouldResave) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch (saveError) {
        console.warn('Не удалось сохранить нормализованные задачи в localStorage:', saveError);
      }
    }

    return normalized;
  } catch (error) {
    console.warn('Не удалось прочитать задачи из localStorage:', error);
    return [];
  }
}

function saveTasks(tasks) {
  try {
    const payload = JSON.stringify(tasks);
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (error) {
    console.error('Не удалось сохранить задачи в localStorage:', error);
  }
}

const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const daySelect = document.getElementById('day-select');
const dateInput = document.getElementById('date-input');
const prioritySelect = document.getElementById('priority-select');
const submitTaskButton = document.getElementById('submit-task-button');
const cancelEditButton = document.getElementById('cancel-edit-button');
const exportButton = document.getElementById('export-tasks-button');
const calendarBoard = document.getElementById('calendar-board');
const toastContainer = document.getElementById('toast-container');
const calendarColumns = Array.from(document.querySelectorAll('#calendar-board .calendar-column'));

let tasks = getTasks();
let editingTaskId = null;

function getPrioritySymbol(priority) {
  switch (priority) {
    case 'high':
      return '🔴';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

function createTaskCard(task) {
  const card = document.createElement('article');
  card.className = 'task-card';
  card.dataset.taskId = task.id;

  if (task.is_completed) {
    card.classList.add('completed');
  }

  if (task.is_carried_over) {
    card.classList.add('carried-over');
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.is_completed;
  checkbox.dataset.taskId = task.id;

  const checkboxLabel = document.createElement('label');
  checkboxLabel.className = 'task-checkbox-label';
  checkboxLabel.appendChild(checkbox);

  const labelText = document.createElement('span');
  labelText.textContent = task.is_completed ? 'Выполнено' : 'Выполнить';
  checkboxLabel.appendChild(labelText);

  const icon = document.createElement('span');
  icon.className = 'task-priority-icon';
  icon.textContent = getPrioritySymbol(task.priority);

  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;

  if (task.date) {
    const dateLabel = document.createElement('span');
    dateLabel.className = 'task-date-label';
    dateLabel.textContent = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(task.date));
    card.appendChild(dateLabel);
  }

  const controls = document.createElement('div');
  controls.className = 'task-card-controls';

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'task-toggle-button';
  toggleButton.textContent = task.is_completed ? 'Отменить' : 'Завершить';
  toggleButton.dataset.taskId = task.id;

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'task-edit-button';
  editButton.textContent = 'Править';
  editButton.dataset.taskId = task.id;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'task-delete-button';
  deleteButton.textContent = 'Удалить';
  deleteButton.dataset.taskId = task.id;

  controls.append(toggleButton, editButton, deleteButton);
  card.append(checkboxLabel, icon, text, controls);
  return card;
}

function showToast(message, actionLabel, actionHandler) {
  if (!toastContainer) {
    return;
  }

  toastContainer.innerHTML = '';

  const toast = document.createElement('div');
  toast.className = 'toast';

  const text = document.createElement('span');
  text.textContent = message;

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'toast-action';
  action.textContent = actionLabel;
  action.addEventListener('click', () => {
    actionHandler();
    toastContainer.innerHTML = '';
  });

  toast.append(text, action);
  toastContainer.appendChild(toast);

  window.setTimeout(() => {
    if (toastContainer.contains(toast)) {
      toastContainer.innerHTML = '';
    }
  }, 5000);
}

function toggleTaskCompletion(taskId, completed) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  task.is_completed = completed;
  saveTasks(tasks);
  renderTasks();
}

function startEditTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  editingTaskId = taskId;
  taskInput.value = task.text;
  daySelect.value = String(task.day);
  dateInput.value = task.date || '';
  prioritySelect.value = task.priority;
  submitTaskButton.textContent = 'Сохранить';
  cancelEditButton.hidden = false;
  taskInput.focus();
}

function resetEditState() {
  editingTaskId = null;
  taskInput.value = '';
  dateInput.value = '';
  submitTaskButton.textContent = 'Добавить';
  cancelEditButton.hidden = true;
}

function deleteTask(taskId) {
  const index = tasks.findIndex((item) => item.id === taskId);
  if (index === -1) {
    return;
  }

  lastDeletedTask = tasks.splice(index, 1)[0];
  saveTasks(tasks);
  renderTasks();
  showToast('Задача удалена', 'Отменить', undoDelete);
}

function undoDelete() {
  if (!lastDeletedTask) {
    return;
  }

  tasks.push(lastDeletedTask);
  lastDeletedTask = null;
  saveTasks(tasks);
  renderTasks();
}

if (calendarBoard) {
  calendarBoard.addEventListener('click', (event) => {
    const checkbox = event.target.closest('.task-checkbox');
    if (checkbox) {
      const taskId = checkbox.dataset.taskId;
      toggleTaskCompletion(taskId, checkbox.checked);
      return;
    }

    const toggleButton = event.target.closest('.task-toggle-button');
    if (toggleButton) {
      const taskId = toggleButton.dataset.taskId;
      const task = tasks.find((item) => item.id === taskId);
      if (task) {
        toggleTaskCompletion(taskId, !task.is_completed);
      }
      return;
    }

    const editButton = event.target.closest('.task-edit-button');
    if (editButton) {
      const taskId = editButton.dataset.taskId;
      startEditTask(taskId);
      return;
    }

    const deleteButton = event.target.closest('.task-delete-button');
    if (deleteButton) {
      const taskId = deleteButton.dataset.taskId;
      deleteTask(taskId);
    }
  });
}

function compareTasks(a, b) {
  if (a.is_completed !== b.is_completed) {
    return a.is_completed ? 1 : -1;
  }

  const priorityOrder = {
    high: 0,
    medium: 1,
    low: 2,
  };

  const priorityA = priorityOrder[a.priority] ?? 3;
  const priorityB = priorityOrder[b.priority] ?? 3;

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  return new Date(a.created_at) - new Date(b.created_at);
}

function renderTasks() {
  calendarColumns.forEach((column) => {
    const heading = column.querySelector('h2');
    column.innerHTML = '';
    if (heading) {
      column.appendChild(heading);
    }
  });

  const tasksByDay = Array.from({ length: 7 }, () => []);

  tasks.forEach((task) => {
    let taskDate = null;
    if (task.date) {
      const parsedDate = new Date(task.date);
      if (!Number.isNaN(parsedDate.getTime())) {
        taskDate = parsedDate;
      }
    }

    const dayIndex = taskDate
      ? (taskDate.getDay() === 0 ? 6 : taskDate.getDay() - 1)
      : Number(task.day) - 1;

    if (dayIndex >= 0 && dayIndex < tasksByDay.length) {
      tasksByDay[dayIndex].push(task);
    }
  });

  tasksByDay.forEach((dayTasks, index) => {
    const targetColumn = calendarColumns[index];
    dayTasks.sort(compareTasks).forEach((task) => {
      const card = createTaskCard(task);
      targetColumn.appendChild(card);
    });
  });
}

function getTaskPlannedDate(task) {
  if (task.date) {
    const exactDate = new Date(task.date);
    if (!Number.isNaN(exactDate.getTime())) {
      exactDate.setHours(0, 0, 0, 0);
      return exactDate;
    }
  }

  const createdAt = task.created_at ? new Date(task.created_at) : new Date();
  const createdDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;

  const createdDay = createdDate.getDay() === 0 ? 7 : createdDate.getDay();
  const taskDay = Number(task.day) || 1;
  const offset = taskDay >= createdDay ? taskDay - createdDay : 7 - createdDay + taskDay;

  const plannedDate = new Date(createdDate);
  plannedDate.setHours(0, 0, 0, 0);
  plannedDate.setDate(plannedDate.getDate() + offset);
  return plannedDate;
}

function checkCarryOver() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cutoffDate = new Date();
  cutoffDate.setHours(0, 0, 0, 0);
  cutoffDate.setDate(cutoffDate.getDate() - 14);

  let changed = false;

  tasks = tasks.filter((task) => {
    const createdAt = task.created_at ? new Date(task.created_at) : new Date();
    if (Number.isNaN(createdAt.getTime())) {
      task.created_at = new Date().toISOString();
    }

    if (task.created_at && new Date(task.created_at) < cutoffDate) {
      changed = true;
      return false;
    }

    const plannedDate = getTaskPlannedDate(task);
    if (!task.is_completed && plannedDate < today) {
      const rawDay = today.getDay();
      task.day = rawDay === 0 ? 7 : rawDay;
      task.date = today.toISOString().slice(0, 10);
      task.is_carried_over = true;
      task.created_at = new Date().toISOString();
      changed = true;
    }
    return true;
  });

  if (changed) {
    saveTasks(tasks);
  }
}

function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

if (taskForm) {
  taskForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const text = taskInput.value.trim();
    if (!text) {
      return;
    }

    if (editingTaskId) {
      const task = tasks.find((item) => item.id === editingTaskId);
      if (task) {
        task.text = text;
        task.day = Number(daySelect.value);
        task.date = dateInput.value || '';
        task.priority = prioritySelect.value;
        saveTasks(tasks);
        renderTasks();
        resetEditState();
      }
    } else {
      const newTask = {
        id: generateTaskId(),
        text,
        day: Number(daySelect.value),
        date: dateInput.value || '',
        priority: prioritySelect.value,
        is_completed: false,
        is_carried_over: false,
        created_at: new Date().toISOString(),
      };

      tasks.push(newTask);
      saveTasks(tasks);
      renderTasks();
      taskInput.value = '';
      taskInput.focus();
    }
  });
}

function exportTasks() {
  const payload = JSON.stringify(tasks, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'tasks_backup.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

if (cancelEditButton) {
  cancelEditButton.addEventListener('click', (event) => {
    event.preventDefault();
    resetEditState();
  });
}

if (exportButton) {
  exportButton.addEventListener('click', exportTasks);
}

checkCarryOver();
renderTasks();
