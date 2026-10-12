(function () {
  const status = document.getElementById('schedule-status');
  const monthly = document.getElementById('monthly-schedule');
  const availabilityForm = document.getElementById('availability-form');
  const slotOptionsList = document.getElementById('slot-options-list');
  const dateInput = document.getElementById('availability-date');
  const availableInput = document.getElementById('availability-available');
  const message = document.getElementById('availability-message');
  const editSlotsButton = document.getElementById('edit-slots-button');
  const editorModal = document.getElementById('slot-editor-modal');
  const editorRows = document.getElementById('slot-editor-rows');
  const editorMessage = document.getElementById('slot-editor-message');
  const editorAdd = document.getElementById('slot-editor-add');
  const editorSave = document.getElementById('slot-editor-save');
  const editorClose = document.getElementById('slot-editor-close');
  const editorCancel = document.getElementById('slot-editor-cancel');
  const SLOT_DURATION_MINUTES = 15;
  let slotValues = [];
  let slotRanges = [];
  let selectedDateAvailability = null;

  function loadingMarkup(label) {
    return `<div class="aura-loading rounded-xl bg-white p-5"><span class="aura-spinner" aria-hidden="true"></span><span>${label}</span></div>`;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function slotCheckboxes() {
    return Array.from(document.querySelectorAll('[data-slot-option]'));
  }

  function toMinutes(timeLabel) {
    const match = String(timeLabel || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  function fromMinutes(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  }

  function normalizeSlotValue(timeValue) {
    const match = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '';
    return fromMinutes((Number(match[1]) * 60) + Number(match[2]));
  }

  function normalizeTimeInput(timeValue) {
    const match = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '';
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function slotInputValue(timeLabel) {
    const minutes = toMinutes(timeLabel);
    if (minutes == null) return '';
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  function sortedUniqueSlots(slots) {
    return Array.from(new Set((slots || []).map((slot) => String(slot).trim()).filter(Boolean)))
      .sort((left, right) => (toMinutes(left) ?? 0) - (toMinutes(right) ?? 0));
  }

  function rangeFromSlot(slot) {
    const startMinutes = toMinutes(slot);
    return {
      start: slot,
      end: startMinutes == null ? '' : fromMinutes(startMinutes + SLOT_DURATION_MINUTES),
    };
  }

  function normalizeRange(range) {
    const start = normalizeSlotValue(range?.startInput) || String(range?.start || '').trim();
    const end = normalizeSlotValue(range?.endInput) || String(range?.end || '').trim();
    return { start, end };
  }

  function rangesFromAvailability(item) {
    const savedRanges = Array.isArray(item?.notes?.slotRanges)
      ? item.notes.slotRanges.map(normalizeRange).filter((range) => range.start && range.end)
      : [];
    if (savedRanges.length) return savedRanges;
    const slots = item?.slots?.length ? item.slots : slotValues;
    return sortedUniqueSlots(slots).map(rangeFromSlot);
  }

  function validateSlotRanges(ranges) {
    const normalized = (ranges || []).map(normalizeRange).filter((range) => range.start || range.end);
    if (!normalized.length) return { ok: true, ranges: [], slots: [] };
    const starts = normalized.map((range) => range.start);
    if (new Set(starts).size !== starts.length) return { ok: false, message: 'Duplicate slot start times are not allowed.' };
    const invalid = normalized.find((range) => toMinutes(range.start) == null || toMinutes(range.end) == null);
    if (invalid) return { ok: false, message: 'Enter a valid start and end time for every slot.' };
    const reversed = normalized.find((range) => toMinutes(range.end) <= toMinutes(range.start));
    if (reversed) return { ok: false, message: `${reversed.end} must be later than ${reversed.start}.` };
    const sorted = normalized.sort((left, right) => toMinutes(left.start) - toMinutes(right.start));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (toMinutes(previous.end) > toMinutes(current.start)) {
        return { ok: false, message: `${previous.start} - ${previous.end} overlaps with ${current.start} - ${current.end}.` };
      }
    }
    return { ok: true, ranges: sorted, slots: sorted.map((range) => range.start) };
  }

  function renderSlotOptions(selectedSlots = slotValues) {
    if (!slotOptionsList) return;
    const selected = new Set(selectedSlots);
    slotOptionsList.innerHTML = slotRanges.length ? slotRanges.map((range) => `
      <label class="rounded-lg border border-[#e3bdc3] px-3 py-2 font-bold">
        <input ${selected.has(range.start) ? 'checked' : ''} data-slot-option value="${range.start}" type="checkbox"> ${range.start} - ${range.end}
      </label>
    `).join('') : '<p class="text-[#5a4044]">No slots added. Use Edit Slots to create booking slots.</p>';
    syncAvailabilityFromSlots();
  }

  function syncAvailabilityFromSlots() {
    const boxes = slotCheckboxes();
    const checkedCount = boxes.filter((input) => input.checked).length;
    if (availableInput) availableInput.checked = checkedCount > 0;
    boxes.forEach((input) => {
      input.disabled = !availableInput?.checked;
    });
  }

  function applyAvailability(item) {
    selectedDateAvailability = item || null;
    if (item?.slots?.length) slotValues = sortedUniqueSlots(item.slots);
    slotRanges = rangesFromAvailability(item);
    slotValues = slotRanges.map((range) => range.start);
    const checkedSlots = item?.is_available === false ? [] : item?.slots?.length ? sortedUniqueSlots(item.slots) : slotValues;
    if (availableInput) availableInput.checked = item?.is_available !== false && checkedSlots.length > 0;
    renderSlotOptions(checkedSlots);
  }

  function renderAvailability(items) {
    const unavailableRows = (items || []).map((item) => {
      const ranges = rangesFromAvailability(item);
      if (item.is_available === false) {
        return {
          date: item.date,
          title: 'Full day unavailable',
          detail: ranges.length ? ranges.map((range) => `${range.start} - ${range.end}`).join(', ') : 'All booking slots blocked',
        };
      }
      const availableStarts = new Set(item.slots || []);
      const unavailableRanges = ranges.filter((range) => !availableStarts.has(range.start));
      if (!unavailableRanges.length) return null;
      return {
        date: item.date,
        title: 'Unavailable slots',
        detail: unavailableRanges.map((range) => `${range.start} - ${range.end}`).join(', '),
      };
    }).filter(Boolean);
    monthly.innerHTML = unavailableRows.length ? unavailableRows.map((item) => `
      <article class="rounded-xl border border-[#e3bdc3] bg-white p-5">
        <p class="font-extrabold text-[#b0004a]">${item.date}</p>
        <h3 class="mt-1 text-2xl font-extrabold">${item.title}</h3>
        <p class="text-[#5a4044]">${item.detail}</p>
      </article>
    `).join('') : '<p class="rounded-xl bg-white p-5 text-[#5a4044]">No unavailable dates or slot combinations saved for this month.</p>';
  }

  async function load() {
    monthly.innerHTML = loadingMarkup('Loading slot availability...');
    try {
      const date = dateInput.value || todayKey();
      const response = await fetch(`/api/doctor/schedule?date=${date}&month=${date.slice(0, 7)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load slots.');
      status.textContent = 'Connected to PostgreSQL';
      if (!slotValues.length) slotValues = sortedUniqueSlots(data.defaultSlots || []);
      applyAvailability((data.availability || []).find((item) => item.date === date));
      renderAvailability(data.availability || []);
    } catch (error) {
      status.textContent = error.message;
      monthly.innerHTML = `<p class="rounded-xl bg-white p-5 text-[#ba1a1a]">${error.message}</p>`;
    }
  }

  availabilityForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const slots = availableInput.checked ? slotCheckboxes().filter((input) => input.checked).map((input) => input.value) : [];
    const validation = validateSlotRanges(slotRanges);
    if (availableInput.checked && !validation.ok) {
      message.textContent = validation.message;
      return;
    }
    const validStarts = new Set(validation.slots);
    const selectedSlots = sortedUniqueSlots(slots).filter((slot) => validStarts.has(slot));
    message.innerHTML = '<span class="aura-loading"><span class="aura-spinner" aria-hidden="true"></span><span>Saving availability...</span></span>';
    try {
      const response = await fetch('/api/doctor/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateInput.value, isAvailable: availableInput.checked, slots: availableInput.checked ? selectedSlots : [], slotRanges: validation.ranges || [] }),
      });
      const data = await response.json();
      message.textContent = response.ok ? 'Availability saved.' : data.message || 'Could not save availability.';
      await load();
    } catch (error) {
      message.textContent = error.message;
    }
  });

  availableInput?.addEventListener('change', () => {
    const boxes = slotCheckboxes();
    boxes.forEach((input) => {
      input.checked = availableInput.checked;
      input.disabled = !availableInput.checked;
    });
  });

  slotOptionsList?.addEventListener('change', (event) => {
    if (!event.target.matches('[data-slot-option]')) return;
    syncAvailabilityFromSlots();
  });

  function editorRow(range = {}) {
    const startValue = slotInputValue(range.start || '');
    const endValue = slotInputValue(range.end || '');
    return `
      <div class="grid gap-3 rounded-lg border border-[#e3bdc3] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center" data-slot-editor-row>
        <label class="grid gap-2 text-sm font-extrabold text-[#5a4044]">
          Start time
          <input class="aura-field p-3 font-normal" data-slot-editor-start type="time" value="${startValue}">
        </label>
        <label class="grid gap-2 text-sm font-extrabold text-[#5a4044]">
          End time
          <input class="aura-field p-3 font-normal" data-slot-editor-end type="time" value="${endValue}">
        </label>
        <button class="mt-0 grid h-11 w-11 place-items-center rounded-lg border border-[#ba1a1a] text-[#ba1a1a] sm:mt-6" data-slot-editor-delete type="button" aria-label="Delete slot">
          <span class="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>
    `;
  }

  function openEditor() {
    editorRows.innerHTML = slotRanges.length ? slotRanges.map(editorRow).join('') : editorRow();
    editorMessage.textContent = '';
    editorModal.classList.remove('hidden');
    editorModal.classList.add('flex');
  }

  function closeEditor() {
    editorModal.classList.add('hidden');
    editorModal.classList.remove('flex');
  }

  function collectEditorSlots() {
    return Array.from(editorRows.querySelectorAll('[data-slot-editor-row]')).map((row) => ({
      startInput: row.querySelector('[data-slot-editor-start]')?.value || '',
      endInput: row.querySelector('[data-slot-editor-end]')?.value || '',
    }));
  }

  editSlotsButton?.addEventListener('click', openEditor);
  editorAdd?.addEventListener('click', () => editorRows.insertAdjacentHTML('beforeend', editorRow()));
  editorRows?.addEventListener('change', (event) => {
    if (!event.target.matches('[data-slot-editor-start]')) return;
    const row = event.target.closest('[data-slot-editor-row]');
    const endInput = row?.querySelector('[data-slot-editor-end]');
    const start = normalizeTimeInput(event.target.value);
    if (start && endInput && !endInput.value) {
      const [hour, minute] = start.split(':').map(Number);
      const end = (hour * 60) + minute + SLOT_DURATION_MINUTES;
      endInput.value = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    }
  });
  editorRows?.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-slot-editor-delete]');
    if (!deleteButton) return;
    const rows = editorRows.querySelectorAll('[data-slot-editor-row]');
    if (rows.length <= 1) {
      rows[0]?.querySelectorAll('input').forEach((input) => {
        input.value = '';
      });
      rows[0]?.querySelector('[data-slot-editor-start]')?.focus();
      return;
    }
    deleteButton.closest('[data-slot-editor-row]')?.remove();
  });
  editorSave?.addEventListener('click', () => {
    const nextRanges = collectEditorSlots();
    const validation = validateSlotRanges(nextRanges);
    if (!validation.ok) {
      editorMessage.textContent = validation.message;
      return;
    }
    slotValues = validation.slots;
    slotRanges = validation.ranges;
    renderSlotOptions(availableInput.checked ? slotValues : []);
    closeEditor();
    message.textContent = 'Slot list updated. Click Save Slots to store it in the database.';
  });
  [editorClose, editorCancel].forEach((button) => button?.addEventListener('click', closeEditor));
  editorModal?.addEventListener('click', (event) => {
    if (event.target === editorModal) closeEditor();
  });

  dateInput.value = todayKey();
  slotValues = sortedUniqueSlots(slotCheckboxes().map((input) => input.value));
  slotRanges = slotValues.map(rangeFromSlot);
  dateInput.addEventListener('change', load);
  load();
})();
