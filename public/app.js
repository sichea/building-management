// 드래그앤드롭 글로벌 상태
let draggedRoomId = null;
let draggedFloor = null;

// 글로벌 애플리케이션 상태 관리
let state = {
  buildings: [],
  selectedBuildingId: null,
  selectedRoomId: null,
  isModalOpen: false
};

// DOM 요소 참조 캐싱
const DOM = {
  // 통계
  statTotal: document.getElementById('statTotal'),
  statOccupied: document.getElementById('statOccupied'),
  statVacant: document.getElementById('statVacant'),
  
  // 3D 건물 뷰
  building3D: document.getElementById('building3D'),
  buildingTabs: document.getElementById('buildingTabs'),
  deleteActiveBuildingBtn: document.getElementById('deleteActiveBuildingBtn'),
  
  // 호실 추가 폼
  newRoomFloor: document.getElementById('newRoomFloor'),
  newRoomType: document.getElementById('newRoomType'),
  newRoomSlotSize: document.getElementById('newRoomSlotSize'),
  
  // 모달 - 건물 추가
  addBuildingModal: document.getElementById('addBuildingModal'),
  newBuildingName: document.getElementById('newBuildingName'),
  saveBuildingBtn: document.getElementById('saveBuildingBtn'),
  
  // 모달 - 호실 추가
  addRoomModal: document.getElementById('addRoomModal'),
  newRoomNumber: document.getElementById('newRoomNumber'),
  saveRoomBtn: document.getElementById('saveRoomBtn'),
  
  // 모달 - 호실 상세 관리
  roomDetailModal: document.getElementById('roomDetailModal'),
  modalRoomBadge: document.getElementById('modalRoomBadge'),
  modalRoomTitle: document.getElementById('modalRoomTitle'),
  roomStatus: document.getElementById('roomStatus'),
  roomNumberInput: document.getElementById('roomNumberInput'),
  detailRoomType: document.getElementById('detailRoomType'),
  detailRoomSlotSize: document.getElementById('detailRoomSlotSize'),
  leaseType: document.getElementById('leaseType'),
  leaseStart: document.getElementById('leaseStart'),
  leaseEnd: document.getElementById('leaseEnd'),
  emojiHelpBtn: document.getElementById('emojiHelpBtn'),
  emojiPopover: document.getElementById('emojiPopover'),
  emojiPopoverCloseBtn: document.getElementById('emojiPopoverCloseBtn'),
  addTenantFormBtn: document.getElementById('addTenantFormBtn'),
  tenantsContainer: document.getElementById('tenantsContainer'),
  roomNotes: document.getElementById('roomNotes'),
  roomStructure: document.getElementById('roomStructure'),
  roomDeposit: document.getElementById('roomDeposit'),
  roomRent: document.getElementById('roomRent'),
  deleteRoomBtn: document.getElementById('deleteRoomBtn'),
  modalSaveBtn: document.getElementById('modalSaveBtn'),
  modalCancelBtn: document.getElementById('modalCancelBtn'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  
  // 모달 내부 - 시설물 업로드 및 갤러리
  facilityImageForm: document.getElementById('facilityImageForm'),
  facilityImageInput: document.getElementById('facilityImageInput'),
  facilityNameInput: document.getElementById('facilityNameInput'),
  facilityGallery: document.getElementById('facilityGallery'),
  
  // 모달 내부 - 설비 이력 관리
  acDateInput: document.getElementById('acDateInput'),
  acTypeInput: document.getElementById('acTypeInput'),
  acDescInput: document.getElementById('acDescInput'),
  addAcHistoryBtn: document.getElementById('addAcHistoryBtn'),
  acHistoryTimeline: document.getElementById('acHistoryTimeline')
};

// ----------------------------------------------------
// 모달 열기/닫기 헬퍼 함수
// ----------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // 모달 오픈 시 본문 스크롤 차단
    if (modalId === 'roomDetailModal') {
      state.isModalOpen = true;
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    // 활성화된 모든 모달이 닫혔는지 확인 후 본문 스크롤 복구
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length === 0) {
      document.body.style.overflow = '';
    }
    if (modalId === 'roomDetailModal') {
      state.isModalOpen = false;
      state.selectedRoomId = null;
    }
  }
}

// ----------------------------------------------------
// API 호출 함수
// ----------------------------------------------------

// 2. 전체 데이터(건물 및 호실) 로드 (주기적 폴링에서도 사용)
async function fetchBuildingsData(silent = false) {
  try {
    const res = await fetch('/api/buildings');
    const buildings = await res.json();
    state.buildings = buildings;
    
    // 전체 보기('all') 또는 유효한 건물을 선택
    if (buildings.length > 0) {
      if (!state.selectedBuildingId || (state.selectedBuildingId !== 'all' && !buildings.some(b => b.id === state.selectedBuildingId))) {
        state.selectedBuildingId = 'all';
      }
    } else {
      state.selectedBuildingId = null;
    }
    
    renderBuildingTabs();
    renderDashboard();
    
    // 상세 모달이 열려 있다면, 내부 데이터도 조용히 백그라운드 갱신
    if (state.isModalOpen && state.selectedRoomId) {
      updateActiveModalData();
    }
  } catch (err) {
    console.error('데이터 호출 오류:', err);
  }
}

