const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const multer = require('multer');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// 만약 OneDrive 경로가 존재하면 해당 경로의 data.json 및 uploads 폴더를 사용 (Node.js 경로 충돌 우회용)
const WORKSPACE_DIR = 'c:/Users/kks37/OneDrive/바탕 화면/코딩/건물관리';
const useRedirect = existsSync(WORKSPACE_DIR);

const DATA_FILE = useRedirect ? path.join(WORKSPACE_DIR, 'data.json') : path.join(__dirname, 'data.json');
const UPLOADS_DIR = useRedirect ? path.join(WORKSPACE_DIR, 'public', 'uploads') : path.join(__dirname, 'public', 'uploads');

// CORS 설정
app.use(cors());
// JSON 파싱
app.use(express.json());

// 정적 파일 서빙
if (useRedirect) {
  // 업로드된 이미지는 OneDrive의 public/uploads 폴더에서 직접 서빙
  app.use('/uploads', express.static(UPLOADS_DIR));
}
app.use(express.static(path.join(__dirname, 'public')));

// 업로드 디렉토리 존재 확인 및 생성
async function ensureDirectories() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    console.error('업로드 디렉토리 생성 실패:', err);
  }
}
ensureDirectories();

// Multer 설정 (이미지 업로드용)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'facility-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// 데이터 읽기 헬퍼
async function readData() {
  try {
    if (!existsSync(DATA_FILE)) {
      // 파일이 없을 경우 기본 빈 구조 리턴
      return { buildings: [] };
    }
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('데이터 읽기 오류:', err);
    return { buildings: [] };
  }
}

// 데이터 쓰기 헬퍼
async function writeData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('데이터 쓰기 오류:', err);
  }
}

// 로컬 IP 주소 반환 (협업용 주소 안내)
app.get('/api/network-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4이고, 루프백 주소가 아니며, 가상 어댑터가 아닌 인터페이스 찾기
      if (iface.family === 'IPv4' && !iface.internal) {
        // 보통 192.168.x.x 또는 10.x.x.x 또는 172.16.x.x 등의 로컬 대역 우선
        if (iface.address.startsWith('192.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
          localIp = iface.address;
          break;
        }
        localIp = iface.address; // 대역에 해당되지 않더라도 외부 사용가능 IPv4가 있으면 일단 할당
      }
    }
    if (localIp !== 'localhost') break;
  }
  
  res.json({ ip: localIp, port: PORT });
});

// 1. 건물 목록 조회
app.get('/api/buildings', async (req, res) => {
  const data = await readData();
  res.json(data.buildings || []);
});

// 2. 새 건물 추가
app.post('/api/buildings', async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '건물명을 입력해주세요.' });
  }

  const data = await readData();
  const newBuilding = {
    id: 'b-' + Date.now(),
    name: name.trim(),
    rooms: []
  };

  data.buildings.push(newBuilding);
  await writeData(data);
  res.status(201).json(newBuilding);
});

// 3. 건물 삭제
app.delete('/api/buildings/:id', async (req, res) => {
  const { id } = req.params;
  const data = await readData();
  
  const initialLength = data.buildings.length;
  data.buildings = data.buildings.filter(b => b.id !== id);
  
  if (data.buildings.length === initialLength) {
    return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
  }

  await writeData(data);
  res.json({ success: true, message: '건물이 삭제되었습니다.' });
});

