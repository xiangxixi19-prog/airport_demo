import { useEffect, useMemo, useRef, useState } from 'react';

const aircraftTypes = ['A320', 'A321', 'B737', 'B738', 'A330', 'B787'];
const wideAircraft = ['A330', 'B787'];
const aircraftCatalog = {
  A320: { category: 'C', length: 37.6, wingspan: 35.8, requiredStandClass: 'C', specialResources: '常规窄体保障' },
  A321: { category: 'C', length: 44.5, wingspan: 35.8, requiredStandClass: 'C', specialResources: '加长客舱清洁组' },
  B737: { category: 'C', length: 39.5, wingspan: 35.8, requiredStandClass: 'C', specialResources: '常规窄体保障' },
  B738: { category: 'C', length: 39.5, wingspan: 35.8, requiredStandClass: 'C', specialResources: '常规窄体保障' },
  A330: { category: 'E', length: 63.7, wingspan: 60.3, requiredStandClass: 'E', specialResources: '宽体保障与双廊桥优先' },
  B787: { category: 'E', length: 56.7, wingspan: 60.1, requiredStandClass: 'E', specialResources: '宽体保障与高压气源' },
};
const categoryRank = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
const airlines = ['CA', 'MU', 'CZ', 'HU', '3U', 'MF', 'ZH', 'SC'];
const cities = ['北京', '上海', '成都', '广州', '深圳', '杭州', '重庆', '昆明', '西安', '青岛'];
const startHour = 6;
const hourCount = 16;
const timelineStartMinutes = startHour * 60;
const timelineTotalMinutes = hourCount * 60;
const safeGapMinutes = 15;
const timelineHours = Array.from({ length: hourCount + 1 }, (_, index) => startHour + index);

const standsData = [
  { id: '101', type: 'near', supportedAircraft: ['A320', 'A321', 'B737', 'B738'], supportedCategories: ['A', 'B', 'C'], maxWingspan: 36, maxLength: 45, bridge: true, towInOut: true, adjacentRestrictions: [], available: true, terminal: 'T1', pier: 'A' },
  { id: '102', type: 'near', supportedAircraft: ['A320', 'A321', 'B737', 'B738'], supportedCategories: ['A', 'B', 'C'], maxWingspan: 36, maxLength: 45, bridge: true, towInOut: true, adjacentRestrictions: [], available: true, terminal: 'T1', pier: 'A' },
  { id: '103', type: 'near', supportedAircraft: ['A320', 'A321', 'B737', 'B738'], supportedCategories: ['A', 'B', 'C'], maxWingspan: 36, maxLength: 45, bridge: true, towInOut: true, adjacentRestrictions: [], available: true, terminal: 'T1', pier: 'B' },
  { id: '104', type: 'near', supportedAircraft: ['A320', 'A321', 'B737', 'B738'], supportedCategories: ['A', 'B', 'C'], maxWingspan: 36, maxLength: 45, bridge: true, towInOut: true, adjacentRestrictions: [], available: true, terminal: 'T1', pier: 'B' },
  { id: '105', type: 'near', supportedAircraft: ['A320', 'A321', 'B737', 'B738', 'A330', 'B787'], supportedCategories: ['A', 'B', 'C', 'D', 'E'], maxWingspan: 65, maxLength: 68, bridge: true, towInOut: true, adjacentRestrictions: ['106'], available: true, terminal: 'T2', pier: 'C' },
  { id: '106', type: 'near', supportedAircraft: ['A320', 'A321', 'B737', 'B738', 'A330', 'B787'], supportedCategories: ['A', 'B', 'C', 'D', 'E'], maxWingspan: 65, maxLength: 68, bridge: true, towInOut: true, adjacentRestrictions: ['105'], available: true, terminal: 'T2', pier: 'C' },
  { id: '201', type: 'remote', supportedAircraft: ['A320', 'A321', 'B737', 'B738', 'A330', 'B787'], supportedCategories: ['A', 'B', 'C', 'D', 'E'], maxWingspan: 68, maxLength: 70, bridge: false, towInOut: true, adjacentRestrictions: [], available: true, terminal: 'T2', pier: 'R' },
  { id: '202', type: 'remote', supportedAircraft: ['A320', 'A321', 'B737', 'B738', 'A330', 'B787'], supportedCategories: ['A', 'B', 'C', 'D', 'E'], maxWingspan: 68, maxLength: 70, bridge: false, towInOut: true, adjacentRestrictions: [], available: true, terminal: 'T2', pier: 'R' },
];

const towTractorsData = ['TOW-01', 'TOW-02', 'TOW-03', 'TOW-04', 'TOW-05', 'TOW-06'].map((id, index) => ({
  id,
  location: index < 3 ? `拖车点 ${index + 1}` : '保障区 C',
  availableAt: 6 * 60 + index * 8,
  status: index === 4 ? '充电待命' : '可派遣',
}));

const initialForm = {
  flightNo: '',
  aircraftType: 'A320',
  arrival: '10:30',
  departure: '11:45',
  airline: 'CA',
  origin: '北京',
  destination: '上海',
  manualStandId: '',
  allowRemote: true,
  allowTow: true,
  preferNear: true,
  minTurn: 60,
  locked: false,
};

const pad = (value) => String(value).padStart(2, '0');
const timeLabel = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const timeInputValue = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const parseTime = (value) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const snapToTenMinutes = (minutes) => Math.round(minutes / 10) * 10;

function overlaps(firstStart, firstEnd, secondStart, secondEnd, gap = 0) {
  return firstStart < secondEnd + gap && secondStart < firstEnd + gap;
}

function buildMockFlights() {
  return Array.from({ length: 18 }, (_, index) => {
    const arrival = 6 * 60 + 20 + index * 42 + (index % 4) * 7;
    const minTurn = 55 + (index % 4) * 10;
    const aircraftType = aircraftTypes[index % aircraftTypes.length];
    return {
      id: `F-${index + 1}`,
      flightNo: `${airlines[index % airlines.length]}${1200 + index * 17}`,
      airline: airlines[index % airlines.length],
      aircraftType,
      arrival,
      departure: arrival + 62 + (index % 5) * 12,
      origin: cities[(index * 2 + 1) % cities.length],
      destination: cities[(index * 2 + 4) % cities.length],
      allowRemote: index % 4 !== 1,
      allowTow: index % 4 !== 1,
      preferNear: index % 3 !== 0,
      minTurn,
      manualStandId: index % 6 === 0 ? standsData[(index * 3) % standsData.length].id : '',
      locked: index === 0,
      baseStatus: index % 5 === 0 ? '待优化' : '待确认',
      isNew: false,
    };
  });
}

function isCompatible(flight, stand) {
  const spec = aircraftCatalog[flight.aircraftType];
  return stand.available
    && stand.supportedAircraft.includes(flight.aircraftType)
    && categoryRank[spec.category] <= Math.max(...stand.supportedCategories.map((item) => categoryRank[item]))
    && spec.wingspan <= stand.maxWingspan
    && spec.length <= stand.maxLength;
}

function compatibilityReasons(flight, stand) {
  const spec = aircraftCatalog[flight.aircraftType];
  const maxCategory = stand.supportedCategories.reduce((max, item) => (categoryRank[item] > categoryRank[max] ? item : max), stand.supportedCategories[0]);
  const reasons = [];
  if (!stand.available) reasons.push(`${stand.id} 机位当前不可用`);
  if (!stand.supportedAircraft.includes(flight.aircraftType) || categoryRank[spec.category] > categoryRank[maxCategory]) {
    reasons.push(`${flight.flightNo} 机型 ${flight.aircraftType} 要求 ${spec.requiredStandClass} 类机位，${stand.id} 机位最高支持 ${maxCategory} 类`);
  }
  if (spec.wingspan > stand.maxWingspan) {
    reasons.push(`${flight.aircraftType} 翼展 ${spec.wingspan}m 超过 ${stand.id} 最大翼展 ${stand.maxWingspan}m`);
  }
  if (spec.length > stand.maxLength) {
    reasons.push(`${flight.aircraftType} 机身长度 ${spec.length}m 超过 ${stand.id} 最大机身长度 ${stand.maxLength}m`);
  }
  if (stand.type === 'remote' && !flight.allowRemote) reasons.push(`${flight.flightNo} 不允许远机位`);
  if (stand.type === 'remote' && !flight.allowTow) reasons.push(`${flight.flightNo} 不允许拖曳，远机位方案不可行`);
  return reasons;
}

