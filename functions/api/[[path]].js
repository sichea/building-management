// ----------------------------------------------------
// Cloudflare Pages Functions - Supabase Serverless API
// ----------------------------------------------------

// CORS 설정을 위한 공통 응답 헤더 생성
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json;charset=UTF-8'
  };
}

// 에러 응답 헬퍼
function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders()
  });
}

// 성공 응답 헬퍼
function jsonSuccess(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}

// ----------------------------------------------------
// Supabase REST API 통신 헬퍼 함수
// ----------------------------------------------------
async function readData(env) {
  const url = `${env.SUPABASE_URL}/rest/v1/building_data?id=eq.1&select=data`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`
    }
  });

  if (!res.ok) {
    throw new Error(`Supabase 조회 실패: ${res.statusText}`);
  }

  const result = await res.json();
  if (result.length === 0) {
    return { buildings: [] };
  }
  return result[0].data;
}

async function writeData(env, newData) {
  const url = `${env.SUPABASE_URL}/rest/v1/building_data?id=eq.1`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      data: newData,
      updated_at: new Date().toISOString()
    })
  });

  if (!res.ok) {
    throw new Error(`Supabase 업데이트 실패: ${res.statusText}`);
  }
}

// ----------------------------------------------------
// 메인 요청 핸들러 (모든 HTTP 메서드 처리)
// ----------------------------------------------------
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // OPTIONS 프리플라이트 요청 처리
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  try {
    // ----------------------------------------------------
    // [GET] /api/buildings : 건물 목록 조회
    // ----------------------------------------------------
    if (method === 'GET' && path === '/api/buildings') {
      const data = await readData(env);
      return jsonSuccess(data.buildings || []);
    }

    // ----------------------------------------------------
    // [POST] /api/buildings : 새 건물 추가
    // ----------------------------------------------------
    if (method === 'POST' && path === '/api/buildings') {
      const body = await request.json();
      const { name } = body;
      if (!name || name.trim() === '') {
        return jsonError('건물명을 입력해주세요.', 400);
      }

      const data = await readData(env);
      const newBuilding = {
        id: 'b-' + Date.now(),
        name: name.trim(),
        rooms: []
      };

      data.buildings.push(newBuilding);
      await writeData(env, data);
      return jsonSuccess(newBuilding, 201);
    }

    // ----------------------------------------------------
    // [DELETE] /api/buildings/:id : 건물 삭제
    // ----------------------------------------------------
    const deleteBuildingMatch = path.match(/^\/api\/buildings\/([^/]+)$/);
    if (method === 'DELETE' && deleteBuildingMatch) {
      const id = deleteBuildingMatch[1];
      const data = await readData(env);

      const initialLength = data.buildings.length;
      data.buildings = data.buildings.filter(b => b.id !== id);

      if (data.buildings.length === initialLength) {
        return jsonError('건물을 찾을 수 없습니다.', 404);
      }

      await writeData(env, data);
      return jsonSuccess({ success: true, message: '건물이 삭제되었습니다.' });
    }

    // ----------------------------------------------------
    // [POST] /api/buildings/:buildingId/rooms : 새 호실 추가
    // ----------------------------------------------------
    const addRoomMatch = path.match(/^\/api\/buildings\/([^/]+)\/rooms$/);
    if (method === 'POST' && addRoomMatch) {
      const buildingId = addRoomMatch[1];
      const body = await request.json();
      const { number, floor, roomType, slotSize } = body;

      if (!number || number.trim() === '') {
        return jsonError('호실 번호를 입력해주세요.', 400);
      }
      if (!floor || floor < 1 || floor > 3) {
        return jsonError('층수를 1~3 사이로 입력해주세요.', 400);
      }

      const validTypes = ['oneroom', 'tworoom', 'store', 'store2', 'full'];
      const type = validTypes.includes(roomType) ? roomType : 'oneroom';
      const defaultSlotSize = type === 'full' ? 5 : (type === 'tworoom' || type === 'store2') ? 2 : 1;
      const size = (slotSize !== undefined) ? parseInt(slotSize) : defaultSlotSize;

      const data = await readData(env);
      const building = data.buildings.find(b => b.id === buildingId);

      if (!building) {
        return jsonError('건물을 찾을 수 없습니다.', 404);
      }

      const roomsOnFloor = building.rooms.filter(r => r.floor === floor);
      let usedSlots = 0;
      roomsOnFloor.forEach(r => {
        usedSlots += r.slotSize || (r.roomType === 'full' ? 5 : (r.roomType === 'tworoom' || r.roomType === 'store2') ? 2 : 1);
      });
      if (usedSlots + size > 5) {
        return jsonError(`해당 층에 공간이 부족합니다. (사용: ${usedSlots + size}/5칸)`, 400);
      }

      const exists = building.rooms.some(r => r.number === number.trim());
      if (exists) {
        return jsonError('이미 존재하는 호실 번호입니다.', 400);
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
      await writeData(env, data);
      return jsonSuccess(newRoom, 201);
    }

    // ----------------------------------------------------
    // [DELETE] /api/buildings/:buildingId/rooms/:roomId : 호실 삭제
    // ----------------------------------------------------
    const deleteRoomMatch = path.match(/^\/api\/buildings\/([^/]+)\/rooms\/([^/]+)$/);
    if (method === 'DELETE' && deleteRoomMatch) {
      const buildingId = deleteRoomMatch[1];
      const roomId = deleteRoomMatch[2];
      const data = await readData(env);

      const building = data.buildings.find(b => b.id === buildingId);
      if (!building) {
        return jsonError('건물을 찾을 수 없습니다.', 404);
      }

      const initialLength = building.rooms.length;
      building.rooms = building.rooms.filter(r => r.id !== roomId);

      if (building.rooms.length === initialLength) {
        return jsonError('호실을 찾을 수 없습니다.', 404);
      }

      await writeData(env, data);
      return jsonSuccess({ success: true, message: '호실이 삭제되었습니다.' });
    }

    // ----------------------------------------------------
    // [PUT] /api/buildings/:buildingId/rooms/:roomId : 호실 상세 정보 수정
    // ----------------------------------------------------
    const editRoomMatch = path.match(/^\/api\/buildings\/([^/]+)\/rooms\/([^/]+)$/);
    if (method === 'PUT' && editRoomMatch) {
      const buildingId = editRoomMatch[1];
      const roomId = editRoomMatch[2];
      const body = await request.json();
      const {
        number, status, tenantName, contact, notes, leaseType, roomType,
        deposit, rent, structure, tenantEmergency, leasePeriod, slotSize, tenants
      } = body;

      const data = await readData(env);
      const building = data.buildings.find(b => b.id === buildingId);
      if (!building) {
        return jsonError('건물을 찾을 수 없습니다.', 404);
      }

      const room = building.rooms.find(r => r.id === roomId);
      if (!room) {
        return jsonError('호실을 찾을 수 없습니다.', 404);
      }

      if (roomType !== undefined) {
        const validTypes = ['oneroom', 'tworoom', 'store', 'store2', 'full'];
        if (!validTypes.includes(roomType)) {
          return jsonError('올바르지 않은 방 타입입니다.', 400);
        }
      }

      const defaultSlotSize = (roomType || room.roomType) === 'full' ? 5 : ((roomType || room.roomType) === 'tworoom' || (roomType || room.roomType) === 'store2') ? 2 : 1;
      const targetSlotSize = slotSize !== undefined ? parseInt(slotSize) : (room.slotSize || defaultSlotSize);

      if (targetSlotSize < 1 || targetSlotSize > 5) {
        return jsonError('호실 크기는 1~5칸 사이여야 합니다.', 400);
      }

      if ((roomType !== undefined && roomType !== room.roomType) || (slotSize !== undefined && parseInt(slotSize) !== room.slotSize)) {
        const otherRooms = building.rooms.filter(r => r.floor === room.floor && r.id !== roomId);
        let usedSlots = 0;
        otherRooms.forEach(r => {
          usedSlots += r.slotSize || (r.roomType === 'full' ? 5 : (r.roomType === 'tworoom' || r.roomType === 'store2') ? 2 : 1);
        });

        if (usedSlots + targetSlotSize > 5) {
          return jsonError(`공간이 부족합니다. (변경 시 해당 층 사용량: ${usedSlots + targetSlotSize}/5칸)`, 400);
        }
      }

      if (number) room.number = number.trim();
      if (status) room.status = status;
      if (roomType !== undefined) room.roomType = roomType;
      if (slotSize !== undefined) room.slotSize = parseInt(slotSize);
      if (tenantName !== undefined) room.tenantName = tenantName.trim();
      if (contact !== undefined) room.contact = contact.trim();
      if (tenantEmergency !== undefined) room.tenantEmergency = tenantEmergency.trim();
      if (leasePeriod !== undefined) room.leasePeriod = leasePeriod.trim();
      if (tenants !== undefined && Array.isArray(tenants)) room.tenants = tenants;
      if (notes !== undefined) room.notes = notes.trim();
      if (leaseType !== undefined) room.leaseType = leaseType;
      if (deposit !== undefined) room.deposit = deposit.trim();
      if (rent !== undefined) room.rent = rent.trim();
      if (structure !== undefined) room.structure = structure.trim();

      await writeData(env, data);
      return jsonSuccess(room);
    }

    // ----------------------------------------------------
    // [PUT] /api/buildings/:buildingId/floors/:floor/rooms/reorder : 호실 순서 재배치
    // ----------------------------------------------------
    const reorderRoomsMatch = path.match(/^\/api\/buildings\/([^/]+)\/floors\/([^/]+)\/rooms\/reorder$/);
    if (method === 'PUT' && reorderRoomsMatch) {
      const buildingId = reorderRoomsMatch[1];
      const floorNum = parseInt(reorderRoomsMatch[2]);
      const body = await request.json();
      const { roomIds } = body;

      if (!roomIds || !Array.isArray(roomIds)) {
        return jsonError('올바르지 않은 정렬 데이터입니다.', 400);
      }

      const data = await readData(env);
      const building = data.buildings.find(b => b.id === buildingId);
      if (!building) {
        return jsonError('건물을 찾을 수 없습니다.', 404);
      }

      const otherFloorRooms = building.rooms.filter(r => r.floor !== floorNum);
      const currentFloorRooms = building.rooms.filter(r => r.floor === floorNum);

      const sortedFloorRooms = [];
      roomIds.forEach(id => {
        const rm = currentFloorRooms.find(r => r.id === id);
        if (rm) sortedFloorRooms.push(rm);
      });

      currentFloorRooms.forEach(rm => {
        if (!sortedFloorRooms.some(r => r.id === rm.id)) {
          sortedFloorRooms.push(rm);
        }
      });

      building.rooms = [];
      for (let f = 1; f <= 3; f++) {
        if (f === floorNum) {
          building.rooms.push(...sortedFloorRooms);
        } else {
          building.rooms.push(...otherFloorRooms.filter(r => r.floor === f));
        }
      }

      await writeData(env, data);
      return jsonSuccess({ success: true, rooms: building.rooms });
    }

    // ----------------------------------------------------
    // [POST] /api/buildings/:buildingId/rooms/:roomId/images : 호실 시설물 이미지 업로드 (Supabase Storage 연동)
    // ----------------------------------------------------
    const uploadImageMatch = path.match(/^\/api\/buildings\/([^/]+)\/rooms\/([^/]+)\/images$/);
    if (method === 'POST' && uploadImageMatch) {
      const buildingId = uploadImageMatch[1];
      const roomId = uploadImageMatch[2];

      const formData = await request.formData();
      const file = formData.get('image');
      const facilityName = formData.get('facilityName');

      if (!file) {
        return jsonError('업로드할 이미지가 없습니다.', 400);
      }

      const data = await readData(env);
      const building = data.buildings.find(b => b.id === buildingId);
      if (!building) {
        return jsonError('건물을 찾을 수 없습니다.', 404);
      }

      const room = building.rooms.find(r => r.id === roomId);
      if (!room) {
        return jsonError('호실을 찾을 수 없습니다.', 404);
      }

      // Supabase Storage 업로드를 위한 고유 파일명 생성
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const originalName = file.name || 'image.jpg';
      const fileExt = originalName.substring(originalName.lastIndexOf('.'));
      const filename = `facility-${uniqueSuffix}${fileExt}`;

      // Supabase Storage 업로드 API 호출
      const storageUploadUrl = `${env.SUPABASE_URL}/storage/v1/object/uploads/${filename}`;
      const uploadResponse = await fetch(storageUploadUrl, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_KEY}`,
          'Content-Type': file.type || 'image/jpeg'
        },
        body: file // File 객체 스트림/바디
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        return jsonError(`스토리지 업로드 실패: ${errText}`, 500);
      }

      // Supabase Storage 퍼블릭 URL 형식 생성
      const publicImageUrl = `${env.SUPABASE_URL}/storage/v1/object/public/uploads/${filename}`;

      const newFacility = {
        id: 'f-' + Date.now(),
        name: (facilityName && facilityName.trim() !== '') ? facilityName.trim() : '미지정 시설물',
        imageUrl: publicImageUrl,
        addedAt: new Date().toISOString().split('T')[0]
      };

      room.facilities.push(newFacility);
      await writeData(env, data);
      return jsonSuccess(newFacility, 201);
    }

    // ----------------------------------------------------
    // [DELETE] /api/buildings/:buildingId/rooms/:roomId/images/:imageId : 호실 시설물 이미지 삭제
    // ----------------------------------------------------
    const deleteImageMatch = path.match(/^\/api\/buildings\/([^/]+)\/rooms\/([^/]+)\/images\/([^/]+)$/);
    if (method === 'DELETE' && deleteImageMatch) {
      const buildingId = deleteImageMatch[1];
      const roomId = deleteImageMatch[2];
      const imageId = deleteImageMatch[3];
      const data = await readData(env);

      const building = data.buildings.find(b => b.id === buildingId);
      if (!building) {
        return jsonError('건물을 찾을 수 없습니다.', 404);
      }

      const room = building.rooms.find(r => r.id === roomId);
      if (!room) {
        return jsonError('호실을 찾을 수 없습니다.', 404);
      }

      const facilityIndex = room.facilities.findIndex(f => f.id === imageId);
      if (facilityIndex === -1) {
        return jsonError('시설물 이미지를 찾을 수 없습니다.', 404);
      }

      const facility = room.facilities[facilityIndex];
      const imageUrl = facility.imageUrl;

      // Supabase Storage에 업로드된 파일이라면 스토리지에서도 파일 삭제 요청 시도
      if (imageUrl.includes('/storage/v1/object/public/uploads/')) {
        const filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
        const storageDeleteUrl = `${env.SUPABASE_URL}/storage/v1/object/uploads/${filename}`;
        try {
          await fetch(storageDeleteUrl, {
            method: 'DELETE',
            headers: {
              'apikey': env.SUPABASE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_KEY}`
            }
          });
        } catch (err) {
          console.error('스토리지 이미지 삭제 중 오류:', err);
        }
      }

      room.facilities.splice(facilityIndex, 1);
      await writeData(env, data);
      return jsonSuccess({ success: true, message: '시설물 이미지가 삭제되었습니다.' });
    }

    // ----------------------------------------------------
    // [POST] /api/buildings/:buildingId/rooms/:roomId/ac-history : 설비 이력 추가
    // ----------------------------------------------------
    const addHistoryMatch = path.match(/^\/api\/buildings\/([^/]+)\/rooms\/([^/]+)\/ac-history$/);
    if (method === 'POST' && addHistoryMatch) {
      const buildingId = addHistoryMatch[1];
      const roomId = addHistoryMatch[2];
      const body = await request.json();
      const { date, type, description } = body;

      if (!date || !description || description.trim() === '') {
        return jsonError('날짜와 이력 내용을 입력해주세요.', 400);
      }

      const data = await readData(env);
      const building = data.buildings.find(b => b.id === buildingId);
      if (!building) {
        return jsonError('건물을 찾을 수 없습니다.', 404);
      }

      const room = building.rooms.find(r => r.id === roomId);
      if (!room) {
        return jsonError('호실을 찾을 수 없습니다.', 404);
      }

      const newHistory = {
        id: 'ac-' + Date.now(),
        date: date,
        type: type || 'purchase',
        description: description.trim()
      };

      room.acHistory.push(newHistory);
      room.acHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

      await writeData(env, data);
      return jsonSuccess(newHistory, 201);
    }

    // ----------------------------------------------------
    // [DELETE] /api/buildings/:buildingId/rooms/:roomId/ac-history/:historyId : 설비 이력 삭제
    // ----------------------------------------------------
    const deleteHistoryMatch = path.match(/^\/api\/buildings\/([^/]+)\/rooms\/([^/]+)\/ac-history\/([^/]+)$/);
    if (method === 'DELETE' && deleteHistoryMatch) {
      const buildingId = deleteHistoryMatch[1];
      const roomId = deleteHistoryMatch[2];
      const historyId = deleteHistoryMatch[3];
      const data = await readData(env);

      const building = data.buildings.find(b => b.id === buildingId);
      if (!building) {
        return jsonError('건물을 찾을 수 없습니다.', 404);
      }

      const room = building.rooms.find(r => r.id === roomId);
      if (!room) {
        return jsonError('호실을 찾을 수 없습니다.', 404);
      }

      const initialLength = room.acHistory.length;
      room.acHistory = room.acHistory.filter(h => h.id !== historyId);

      if (room.acHistory.length === initialLength) {
        return jsonError('이력을 찾을 수 없습니다.', 404);
      }

      await writeData(env, data);
      return jsonSuccess({ success: true, message: '설비 이력이 삭제되었습니다.' });
    }

    // ----------------------------------------------------
    // [GET] /api/summary-extras : 공동 지출 및 세금, 추가 수익 정보 조회
    // ----------------------------------------------------
    if (method === 'GET' && path === '/api/summary-extras') {
      const data = await readData(env);
      return jsonSuccess({
        expenses: data.expenses || {},
        revenue: data.revenue || []
      });
    }

    // ----------------------------------------------------
    // [PUT] /api/summary-extras : 공동 지출 및 세금, 추가 수익 정보 저장
    // ----------------------------------------------------
    if (method === 'PUT' && path === '/api/summary-extras') {
      const body = await request.json();
      const data = await readData(env);
      
      if (body.expenses !== undefined) {
        data.expenses = body.expenses;
      }
      if (body.revenue !== undefined) {
        data.revenue = body.revenue;
      }

      await writeData(env, data);
      return jsonSuccess({ success: true });
    }

    // 일치하는 API 엔드포인트가 없음
    return jsonError('경로를 찾을 수 없습니다.', 404);

  } catch (err) {
    console.error('API 서버 에러:', err);
    return jsonError(`서버 에러 발생: ${err.message}`, 500);
  }
}