// 4. 특정 건물에 새 호실 추가
app.post('/api/buildings/:buildingId/rooms', async (req, res) => {
  const { buildingId } = req.params;
  const { number, floor, roomType, slotSize } = req.body;

  if (!number || number.trim() === '') {
    return res.status(400).json({ error: '호실 번호를 입력해주세요.' });
  }

  if (!floor || floor < 1 || floor > 3) {
    return res.status(400).json({ error: '층수를 1~3 사이로 입력해주세요.' });
  }

  const validTypes = ['oneroom', 'tworoom', 'store', 'store2', 'full'];
  const type = validTypes.includes(roomType) ? roomType : 'oneroom';
  
  // 타입별 기본 슬롯 크기 결정 (전체 full은 4에서 5칸으로 상향)
  const defaultSlotSize = type === 'full' ? 5 : (type === 'tworoom' || type === 'store2') ? 2 : 1;
  const size = (slotSize !== undefined) ? parseInt(slotSize) : defaultSlotSize;

  const data = await readData();
  const building = data.buildings.find(b => b.id === buildingId);
  
  if (!building) {
    return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
  }

  // 해당 층 사용 슬롯 계산 (기존 저장된 slotSize 또는 방 타입 기준 fallback)
  const roomsOnFloor = building.rooms.filter(r => r.floor === floor);
  let usedSlots = 0;
  roomsOnFloor.forEach(r => {
    usedSlots += r.slotSize || (r.roomType === 'full' ? 5 : (r.roomType === 'tworoom' || r.roomType === 'store2') ? 2 : 1);
  });
  if (usedSlots + size > 5) {
    return res.status(400).json({ error: `해당 층에 공간이 부족합니다. (사용: ${usedSlots + size}/5칸)` });
  }

  // 중복 호실 검사
  const exists = building.rooms.some(r => r.number === number.trim());
  if (exists) {
    return res.status(400).json({ error: '이미 존재하는 호실 번호입니다.' });
  }

  const newRoom = {
    id: 'r-' + Date.now(),
    number: number.trim(),
    floor: floor,
    roomType: type,
    slotSize: size,
    status: 'vacant',
    leaseType: '',
    deposit: '',
    rent: '',
    structure: '',
    tenantName: '',
    contact: '',
    tenantEmergency: '',
    leasePeriod: '',
    tenants: [],
    facilities: [],
    acHistory: [],
    notes: ''
  };

  building.rooms.push(newRoom);

  await writeData(data);
  res.status(201).json(newRoom);
});

// 5. 호실 삭제
app.delete('/api/buildings/:buildingId/rooms/:roomId', async (req, res) => {
  const { buildingId, roomId } = req.params;
  const data = await readData();

  const building = data.buildings.find(b => b.id === buildingId);
  if (!building) {
    return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
  }

  const initialLength = building.rooms.length;
  building.rooms = building.rooms.filter(r => r.id !== roomId);

  if (building.rooms.length === initialLength) {
    return res.status(404).json({ error: '호실을 찾을 수 없습니다.' });
  }

  await writeData(data);
  res.json({ success: true, message: '호실이 삭제되었습니다.' });
});