function formatOverlapExplanation(flight, otherFlight, standId, overlapStart, overlapEnd) {
  return `${flight.flightNo} 被分配至机位 ${standId}，但该机位在 ${timeLabel(overlapStart)}-${timeLabel(overlapEnd)} 与 ${otherFlight.flightNo} 的占用窗口重叠 ${Math.max(overlapEnd - overlapStart, 0)} 分钟，因此形成同一机位时间冲突。`;
}

function canUseStand(flight, stand, assignment, currentAssignments) {
  if (!isCompatible(flight, stand)) return false;
  if (stand.type === 'remote' && !flight.allowRemote) return false;
  return currentAssignments.every((item) => (
    item.standId !== stand.id
    || item.flightId === flight.id
    || !overlaps(assignment.occupyStart, assignment.occupyEnd, item.occupyStart, item.occupyEnd, safeGapMinutes)
  ));
}

function explainManualMove(flight, stand, assignment, currentAssignments, allFlights) {
  const reasons = compatibilityReasons(flight, stand);
  currentAssignments
    .filter((item) => item.flightId !== flight.id && item.standId === stand.id && overlaps(assignment.occupyStart, assignment.occupyEnd, item.occupyStart, item.occupyEnd, safeGapMinutes))
    .forEach((item) => {
      const other = allFlights.find((target) => target.id === item.flightId);
      reasons.push(`${stand.id} 在 ${timeLabel(Math.max(assignment.occupyStart, item.occupyStart))}-${timeLabel(Math.min(assignment.occupyEnd, item.occupyEnd))} 已被 ${other?.flightNo || item.flightId} 占用`);
    });
  if (wideAircraft.includes(flight.aircraftType)) {
    stand.adjacentRestrictions.forEach((adjacentId) => {
      currentAssignments
        .filter((item) => item.flightId !== flight.id && item.standId === adjacentId && overlaps(assignment.occupyStart, assignment.occupyEnd, item.occupyStart, item.occupyEnd, safeGapMinutes))
        .forEach((item) => {
          const other = allFlights.find((target) => target.id === item.flightId);
          reasons.push(`${flight.aircraftType} 占用 ${stand.id} 时要求相邻 ${adjacentId} 隔离，但 ${other?.flightNo || item.flightId} 正在占用`);
        });
    });
  }
  if (!stand.available) reasons.push(`${stand.id} 当前不可用`);
  return reasons;
}

function scoreStand(flight, stand, assignments) {
  const load = assignments.filter((assignment) => assignment.standId === stand.id).length;
  let score = load * 6;
  if (stand.type === 'near') score -= flight.preferNear ? 34 : 10;
  if (stand.type === 'remote') score += flight.allowTow ? 14 : 50;
  if (flight.manualStandId === stand.id) score -= 16;
  if (wideAircraft.includes(flight.aircraftType) && stand.supportedAircraft.includes(flight.aircraftType)) score -= 4;
  return score;
}

function createAssignment(flight, stand, mode = 'single') {
  const shortStop = mode === 'towSplit';
  const occupyEnd = shortStop ? Math.min(flight.arrival + Math.max(35, flight.minTurn), flight.departure) : flight.departure;
  return {
    id: `A-${flight.id}`,
    flightId: flight.id,
    standId: stand.id,
    occupyStart: flight.arrival,
    occupyEnd,
    mode,
    locked: flight.locked,
    status: 'assigned',
    note: shortStop ? '近机位短停后拖至远机位。' : `${stand.type === 'near' ? '近机位' : '远机位'}完整占用。`,
  };
}

function assignTowTractors(tasks, towTractors) {
  const tractorState = towTractors.map((tractor) => ({ ...tractor }));
  return tasks.map((task) => {
    const sorted = tractorState
      .filter((tractor) => tractor.status !== '停用')
      .sort((a, b) => Math.max(a.availableAt, task.start) - Math.max(b.availableAt, task.start));
    const selected = sorted[0];
    if (!selected || selected.availableAt > task.start) {
      return { ...task, tractorId: selected?.id || '', status: '冲突待解', reason: '拖车可用时间与任务窗口冲突' };
    }
    selected.availableAt = task.end + 10;
    selected.location = task.to;
    selected.status = '执行任务';
    return { ...task, tractorId: selected.id, status: '已派遣' };
  });
}

function optimizeAssignments(flights, previousAssignments, options = {}) {
  const scopeIds = options.scopeIds || null;
  const assignments = [];
  const unresolved = [];
  const sortedFlights = [...flights].sort((a, b) => a.arrival - b.arrival);

  sortedFlights.forEach((flight) => {
    const previous = previousAssignments.find((item) => item.flightId === flight.id);
    const shouldKeep = flight.locked || (scopeIds && !scopeIds.has(flight.id));
    if (shouldKeep && previous) {
      assignments.push({ ...previous, locked: flight.locked });
      return;
    }

    const baseCandidates = [
      flight.manualStandId && standsData.find((stand) => stand.id === flight.manualStandId),
      ...standsData.filter((stand) => stand.type === 'near'),
      ...standsData.filter((stand) => stand.type === 'remote'),
    ].filter(Boolean);
    const candidates = [...new Map(baseCandidates.map((stand) => [stand.id, stand])).values()]
      .sort((a, b) => scoreStand(flight, a, assignments) - scoreStand(flight, b, assignments));

    let selected = null;
    for (const stand of candidates) {
      const assignment = createAssignment(flight, stand);
      if (canUseStand(flight, stand, assignment, assignments)) {
        selected = assignment;
        break;
      }
    }

    if (!selected && flight.allowTow) {
      const nearStand = standsData
        .filter((stand) => stand.type === 'near')
        .find((stand) => canUseStand(flight, stand, createAssignment(flight, stand, 'towSplit'), assignments));
      const remoteStand = standsData
        .filter((stand) => stand.type === 'remote')
        .find((stand) => isCompatible(flight, stand));
      if (nearStand && remoteStand) {
        selected = createAssignment(flight, nearStand, 'towSplit');
        selected.remoteStandId = remoteStand.id;
      }
    }

    if (selected) {
      assignments.push({ ...selected, source: 'system' });
    } else {
      unresolved.push(flight.id);
      assignments.push({
        id: `A-${flight.id}`,
        flightId: flight.id,
        standId: flight.manualStandId || '',
        occupyStart: flight.arrival,
        occupyEnd: flight.departure,
        mode: 'unassigned',
        locked: flight.locked,
        status: 'unresolved',
        note: '未找到满足机型、时间窗、近远机位和拖曳约束的方案。',
        source: 'system',
      });
    }
  });

  return { assignments, unresolved };
}