// ----------------------------------------------------
// UI 렌더링 함수
// ----------------------------------------------------

// 건물 선택 탭 바 렌더링
function renderBuildingTabs() {
  if (!DOM.buildingTabs) return;
  DOM.buildingTabs.innerHTML = '';
  
  if (state.buildings.length === 0) return;
  
  // 1. 전체 보기 탭 추가 (제일 왼쪽)
  const allTab = document.createElement('button');
  allTab.className = `building-tab ${state.selectedBuildingId === 'all' ? 'active' : ''}`;
  allTab.textContent = '전체';
  allTab.addEventListener('click', () => {
    state.selectedBuildingId = 'all';
    renderBuildingTabs();
    renderDashboard();
  });
  DOM.buildingTabs.appendChild(allTab);
  
  // 2. 개별 건물 탭 추가
  state.buildings.forEach(building => {
    const tab = document.createElement('button');
    tab.className = `building-tab ${state.selectedBuildingId === building.id ? 'active' : ''}`;
    tab.textContent = building.name;
    tab.addEventListener('click', () => {
      state.selectedBuildingId = building.id;
      renderBuildingTabs();
      renderDashboard();
    });
    DOM.buildingTabs.appendChild(tab);
  });
}

// 대시보드 렌더링 (선택된 건물만 혹은 전체 건물 3D 뷰 렌더링)
function renderDashboard() {
  DOM.building3D.innerHTML = '';
  
  if (state.buildings.length === 0) {
    DOM.statTotal.textContent = '0';
    DOM.statOccupied.textContent = '0';
    DOM.statVacant.textContent = '0';
    lucide.createIcons();
    return;
  }
  
  // 전체 통계 계산 (모든 건물 합산)
  let totalAll = 0, occupiedAll = 0, vacantAll = 0;
  state.buildings.forEach(b => {
    const rooms = b.rooms || [];
    totalAll += rooms.length;
    occupiedAll += rooms.filter(r => r.status === 'occupied').length;
    vacantAll += rooms.filter(r => r.status === 'vacant').length;
  });
  
  DOM.statTotal.textContent = totalAll;
  DOM.statOccupied.textContent = occupiedAll;
  DOM.statVacant.textContent = vacantAll;
  
  // 전체 보기('all') 인 경우
  if (state.selectedBuildingId === 'all') {
    DOM.building3D.classList.add('all-buildings-layout');
    // 건물 삭제 버튼 감추기
    if (DOM.deleteActiveBuildingBtn) DOM.deleteActiveBuildingBtn.style.display = 'none';
    
    // 모든 건물을 순서대로 렌더링
    state.buildings.forEach(building => {
      // 각 건물 컨테이너
      const buildingUnitWrap = document.createElement('div');
      buildingUnitWrap.className = 'building-unit-container';
      buildingUnitWrap.style.marginBottom = '40px';
      
      // 건물 이름 타이틀 헤더
      const buildingHeader = document.createElement('div');
      buildingHeader.className = 'building-title-header';
      buildingHeader.style.marginBottom = '12px';
      buildingHeader.style.paddingLeft = '8px';
      buildingHeader.innerHTML = `<h3 style="font-size: 18px; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 8px;"><i data-lucide="building" style="color: var(--primary); width: 20px; height: 20px;"></i> ${building.name}</h3>`;
      buildingUnitWrap.appendChild(buildingHeader);
      
      const buildingWrap = document.createElement('div');
      buildingWrap.className = 'building-unit';
      
      // 옥상
      const roof = document.createElement('div');
      roof.className = 'building-roof';
      buildingWrap.appendChild(roof);
      
      const rooms = building.rooms || [];
      
      // 3층부터 1층까지
      for (let floor = 3; floor >= 1; floor--) {
        const floorRooms = rooms.filter(r => r.floor === floor);
        
        const floorContainer = document.createElement('div');
        floorContainer.className = 'floor-container';
        
        const floorSlab = document.createElement('div');
        floorSlab.className = 'floor-slab';
        
        // 층 라벨 (클릭 시 호실 추가)
        const floorLabel = document.createElement('div');
        floorLabel.className = 'floor-label clickable';
        floorLabel.title = `${floor}층에 호실 추가`;
        floorLabel.innerHTML = `
          <span>${floor}F</span>
          <button class="btn-floor-add-room" title="호실 추가">
            <i data-lucide="plus"></i>
          </button>
        `;
        floorLabel.addEventListener('click', (e) => {
          e.stopPropagation();
          state.selectedBuildingId = building.id; // 호실 추가 시 해당 건물로 타겟팅
          if (DOM.newRoomFloor) DOM.newRoomFloor.value = floor;
          openModal('addRoomModal');
        });
        floorSlab.appendChild(floorLabel);
        
        // 호실 가로 배열
        const floorRoomsContainer = document.createElement('div');
        floorRoomsContainer.className = 'floor-rooms';
        
        // 호실들 렌더링
        floorRooms.forEach(room => {
          const rt = room.roomType || 'oneroom';
          const size = room.slotSize || (rt === 'full' ? 5 : (rt === 'tworoom' || rt === 'store2') ? 2 : 1);
          const roomEl = createRoom3DElement(room, building.id);
          roomEl.style.flex = `${size} 1 0%`; // Flex 비율 설정으로 여백 없이 꽉 채우며 수축 허용
          floorRoomsContainer.appendChild(roomEl);
        });
        
        // 층에 호실이 하나도 없는 경우에만 층 전체를 채우는 1칸 빈칸 렌더링
        if (floorRooms.length === 0) {
          const emptyCell = document.createElement('div');
          emptyCell.className = 'room-3d room-empty-cell';
          emptyCell.style.flex = '1 0 0%';
          floorRoomsContainer.appendChild(emptyCell);
        }
        
        floorSlab.appendChild(floorRoomsContainer);
        floorContainer.appendChild(floorSlab);
        buildingWrap.appendChild(floorContainer);
      }
      
      buildingUnitWrap.appendChild(buildingWrap);
      DOM.building3D.appendChild(buildingUnitWrap);
    });
    
    lucide.createIcons();
    return;
  }
  
  // 특정 개별 건물 보기인 경우
  DOM.building3D.classList.remove('all-buildings-layout');
  if (DOM.deleteActiveBuildingBtn) DOM.deleteActiveBuildingBtn.style.display = 'flex';
  
  const activeBuilding = state.buildings.find(b => b.id === state.selectedBuildingId);
  if (!activeBuilding) {
    DOM.building3D.innerHTML = '<p class="empty-text">선택된 건물이 없거나 건물을 추가해 주세요.</p>';
    lucide.createIcons();
    return;
  }
  
  const rooms = activeBuilding.rooms || [];
  
  // 건물 컨테이너
  const buildingWrap = document.createElement('div');
  buildingWrap.className = 'building-unit';
  
  // 옥상
  const roof = document.createElement('div');
  roof.className = 'building-roof';
  buildingWrap.appendChild(roof);
  
  // 3층부터 1층까지
  for (let floor = 3; floor >= 1; floor--) {
    const floorRooms = rooms.filter(r => r.floor === floor);
    
    const floorContainer = document.createElement('div');
    floorContainer.className = 'floor-container';
    
    const floorSlab = document.createElement('div');
    floorSlab.className = 'floor-slab';
    
    // 층 라벨 (클릭 시 호실 추가)
    const floorLabel = document.createElement('div');
    floorLabel.className = 'floor-label clickable';
    floorLabel.title = `${floor}층에 호실 추가`;
    floorLabel.innerHTML = `
      <span>${floor}F</span>
      <button class="btn-floor-add-room" title="호실 추가">
        <i data-lucide="plus"></i>
      </button>
    `;
    floorLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      state.selectedBuildingId = activeBuilding.id;
      if (DOM.newRoomFloor) DOM.newRoomFloor.value = floor;
      openModal('addRoomModal');
    });
    floorSlab.appendChild(floorLabel);
    
    // 호실 가로 배열 (최대 4칸)
    const floorRoomsContainer = document.createElement('div');
    floorRoomsContainer.className = 'floor-rooms';
    
    // 호실들 렌더링
    floorRooms.forEach(room => {
      const rt = room.roomType || 'oneroom';
      const size = room.slotSize || (rt === 'full' ? 5 : (rt === 'tworoom' || rt === 'store2') ? 2 : 1);
      const roomEl = createRoom3DElement(room, activeBuilding.id);
      roomEl.style.flex = `${size} 1 0%`; // Flex 비율 설정으로 여백 없이 꽉 채우며 수축 허용
      floorRoomsContainer.appendChild(roomEl);
    });
    
    // 층에 호실이 하나도 없는 경우에만 층 전체를 채우는 1칸 빈칸 렌더링
    if (floorRooms.length === 0) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'room-3d room-empty-cell';
      emptyCell.style.flex = '1 0 0%';
      floorRoomsContainer.appendChild(emptyCell);
    }
    
    floorSlab.appendChild(floorRoomsContainer);
    floorContainer.appendChild(floorSlab);
    buildingWrap.appendChild(floorContainer);
  }
  
  DOM.building3D.appendChild(buildingWrap);
  
  lucide.createIcons();
}

