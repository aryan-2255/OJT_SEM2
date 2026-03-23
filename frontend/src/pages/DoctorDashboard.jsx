import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import SectionCard from "../components/SectionCard";
import StatusMessage from "../components/StatusMessage";
import { useAuth } from "../context/AuthContext";
import { doctorApi } from "../services/api";
import { formatTimeLabel, TIME_OPTIONS } from "../services/time";

const APPOINTMENT_REFRESH_INTERVAL_MS = 30000;
const ACTIVE_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 10;
const DEFAULT_FORM = {
  startTime: "09:00",
  endTime: "12:00",
  breakStartTime: "",
  breakEndTime: "",
};
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

function AppointmentTable({ appointments, emptyMessage, isLoading }) {
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
            <th>Patient</th>
            <th>Email</th>
            <th>Date</th>
            <th>Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td>{appointment.patient.name}</td>
              <td>{appointment.patient.email}</td>
              <td>{appointment.date}</td>
              <td>{formatTimeLabel(appointment.time)}</td>
              <td>
                <span className={`status-pill status-${appointment.status.toLowerCase()}`}>
                  {appointment.status}
                </span>
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

function normalizeBreakTimes(nextForm) {
  const hasBreakStart = Boolean(nextForm.breakStartTime);
  const hasBreakEnd = Boolean(nextForm.breakEndTime);

  if (!hasBreakStart) {
    return {
      ...nextForm,
      breakEndTime: "",
    };
  }

  if (nextForm.breakStartTime <= nextForm.startTime || nextForm.breakStartTime >= nextForm.endTime) {
    return {
      ...nextForm,
      breakStartTime: "",
      breakEndTime: "",
    };
  }

  if (
    hasBreakEnd &&
    (nextForm.breakEndTime <= nextForm.breakStartTime || nextForm.breakEndTime >= nextForm.endTime)
  ) {
    return {
      ...nextForm,
      breakEndTime: "",
    };
  }

  return nextForm;
}

function buildFormFromSchedules(schedules) {
  if (schedules.length === 1) {
    return {
      ...DEFAULT_FORM,
      startTime: schedules[0].startTime,
      endTime: schedules[0].endTime,
    };
  }

  if (schedules.length === 2) {
    const [firstBlock, secondBlock] = [...schedules].sort((left, right) =>
      left.startTime.localeCompare(right.startTime)
    );

    if (firstBlock.endTime < secondBlock.startTime) {
      return {
        startTime: firstBlock.startTime,
        endTime: secondBlock.endTime,
        breakStartTime: firstBlock.endTime,
        breakEndTime: secondBlock.startTime,
      };
    }
  }

  return DEFAULT_FORM;
}

function DoctorDashboard() {
  const { auth } = useAuth();
  const startTimeOptions = TIME_OPTIONS.slice(0, -1);
  const [schedules, setSchedules] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [historyAppointments, setHistoryAppointments] = useState([]);
  const [historyPagination, setHistoryPagination] = useState(EMPTY_PAGINATION);
  const [historyFilters, setHistoryFilters] = useState(DEFAULT_HISTORY_FILTERS);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const endTimeOptions = TIME_OPTIONS.filter((option) => option.value > form.startTime);
  const breakStartOptions = TIME_OPTIONS.filter(
    (option) => option.value > form.startTime && option.value < form.endTime
  );
  const breakEndOptions = TIME_OPTIONS.filter(
    (option) =>
      Boolean(form.breakStartTime) &&
      option.value > form.breakStartTime &&
      option.value < form.endTime
  );

  async function loadSchedules() {
    const response = await doctorApi.listSchedules(auth.token);
    setSchedules(response.schedules);
    setForm(buildFormFromSchedules(response.schedules));
  }

  async function loadAppointmentSections() {
    const [todayResponse, upcomingResponse, historyResponse] = await Promise.all([
      doctorApi.listAppointments(auth.token, {
        view: "today",
        page: 1,
        pageSize: ACTIVE_PAGE_SIZE,
      }),
      doctorApi.listAppointments(auth.token, {
        view: "upcoming",
        page: 1,
        pageSize: ACTIVE_PAGE_SIZE,
      }),
      doctorApi.listAppointments(auth.token, buildHistoryQuery(historyFilters)),
    ]);

    setTodayAppointments(todayResponse.appointments);
    setUpcomingAppointments(upcomingResponse.appointments);
    setHistoryAppointments(historyResponse.appointments);
    setHistoryPagination(historyResponse.pagination);
  }

  useEffect(() => {
    async function initializeSchedules() {
      setLoadingSchedules(true);

      try {
        await loadSchedules();
      } catch (requestError) {
        setNotice({ type: "error", text: requestError.message });
      } finally {
        setLoadingSchedules(false);
      }
    }

    initializeSchedules();
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

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => {
      let nextForm = { ...current, [name]: value };

      if (name === "startTime" && nextForm.endTime <= value) {
        nextForm.endTime =
          TIME_OPTIONS.find((option) => option.value > value)?.value || current.endTime;
      }

      if (name === "endTime" && nextForm.startTime >= value) {
        nextForm.startTime =
          [...TIME_OPTIONS].reverse().find((option) => option.value < value)?.value || current.startTime;
      }

      return normalizeBreakTimes(nextForm);
    });
  }

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

  async function handleCreateSchedule(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      await doctorApi.createSchedule(auth.token, form);
      await Promise.all([loadSchedules(), loadAppointmentSections()]);
      setNotice({ type: "success", text: "Daily availability saved successfully." });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSchedule(scheduleId) {
    setNotice(null);

    try {
      await doctorApi.deleteSchedule(auth.token, scheduleId);
      await Promise.all([loadSchedules(), loadAppointmentSections()]);
      setNotice({ type: "success", text: "Availability block removed." });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    }
  }

  return (
    <DashboardLayout
      title="Doctor Dashboard"
      subtitle="Set one daily availability template, keep it active until you change it, and manage appointments clearly."
    >
      <div className="full-span">
        <StatusMessage notice={notice} />
      </div>

      <SectionCard title="Daily Availability">
        <form className="stack gap-sm" onSubmit={handleCreateSchedule}>
          <p className="muted-text">
            Save a daily availability once and it stays active every day until you replace it or
            delete all blocks. Add an optional break and the system will split the day into two
            blocks automatically.
          </p>

          <label>
            Start time
            <select
              name="startTime"
              value={form.startTime}
              onChange={handleChange}
              required
            >
              {startTimeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            End time
            <select
              name="endTime"
              value={form.endTime}
              onChange={handleChange}
              required
            >
              {endTimeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Break start
            <select name="breakStartTime" value={form.breakStartTime} onChange={handleChange}>
              <option value="">No break</option>
              {breakStartOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Break end
            <select
              name="breakEndTime"
              value={form.breakEndTime}
              onChange={handleChange}
              disabled={!form.breakStartTime}
            >
              <option value="">{form.breakStartTime ? "Select break end" : "Set break start first"}</option>
              {breakEndOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save daily availability"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Current Daily Availability">
        <p className="muted-text">
          These blocks apply every day until you update them. If all blocks are deleted, patients
          will not see any new slots.
        </p>
        {loadingSchedules ? (
          <p className="empty-state">Loading availability...</p>
        ) : schedules.length === 0 ? (
          <p className="empty-state">
            No default daily availability has been saved yet. Save it once here to keep the same
            schedule running every day until you change it.
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Start</th>
                  <th>End</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>{formatTimeLabel(schedule.startTime)}</td>
                    <td>{formatTimeLabel(schedule.endTime)}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="full-span">
        <SectionCard title="Today's Appointments">
          <AppointmentTable
            appointments={todayAppointments}
            emptyMessage="No booked appointments for today."
            isLoading={loadingAppointments}
          />
        </SectionCard>
      </div>

      <div className="full-span">
        <SectionCard title="Upcoming Appointments">
          <AppointmentTable
            appointments={upcomingAppointments}
            emptyMessage="No upcoming booked appointments."
            isLoading={loadingAppointments}
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

export default DoctorDashboard;