function generateTowTasks(flights, assignments, towTractors) {
  const tasks = assignments
    .filter((assignment) => assignment.mode === 'towSplit' || (assignment.standId && standsData.find((stand) => stand.id === assignment.standId)?.type === 'remote'))
    .map((assignment) => {
      const flight = flights.find((item) => item.id === assignment.flightId);
      const stand = standsData.find((item) => item.id === assignment.standId);
      const remoteStand = assignment.remoteStandId || assignment.standId;
      const isSplitTow = assignment.mode === 'towSplit';
      const isLongRemoteStay = stand?.type === 'remote' && flight.departure - flight.arrival >= 95;
      const start = isSplitTow ? assignment.occupyEnd + 5 : flight.arrival + 18;
      const type = isSplitTow ? '近机位短停后拖至远机位' : '远机位长期停放';
      const reason = isSplitTow
        ? `为释放近机位 ${assignment.standId}，${flight.flightNo} 短停后拖至远机位 ${remoteStand}。`
        : `${flight.flightNo} 过站时间 ${flight.departure - flight.arrival} 分钟，高峰时段靠桥资源紧张，安排远机位长期停放。`;
      return {
        id: `T-${assignment.flightId}`,
        flightId: assignment.flightId,
        type,
        from: assignment.standId,
        to: isSplitTow ? remoteStand : `远机位等待区-${remoteStand}`,
        start,
        end: start + (isSplitTow ? 28 : 24),
        reason: isLongRemoteStay || isSplitTow ? reason : '保障等级调整，生成拖曳调整任务。',
      };
    });
  return assignTowTractors(tasks, towTractors);
}

function detectConflicts(flights, assignments, towTasks) {
  const issues = [];
  assignments.forEach((assignment) => {
    const flight = flights.find((item) => item.id === assignment.flightId);
    const stand = standsData.find((item) => item.id === assignment.standId);
    if (!flight) return;
    if (!assignment.standId || assignment.status === 'unresolved') {
      issues.push({ flightId: flight.id, type: '不可行机位分配', category: 'conflict', message: assignment.note, suggestion: '运行自动重排，或放宽近机位/拖曳约束。' });
    }
    if (stand && !isCompatible(flight, stand)) {
      issues.push({ flightId: flight.id, type: '机型/尺寸不兼容', category: 'conflict', standId: stand.id, highlight: 'compatibility', message: compatibilityReasons(flight, stand).join('；'), suggestion: '更换为满足机型等级、翼展和机身长度限制的机位。' });
    }
    if (flight.departure - flight.arrival < flight.minTurn) {
      const turn = flight.departure - flight.arrival;
      issues.push({
        flightId: flight.id,
        type: '过站不足',
        category: 'risk',
        message: `该航班到港至离港仅有 ${turn} 分钟，小于系统建议的最小保障时间 ${flight.minTurn} 分钟，可能导致清洁、加油、登机等保障流程时间不足。`,
        suggestion: '建议延后离港、降低保障压力，或由运行控制确认压缩保障流程。',
      });
    }
    if (flight.manualStandId && assignment.standId !== flight.manualStandId) {
      const manualStand = standsData.find((item) => item.id === flight.manualStandId);
      const reasons = manualStand ? compatibilityReasons(flight, manualStand) : [`人工指定机位 ${flight.manualStandId} 不存在`];
      assignments
        .filter((item) => item.standId === flight.manualStandId && item.flightId !== flight.id && overlaps(flight.arrival, flight.departure, item.occupyStart, item.occupyEnd, safeGapMinutes))
        .forEach((item) => {
          const other = flights.find((target) => target.id === item.flightId);
          reasons.push(`${flight.manualStandId} 在 ${timeLabel(Math.max(flight.arrival, item.occupyStart))}-${timeLabel(Math.min(flight.departure, item.occupyEnd))} 已被 ${other?.flightNo || item.flightId} 占用`);
        });
      issues.push({ flightId: flight.id, type: '人工指定机位冲突', category: 'conflict', standId: flight.manualStandId, highlight: 'manual', message: `${flight.flightNo} 人工指定 ${flight.manualStandId}，但${reasons.join('；')}。`, suggestion: '建议解除人工指定，或改派至系统推荐的可用机位。' });
    }
    if (flight.preferNear && stand && stand.type === 'remote') {
      issues.push({ flightId: flight.id, type: '靠桥偏好未满足', category: 'risk', standId: stand.id, message: `航班偏好近机位，但当前分配至远机位 ${stand.id}。`, suggestion: '若近机位释放，可在局部优化中优先回迁近机位。' });
    }
    if (assignment.mode === 'towSplit') {
      const buffer = Math.max((assignment.occupyEnd + 5) - assignment.occupyEnd, 0);
      if (buffer < 10) {
        issues.push({ flightId: flight.id, type: '拖曳缓冲时间不足', category: 'risk', standId: assignment.standId, message: `近机位释放后拖曳缓冲仅 ${buffer} 分钟，低于建议 10 分钟。`, suggestion: '建议提前拖车到位，或延后下一架占用该机位的航班。' });
      }
    }
    if (stand && stand.type === 'remote' && flight.departure - flight.arrival < flight.minTurn + 20) {
      issues.push({ flightId: flight.id, type: '滑行时间过紧', category: 'risk', standId: stand.id, message: `远机位运行需要额外摆渡/滑行缓冲，当前周转余量偏紧。`, suggestion: '建议增加 20 分钟地面保障缓冲或调整至近机位。' });
    }
  });

  for (let i = 0; i < assignments.length; i += 1) {
    for (let j = i + 1; j < assignments.length; j += 1) {
      const first = assignments[i];
      const second = assignments[j];
      if (first.standId && first.standId === second.standId && overlaps(first.occupyStart, first.occupyEnd, second.occupyStart, second.occupyEnd, safeGapMinutes)) {
        const overlapStart = Math.max(first.occupyStart, second.occupyStart);
        const overlapEnd = Math.min(first.occupyEnd, second.occupyEnd);
        [first, second].forEach((assignment, index) => {
          const flight = flights.find((item) => item.id === assignment.flightId);
          const otherFlight = flights.find((item) => item.id === (index === 0 ? second.flightId : first.flightId));
          issues.push({
            flightId: assignment.flightId,
            otherFlightId: index === 0 ? second.flightId : first.flightId,
            type: '机位时间重叠',
            category: 'conflict',
            standId: first.standId,
            overlapStart,
            overlapEnd,
            highlight: 'time',
            message: formatOverlapExplanation(flight, otherFlight, first.standId, overlapStart, overlapEnd),
            suggestion: `建议解除人工指定或改派至 ${standsData.find((stand) => canUseStand(flight, stand, assignment, assignments))?.id || '远机位'}。`,
          });
        });
      }
    }
  }

  assignments.forEach((assignment) => {
    const flight = flights.find((item) => item.id === assignment.flightId);
    const stand = standsData.find((item) => item.id === assignment.standId);
    if (!flight || !stand || !wideAircraft.includes(flight.aircraftType)) return;
    stand.adjacentRestrictions.forEach((adjacentId) => {
      assignments
        .filter((item) => item.standId === adjacentId && overlaps(assignment.occupyStart, assignment.occupyEnd, item.occupyStart, item.occupyEnd, safeGapMinutes))
        .forEach((item) => {
          const other = flights.find((target) => target.id === item.flightId);
          issues.push({
            flightId: flight.id,
            otherFlightId: item.flightId,
            type: '相邻机位限制冲突',
            category: 'conflict',
            standId: assignment.standId,
            overlapStart: Math.max(assignment.occupyStart, item.occupyStart),
            overlapEnd: Math.min(assignment.occupyEnd, item.occupyEnd),
            highlight: 'compatibility',
            message: `${flight.flightNo} 为宽体机，占用 ${assignment.standId} 时要求相邻 ${adjacentId} 保持隔离，但 ${other?.flightNo || item.flightId} 同时占用相邻机位。`,
            suggestion: '建议调整相邻机位航班，或将宽体机改派至远机位。',
          });
        });
    });
  });

  for (let i = 0; i < towTasks.length; i += 1) {
    for (let j = i + 1; j < towTasks.length; j += 1) {
      if (towTasks[i].tractorId && towTasks[i].tractorId === towTasks[j].tractorId && overlaps(towTasks[i].start, towTasks[i].end, towTasks[j].start, towTasks[j].end, 10)) {
        [towTasks[i], towTasks[j]].forEach((task) => {
          issues.push({
            flightId: task.flightId,
            type: '拖车任务冲突',
            category: 'conflict',
            overlapStart: Math.max(towTasks[i].start, towTasks[j].start),
            overlapEnd: Math.min(towTasks[i].end, towTasks[j].end),
            message: `${task.tractorId} 拖车任务时间冲突`,
            suggestion: '重新派遣拖车或延后拖曳开始时间。',
          });
        });
      }
    }
  }

  towTasks.filter((task) => task.status === '冲突待解').forEach((task) => {
    issues.push({ flightId: task.flightId, type: '拖车任务重叠', category: 'conflict', message: task.reason, suggestion: '打开拖车派遣面板重新选择可用拖车。' });
  });

  return issues;
}