// 슬롯 크기 헬퍼
function getSlotSize(roomType) {
  if (roomType === 'full') return 5;
  if (roomType === 'tworoom' || roomType === 'store2') return 2;
  return 1; // oneroom, store
}

// 방 타입 라벨
function getRoomTypeLabel(roomType) {
  const labels = { oneroom: '원룸', tworoom: '투룸', store: '상가', store2: '상가', full: '전체' };
  return labels[roomType] || '원룸';
}

// 임대 유형 라벨
function getLeaseLabel(leaseType) {
  const labels = { jeonse: '전세', wolse: '월세', banjeonse: '반전세' };
  return labels[leaseType] || '';
}

// 개별 호실 3D 블록 엘리먼트 생성
function createRoom3DElement(room, buildingId) {
  const roomType = room.roomType || 'oneroom';
  const el = document.createElement('div');
  el.className = `room-3d ${room.status} type-${roomType}`;
  el.setAttribute('data-room-id', room.id);
  
  // 상태별 라벨
  let statusText = '공실';
  if (room.status === 'occupied') statusText = '입주';
  
  // 창문 스타일 클래스
  const windowClass = room.status + '-window';
  
  // 임대유형 및 금액 뱃지
  const leaseLabel = getLeaseLabel(room.leaseType);
  let leaseBadgeHtml = '';
  if (leaseLabel) {
    let priceText = '';
    if (room.leaseType === 'jeonse' && room.deposit) {
      priceText = ` ${room.deposit}`;
    } else if ((room.leaseType === 'wolse' || room.leaseType === 'banjeonse') && (room.deposit || room.rent)) {
      priceText = ` ${room.deposit || 0}/${room.rent || 0}`;
    }
    leaseBadgeHtml = `<span class="lease-badge lease-${room.leaseType}">${leaseLabel}${priceText}</span>`;
  }
  
  // 방 타입 뱃지
  const typeLabel = getRoomTypeLabel(roomType);
  
  // 세입자 정보
  let tenantHtml = `<p class="empty-room-text">비어있음</p>`;
  if (room.status === 'occupied') {
    const tenants = room.tenants || [];
    if (tenants.length > 0) {
      const primaryTenant = tenants[0];
      const extraCount = tenants.length - 1;
      const nameText = primaryTenant.name + (extraCount > 0 ? ` 외 ${extraCount}명` : '');
      tenantHtml = `
        <div class="tenant-info">
          <span class="tenant-name">${nameText}</span>
          <span class="tenant-contact">${primaryTenant.contact || ''}</span>
          ${primaryTenant.emergency ? `<span class="tenant-contact" style="color: #ef4444; font-size: 9px;">🚨 ${primaryTenant.emergency}</span>` : ''}
          ${primaryTenant.leasePeriod ? `<span class="tenant-contact" style="font-size: 9px; margin-top: 1px;">📅 ${primaryTenant.leasePeriod}</span>` : ''}
        </div>
      `;
    } else if (room.tenantName) {
      tenantHtml = `
        <div class="tenant-info">
          <span class="tenant-name">${room.tenantName}</span>
          <span class="tenant-contact">${room.contact || ''}</span>
          ${room.tenantEmergency ? `<span class="tenant-contact" style="color: #ef4444; font-size: 9px;">🚨 ${room.tenantEmergency}</span>` : ''}
          ${room.leasePeriod ? `<span class="tenant-contact" style="font-size: 9px; margin-top: 1px;">📅 ${room.leasePeriod}</span>` : ''}
        </div>
      `;
    }
  }
  
  // 방 타입별 시각 요소
  let visualHtml = '';
  if (room.structure) {
    // 사용자가 입력한 구조 이모지가 있을 때 문/창문 대신 표시
    visualHtml = `
      <div class="room-visual room-structure-emoji" title="${room.structure}">
        <span>${room.structure}</span>
      </div>
    `;
  } else if (roomType === 'store' || roomType === 'store2') {
    // 상가 구조/옵션 칸 기본 빈칸으로
    visualHtml = `<div class="room-visual store-empty-visual"></div>`;
  } else if (roomType === 'tworoom') {
    // 투룸: 문 + 창문 3개
    visualHtml = `
      <div class="room-visual">
        <div class="room-door"></div>
        <div class="room-window ${windowClass}"></div>
        <div class="room-window ${windowClass}"></div>
        <div class="room-window ${windowClass}"></div>
      </div>
    `;
  } else if (roomType === 'full') {
    // 전체: 문 + 창문 5개
    visualHtml = `
      <div class="room-visual">
        <div class="room-door"></div>
        <div class="room-window ${windowClass}"></div>
        <div class="room-window ${windowClass}"></div>
        <div class="room-window ${windowClass}"></div>
        <div class="room-window ${windowClass}"></div>
        <div class="room-window ${windowClass}"></div>
      </div>
    `;
  } else {
    // 원룸: 문 + 창문 2개
    visualHtml = `
      <div class="room-visual">
        <div class="room-door"></div>
        <div class="room-window ${windowClass}"></div>
        <div class="room-window ${windowClass}"></div>
      </div>
    `;
  }
  
  el.innerHTML = `
    <div class="room-3d-header">
      <span class="room-number">${room.number}</span>
      <div class="room-badges">
        <span class="room-badge-status ${room.status}">${statusText}</span>
      </div>
    </div>
    ${visualHtml}
    <div class="room-3d-info">
      ${tenantHtml}
      ${leaseBadgeHtml}
    </div>
  `;

  // 드래그앤드롭 속성 및 이벤트 바인딩
  el.setAttribute('draggable', 'true');
  
  el.addEventListener('dragstart', (e) => {
    draggedRoomId = room.id;
    draggedFloor = room.floor;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', room.id);
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    document.querySelectorAll('.room-3d').forEach(item => {
      item.classList.remove('drag-over');
    });
    draggedRoomId = null;
    draggedFloor = null;
  });

  el.addEventListener('dragover', (e) => {
    if (draggedFloor === room.floor && draggedRoomId !== room.id) {
      e.preventDefault();
      el.classList.add('drag-over');
    }
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over');
  });

  el.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    
    if (draggedFloor === room.floor && draggedRoomId && draggedRoomId !== room.id) {
      const container = el.parentNode;
      const children = Array.from(container.querySelectorAll('.room-3d:not(.room-empty-cell)'));
      const draggedEl = container.querySelector(`[data-room-id="${draggedRoomId}"]`);
      
      if (!draggedEl) return;
      
      const draggedIdx = children.indexOf(draggedEl);
      const targetIdx = children.indexOf(el);
      
      if (draggedIdx < targetIdx) {
        container.insertBefore(draggedEl, el.nextSibling);
      } else {
        container.insertBefore(draggedEl, el);
      }
      
      const newOrderIds = Array.from(container.querySelectorAll('.room-3d:not(.room-empty-cell)'))
                               .map(item => item.getAttribute('data-room-id'));
      
      try {
        const res = await fetch(`/api/buildings/${buildingId}/floors/${room.floor}/rooms/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomIds: newOrderIds })
        });
        
        if (res.ok) {
          await fetchBuildingsData(true);
        } else {
          alert('정렬 순서 저장에 실패했습니다.');
          await fetchBuildingsData();
        }
      } catch (err) {
        console.error(err);
        await fetchBuildingsData();
      }
    }
  });
  
  el.addEventListener('click', () => {
    state.selectedBuildingId = buildingId;
    openRoomDetailModal(room.id);
  });
  return el;
}

// ----------------------------------------------------
// 세입자 다수 입력용 동적 폼 헬퍼 함수
// ----------------------------------------------------
function renderTenantsForm(tenants = []) {
  if (!DOM.tenantsContainer) return;
  DOM.tenantsContainer.innerHTML = '';
  
  if (tenants.length === 0) {
    tenants.push({ name: '', contact: '' });
  }

  tenants.forEach((tenant, index) => {
    const row = document.createElement('div');
    row.className = 'tenant-row-item';
    row.innerHTML = `
      <div class="form-group" style="flex: 2; margin-bottom: 0;">
        <input type="text" class="tenant-name-input" value="${tenant.name || ''}" placeholder="세입자 ${index + 1} 성명">
      </div>
      <div class="form-group" style="flex: 3; margin-bottom: 0;">
        <input type="text" class="tenant-contact-input" value="${tenant.contact || ''}" placeholder="연락처 (010-0000-0000)">
      </div>
      ${index > 0 ? `
        <button type="button" class="btn-remove-tenant-row" data-index="${index}" title="세입자 삭제">&times;</button>
      ` : `<div style="width: 38px;"></div>`}
    `;
    
    if (index > 0) {
      row.querySelector('.btn-remove-tenant-row').addEventListener('click', () => {
        const currentTenants = getTenantsFromUI();
        currentTenants.splice(index, 1);
        renderTenantsForm(currentTenants);
      });
    }
    
    DOM.tenantsContainer.appendChild(row);
  });
}

function getTenantsFromUI() {
  if (!DOM.tenantsContainer) return [];
  const rows = DOM.tenantsContainer.querySelectorAll('.tenant-row-item');
  const tenants = [];
  
  rows.forEach(row => {
    const name = row.querySelector('.tenant-name-input').value.trim();
    const contact = row.querySelector('.tenant-contact-input').value.trim();
    tenants.push({ name, contact, emergency: '', leasePeriod: '' });
  });
  return tenants;
}

// ----------------------------------------------------
// 호실 상세 모달 열기 및 바인딩
// ----------------------------------------------------
function openRoomDetailModal(roomId) {
  state.selectedRoomId = roomId;
  
  const currentBuilding = state.buildings.find(b => b.id === state.selectedBuildingId);
  const room = currentBuilding.rooms.find(r => r.id === roomId);
  
  if (!room) return;
  
  // 폼 정보 바인딩
  DOM.modalRoomBadge.textContent = room.number;
  DOM.modalRoomTitle.textContent = '호실 정보 및 이력 관리';
  DOM.roomStatus.value = room.status;
  DOM.roomNumberInput.value = room.number;
  DOM.detailRoomType.value = room.roomType || 'oneroom';
  DOM.detailRoomSlotSize.value = room.slotSize || getSlotSize(room.roomType || 'oneroom');
  DOM.leaseType.value = room.leaseType || '';
  if (room.leasePeriod && room.leasePeriod.includes('~')) {
    const parts = room.leasePeriod.split('~');
    DOM.leaseStart.value = parts[0].trim();
    DOM.leaseEnd.value = parts[1].trim();
  } else {
    DOM.leaseStart.value = '';
    DOM.leaseEnd.value = '';
  }
  DOM.roomStructure.value = room.structure || '';
  DOM.roomDeposit.value = room.deposit || '';
  DOM.roomRent.value = room.rent || '';
  DOM.roomNotes.value = room.notes || '';
  
  // 다수 세입자 폼 바인딩 (성명, 연락처만 가로 1줄 추가)
  let tenants = [];
  if (room.tenants && room.tenants.length > 0) {
    tenants = JSON.parse(JSON.stringify(room.tenants));
  } else {
    // 기존 마이그레이션 호환
    tenants = [{
      name: room.tenantName || '',
      contact: room.contact || ''
    }];
  }
  renderTenantsForm(tenants);
  
  // 이미지 폼 초기화
  DOM.facilityNameInput.value = '';
  DOM.facilityImageInput.value = '';
  document.querySelector('.file-label span').textContent = '시설물 사진 선택';
  
  // 설비 폼 초기화
  DOM.acDateInput.value = new Date().toISOString().split('T')[0];
  DOM.acDescInput.value = '';
  DOM.acTypeInput.value = 'purchase';
  
  // 시설 갤러리 및 설비 타임라인 렌더링
  renderFacilityGallery(room);
  renderAcHistoryTimeline(room);
  
  openModal('roomDetailModal');
}

// 백그라운드 데이터 갱신 시 모달 내 갤러리 및 타임라인만 부분 갱신
function updateActiveModalData() {
  const currentBuilding = state.buildings.find(b => b.id === state.selectedBuildingId);
  if (!currentBuilding) return;
  const room = currentBuilding.rooms.find(r => r.id === state.selectedRoomId);
  if (!room) {
    closeModal('roomDetailModal');
    return;
  }
  renderFacilityGallery(room);
  renderAcHistoryTimeline(room);
}

// 시설물 이미지 갤러리 렌더링
function renderFacilityGallery(room) {
  DOM.facilityGallery.innerHTML = '';
  
  const facilities = room.facilities || [];
  if (facilities.length === 0) {
    DOM.facilityGallery.innerHTML = `<p class="empty-text">등록된 시설물 이미지가 없습니다.</p>`;
    return;
  }
  
  facilities.forEach(item => {
    const wrapper = document.createElement('div');
    wrapper.className = 'gallery-item';
    wrapper.innerHTML = `
      <img src="${item.imageUrl}" alt="${item.name}" onerror="this.src='https://placehold.co/100x100?text=No+Image'">
      <div class="gallery-item-name">${item.name}</div>
      <button class="delete-gallery-item" title="이미지 삭제" data-image-id="${item.id}">&times;</button>
    `;
    
    // 시설물 이미지 개별 삭제 이벤트
    wrapper.querySelector('.delete-gallery-item').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`'${item.name}' 시설물 이미지를 정말 삭제하시겠습니까?`)) return;
      
      try {
        const res = await fetch(`/api/buildings/${state.selectedBuildingId}/rooms/${room.id}/images/${item.id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          // 상태 데이터 로드 및 갱신
          await fetchBuildingsData(true);
        } else {
          alert('이미지 삭제에 실패했습니다.');
        }
      } catch (err) {
        console.error(err);
      }
    });
    
    DOM.facilityGallery.appendChild(wrapper);
  });
}