// 6. 호실 상세 정보 수정
app.put('/api/buildings/:buildingId/rooms/:roomId', async (req, res) => {
  const { buildingId, roomId } = req.params;
  const { number, status, tenantName, contact, notes, leaseType, roomType, deposit, rent, structure, tenantEmergency, leasePeriod, slotSize, tenants } = req.body;

  const data = await readData();
  const building = data.buildings.find(b => b.id === buildingId);
  if (!building) {
    return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
  }

  const room = building.rooms.find(r => r.id === roomId);
  if (!room) {
    return res.status(404).json({ error: '호실을 찾을 수 없습니다.' });
  }

  // 방 타입 유효성 검사
  if (roomType !== undefined) {
    const validTypes = ['oneroom', 'tworoom', 'store', 'store2', 'full'];
    if (!validTypes.includes(roomType)) {
      return res.status(400).json({ error: '올바르지 않은 방 타입입니다.' });
    }
  }

  // 변경될 최종 슬롯 크기 결정 (전체 full은 5칸으로 상향)
  const defaultSlotSize = (roomType || room.roomType) === 'full' ? 5 : ((roomType || room.roomType) === 'tworoom' || (roomType || room.roomType) === 'store2') ? 2 : 1;
  const targetSlotSize = slotSize !== undefined ? parseInt(slotSize) : (room.slotSize || defaultSlotSize);

  if (targetSlotSize < 1 || targetSlotSize > 5) {
    return res.status(400).json({ error: '호실 크기는 1~5칸 사이여야 합니다.' });
  }

  // 타입이나 크기 중 하나라도 기존값과 다르다면 공간 유효성 검증
  if ((roomType !== undefined && roomType !== room.roomType) || (slotSize !== undefined && parseInt(slotSize) !== room.slotSize)) {
    const otherRooms = building.rooms.filter(r => r.floor === room.floor && r.id !== roomId);
    let usedSlots = 0;
    otherRooms.forEach(r => {
      usedSlots += r.slotSize || (r.roomType === 'full' ? 5 : (r.roomType === 'tworoom' || r.roomType === 'store2') ? 2 : 1);
    });

    if (usedSlots + targetSlotSize > 5) {
      return res.status(400).json({ error: `공간이 부족합니다. (변경 시 해당 층 사용량: ${usedSlots + targetSlotSize}/5칸)` });
    }
  }

  // 값 업데이트
  if (number) room.number = number.trim();
  if (status) room.status = status;
  if (roomType !== undefined) room.roomType = roomType;
  if (slotSize !== undefined) room.slotSize = parseInt(slotSize);
  
  if (tenantName !== undefined) room.tenantName = tenantName.trim();
  if (contact !== undefined) room.contact = contact.trim();
  if (tenantEmergency !== undefined) room.tenantEmergency = tenantEmergency.trim();
  if (leasePeriod !== undefined) room.leasePeriod = leasePeriod.trim();
  
  if (tenants !== undefined && Array.isArray(tenants)) {
    room.tenants = tenants;
  }
  
  if (notes !== undefined) room.notes = notes.trim();
  if (leaseType !== undefined) room.leaseType = leaseType;
  if (deposit !== undefined) room.deposit = deposit.trim();
  if (rent !== undefined) room.rent = rent.trim();
  if (structure !== undefined) room.structure = structure.trim();

  await writeData(data);
  res.json(room);
});

// 6-2. 호실 순서 재배치
app.put('/api/buildings/:buildingId/floors/:floor/rooms/reorder', async (req, res) => {
  const { buildingId, floor } = req.params;
  const { roomIds } = req.body;
  const floorNum = parseInt(floor);

  if (!roomIds || !Array.isArray(roomIds)) {
    return res.status(400).json({ error: '올바르지 않은 정렬 데이터입니다.' });
  }

  const data = await readData();
  const building = data.buildings.find(b => b.id === buildingId);
  if (!building) {
    return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
  }

  // 해당 층의 방들과 다른 층의 방들을 분리
  const otherFloorRooms = building.rooms.filter(r => r.floor !== floorNum);
  const currentFloorRooms = building.rooms.filter(r => r.floor === floorNum);

  // roomIds 순서대로 currentFloorRooms를 정렬
  const sortedFloorRooms = [];
  roomIds.forEach(id => {
    const rm = currentFloorRooms.find(r => r.id === id);
    if (rm) sortedFloorRooms.push(rm);
  });

  // 혹시 정렬 요청 데이터에 빠진 호실이 있다면 원래 순서대로 뒤에 붙임
  currentFloorRooms.forEach(rm => {
    if (!sortedFloorRooms.some(r => r.id === rm.id)) {
      sortedFloorRooms.push(rm);
    }
  });

  // building.rooms 합치기 (층 순서대로 정렬 유지)
  building.rooms = [];
  for (let f = 1; f <= 3; f++) {
    if (f === floorNum) {
      building.rooms.push(...sortedFloorRooms);
    } else {
      building.rooms.push(...otherFloorRooms.filter(r => r.floor === f));
    }
  }

  await writeData(data);
  res.json({ success: true, rooms: building.rooms });
});