function decorateFlights(flights, assignments, issues) {
  return flights.map((flight) => {
    const assignment = assignments.find((item) => item.flightId === flight.id);
    const flightIssues = issues.filter((issue) => issue.flightId === flight.id);
    const hasConflict = flightIssues.some((issue) => issue.category === 'conflict');
    const hasRisk = flightIssues.some((issue) => issue.category === 'risk');
    return {
      ...flight,
      assignment,
      standId: assignment?.standId || '',
      hasConflict,
      hasRisk,
      issues: flightIssues,
      status: hasConflict ? '硬冲突' : hasRisk ? '运行风险' : assignment?.source === 'manual-adjust' ? '人工调整' : flight.locked ? '锁定机位' : flight.manualStandId ? '人工指定' : assignment?.mode === 'towSplit' ? '拖曳方案' : assignment?.standId ? '系统分配' : '待优化',
    };
  });
}

function calculateMetrics(flights, assignments, towTasks, issues) {
  const assigned = assignments.filter((item) => item.standId && item.status !== 'unresolved');
  const occupiedMinutes = assigned.reduce((sum, item) => sum + Math.max(item.occupyEnd - item.occupyStart, 0), 0);
  const totalMinutes = standsData.filter((stand) => stand.available).length * timelineTotalMinutes;
  const nearAssigned = assigned.filter((item) => standsData.find((stand) => stand.id === item.standId)?.type === 'near').length;
  const remoteFlights = assigned.filter((item) => standsData.find((stand) => stand.id === item.standId)?.type === 'remote').length;
  const activeTractors = new Set(towTasks.filter((task) => task.tractorId).map((task) => task.tractorId)).size;
  return {
    utilization: totalMinutes ? Math.round((occupiedMinutes / totalMinutes) * 100) : 0,
    conflicts: issues.filter((issue) => issue.category === 'conflict').length,
    unresolved: new Set(issues.filter((issue) => issue.category === 'conflict').map((issue) => issue.flightId)).size,
    towTasks: towTasks.length,
    remoteFlights,
    towUtilization: towTractorsData.length ? Math.round((activeTractors / towTractorsData.length) * 100) : 0,
    bridgeRate: assigned.length ? Math.round((nearAssigned / assigned.length) * 100) : 0,
    avgTurn: Math.round(flights.reduce((sum, flight) => sum + flight.departure - flight.arrival, 0) / flights.length),
  };
}

function getFlightPosition(assignment) {
  const start = Math.max(assignment.occupyStart - timelineStartMinutes, 0);
  const duration = Math.max(assignment.occupyEnd - assignment.occupyStart, 36);
  return {
    left: `${(start / timelineTotalMinutes) * 100}%`,
    width: `${(duration / timelineTotalMinutes) * 100}%`,
  };
}

function getTowPosition(task) {
  const start = Math.max(task.start - timelineStartMinutes, 0);
  return {
    left: `${(start / timelineTotalMinutes) * 100}%`,
    width: `${((task.end - task.start) / timelineTotalMinutes) * 100}%`,
  };
}

function StatusPill({ value }) {
  const tone = value.includes('冲突') ? 'danger' : value.includes('风险') || value.includes('待') ? 'warn' : value.includes('拖曳') ? 'active' : 'ok';
  return <span className={`pill ${tone}`}>{value}</span>;
}

function issueTooltip(flight) {
  if (!flight.issues.length) return `${flight.flightNo} 当前无硬冲突或运行风险`;
  return flight.issues.map((issue) => `${issue.category === 'conflict' ? '硬冲突' : '运行风险'}：${issue.type}。${issue.message} 建议：${issue.suggestion}`).join('\n');
}

