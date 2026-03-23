import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import SectionCard from "../components/SectionCard";
import StatusMessage from "../components/StatusMessage";
import { useAuth } from "../context/AuthContext";
import { patientApi } from "../services/api";
import { getTodayDateValue, getTomorrowDateValue } from "../services/date";
import { formatTimeLabel } from "../services/time";

const SLOT_REFRESH_INTERVAL_MS = 15000;
const APPOINTMENT_REFRESH_INTERVAL_MS = 30000;
const ACTIVE_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 10;
const EMPTY_PAGINATION = {
  total: 0,
  page: 1,
  pageSize: HISTORY_PAGE_SIZE,
  totalPages: 1,
};
const DEFAULT_HISTORY_FILTERS = {
  status: "ALL",
  fromDate: "",
  toDate: "",
  page: 1,
};

function getDailyLimitMessage(appointment) {
  if (!appointment) {
    return "";
  }

  const appointmentTime = formatTimeLabel(appointment.time);

  if (appointment.status === "BOOKED") {
    return `You already have a booked appointment with ${appointment.doctor.name} on ${appointment.date} at ${appointmentTime}. Cancel it before booking another slot on this date.`;
  }

  return `Only one appointment per day is allowed. You already had an appointment with ${appointment.doctor.name} on ${appointment.date} at ${appointmentTime}.`;
}