// 설비 이력 타임라인 렌더링
function renderAcHistoryTimeline(room) {
  DOM.acHistoryTimeline.innerHTML = '';
  
  const history = room.acHistory || [];
  if (history.length === 0) {
    DOM.acHistoryTimeline.innerHTML = `<p class="empty-text">등록된 설비 이력이 없습니다.</p>`;
    return;
  }
  
  history.forEach(item => {
    const timelineItem = document.createElement('div');
    timelineItem.className = `timeline-item ${item.type}`;
    
    const typeLabel = item.type === 'purchase' ? '🛒 구매' : '🛠️ 점검';
    
    timelineItem.innerHTML = `
      <div class="timeline-content">
        <div class="timeline-info">
          <span class="timeline-date">${item.date} [${typeLabel}]</span>
          <span class="timeline-desc">${item.description}</span>
        </div>
        <button class="btn-timeline-delete" title="이력 삭제" data-history-id="${item.id}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
    
    // 이력 삭제 버튼 이벤트
    timelineItem.querySelector('.btn-timeline-delete').addEventListener('click', async () => {
      if (!confirm('해당 설비 이력을 삭제하시겠습니까?')) return;
      
      try {
        const res = await fetch(`/api/buildings/${state.selectedBuildingId}/rooms/${room.id}/ac-history/${item.id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          await fetchBuildingsData(true);
        } else {
          alert('이력 삭제 실패');
        }
      } catch (err) {
        console.error(err);
      }
    });
    
    DOM.acHistoryTimeline.appendChild(timelineItem);
  });
  
  lucide.createIcons();
}