// 7. 호실 시설 이미지 업로드
app.post('/api/buildings/:buildingId/rooms/:roomId/images', upload.single('image'), async (req, res) => {
  const { buildingId, roomId } = req.params;
  const { facilityName } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: '업로드할 이미지가 없습니다.' });
  }

  const data = await readData();
  const building = data.buildings.find(b => b.id === buildingId);
  if (!building) {
    return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
  }

  const room = building.rooms.find(r => r.id === roomId);
  if (!room) {
    return res.status(404).json({ error: '호실을 찾을 수 없습니다.' });
  }

  const newFacility = {
    id: 'f-' + Date.now(),
    name: (facilityName && facilityName.trim() !== '') ? facilityName.trim() : '미지정 시설물',
    imageUrl: '/uploads/' + req.file.filename,
    addedAt: new Date().toISOString().split('T')[0]
  };

  room.facilities.push(newFacility);
  await writeData(data);
  res.status(201).json(newFacility);
});

// 8. 호실 시설 이미지 삭제
app.delete('/api/buildings/:buildingId/rooms/:roomId/images/:imageId', async (req, res) => {
  const { buildingId, roomId, imageId } = req.params;
  const data = await readData();

  const building = data.buildings.find(b => b.id === buildingId);
  if (!building) {
    return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
  }

  const room = building.rooms.find(r => r.id === roomId);
  if (!room) {
    return res.status(404).json({ error: '호실을 찾을 수 없습니다.' });
  }

  const facilityIndex = room.facilities.findIndex(f => f.id === imageId);
  if (facilityIndex === -1) {
    return res.status(404).json({ error: '시설물 이미지를 찾을 수 없습니다.' });
  }

  const facility = room.facilities[facilityIndex];
  // 파일 시스템에서 실제 이미지 삭제 시도
  const filePath = path.join(__dirname, 'public', facility.imageUrl);
  try {
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
  } catch (err) {
    console.error('이미지 파일 삭제 오류:', err);
  }

  room.facilities.splice(facilityIndex, 1);
  await writeData(data);
  res.json({ success: true, message: '시설물 이미지가 삭제되었습니다.' });
});

// 9. 설비 이력 추가
app.post('/api/buildings/:buildingId/rooms/:roomId/ac-history', async (req, res) => {
  const { buildingId, roomId } = req.params;
  const { date, type, description } = req.body; // type: 'purchase' (구매/설치), 'maintenance' (유지보수/수리)

  if (!date || !description || description.trim() === '') {
    return res.status(400).json({ error: '날짜와 이력 내용을 입력해주세요.' });
  }

  const data = await readData();
  const building = data.buildings.find(b => b.id === buildingId);
  if (!building) {
    return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
  }

  const room = building.rooms.find(r => r.id === roomId);
  if (!room) {
    return res.status(404).json({ error: '호실을 찾을 수 없습니다.' });
  }

  const newHistory = {
    id: 'ac-' + Date.now(),
    date: date,
    type: type || 'purchase',
    description: description.trim()
  };

  room.acHistory.push(newHistory);
  // 날짜 최신순 정렬
  room.acHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

  await writeData(data);
  res.status(201).json(newHistory);
});

// 10. 설비 이력 삭제
app.delete('/api/buildings/:buildingId/rooms/:roomId/ac-history/:historyId', async (req, res) => {
  const { buildingId, roomId, historyId } = req.params;
  const data = await readData();

  const building = data.buildings.find(b => b.id === buildingId);
  if (!building) {
    return res.status(404).json({ error: '건물을 찾을 수 없습니다.' });
  }

  const room = building.rooms.find(r => r.id === roomId);
  if (!room) {
    return res.status(404).json({ error: '호실을 찾을 수 없습니다.' });
  }

  const initialLength = room.acHistory.length;
  room.acHistory = room.acHistory.filter(h => h.id !== historyId);

  if (room.acHistory.length === initialLength) {
    return res.status(404).json({ error: '이력을 찾을 수 없습니다.' });
  }

  await writeData(data);
  res.json({ success: true, message: '설비 이력이 삭제되었습니다.' });
});

// SPA 프론트엔드 라우트 (API 라우트 외 모든 요청은 index.html 서빙)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 성공적으로 구동되었습니다.`);
  console.log(`로컬 접속: http://localhost:${PORT}`);
});