function AppointmentTable({ appointments, emptyMessage, onCancel, isLoading }) {
  if (isLoading) {
    return <p className="empty-state">Loading appointments...</p>;
  }

  if (appointments.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Doctor</th>
            <th>Date</th>
            <th>Time</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td>{appointment.doctor.name}</td>
              <td>{appointment.date}</td>
              <td>{formatTimeLabel(appointment.time)}</td>
              <td>
                <span className={`status-pill status-${appointment.status.toLowerCase()}`}>
                  {appointment.status}
                </span>
              </td>
              <td>
                {appointment.status === "BOOKED" ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onCancel(appointment.id)}
                  >
                    Cancel
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildHistoryQuery(filters) {
  return {
    view: "history",
    page: filters.page,
    pageSize: HISTORY_PAGE_SIZE,
    status: filters.status === "ALL" ? undefined : filters.status,
    fromDate: filters.fromDate || undefined,
    toDate: filters.toDate || undefined,
  };
}

function PatientDashboard() {
  const { auth } = useAuth();
  const lastBookableDate = getTomorrowDateValue();
  const [doctors, setDoctors] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [historyAppointments, setHistoryAppointments] = useState([]);
  const [historyPagination, setHistoryPagination] = useState(EMPTY_PAGINATION);
  const [historyFilters, setHistoryFilters] = useState(DEFAULT_HISTORY_FILTERS);
  const [selectedDateBookedAppointment, setSelectedDateBookedAppointment] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayDateValue());
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [bookingTime, setBookingTime] = useState("");
  const [notice, setNotice] = useState(null);

  async function loadDoctors() {
    const response = await patientApi.listDoctors(auth.token);
    setDoctors(response.doctors);
  }

  async function loadAppointmentSections() {
    const [todayResponse, upcomingResponse, historyResponse] = await Promise.all([
      patientApi.listAppointments(auth.token, {
        view: "today",
        page: 1,
        pageSize: ACTIVE_PAGE_SIZE,
      }),
      patientApi.listAppointments(auth.token, {
        view: "upcoming",
        page: 1,
        pageSize: ACTIVE_PAGE_SIZE,
      }),
      patientApi.listAppointments(auth.token, buildHistoryQuery(historyFilters)),
    ]);

    setTodayAppointments(todayResponse.appointments);
    setUpcomingAppointments(upcomingResponse.appointments);
    setHistoryAppointments(historyResponse.appointments);
    setHistoryPagination(historyResponse.pagination);
  }

  async function loadSelectedDateBooking(date) {
    if (!date) {
      setSelectedDateBookedAppointment(null);
      return;
    }

    const response = await patientApi.listAppointments(auth.token, {
      view: "all",
      fromDate: date,
      toDate: date,
      page: 1,
      pageSize: HISTORY_PAGE_SIZE,
    });

    setSelectedDateBookedAppointment(
      response.appointments.find((appointment) => appointment.status !== "CANCELLED") || null
    );
  }

  async function loadSlots(doctorId, date) {
    if (!doctorId || !date) {
      setSlots([]);
      return;
    }

    const response = await patientApi.getSlots(auth.token, doctorId, date);
    setSlots(response.slots);
  }

  useEffect(() => {
    async function initializeDoctors() {
      setLoadingDoctors(true);

      try {
        await loadDoctors();
      } catch (requestError) {
        setNotice({ type: "error", text: requestError.message });
      } finally {
        setLoadingDoctors(false);
      }
    }

    initializeDoctors();
  }, [auth.token]);

  useEffect(() => {
    async function initializeAppointments() {
      setLoadingAppointments(true);

      try {
        await loadAppointmentSections();
      } catch (requestError) {
        setNotice({ type: "error", text: requestError.message });
      } finally {
        setLoadingAppointments(false);
      }
    }

    initializeAppointments();
  }, [
    auth.token,
    historyFilters.page,
    historyFilters.status,
    historyFilters.fromDate,
    historyFilters.toDate,
  ]);

  useEffect(() => {
    if (!selectedDoctorId && doctors.length > 0) {
      setSelectedDoctorId(String(doctors[0].id));
    }
  }, [doctors, selectedDoctorId]);

  useEffect(() => {
    async function refreshSelectedDateData() {
      try {
        setBookingTime("");
        await Promise.all([
          loadSlots(selectedDoctorId, selectedDate),
          loadSelectedDateBooking(selectedDate),
        ]);
      } catch (requestError) {
        setSlots([]);
        setSelectedDateBookedAppointment(null);
        setNotice({ type: "error", text: requestError.message });
      }
    }

    refreshSelectedDateData();
  }, [auth.token, selectedDate, selectedDoctorId]);

  useEffect(() => {
    if (!selectedDoctorId || selectedDate !== getTodayDateValue()) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      Promise.all([
        loadSlots(selectedDoctorId, selectedDate),
        loadSelectedDateBooking(selectedDate),
      ]).catch((requestError) => {
        setSlots([]);
        setSelectedDateBookedAppointment(null);
        setNotice({ type: "error", text: requestError.message });
      });
    }, SLOT_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [auth.token, selectedDate, selectedDoctorId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadAppointmentSections().catch((requestError) => {
        setNotice({ type: "error", text: requestError.message });
      });
    }, APPOINTMENT_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    auth.token,
    historyFilters.page,
    historyFilters.status,
    historyFilters.fromDate,
    historyFilters.toDate,
  ]);

  function handleHistoryFilterChange(event) {
    const { name, value } = event.target;
    setHistoryFilters((current) => ({
      ...current,
      [name]: value,
      page: 1,
    }));
  }

  function clearHistoryFilters() {
    setHistoryFilters(DEFAULT_HISTORY_FILTERS);
  }

  async function refreshAllAppointmentData() {
    await Promise.all([
      loadAppointmentSections(),
      loadSelectedDateBooking(selectedDate),
      loadSlots(selectedDoctorId, selectedDate),
    ]);
  }

  async function handleBookSlot(time) {
    if (selectedDateBookedAppointment) {
      setNotice({
        type: "info",
        text: getDailyLimitMessage(selectedDateBookedAppointment),
      });
      return;
    }

    setBookingTime(time);
    setNotice(null);

    try {
      await patientApi.bookAppointment(auth.token, {
        doctorId: Number(selectedDoctorId),
        date: selectedDate,
        time,
      });

      await refreshAllAppointmentData();

      setNotice({
        type: "success",
        text: `Appointment booked for ${selectedDate} at ${formatTimeLabel(time)}.`,
      });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    } finally {
      setBookingTime("");
    }
  }

  async function handleCancelAppointment(appointmentId) {
    setNotice(null);

    try {
      await patientApi.cancelAppointment(auth.token, appointmentId);
      await refreshAllAppointmentData();
      setNotice({ type: "success", text: "Appointment cancelled successfully." });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    }
  }

  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === selectedDoctorId);

  return (
    <DashboardLayout
      title="Patient Dashboard"
      subtitle="Browse doctors, book one appointment per day, and keep upcoming and past visits organized."
    >
      <div className="full-span">
        <StatusMessage notice={notice} />
      </div>

      <SectionCard title="Doctors">
        {loadingDoctors ? (
          <p className="empty-state">Loading doctors...</p>
        ) : doctors.length === 0 ? (
          <p className="empty-state">No doctors have been created yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Specialization</th>
                  <th>Email</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr key={doctor.id}>
                    <td>{doctor.name}</td>
                    <td>{doctor.specialization || "General"}</td>
                    <td>{doctor.email}</td>
                    <td>
                      <button
                        type="button"
                        className={
                          String(doctor.id) === selectedDoctorId ? "secondary-button active" : ""
                        }
                        onClick={() => setSelectedDoctorId(String(doctor.id))}
                      >
                        {String(doctor.id) === selectedDoctorId ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Available Slots">
        <div className="stack gap-sm">
          {selectedDateBookedAppointment ? (
            <div className="notice notice-info">{getDailyLimitMessage(selectedDateBookedAppointment)}</div>
          ) : null}

          <p className="muted-text">All appointment times are shown in AM/PM. Patients can book only for today or tomorrow.</p>

          <label>
            Appointment date
            <input
              type="date"
              value={selectedDate}
              min={getTodayDateValue()}
              max={lastBookableDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>

          <div className="selection-card">
            <strong>{selectedDoctor ? selectedDoctor.name : "Choose a doctor"}</strong>
            <span>{selectedDoctor?.specialization || "No specialization added"}</span>
          </div>

          <div className="slot-scroll-area">
            <div className="slot-grid">
              {slots.length === 0 ? (
                <p className="empty-state">No open slots for the selected doctor and date.</p>
              ) : (
                slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className="slot-button"
                    disabled={bookingTime === slot || Boolean(selectedDateBookedAppointment)}
                    onClick={() => handleBookSlot(slot)}
                  >
                    {bookingTime === slot ? "Booking..." : formatTimeLabel(slot)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="full-span">
        <SectionCard title="Today's Appointments">
          <AppointmentTable
            appointments={todayAppointments}
            emptyMessage="No booked appointments for today."
            isLoading={loadingAppointments}
            onCancel={handleCancelAppointment}
          />
        </SectionCard>
      </div>

      <div className="full-span">
        <SectionCard title="Upcoming Appointments">
          <AppointmentTable
            appointments={upcomingAppointments}
            emptyMessage="No upcoming booked appointments."
            isLoading={loadingAppointments}
            onCancel={handleCancelAppointment}
          />
        </SectionCard>
      </div>

      <div className="full-span">
        <SectionCard title="Appointment History">
          <div className="filter-row">
            <label>
              Status
              <select
                name="status"
                value={historyFilters.status}
                onChange={handleHistoryFilterChange}
              >
                <option value="ALL">All history</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="COMPLETED">Completed</option>
                <option value="BOOKED">Past booked</option>
              </select>
            </label>

            <label>
              From date
              <input
                name="fromDate"
                type="date"
                value={historyFilters.fromDate}
                onChange={handleHistoryFilterChange}
              />
            </label>

            <label>
              To date
              <input
                name="toDate"
                type="date"
                value={historyFilters.toDate}
                onChange={handleHistoryFilterChange}
              />
            </label>

            <button type="button" className="secondary-button filter-button" onClick={clearHistoryFilters}>
              Clear filters
            </button>
          </div>

          <AppointmentTable
            appointments={historyAppointments}
            emptyMessage="No history records match the current filters."
            isLoading={loadingAppointments}
            onCancel={handleCancelAppointment}
          />

          <div className="pager-row">
            <span className="muted-text">
              Page {historyPagination.page} of {historyPagination.totalPages} ({historyPagination.total} records)
            </span>

            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                disabled={loadingAppointments || historyPagination.page <= 1}
                onClick={() =>
                  setHistoryFilters((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                Previous
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={loadingAppointments || historyPagination.page >= historyPagination.totalPages}
                onClick={() =>
                  setHistoryFilters((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                Next
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

export default PatientDashboard;
