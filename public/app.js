const state = { plans: [], selected: null, pollTimer: null, sceneTimer: null, sceneIndex: 0 };
const elements = Object.fromEntries([
  'serverLabel', 'generateForm', 'niche', 'duration', 'durationValue', 'generateButton', 'formMessage',
  'projectList', 'emptyPreview', 'videoPreview', 'posterPreview', 'previewCopy', 'sceneCounter',
  'sceneText', 'sceneNarration', 'previewActions', 'renderButton', 'downloadButton', 'progressWrap',
  'progressLabel', 'progressValue', 'renderProgress',
].map((id) => [id, document.getElementById(id)]));

async function api(path, options) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function statusText(status) {
  return { draft: 'Storyboard', queued: 'Đang chờ', rendering: 'Đang dựng', ready: 'Hoàn tất', failed: 'Có lỗi' }[status] || status;
}

function renderLibrary() {
  if (!state.plans.length) {
    elements.projectList.innerHTML = '<p class="library-empty">Chưa có dự án. Tạo storyboard đầu tiên ở cột bên trái.</p>';
    return;
  }
  elements.projectList.innerHTML = state.plans.map((plan) => `
    <article class="project-card ${state.selected?.id === plan.id ? 'active' : ''}" data-id="${plan.id}">
      <div class="project-meta"><span>${new Date(plan.createdAt).toLocaleDateString('vi-VN')}</span><span class="project-status ${plan.status}">${statusText(plan.status)}</span></div>
      <h3>${escapeHtml(plan.title)}</h3>
      <div class="project-meta"><span>${plan.sceneCount || plan.scenes?.length || 0} cảnh</span><span>${plan.durationSeconds} giây</span></div>
      <button class="project-delete" type="button" data-delete="${plan.id}">Xóa dự án</button>
    </article>`).join('');
}

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}

function showScene() {
  if (!state.selected?.scenes?.length || state.selected.status === 'ready') return;
  const scene = state.selected.scenes[state.sceneIndex % state.selected.scenes.length];
  elements.sceneCounter.textContent = `${String(state.sceneIndex + 1).padStart(2, '0')} / ${String(state.selected.scenes.length).padStart(2, '0')}`;
  elements.sceneText.textContent = scene.onScreenText;
  elements.sceneNarration.textContent = scene.narration;
  state.sceneIndex = (state.sceneIndex + 1) % state.selected.scenes.length;
}

function present(plan) {
  state.selected = plan;
  state.sceneIndex = 0;
  clearInterval(state.sceneTimer);
  elements.emptyPreview.hidden = true;
  elements.previewActions.hidden = false;
  elements.videoPreview.hidden = plan.status !== 'ready';
  elements.posterPreview.hidden = true;
  elements.previewCopy.hidden = plan.status === 'ready';
  elements.renderButton.disabled = ['queued', 'rendering'].includes(plan.status);
  elements.renderButton.textContent = plan.status === 'ready' ? 'Dựng lại MP4' : 'Dựng MP4';
  elements.downloadButton.hidden = plan.status !== 'ready';
  elements.progressWrap.hidden = !['queued', 'rendering', 'failed'].includes(plan.status);
  if (plan.status === 'ready') {
    const stamp = encodeURIComponent(plan.updatedAt);
    elements.videoPreview.src = `${plan.outputUrl}?v=${stamp}`;
    elements.downloadButton.href = plan.outputUrl;
  } else {
    elements.videoPreview.removeAttribute('src');
    elements.videoPreview.load();
    showScene();
    state.sceneTimer = setInterval(showScene, 2400);
  }
  updateProgress(plan);
  renderLibrary();
}

function updateProgress(plan) {
  const progress = plan.progress || 0;
  elements.renderProgress.value = progress;
  elements.progressValue.textContent = `${progress}%`;
  elements.progressLabel.textContent = plan.status === 'failed' ? plan.error || 'Render thất bại' : statusText(plan.status);
}

async function loadPlans() {
  state.plans = await api('/api/video-plans');
  renderLibrary();
}

async function selectPlan(id) {
  const plan = await api(`/api/video-plans/${id}`);
  present(plan);
  if (['queued', 'rendering'].includes(plan.status)) startPolling(id);
}

function startPolling(id) {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    try {
      const plan = await api(`/api/video-plans/${id}`);
      present(plan);
      if (!['queued', 'rendering'].includes(plan.status)) {
        clearInterval(state.pollTimer);
        await loadPlans();
      }
    } catch (error) {
      clearInterval(state.pollTimer);
      showMessage(error.message, true);
    }
  }, 1000);
}

function showMessage(message, isError = false) {
  elements.formMessage.textContent = message;
  elements.formMessage.classList.toggle('error', isError);
}

elements.duration.addEventListener('input', () => { elements.durationValue.textContent = `${elements.duration.value} giây`; });
elements.generateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.generateButton.disabled = true;
  showMessage('Đang xây dựng câu chuyện và nhịp dựng...');
  try {
    const form = new FormData(elements.generateForm);
    const plan = await api('/api/video-plans/generate', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    await loadPlans();
    present(plan);
    showMessage('Storyboard đã sẵn sàng. Kiểm tra từng cảnh rồi dựng MP4.');
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    elements.generateButton.disabled = false;
  }
});

elements.renderButton.addEventListener('click', async () => {
  if (!state.selected) return;
  elements.renderButton.disabled = true;
  try {
    const plan = await api(`/api/video-plans/${state.selected.id}/render`, { method: 'POST' });
    present(plan);
    startPolling(plan.id);
  } catch (error) {
    showMessage(error.message, true);
    elements.renderButton.disabled = false;
  }
});

elements.projectList.addEventListener('click', async (event) => {
  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) {
    event.stopPropagation();
    await api(`/api/video-plans/${deleteButton.dataset.delete}`, { method: 'DELETE' });
    if (state.selected?.id === deleteButton.dataset.delete) window.location.reload();
    await loadPlans();
    return;
  }
  const card = event.target.closest('[data-id]');
  if (card) selectPlan(card.dataset.id).catch((error) => showMessage(error.message, true));
});

Promise.all([api('/api/health'), loadPlans()])
  .then(([health]) => {
    document.querySelector('.status-dot').classList.add('online');
    elements.serverLabel.textContent = health.mockAi ? 'Sẵn sàng · Mock AI' : 'Sẵn sàng · AI';
  })
  .catch((error) => { elements.serverLabel.textContent = 'Mất kết nối'; showMessage(error.message, true); });
