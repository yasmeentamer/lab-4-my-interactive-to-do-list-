// ─── MODEL: Task ─────────────────────────────────────────────────────────────
// Represents a single to-do item
class Task {
  constructor(description) {
    this.id          = Date.now() + Math.random().toString(36).slice(2);
    this.description = description;
    this.completed   = false;
    this.createdAt   = new Date().toISOString();
  }
}

// ─── MODEL: TaskManager ───────────────────────────────────────────────────────
// Manages the array of tasks and handles localStorage persistence
class TaskManager {
  constructor() {
    this.tasks = this.#load();
  }

  // Private: load tasks from localStorage
  #load() {
    try {
      return JSON.parse(localStorage.getItem('pro-tasks') || '[]');
    } catch {
      return [];
    }
  }

  // Private: save tasks to localStorage
  #save() {
    localStorage.setItem('pro-tasks', JSON.stringify(this.tasks));
  }

  add(description) {
    const task = new Task(description.trim());
    this.tasks.push(task);
    this.#save();
    return task;
  }

  remove(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.#save();
  }

  toggle(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      this.#save();
    }
  }

  edit(id, newDesc) {
    const task = this.tasks.find(t => t.id === id);
    if (task && newDesc.trim()) {
      task.description = newDesc.trim();
      this.#save();
    }
  }

  getFiltered(filter, sort) {
    let list = [...this.tasks];

    // Filter
    if (filter === 'completed')  list = list.filter(t => t.completed);
    if (filter === 'incomplete') list = list.filter(t => !t.completed);

    // Sort
    if (sort === 'alpha') {
      list.sort((a, b) => a.description.localeCompare(b.description));
    } else {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    return list;
  }
}

// ─── VIEW: TaskView ───────────────────────────────────────────────────────────
// Handles all DOM rendering and UI updates
class TaskView {
  constructor() {
    this.listEl     = document.getElementById('task-list');
    this.inputEl    = document.getElementById('task-input');
    this.addBtn     = document.getElementById('add-btn');
    this.statTotal  = document.getElementById('stat-total');
    this.statDone   = document.getElementById('stat-done');
    this.statPend   = document.getElementById('stat-pending');
    this.filterBtns = document.querySelectorAll('[data-filter]');
    this.sortBtns   = document.querySelectorAll('[data-sort]');
  }