function FlightList({ flightRefs, flights, selectedFlightId, onEditFlight, onOpenDetail }) {
  return (
    <aside className="panel flight-panel">
      <div className="panel-title"><span>航班列表</span><strong>{flights.length}</strong></div>
      <div className="flight-list">
        {flights.map((flight) => (
          <article
            className={`flight-card clickable ${flight.isNew ? 'new-flight' : ''} ${flight.hasConflict ? 'conflict' : ''} ${!flight.hasConflict && flight.hasRisk ? 'pending' : ''} ${selectedFlightId === flight.id ? 'selected' : ''}`}
            key={flight.id}
            ref={(node) => { flightRefs.current[flight.id] = node; }}
            onClick={() => onOpenDetail(flight.id)}
            title={issueTooltip(flight)}
          >
            <div className="flight-card-top">
              <div>
                <button className="flight-link" type="button" onClick={(event) => { event.stopPropagation(); onEditFlight(flight.id); }}>{flight.flightNo}</button>
                <p>{flight.origin} - {flight.destination} · {flight.aircraftType}</p>
              </div>
              <StatusPill value={flight.status} />
            </div>
            <div className="flight-meta">
              <span>到港 {timeLabel(flight.arrival)}</span>
              <span>离港 {timeLabel(flight.departure)}</span>
              <span>机位 {flight.standId || '待分配'}{flight.locked ? ' · 锁定' : ''}</span>
            </div>
            <div className="state-line">{flight.status}</div>
            {flight.issues[0] && <div className="risk-tip">{flight.issues[0].type}：{flight.issues[0].message}</div>}
            <div className="flight-progress"><span style={{ width: `${64 + (flight.flightNo.charCodeAt(2) % 24)}%` }} /></div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function Timeline({ blockRefs, flights, assignments, selectedFlightId, standRefs, towTasks, activeDropStand, draggingFlightId, onDragEnd, onDragStart, onDropFlight, onOpenDetail, onOpenStand, onSetActiveDropStand }) {
  return (
    <main className="panel timeline-panel">
      <div className="panel-title timeline-heading">
        <span>机位时间轴</span>
        <div className="legend">
          <span><i className="legend-dot assigned" />占用</span>
          <span><i className="legend-dot tow" />拖曳</span>
          <span><i className="legend-dot alert" />风险</span>
          <span><i className="legend-dot drag" />可拖拽</span>
        </div>
      </div>
      <div className="time-ruler">{timelineHours.map((hour) => <span key={hour}>{pad(hour)}:00</span>)}</div>
      <div className="stand-grid">
        {standsData.map((stand) => {
          const standAssignments = assignments.filter((assignment) => assignment.standId === stand.id);
          return (
            <section className="stand-row" key={stand.id}>
              <button className="stand-label stand-button" type="button" onClick={() => onOpenStand(stand.id)}>
                <strong>{stand.id}</strong><span>{stand.type === 'near' ? '近机位 · 靠桥' : '远机位 · 需摆渡 · 不可靠桥'} · {stand.pier}</span>
              </button>
              <div
                className={`lane ${activeDropStand === stand.id ? 'drop-target' : ''}`}
                ref={(node) => { standRefs.current[stand.id] = node; }}
                onDragEnter={() => onSetActiveDropStand(stand.id)}
                onDragLeave={() => onSetActiveDropStand(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDropFlight(event, stand.id)}
              >
                {standAssignments.map((assignment) => {
                  const flight = flights.find((item) => item.id === assignment.flightId);
                  if (!flight) return null;
                  return (
                    <div
                      className={`flight-block ${flight.hasConflict ? 'conflict' : ''} ${flight.hasRisk ? 'pending' : ''} ${flight.isNew ? 'new-flight' : ''} ${draggingFlightId === flight.id ? 'dragging' : ''} ${selectedFlightId === flight.id ? 'selected' : ''}`}
                      draggable={!flight.locked}
                      key={assignment.id}
                      ref={(node) => { blockRefs.current[flight.id] = node; }}
                      onClick={() => onOpenDetail(flight.id)}
                      onDragEnd={onDragEnd}
                      onDragStart={(event) => onDragStart(event, flight)}
                      style={getFlightPosition(assignment)}
                      title={issueTooltip(flight)}
                    >
                      <b>{flight.flightNo}</b>
                      <span>{timeLabel(assignment.occupyStart)}-{timeLabel(assignment.occupyEnd)}</span>
                      <small>{flight.status}</small>
                      {(flight.hasConflict || flight.hasRisk) && <em>{flight.hasConflict ? '冲突' : '风险'}</em>}
                    </div>
                  );
                })}
                {towTasks.filter((task) => task.from === stand.id).map((task) => (
                  <div
                    className="tow-block"
                    key={task.id}
                    style={getTowPosition(task)}
                    title={`${task.type}：${timeLabel(task.start)}-${timeLabel(task.end)}，拖车 ${task.tractorId || '待派遣'}。${task.reason}`}
                  >
                    {task.from} → {task.to.replace('远机位等待区-', '')}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function TruckPanel({ towTractors, towTasks }) {
  return (
    <aside className="panel truck-panel">
      <div className="panel-title"><span>拖车资源状态</span><strong>{towTractors.length}</strong></div>
      <div className="truck-list">
        {towTractors.map((tractor) => {
          const task = towTasks.find((item) => item.tractorId === tractor.id);
          return (
            <article className="truck-card" key={tractor.id}>
              <div className="truck-top">
                <div><h3>{tractor.id}</h3><p>{task ? `${task.from} -> ${task.to}` : tractor.location}</p></div>
                <span className={`resource-dot ${task ? 'busy' : tractor.status === '充电待命' ? 'charge' : ''}`} />
              </div>
              <div className="truck-stats"><span>{task ? task.status : tractor.status}</span><span>{task ? `${timeLabel(task.end)} 完成` : `${timeLabel(tractor.availableAt)} 可用`}</span></div>
              <div className="battery"><span style={{ width: `${92 - towTractors.indexOf(tractor) * 8}%` }} /></div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function FlightForm({ form, title, eyebrow, submitText, onChange, onClose, onSubmit }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="flight-modal wide-modal" onSubmit={onSubmit}>
        <div className="modal-title"><div><span>{eyebrow}</span><h2>{title}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭">×</button></div>
        <label>航班号<input required value={form.flightNo} onChange={(event) => onChange({ ...form, flightNo: event.target.value.toUpperCase() })} /></label>
        <div className="form-row">
          <label>来源城市<input required value={form.origin} onChange={(event) => onChange({ ...form, origin: event.target.value })} /></label>
          <label>目的城市<input required value={form.destination} onChange={(event) => onChange({ ...form, destination: event.target.value })} /></label>
        </div>
        <div className="form-row">
          <label>到港时间<input required type="time" value={form.arrival} onChange={(event) => onChange({ ...form, arrival: event.target.value })} /></label>
          <label>离港时间<input required type="time" value={form.departure} onChange={(event) => onChange({ ...form, departure: event.target.value })} /></label>
        </div>
        <div className="form-row">
          <label>航司<input required value={form.airline} onChange={(event) => onChange({ ...form, airline: event.target.value.toUpperCase() })} /></label>
          <label>机型<select value={form.aircraftType} onChange={(event) => onChange({ ...form, aircraftType: event.target.value })}>{aircraftTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
        </div>
        <div className="form-row">
          <label>人工指定机位<select value={form.manualStandId} onChange={(event) => onChange({ ...form, manualStandId: event.target.value })}><option value="">系统自动分配</option>{standsData.map((stand) => <option value={stand.id} key={stand.id}>{stand.id} · {stand.type === 'near' ? '近' : '远'}</option>)}</select></label>
          <label>最小过站时间<input min="30" step="5" type="number" value={form.minTurn} onChange={(event) => onChange({ ...form, minTurn: Number(event.target.value) })} /></label>
        </div>
        <div className="constraint-grid">
          <label className="check-row"><input checked={form.allowRemote} type="checkbox" onChange={(event) => onChange({ ...form, allowRemote: event.target.checked })} />允许远机位</label>
          <label className="check-row"><input checked={form.allowTow} type="checkbox" onChange={(event) => onChange({ ...form, allowTow: event.target.checked })} />允许拖曳</label>
          <label className="check-row"><input checked={form.preferNear} type="checkbox" onChange={(event) => onChange({ ...form, preferNear: event.target.checked })} />近机位偏好</label>
          <label className="check-row"><input checked={form.locked} type="checkbox" onChange={(event) => onChange({ ...form, locked: event.target.checked })} />锁定当前机位</label>
        </div>
        <div className="modal-actions"><button type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit">{submitText}</button></div>
      </form>
    </div>
  );
}

function FlightDetailModal({ assignment, flight, onRestoreSystem, stand, towTask, onClose }) {
  const spec = aircraftCatalog[flight.aircraftType];
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="flight-modal wide-modal">
        <div className="modal-title"><div><span>Flight Detail</span><h2>{flight.flightNo}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭">×</button></div>
        <div className="detail-section-grid">
          <article className="detail-card"><h3>基础信息</h3><div className="detail-grid">
            <span>航班号</span><strong>{flight.flightNo}</strong>
            <span>航司</span><strong>{flight.airline}</strong>
            <span>机型</span><strong>{flight.aircraftType}</strong>
            <span>机型类别</span><strong>{spec.category}</strong>
            <span>来源/目的地</span><strong>{flight.origin} - {flight.destination}</strong>
            <span>到港时间</span><strong>{timeLabel(flight.arrival)}</strong>
            <span>离港时间</span><strong>{timeLabel(flight.departure)}</strong>
            <span>计划过站</span><strong>{flight.departure - flight.arrival} 分钟</strong>
            <span>最小过站</span><strong>{flight.minTurn} 分钟</strong>
          </div></article>
          <article className={`detail-card ${flight.issues.some((issue) => issue.highlight === 'manual') ? 'highlight-card' : ''}`}><h3>机位与运行约束</h3><div className="detail-grid">
            <span>当前机位</span><strong>{assignment?.standId || '待分配'}</strong>
            <span>分配状态</span><strong>{flight.status}</strong>
            <span>分配来源</span><strong>{assignment?.source === 'manual-adjust' ? '人工调整' : flight.locked ? '锁定机位' : flight.manualStandId ? '人工指定' : '系统分配'}</strong>
            <span>人工指定机位</span><strong>{flight.manualStandId || '无'}</strong>
            <span>锁定机位</span><strong>{flight.locked ? '是' : '否'}</strong>
            <span>允许近机位</span><strong>是</strong>
            <span>允许远机位</span><strong>{flight.allowRemote ? '是' : '否'}</strong>
            <span>允许拖曳</span><strong>{flight.allowTow ? '是' : '否'}</strong>
            <span>近机位偏好</span><strong>{flight.preferNear ? '高' : '普通'}</strong>
            <span>保障等级</span><strong>{wideAircraft.includes(flight.aircraftType) ? '高' : '常规'}</strong>
            <span>需要靠桥</span><strong>{flight.preferNear ? '是' : '否'}</strong>
          </div></article>
          <article className={`detail-card ${flight.issues.some((issue) => issue.highlight === 'compatibility') ? 'highlight-card' : ''}`}><h3>机型适配参数</h3><div className="detail-grid">
            <span>机身长度</span><strong>{spec.length}m</strong>
            <span>翼展</span><strong>{spec.wingspan}m</strong>
            <span>机位等级要求</span><strong>{spec.requiredStandClass} 类</strong>
            <span>特殊保障资源</span><strong>{spec.specialResources}</strong>
            <span>当前机位能力</span><strong>{stand ? `${stand.id} · ${stand.supportedCategories.join('/')} 类 · ${stand.maxWingspan}m / ${stand.maxLength}m` : '未分配'}</strong>
          </div></article>
          <article className="detail-card"><h3>拖曳相关参数</h3><div className="detail-grid">
            <span>生成拖曳任务</span><strong>{towTask ? '是' : '否'}</strong>
            <span>拖曳类型</span><strong>{towTask?.type || '-'}</strong>
            <span>起始机位</span><strong>{towTask?.from || '-'}</strong>
            <span>目标机位</span><strong>{towTask?.to || '-'}</strong>
            <span>拖曳开始</span><strong>{towTask ? timeLabel(towTask.start) : '-'}</strong>
            <span>拖曳结束</span><strong>{towTask ? timeLabel(towTask.end) : '-'}</strong>
            <span>拖车编号</span><strong>{towTask?.tractorId || '-'}</strong>
            <span>估计拖曳时间</span><strong>{towTask ? `${towTask.end - towTask.start} 分钟` : '-'}</strong>
            <span>拖曳原因</span><strong>{towTask?.reason || '-'}</strong>
          </div></article>
        </div>
        {assignment?.source === 'manual-adjust' && assignment.systemSnapshot && (
          <div className="modal-actions restore-actions">
            <button className="primary-button" type="button" onClick={() => onRestoreSystem(flight.id)}>恢复系统分配</button>
          </div>
        )}
        <div className="conflict-detail-list diagnosis-list">
          <h3>冲突诊断与建议</h3>
          {flight.issues.length ? flight.issues.map((issue, index) => (
            <article className="detail-card" key={`${issue.type}-${index}`}>
              <div className={`detail-grid ${issue.highlight === 'time' ? 'time-highlight' : ''}`}>
                <span>问题类型</span><strong>{issue.type}</strong>
                <span>问题分类</span><strong>{issue.category === 'conflict' ? '资源冲突（硬约束）' : '运行风险（预警）'}</strong>
                <span>冲突对象</span><strong>{issue.otherFlightId || issue.tractorId || issue.standId || '当前航班约束'}</strong>
                <span>冲突机位</span><strong>{issue.standId || flight.standId || '未分配'}</strong>
                <span>时间区间</span><strong>{issue.overlapStart ? `${timeLabel(issue.overlapStart)} - ${timeLabel(issue.overlapEnd)}` : `${timeLabel(flight.arrival)} - ${timeLabel(flight.departure)}`}</strong>
                <span>重叠分钟数</span><strong>{issue.overlapStart ? `${Math.max(issue.overlapEnd - issue.overlapStart, 0)} 分钟` : '不适用'}</strong>
                <span>原因说明</span><strong>{issue.message}</strong>
                <span>建议处理</span><strong>{issue.suggestion}</strong>
              </div>
            </article>
          )) : <div className="empty-state">当前航班无实时冲突。</div>}
        </div>
      </section>
    </div>
  );
}

function StandDetailModal({ assignments, flights, issues, onClose, stand, towTasks }) {
  const standAssignments = assignments.filter((item) => item.standId === stand.id);
  const occupiedMinutes = standAssignments.reduce((sum, item) => sum + item.occupyEnd - item.occupyStart, 0);
  const windows = [...standAssignments].sort((a, b) => a.occupyStart - b.occupyStart);
  const freeWindows = [];
  let cursor = timelineStartMinutes;
  windows.forEach((item) => {
    if (item.occupyStart > cursor) freeWindows.push(`${timeLabel(cursor)}-${timeLabel(item.occupyStart)}`);
    cursor = Math.max(cursor, item.occupyEnd);
  });
  if (cursor < timelineStartMinutes + timelineTotalMinutes) freeWindows.push(`${timeLabel(cursor)}-${timeLabel(timelineStartMinutes + timelineTotalMinutes)}`);
  const standIssues = issues.filter((issue) => issue.standId === stand.id);
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="flight-modal wide-modal">
        <div className="modal-title"><div><span>Stand Detail</span><h2>机位 {stand.id}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭">×</button></div>
        <div className="detail-section-grid">
          <article className="detail-card"><h3>基础信息</h3><div className="detail-grid">
            <span>机位编号</span><strong>{stand.id}</strong>
            <span>类型</span><strong>{stand.type === 'near' ? '近机位' : '远机位'}</strong>
            <span>所属区域</span><strong>{stand.terminal} · 指廊 {stand.pier}</strong>
            <span>是否可用</span><strong>{stand.available ? '可用' : '停用'}</strong>
            <span>靠桥机位</span><strong>{stand.bridge ? '是' : '否'}</strong>
            <span>摆渡需求</span><strong>{stand.bridge ? '无需摆渡' : '需摆渡，不可靠桥'}</strong>
          </div></article>
          <article className={standIssues.some((issue) => issue.highlight === 'compatibility') ? 'detail-card highlight-card' : 'detail-card'}><h3>适配能力</h3><div className="detail-grid">
            <span>支持类别</span><strong>{stand.supportedCategories.join('/')}</strong>
            <span>最大翼展</span><strong>{stand.maxWingspan}m</strong>
            <span>最大机身长度</span><strong>{stand.maxLength}m</strong>
            <span>支持宽体</span><strong>{stand.supportedCategories.includes('E') ? '是' : '否'}</strong>
            <span>支持拖曳进出</span><strong>{stand.towInOut ? '是' : '否'}</strong>
            <span>相邻限制</span><strong>{stand.adjacentRestrictions.length ? stand.adjacentRestrictions.join('、') : '无'}</strong>
          </div></article>
          <article className="detail-card"><h3>运行约束</h3><div className="detail-grid">
            <span>当前占用航班</span><strong>{standAssignments.map((item) => flights.find((flight) => flight.id === item.flightId)?.flightNo).join('、') || '无'}</strong>
            <span>占用时间段</span><strong>{standAssignments.map((item) => `${timeLabel(item.occupyStart)}-${timeLabel(item.occupyEnd)}`).join('、') || '无'}</strong>
            <span>空闲窗口</span><strong>{freeWindows.join('、') || '无'}</strong>
            <span>机位利用率</span><strong>{Math.round((occupiedMinutes / timelineTotalMinutes) * 100)}%</strong>
            <span>冲突占用</span><strong>{standIssues.some((issue) => issue.category === 'conflict') ? '是' : '否'}</strong>
            <span>人工指定导致冲突</span><strong>{standIssues.some((issue) => issue.highlight === 'manual') ? '是' : '否'}</strong>
            <span>相关拖曳任务</span><strong>{towTasks.filter((task) => task.from === stand.id || task.to === stand.id).length}</strong>
          </div></article>
        </div>
      </section>
    </div>
  );
}

function ConflictResolveModal({ flights, issues, onClose, onResolve }) {
  const conflictIds = [...new Set(issues.filter((issue) => issue.category === 'conflict').map((issue) => issue.flightId))];
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="flight-modal wide-modal">
        <div className="modal-title"><div><span>Local Resolution</span><h2>冲突消解</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭">×</button></div>
        {conflictIds.length ? conflictIds.map((id) => {
          const flight = flights.find((item) => item.id === id);
          return (
            <article className="detail-card conflict-action-card" key={id}>
              <div><h3>{flight.flightNo}</h3><p>{flight.issues.map((issue) => issue.type).join('、')}</p></div>
              <div className="inline-actions">
                <button type="button" onClick={() => onResolve(id, 'delay')}>延后起飞</button>
                <button type="button" onClick={() => onResolve(id, 'stand')}>更换机位</button>
                <button type="button" onClick={() => onResolve(id, 'cancel')}>取消处理</button>
              </div>
            </article>
          );
        }) : <div className="empty-state">当前没有冲突航班。</div>}
      </section>
    </div>
  );
}

function TowingDispatchModal({ flights, towTractors, towTasks, onAssignTow, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="flight-modal wide-modal">
        <div className="modal-title"><div><span>Towing Dispatch</span><h2>拖车派遣</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭">×</button></div>
        <div className="dispatch-grid">
          <div><h3>拖车资源</h3><div className="dispatch-list">{towTractors.map((tractor) => <article className="detail-card" key={tractor.id}><h3>{tractor.id}</h3><p>{tractor.location} · {timeLabel(tractor.availableAt)} 可用</p></article>)}</div></div>
          <div><h3>拖曳任务</h3><div className="dispatch-list">{towTasks.length ? towTasks.map((task) => {
            const flight = flights.find((item) => item.id === task.flightId);
            return (
              <article className="detail-card tow-assignment" key={task.id}>
                <div>
                  <h3>{flight.flightNo}</h3>
                  <p>{task.type} · {task.from} - {task.to} · {timeLabel(task.start)} - {timeLabel(task.end)} · {task.status}</p>
                  <p>{task.reason} · 预计 {task.end - task.start} 分钟</p>
                </div>
                <select value={task.tractorId} onChange={(event) => onAssignTow(task.id, event.target.value)}>
                  <option value="">待派遣</option>{towTractors.map((tractor) => <option value={tractor.id} key={tractor.id}>{tractor.id}</option>)}
                </select>
              </article>
            );
          }) : <div className="empty-state">当前方案未生成拖曳任务。</div>}</div></div>
        </div>
      </section>
    </div>
  );
}

const initialFlights = buildMockFlights();
const initialPlan = optimizeAssignments(initialFlights, [], { mode: 'global' });
const initialTowTasks = generateTowTasks(initialFlights, initialPlan.assignments, towTractorsData);

export default function App() {
  const [flights, setFlights] = useState(initialFlights);
  const [assignments, setAssignments] = useState(initialPlan.assignments);
  const [towTasks, setTowTasks] = useState(initialTowTasks);
  const [towTractors] = useState(towTractorsData);
  const [form, setForm] = useState(initialForm);
  const [editForm, setEditForm] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isTowingOpen, setIsTowingOpen] = useState(false);
  const [selectedFlightId, setSelectedFlightId] = useState(null);
  const [selectedStandId, setSelectedStandId] = useState(null);
  const [operationMessage, setOperationMessage] = useState('');
  const [activeDropStand, setActiveDropStand] = useState(null);
  const [draggingFlightId, setDraggingFlightId] = useState(null);
  const flightRefs = useRef({});
  const blockRefs = useRef({});
  const standRefs = useRef({});

  const issues = useMemo(() => detectConflicts(flights, assignments, towTasks), [flights, assignments, towTasks]);
  const displayFlights = useMemo(() => decorateFlights(flights, assignments, issues), [flights, assignments, issues]);
  const metrics = useMemo(() => calculateMetrics(flights, assignments, towTasks, issues), [flights, assignments, towTasks, issues]);

  function rerunPlan(nextFlights, nextAssignments = assignments, options = { mode: 'global' }) {
    const beforeIssues = detectConflicts(flights, assignments, towTasks).length;
    const plan = optimizeAssignments(nextFlights, nextAssignments, options);
    const tasks = generateTowTasks(nextFlights, plan.assignments, towTractors);
    const afterIssues = detectConflicts(nextFlights, plan.assignments, tasks).length;
    setFlights(nextFlights);
    setAssignments(plan.assignments);
    setTowTasks(tasks);
    return { plan, tasks, beforeIssues, afterIssues };
  }

  function normalizeForm(source) {
    const arrival = parseTime(source.arrival);
    const departure = Math.max(parseTime(source.departure), arrival + Number(source.minTurn || 60));
    return { arrival, departure };
  }

  function handleAddFlight(event) {
    event.preventDefault();
    const { arrival, departure } = normalizeForm(form);
    const nextFlights = [...flights, {
      id: `F-${Date.now()}`,
      flightNo: form.flightNo || `NX${9000 + flights.length}`,
      airline: form.airline,
      aircraftType: form.aircraftType,
      arrival,
      departure,
      origin: form.origin,
      destination: form.destination,
      allowRemote: form.allowRemote,
      allowTow: form.allowTow,
      preferNear: form.preferNear,
      minTurn: Number(form.minTurn) || 60,
      manualStandId: form.manualStandId,
      locked: form.locked,
      baseStatus: '待优化',
      isNew: true,
    }];
    setFlights(nextFlights);
    setForm(initialForm);
    setIsAddOpen(false);
    setOperationMessage('新增航班已进入待优化队列，点击自动重排可生成机位方案。');
  }

  function openEditFlight(flightId) {
    const flight = flights.find((item) => item.id === flightId);
    if (!flight) return;
    setEditForm({
      ...initialForm,
      ...flight,
      arrival: timeInputValue(flight.arrival),
      departure: timeInputValue(flight.departure),
    });
  }

  function handleEditFlight(event) {
    event.preventDefault();
    const { arrival, departure } = normalizeForm(editForm);
    const nextFlights = flights.map((flight) => (
      flight.id === editForm.id
        ? { ...flight, ...editForm, arrival, departure, minTurn: Number(editForm.minTurn) || 60, baseStatus: '待优化' }
        : flight
    ));
    rerunPlan(nextFlights, assignments, { mode: 'global' });
    setEditForm(null);
  }

  function handleAutoReassign() {
    const unlockedAssignments = assignments.filter((assignment) => flights.find((flight) => flight.id === assignment.flightId)?.locked);
    const manualAdjustedBefore = assignments.filter((assignment) => assignment.source === 'manual-adjust' && !flights.find((flight) => flight.id === assignment.flightId)?.locked).length;
    const result = rerunPlan(flights, unlockedAssignments, { mode: 'global' });
    const adjusted = result.plan.assignments.filter((assignment) => {
      const before = assignments.find((item) => item.flightId === assignment.flightId);
      return before?.standId !== assignment.standId || before?.mode !== assignment.mode;
    }).length;
    const bridgeRate = calculateMetrics(flights, result.plan.assignments, result.tasks, detectConflicts(flights, result.plan.assignments, result.tasks)).bridgeRate;
    setOperationMessage(`本次自动重排共调整 ${adjusted} 个航班，消除 ${Math.max(result.beforeIssues - result.afterIssues, 0)} 个冲突，新增 ${result.tasks.length} 个拖曳任务，近机位靠桥率提升至 ${bridgeRate}%。本次自动重排覆盖了 ${manualAdjustedBefore} 个人工调整航班。${result.plan.unresolved.length ? ` 待解：${result.plan.unresolved.join('、')}` : ''}`);
  }

  function handleResolveConflict(flightId, action) {
    if (action === 'cancel') {
      setOperationMessage('已取消本次局部处理。');
      return;
    }
    const relatedIds = new Set([flightId]);
    issues.filter((issue) => issue.flightId === flightId && issue.otherFlightId).forEach((issue) => relatedIds.add(issue.otherFlightId));
    let nextFlights = flights;
    if (action === 'delay') {
      nextFlights = flights.map((flight) => (flight.id === flightId ? { ...flight, departure: flight.departure + 20, baseStatus: '待优化' } : flight));
    }
    const result = rerunPlan(nextFlights, assignments, { mode: 'local', scopeIds: relatedIds });
    setOperationMessage(`局部冲突消解完成，处理 ${relatedIds.size} 个相关航班，剩余冲突 ${result.afterIssues} 个。`);
  }

  function handleAssignTow(taskId, tractorId) {
    setTowTasks((current) => current.map((task) => (task.id === taskId ? { ...task, tractorId, status: tractorId ? '已派遣' : '待派遣' } : task)));
    setOperationMessage(`${taskId} 已更新拖车派遣。`);
  }

  function handleOpenTowingDispatch() {
    const nextTasks = assignTowTractors(towTasks.map((task) => ({ ...task, tractorId: '', status: '待执行' })), towTractors);
    setTowTasks(nextTasks);
    setIsTowingOpen(true);
    const pending = nextTasks.filter((task) => task.status === '冲突待解').length;
    setOperationMessage(
      nextTasks.length === 0
        ? '当前未生成拖曳任务：可能没有远机位航班、没有近机位转远机位任务，或当前冲突属于机位时间/相邻机位限制。请先执行自动重排，或手动将适合航班调整至远机位后再生成拖曳任务。'
        : pending > 0
        ? `当前拖车资源不足，${pending} 个任务待派遣。`
        : `拖车派遣已完成，当前生成 ${nextTasks.length} 个拖曳任务。`,
    );
  }

  function handleRestoreSystemAssignment(flightId) {
    const current = assignments.find((assignment) => assignment.flightId === flightId);
    if (!current?.systemSnapshot) return;
    const restored = current.systemSnapshot;
    const nextAssignments = assignments.map((assignment) => (
      assignment.flightId === flightId
        ? { ...restored, source: 'system' }
        : assignment
    ));
    const nextTowTasks = generateTowTasks(flights, nextAssignments, towTractors);
    setAssignments(nextAssignments);
    setTowTasks(nextTowTasks);
    setOperationMessage(`${flights.find((flight) => flight.id === flightId)?.flightNo} 已恢复到系统分配方案。`);
  }

  function handleDragStart(event, flight) {
    if (flight.locked) return;
    setDraggingFlightId(flight.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', flight.id);
  }

  function handleDropFlight(event, standId) {
    event.preventDefault();
    const flightId = event.dataTransfer.getData('text/plain');
    const flight = flights.find((item) => item.id === flightId);
    if (!flight) return;
    if (flight.locked) {
      setOperationMessage(`${flight.flightNo} 已锁定机位，不能人工拖拽调整。`);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const duration = flight.departure - flight.arrival;
    const nextArrival = timelineStartMinutes + clamp(snapToTenMinutes(((event.clientX - rect.left) / rect.width) * timelineTotalMinutes), 0, timelineTotalMinutes - duration);
    const stand = standsData.find((item) => item.id === standId);
    const currentAssignment = assignments.find((assignment) => assignment.flightId === flightId);
    const manualAssignment = {
      ...(currentAssignment || createAssignment(flight, stand)),
      flightId,
      standId,
      occupyStart: nextArrival,
      occupyEnd: nextArrival + duration,
      mode: 'single',
      source: 'manual-adjust',
      status: 'assigned',
      systemSnapshot: currentAssignment?.source === 'manual-adjust' ? currentAssignment.systemSnapshot : currentAssignment,
    };
    const reasons = explainManualMove(flight, stand, manualAssignment, assignments, flights);
    const nextFlights = flights.map((item) => (item.id === flightId ? { ...item, arrival: nextArrival, departure: nextArrival + duration, baseStatus: '人工调整' } : item));
    const nextAssignments = assignments.some((assignment) => assignment.flightId === flightId)
      ? assignments.map((assignment) => (assignment.flightId === flightId ? manualAssignment : assignment))
      : [...assignments, manualAssignment];
    const nextTowTasks = generateTowTasks(nextFlights, nextAssignments, towTractors);
    setFlights(nextFlights);
    setAssignments(nextAssignments);
    setTowTasks(nextTowTasks);
    setOperationMessage(
      reasons.length
        ? `人工调整已应用，但存在不可行风险：${reasons.join('；')}。`
        : `${flight.flightNo} 已人工调整至 ${standId}，冲突检测和指标已刷新。`,
    );
    setDraggingFlightId(null);
    setActiveDropStand(null);
  }

  const selectedFlight = displayFlights.find((flight) => flight.id === selectedFlightId);
  const selectedAssignment = assignments.find((assignment) => assignment.flightId === selectedFlightId);
  const selectedFlightStand = standsData.find((stand) => stand.id === selectedAssignment?.standId);
  const selectedTowTask = towTasks.find((task) => task.flightId === selectedFlightId);

  useEffect(() => {
    if (!selectedFlightId) return;
    flightRefs.current[selectedFlightId]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    blockRefs.current[selectedFlightId]?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  }, [selectedFlightId]);

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <div><p className="eyebrow">Airport Stand & Towing Optimization</p><h1>机位分配与拖曳调度优化闭环</h1></div>
        <div className="kpi-strip">
          <div><span>机位利用率</span><strong>{metrics.utilization}%</strong></div>
          <div><span>冲突数量</span><strong>{metrics.conflicts}</strong></div>
          <div><span>硬冲突航班</span><strong>{metrics.unresolved}</strong></div>
          <div><span>拖曳任务</span><strong>{metrics.towTasks}</strong></div>
          <div><span>远机位航班</span><strong>{metrics.remoteFlights}</strong></div>
          <div><span>拖车利用率</span><strong>{metrics.towUtilization}%</strong></div>
          <div><span>近机位靠桥率</span><strong>{metrics.bridgeRate}%</strong></div>
          <div><span>平均周转</span><strong>{metrics.avgTurn}m</strong></div>
        </div>
      </header>
      <section className="command-bar">
        <button className="primary-button" type="button" onClick={() => setIsAddOpen(true)}>新增航班</button>
        <button type="button" onClick={handleAutoReassign}>自动重排</button>
        <button type="button" onClick={() => setIsResolveOpen(true)}>冲突消解</button>
        <button type="button" onClick={handleOpenTowingDispatch}>拖车派遣</button>
        <div className="live-indicator"><span />优化闭环运行中</div>
      </section>
      {operationMessage && <div className="operation-message"><span>{operationMessage}</span><button type="button" onClick={() => setOperationMessage('')}>关闭</button></div>}
      <div className="dashboard-grid">
        <FlightList flightRefs={flightRefs} flights={displayFlights} selectedFlightId={selectedFlightId} onEditFlight={openEditFlight} onOpenDetail={setSelectedFlightId} />
        <Timeline
          activeDropStand={activeDropStand}
          assignments={assignments}
          blockRefs={blockRefs}
          draggingFlightId={draggingFlightId}
          flights={displayFlights}
          selectedFlightId={selectedFlightId}
          standRefs={standRefs}
          towTasks={towTasks}
          onDragEnd={() => { setDraggingFlightId(null); setActiveDropStand(null); }}
          onDragStart={handleDragStart}
          onDropFlight={handleDropFlight}
          onOpenDetail={setSelectedFlightId}
          onOpenStand={setSelectedStandId}
          onSetActiveDropStand={setActiveDropStand}
        />
        <TruckPanel towTractors={towTractors} towTasks={towTasks} />
      </div>
      {isAddOpen && <FlightForm form={form} title="新增航班" eyebrow="Flight Input" submitText="加入优化队列" onChange={setForm} onClose={() => setIsAddOpen(false)} onSubmit={handleAddFlight} />}
      {editForm && <FlightForm form={editForm} title={`编辑航班 ${editForm.flightNo}`} eyebrow="Flight Edit" submitText="保存并重算" onChange={setEditForm} onClose={() => setEditForm(null)} onSubmit={handleEditFlight} />}
      {selectedFlight && <FlightDetailModal assignment={selectedAssignment} flight={selectedFlight} onRestoreSystem={handleRestoreSystemAssignment} stand={selectedFlightStand} towTask={selectedTowTask} onClose={() => setSelectedFlightId(null)} />}
      {selectedStandId && <StandDetailModal assignments={assignments} flights={displayFlights} issues={issues} stand={standsData.find((stand) => stand.id === selectedStandId)} towTasks={towTasks} onClose={() => setSelectedStandId(null)} />}
      {isResolveOpen && <ConflictResolveModal flights={displayFlights} issues={issues} onClose={() => setIsResolveOpen(false)} onResolve={handleResolveConflict} />}
      {isTowingOpen && <TowingDispatchModal flights={displayFlights} towTractors={towTractors} towTasks={towTasks} onAssignTow={handleAssignTow} onClose={() => setIsTowingOpen(false)} />}
    </div>
  );
}