// ----------------------------------------------------
// 이벤트 리스너 등록
// ----------------------------------------------------

// 1. (건물 선택기 제거됨 - 모든 건물 한 페이지 표시)

// 2. 새 건물 추가 완료
DOM.saveBuildingBtn.addEventListener('click', async () => {
  const name = DOM.newBuildingName.value;
  if (!name || name.trim() === '') {
    alert('건물명을 입력해주세요.');
    return;
  }
  
  try {
    const res = await fetch('/api/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    if (res.ok) {
      const newBuilding = await res.json();
      state.selectedBuildingId = newBuilding.id;
      DOM.newBuildingName.value = '';
      closeModal('addBuildingModal');
      await fetchBuildingsData();
    } else {
      const err = await res.json();
      alert(err.error || '건물 추가에 실패했습니다.');
    }
  } catch (err) {
    console.error(err);
  }
});

// 3. 건물 삭제 (renderDashboard 내 동적 바인딩으로 대체)

// 4. 새 호실 추가 완료 (층 선택 포함)
DOM.saveRoomBtn.addEventListener('click', async () => {
  const number = DOM.newRoomNumber.value;
  const floor = parseInt(DOM.newRoomFloor.value);
  const slotSize = parseInt(DOM.newRoomSlotSize.value);
  if (!number || number.trim() === '') {
    alert('호실 번호를 입력해주세요.');
    return;
  }
  
  try {
    const res = await fetch(`/api/buildings/${state.selectedBuildingId}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, floor, roomType: DOM.newRoomType.value, slotSize })
    });
    
    if (res.ok) {
      DOM.newRoomNumber.value = '';
      closeModal('addRoomModal');
      await fetchBuildingsData();
    } else {
      const err = await res.json();
      alert(err.error || '호실 추가 실패');
    }
  } catch (err) {
    console.error(err);
  }
});

// 5. 호실 정보 변경 사항 최종 저장
DOM.modalSaveBtn.addEventListener('click', async () => {
  if (!state.selectedRoomId) return;
  
  const status = DOM.roomStatus.value;
  const number = DOM.roomNumberInput.value;
  const roomType = DOM.detailRoomType.value;
  const slotSize = parseInt(DOM.detailRoomSlotSize.value);
  const leaseType = DOM.leaseType.value;
  const structure = DOM.roomStructure.value;
  const deposit = DOM.roomDeposit.value;
  const rent = DOM.roomRent.value;
  const notes = DOM.roomNotes.value;
  
  // 동적 세입자 목록 수집
  const tenants = getTenantsFromUI();
  
  // 하위 호환성을 위해 첫 번째 세입자 정보를 단일 필드로 매핑
  const primaryTenant = tenants[0] || { name: '', contact: '' };
  const tenantName = primaryTenant.name;
  const contact = primaryTenant.contact;
  const tenantEmergency = '';
  const leasePeriod = (DOM.leaseStart.value && DOM.leaseEnd.value) 
    ? `${DOM.leaseStart.value} ~ ${DOM.leaseEnd.value}` 
    : (DOM.leaseStart.value || DOM.leaseEnd.value || '');
  
  if (!number || number.trim() === '') {
    alert('호실 번호는 필수 입력입니다.');
    return;
  }
  
  try {
    const res = await fetch(`/api/buildings/${state.selectedBuildingId}/rooms/${state.selectedRoomId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status, number, leaseType, tenantName, contact, notes, roomType, deposit, rent, structure,
        tenantEmergency, leasePeriod, slotSize, tenants
      })
    });
    
    if (res.ok) {
      closeModal('roomDetailModal');
      await fetchBuildingsData();
    } else {
      const err = await res.json();
      alert(err.error || '저장에 실패했습니다.');
    }
  } catch (err) {
    console.error(err);
  }
});