  // Render the full task list
  render(tasks) {
    this.listEl.innerHTML = '';
    if (!tasks.length) {
      this.listEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">📋</div>
          No tasks here yet.
        </div>`;
      return;
    }
    tasks.forEach(task => this.listEl.appendChild(this.#createItem(task)));
  }

  // Private: build a single task card element
  #createItem(task) {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.completed ? ' completed' : '');
    item.dataset.id = task.id;

    // Toggle button — circle icon, green check when done
    const toggleBtn = document.createElement('button');
    toggleBtn.className      = 'toggle-btn' + (task.completed ? ' toggle-done' : '');
    toggleBtn.title          = 'Toggle complete';
    toggleBtn.innerHTML      = task.completed
      ? `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10" fill="#2e7d32"/><path d="M6 11.5l3.5 3.5 6.5-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10" stroke="#d4c9ee" stroke-width="2"/></svg>`;
    toggleBtn.dataset.action = 'toggle';

    // Content (text + timestamp)
    const content = document.createElement('div');
    content.className = 'task-content';

    const textEl = document.createElement('div');
    textEl.className   = 'task-text';
    textEl.textContent = task.description;

    const timeEl = document.createElement('div');
    timeEl.className   = 'task-time';
    timeEl.textContent = '🕐 ' + new Date(task.createdAt).toLocaleString();

    content.appendChild(textEl);
    content.appendChild(timeEl);

    // Action buttons (edit ✏️ and delete ❌)
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className        = 'icon-btn';
    editBtn.title            = 'Edit';
    editBtn.textContent      = '✏️';
    editBtn.dataset.action   = 'edit';

    const delBtn = document.createElement('button');
    delBtn.className         = 'icon-btn';
    delBtn.title             = 'Delete';
    delBtn.textContent       = '❌';
    delBtn.dataset.action    = 'delete';

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(toggleBtn);
    item.appendChild(content);
    item.appendChild(actions);
    return item;
  }

  // Replace task text with an editable input field
  showEditInput(item, task) {
    const content = item.querySelector('.task-content');
    const textEl  = item.querySelector('.task-text');
    textEl.style.display = 'none';

    const input = document.createElement('input');
    input.className = 'edit-input';
    input.value     = task.description;
    content.insertBefore(input, textEl);
    input.focus();
    input.select();
    return input;
  }

  // Update the stats bar (total / done / pending)
  updateStats(all) {
    const done = all.filter(t => t.completed).length;
    this.statTotal.textContent = all.length;
    this.statDone.textContent  = done;
    this.statPend.textContent  = all.length - done;
  }

  setActiveFilter(filter) {
    this.filterBtns.forEach(b =>
      b.classList.toggle('active', b.dataset.filter === filter)
    );
  }

  setActiveSort(sort) {
    this.sortBtns.forEach(b =>
      b.classList.toggle('active', b.dataset.sort === sort)
    );
  }

  // Animate a task card out, then call the callback
  animateRemove(item, cb) {
    item.classList.add('removing');
    item.addEventListener('transitionend', cb, { once: true });
  }
}

// ─── CONTROLLER ───────────────────────────────────────────────────────────────
// Wires the Model and View together; handles all user interactions
class Controller {
  constructor(model, view) {
    this.model  = model;
    this.view   = view;
    this.filter = 'all';
    this.sort   = 'time';

    // Add task via button or Enter key
    this.view.addBtn.addEventListener('click', () => this.#addTask());
    this.view.inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.#addTask();
    });

    // Filter chip clicks
    this.view.filterBtns.forEach(btn => btn.addEventListener('click', () => {
      this.filter = btn.dataset.filter;
      this.view.setActiveFilter(this.filter);
      this.#refresh();
    }));

    // Sort chip clicks
    this.view.sortBtns.forEach(btn => btn.addEventListener('click', () => {
      this.sort = btn.dataset.sort;
      this.view.setActiveSort(this.sort);
      this.#refresh();
    }));

    // Delegated click handler for task list actions
    this.view.listEl.addEventListener('click', e => {
      const btn    = e.target.closest('[data-action]');
      if (!btn) return;
      const item   = btn.closest('.task-item');
      const id     = item?.dataset.id;
      if (!id) return;

      const action = btn.dataset.action;
      if (action === 'toggle') this.#toggle(id);
      if (action === 'delete') this.#delete(item, id);
      if (action === 'edit')   this.#startEdit(item, id);
    });

    this.#refresh();
  }

  #addTask() {
    const val = this.view.inputEl.value.trim();
    if (!val) return;
    this.model.add(val);
    this.view.inputEl.value = '';
    this.#refresh();
  }

  #toggle(id) {
    this.model.toggle(id);
    this.#refresh();
  }

  #delete(item, id) {
    this.view.animateRemove(item, () => {
      this.model.remove(id);
      this.#refresh();
    });
  }

  #startEdit(item, id) {
    const task = this.model.tasks.find(t => t.id === id);
    if (!task) return;
    const input = this.view.showEditInput(item, task);

    const commit = () => {
      this.model.edit(id, input.value);
      this.#refresh();
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  commit();
      if (e.key === 'Escape') this.#refresh();
    });
    input.addEventListener('blur', commit);
  }

  #refresh() {
    const filtered = this.model.getFiltered(this.filter, this.sort);
    this.view.render(filtered);
    this.view.updateStats(this.model.tasks);
  }
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
const app = new Controller(new TaskManager(), new TaskView());
