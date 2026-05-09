import { useMemo, useState } from 'react';

const stands = ['101', '102', '103', '104', '105', '106', '201', '202'];
const airlines = ['CA', 'MU', 'CZ', 'HU', '3U', 'MF', 'ZH', 'SC'];
const cities = ['北京', '上海', '成都', '广州', '深圳', '杭州', '重庆', '昆明', '西安', '青岛'];
const aircraft = ['A320', 'A321', 'B737', 'B738', 'A330', 'B787'];
const truckNames = ['TOW-01', 'TOW-02', 'TOW-03', 'TOW-04', 'TOW-05', 'TOW-06'];

const startHour = 6;
const hourCount = 16;
const timelineHours = Array.from({ length: hourCount + 1 }, (_, index) => startHour + index);

const pad = (value) => String(value).padStart(2, '0');

function timeLabel(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${pad(hour)}:${pad(minute)}`;
}

function parseTime(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function generateMockData() {
  const flights = Array.from({ length: 18 }, (_, index) => {
    const arrival = 6 * 60 + 20 + index * 42 + (index % 4) * 7;
    const turn = 62 + (index % 5) * 12;
    const stand = stands[(index * 3 + Math.floor(index / 2)) % stands.length];
    const needsTow = index % 3 !== 1;
    const towingStart = arrival + turn + 8;

    return {
      id: `${airlines[index % airlines.length]}${1200 + index * 17}`,
      city: cities[(index * 2 + 1) % cities.length],
      aircraft: aircraft[index % aircraft.length],
      stand,
      arrival,
      departure: arrival + turn,
      status: index % 6 === 0 ? '冲突待解' : index % 4 === 0 ? '拖曳中' : index % 5 === 0 ? '延误风险' : '已分配',
      priority: index % 5 === 0 ? '高' : index % 4 === 0 ? '中' : '常规',
      needsTow,
      towing: needsTow
        ? {
            truck: truckNames[index % truckNames.length],
            from: stand,
            to: index % 2 === 0 ? `远机位 R${20 + index}` : `维修坪 M${index % 4 + 1}`,
            start: towingStart,
            end: towingStart + 24 + (index % 3) * 6,
          }
        : null,
    };
  });

  return { flights };
}

function generateTruckData(flights) {
  return truckNames.map((name, index) => {
    const activeJob = flights.find((flight) => flight.towing?.truck === name && index % 2 === flight.id.length % 2);
    return {
      name,
      battery: 92 - index * 8,
      driver: ['李航', '王磊', '张辰', '陈越', '赵宁', '周岩'][index],
      status: activeJob ? '执行任务' : index === 4 ? '充电待命' : '可派遣',
      location: activeJob ? `${activeJob.stand} -> ${activeJob.towing.to}` : index === 4 ? '保障区 C' : `拖车点 ${index + 1}`,
      eta: activeJob ? `${timeLabel(activeJob.towing.end)} 完成` : index === 4 ? '18 分钟后可用' : '即时响应',
      load: activeJob ? 76 + index * 3 : index === 4 ? 34 : 12 + index * 7,
    };
  });
}

const { flights: initialFlights } = generateMockData();
const initialForm = {
  id: '',
  arrival: '10:30',
  departure: '11:45',
  aircraft: 'A320',
  stand: '101',
};

function getFlightPosition(flight) {
  const totalMinutes = hourCount * 60;
  const start = Math.max(flight.arrival - startHour * 60, 0);
  const duration = Math.max(flight.departure - flight.arrival, 36);
  return {
    left: `${(start / totalMinutes) * 100}%`,
    width: `${(duration / totalMinutes) * 100}%`,
  };
}

function getTowPosition(towing) {
  const totalMinutes = hourCount * 60;
  const start = Math.max(towing.start - startHour * 60, 0);
  const duration = Math.max(towing.end - towing.start, 18);
  return {
    left: `${(start / totalMinutes) * 100}%`,
    width: `${(duration / totalMinutes) * 100}%`,
  };
}

function StatusPill({ value }) {
  const tone = value.includes('冲突') ? 'danger' : value.includes('延误') ? 'warn' : value.includes('拖曳') || value.includes('新增') ? 'active' : 'ok';
  return <span className={`pill ${tone}`}>{value}</span>;
}

function FlightList({ flights }) {
  return (
    <aside className="panel flight-panel">
      <div className="panel-title">
        <span>航班列表</span>
        <strong>{flights.length}</strong>
      </div>
      <div className="flight-list">
        {flights.map((flight) => (
          <article className={`flight-card ${flight.isNew ? 'new-flight' : ''}`} key={flight.id}>
            <div className="flight-card-top">
              <div>
                <h3>{flight.id}</h3>
                <p>{flight.city} · {flight.aircraft}</p>
              </div>
              <StatusPill value={flight.status} />
            </div>
            <div className="flight-meta">
              <span>到港 {timeLabel(flight.arrival)}</span>
              <span>离港 {timeLabel(flight.departure)}</span>
              <span>机位 {flight.stand}</span>
            </div>
            <div className="flight-progress">
              <span style={{ width: `${64 + (flight.id.charCodeAt(2) % 24)}%` }} />
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function Timeline({ flights }) {
  return (
    <main className="panel timeline-panel">
      <div className="panel-title timeline-heading">
        <span>机位时间轴</span>
        <div className="legend">
          <span><i className="legend-dot assigned" />占用</span>
          <span><i className="legend-dot tow" />拖曳</span>
          <span><i className="legend-dot alert" />风险</span>
        </div>
      </div>

      <div className="time-ruler">
        {timelineHours.map((hour) => (
          <span key={hour}>{pad(hour)}:00</span>
        ))}
      </div>

      <div className="stand-grid">
        {stands.map((stand) => {
          const standFlights = flights.filter((flight) => flight.stand === stand);
          return (
            <section className="stand-row" key={stand}>
              <div className="stand-label">
                <strong>{stand}</strong>
                <span>{stand.startsWith('1') ? '近机位' : '远机位'}</span>
              </div>
              <div className="lane">
                {standFlights.map((flight) => (
                  <div
                    className={`flight-block ${flight.status === '冲突待解' ? 'conflict' : ''} ${flight.isNew ? 'new-flight' : ''}`}
                    key={flight.id}
                    style={getFlightPosition(flight)}
                    title={`${flight.id} ${timeLabel(flight.arrival)}-${timeLabel(flight.departure)}`}
                  >
                    <b>{flight.id}</b>
                    <span>{timeLabel(flight.arrival)}-{timeLabel(flight.departure)}</span>
                  </div>
                ))}
                {standFlights.filter((flight) => flight.towing).map((flight) => (
                  <div className="tow-block" key={`${flight.id}-tow`} style={getTowPosition(flight.towing)}>
                    {flight.towing.truck}
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

function TruckPanel({ trucks }) {
  return (
    <aside className="panel truck-panel">
      <div className="panel-title">
        <span>拖车资源状态</span>
        <strong>{trucks.filter((truck) => truck.status === '可派遣').length}/{trucks.length}</strong>
      </div>
      <div className="truck-list">
        {trucks.map((truck) => (
          <article className="truck-card" key={truck.name}>
            <div className="truck-top">
              <div>
                <h3>{truck.name}</h3>
                <p>{truck.driver} · {truck.location}</p>
              </div>
              <span className={`resource-dot ${truck.status === '执行任务' ? 'busy' : truck.status === '充电待命' ? 'charge' : ''}`} />
            </div>
            <div className="truck-stats">
              <span>{truck.status}</span>
              <span>{truck.eta}</span>
            </div>
            <div className="battery">
              <span style={{ width: `${truck.battery}%` }} />
            </div>
            <div className="load-line">
              <span>任务负载</span>
              <strong>{truck.load}%</strong>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function AddFlightModal({ form, onChange, onClose, onSubmit }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="flight-modal" onSubmit={onSubmit}>
        <div className="modal-title">
          <div>
            <span>Flight Insert</span>
            <h2>新增航班</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">×</button>
        </div>

        <label>
          航班号
          <input
            required
            value={form.id}
            placeholder="例如 CA1888"
            onChange={(event) => onChange({ ...form, id: event.target.value.toUpperCase() })}
          />
        </label>

        <div className="form-row">
          <label>
            到港时间
            <input
              required
              type="time"
              value={form.arrival}
              onChange={(event) => onChange({ ...form, arrival: event.target.value })}
            />
          </label>
          <label>
            离港时间
            <input
              required
              type="time"
              value={form.departure}
              onChange={(event) => onChange({ ...form, departure: event.target.value })}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            机型
            <select value={form.aircraft} onChange={(event) => onChange({ ...form, aircraft: event.target.value })}>
              {aircraft.map((item) => (
                <option value={item} key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            分配机位
            <select value={form.stand} onChange={(event) => onChange({ ...form, stand: event.target.value })}>
              {stands.map((stand) => (
                <option value={stand} key={stand}>{stand}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="submit">提交航班</button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [flights, setFlights] = useState(initialFlights);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const trucks = useMemo(() => generateTruckData(flights), [flights]);
  const conflicts = flights.filter((flight) => flight.status === '冲突待解' || flight.status === '延误风险').length;
  const towingJobs = flights.filter((flight) => flight.needsTow).length;

  function handleAddFlight(event) {
    event.preventDefault();

    const arrival = parseTime(form.arrival);
    let departure = parseTime(form.departure);
    if (departure <= arrival) {
      departure = arrival + 90;
    }

    const newFlight = {
      id: form.id.trim() || `NX${9000 + flights.length}`,
      city: '新增计划',
      aircraft: form.aircraft,
      stand: form.stand,
      arrival,
      departure,
      status: '新增航班',
      priority: '常规',
      needsTow: false,
      towing: null,
      isNew: true,
    };

    setFlights((currentFlights) => [...currentFlights, newFlight].sort((a, b) => a.arrival - b.arrival));
    setForm(initialForm);
    setIsModalOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Airport Stand & Towing Scheduler</p>
          <h1>机场机位分配与拖曳调度指挥台</h1>
        </div>
        <div className="kpi-strip">
          <div>
            <span>机位利用率</span>
            <strong>82%</strong>
          </div>
          <div>
            <span>拖曳任务</span>
            <strong>{towingJobs}</strong>
          </div>
          <div>
            <span>风险告警</span>
            <strong>{conflicts}</strong>
          </div>
          <div>
            <span>平均周转</span>
            <strong>74m</strong>
          </div>
        </div>
      </header>

      <section className="command-bar">
        <button className="primary-button" type="button" onClick={() => setIsModalOpen(true)}>新增航班</button>
        <button type="button">自动重排</button>
        <button type="button">冲突消解</button>
        <button type="button">拖车派遣</button>
        <div className="live-indicator"><span />实时仿真运行中</div>
      </section>

      <div className="dashboard-grid">
        <FlightList flights={flights} />
        <Timeline flights={flights} />
        <TruckPanel trucks={trucks} />
      </div>

      {isModalOpen && (
        <AddFlightModal
          form={form}
          onChange={setForm}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleAddFlight}
        />
      )}
    </div>
  );
}