DOM.modalCancelBtn.addEventListener('click', () => closeModal('roomDetailModal'));
DOM.modalCloseBtn.addEventListener('click', () => closeModal('roomDetailModal'));

// 6. 호실 완전히 삭제
DOM.deleteRoomBtn.addEventListener('click', async () => {
  if (!state.selectedRoomId) return;
  
  const currentBuilding = state.buildings.find(b => b.id === state.selectedBuildingId);
  const room = currentBuilding.rooms.find(r => r.id === state.selectedRoomId);
  
  if (!confirm(`'${room.number}' 호실을 완전히 삭제하시겠습니까? 등록된 이미지 및 설비 이력도 삭제됩니다.`)) {
    return;
  }
  
  try {
    const res = await fetch(`/api/buildings/${state.selectedBuildingId}/rooms/${state.selectedRoomId}`, {
      method: 'DELETE'
    });
    
    if (res.ok) {
      closeModal('roomDetailModal');
      await fetchBuildingsData();
    } else {
      alert('호실 삭제에 실패했습니다.');
    }
  } catch (err) {
    console.error(err);
  }
});

// 7. 시설 이미지 업로드 전송
DOM.facilityImageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const file = DOM.facilityImageInput.files[0];
  const name = DOM.facilityNameInput.value;
  
  if (!file) {
    alert('이미지 파일을 선택해주세요.');
    return;
  }
  
  const formData = new FormData();
  formData.append('image', file);
  formData.append('facilityName', name);
  
  try {
    DOM.uploadImageBtn.disabled = true;
    DOM.uploadImageBtn.textContent = '업로드중...';
    
    const res = await fetch(`/api/buildings/${state.selectedBuildingId}/rooms/${state.selectedRoomId}/images`, {
      method: 'POST',
      body: formData
    });
    
    if (res.ok) {
      DOM.facilityImageInput.value = '';
      DOM.facilityNameInput.value = '';
      document.querySelector('.file-label span').textContent = '시설물 사진 선택';
      
      await fetchBuildingsData(true); // 조용히 갱신
    } else {
      alert('업로드 실패');
    }
  } catch (err) {
    console.error(err);
  } finally {
    DOM.uploadImageBtn.disabled = false;
    DOM.uploadImageBtn.textContent = '업로드';
  }
});

// 파일 선택 시 라벨에 파일명 출력
DOM.facilityImageInput.addEventListener('change', (e) => {
  const fileName = e.target.files[0] ? e.target.files[0].name : '시설물 사진 선택';
  document.querySelector('.file-label span').textContent = fileName;
});

// 8. 설비 이력 등록
DOM.addAcHistoryBtn.addEventListener('click', async () => {
  const date = DOM.acDateInput.value;
  const type = DOM.acTypeInput.value;
  const description = DOM.acDescInput.value;
  
  if (!date || !description || description.trim() === '') {
    alert('날짜와 이력 내용을 모두 입력해주세요.');
    return;
  }
  
  try {
    const res = await fetch(`/api/buildings/${state.selectedBuildingId}/rooms/${state.selectedRoomId}/ac-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, type, description })
    });
    
    if (res.ok) {
      DOM.acDescInput.value = '';
      await fetchBuildingsData(true); // 조용히 갱신
    } else {
      alert('설비 이력 추가 실패');
    }
  } catch (err) {
    console.error(err);
  }
});

// 모달 바깥쪽 클릭 시 닫기
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }

  // 이모지 팝오버 바깥 영역 클릭 시 닫기
  if (DOM.emojiPopover && DOM.emojiPopover.classList.contains('active')) {
    if (!DOM.emojiPopover.contains(e.target) && !DOM.emojiHelpBtn.contains(e.target) && e.target !== DOM.emojiHelpBtn) {
      DOM.emojiPopover.classList.remove('active');
    }
  }
});

// 현재 선택된 건물 삭제 이벤트 바인딩
if (DOM.deleteActiveBuildingBtn) {
  DOM.deleteActiveBuildingBtn.addEventListener('click', async () => {
    if (!state.selectedBuildingId) {
      alert('삭제할 건물이 선택되지 않았습니다.');
      return;
    }
    const currentBuilding = state.buildings.find(b => b.id === state.selectedBuildingId);
    if (!currentBuilding) return;
    
    if (!confirm(`[${currentBuilding.name}]을 삭제하시면 하위의 모든 호실 정보가 삭제됩니다. 정말 삭제하시겠습니까?`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/buildings/${state.selectedBuildingId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        state.selectedBuildingId = null;
        await fetchBuildingsData();
      } else {
        alert('건물 삭제 실패');
      }
    } catch (err) {
      console.error(err);
    }
  });
}

// ----------------------------------------------------
// 초기화 및 실시간 폴링 동기화 작동
// ----------------------------------------------------
async function init() {
  await fetchBuildingsData();
  
  // 이모지 제안 버튼 클릭 이벤트 바인딩
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      DOM.roomStructure.value = (DOM.roomStructure.value + emoji).trim();
      // 이모지 선택 후 편의를 위해 팝오버를 닫음
      if (DOM.emojiPopover) {
        DOM.emojiPopover.classList.remove('active');
      }
    });
  });

  // 이모지 팝오버 예시 버튼 토글
  if (DOM.emojiHelpBtn && DOM.emojiPopover) {
    DOM.emojiHelpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.emojiPopover.classList.toggle('active');
    });
  }

  // 이모지 팝오버 닫기 버튼
  if (DOM.emojiPopoverCloseBtn && DOM.emojiPopover) {
    DOM.emojiPopoverCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.emojiPopover.classList.remove('active');
    });
  }

  // 세입자 추가 버튼 클릭 이벤트 바인딩 (성명, 연락처만 가로 1줄 추가)
  if (DOM.addTenantFormBtn) {
    DOM.addTenantFormBtn.addEventListener('click', () => {
      const currentTenants = getTenantsFromUI();
      currentTenants.push({ name: '', contact: '' });
      renderTenantsForm(currentTenants);
    });
  }
  
  // 3초 주기로 데이터 실시간 동기화 폴링 (여러 관리자가 협업할 수 있도록)
  setInterval(() => {
    fetchBuildingsData(true);
  }, 3000);
}

// 페이지 로드 시 구동 시작
document.addEventListener('DOMContentLoaded', init);
