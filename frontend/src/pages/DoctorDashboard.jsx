import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import SectionCard from "../components/SectionCard";
import StatusMessage from "../components/StatusMessage";
import { useAuth } from "../context/AuthContext";
import { doctorApi } from "../services/api";
import { getTodayDateValue } from "../services/date";
import { formatTimeLabel, TIME_OPTIONS } from "../services/time";

const APPOINTMENT_REFRESH_INTERVAL_MS = 30000;
const ACTIVE_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 10;
const WEEKDAY_OPTIONS = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
];
const WEEKDAY_LABELS = Object.fromEntries(
  WEEKDAY_OPTIONS.map((weekday) => [weekday.value, weekday.label])
);
const DEFAULT_AVAILABILITY_FORM = {
  mode: "DAILY",
  weekdays: [],
  startTime: "09:00",
  endTime: "12:00",
  breakStartTime: "",
  breakEndTime: "",
};
const DEFAULT_DAY_OFF_FORM = {
  date: getTodayDateValue(),
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

function buildFormFromBlocks(baseForm, blocks) {
  if (blocks.length === 1) {
    return {
      ...baseForm,
      startTime: blocks[0].startTime,
      endTime: blocks[0].endTime,
    };
  }

  if (blocks.length === 2) {
    const [firstBlock, secondBlock] = [...blocks].sort((left, right) =>
      left.startTime.localeCompare(right.startTime)
    );

    if (firstBlock.endTime < secondBlock.startTime) {
      return {
        ...baseForm,
        startTime: firstBlock.startTime,
        endTime: secondBlock.endTime,
        breakStartTime: firstBlock.endTime,
        breakEndTime: secondBlock.startTime,
      };
    }
  }

  return baseForm;
}

function buildFormFromSchedules(scheduleMode, schedules) {
  if (!scheduleMode || schedules.length === 0) {
    return {
      ...DEFAULT_AVAILABILITY_FORM,
    };
  }

  if (scheduleMode === "DAILY") {
    return buildFormFromBlocks(
      {
        ...DEFAULT_AVAILABILITY_FORM,
        mode: "DAILY",
      },
      schedules
    );
  }

  const schedulesByDay = WEEKDAY_OPTIONS.map((weekday) => ({
    value: weekday.value,
    blocks: schedules
      .filter((schedule) => schedule.dayOfWeek === weekday.value)
      .sort((left, right) => left.startTime.localeCompare(right.startTime)),
  })).filter((entry) => entry.blocks.length > 0);

  if (schedulesByDay.length === 0) {
    return {
      ...DEFAULT_AVAILABILITY_FORM,
      mode: "WEEKLY",
    };
  }

  const selectedWeekdays = schedulesByDay.map((entry) => entry.value);
  const firstPattern = schedulesByDay[0].blocks.map((block) => ({
    startTime: block.startTime,
    endTime: block.endTime,
  }));
  const hasUniformBlocks = schedulesByDay.every((entry) =>
    JSON.stringify(
      entry.blocks.map((block) => ({
        startTime: block.startTime,
        endTime: block.endTime,
      }))
    ) === JSON.stringify(firstPattern)
  );

  if (hasUniformBlocks) {
    return buildFormFromBlocks(
      {
        ...DEFAULT_AVAILABILITY_FORM,
        mode: "WEEKLY",
        weekdays: selectedWeekdays,
      },
      firstPattern
    );
  }

  return {
    ...DEFAULT_AVAILABILITY_FORM,
    mode: "WEEKLY",
    weekdays: selectedWeekdays,
  };
}

function formatScheduleDay(schedule) {
  return schedule.mode === "DAILY" ? "Every day" : WEEKDAY_LABELS[schedule.dayOfWeek] || schedule.dayOfWeek;
}

function DoctorDashboard() {
  const { auth } = useAuth();
  const startTimeOptions = TIME_OPTIONS.slice(0, -1);
  const [scheduleMode, setScheduleMode] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [dayOffs, setDayOffs] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [historyAppointments, setHistoryAppointments] = useState([]);
  const [historyPagination, setHistoryPagination] = useState(EMPTY_PAGINATION);
  const [historyFilters, setHistoryFilters] = useState(DEFAULT_HISTORY_FILTERS);
  const [availabilityForm, setAvailabilityForm] = useState(DEFAULT_AVAILABILITY_FORM);
  const [dayOffForm, setDayOffForm] = useState(DEFAULT_DAY_OFF_FORM);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [isSubmittingAvailability, setIsSubmittingAvailability] = useState(false);
  const [isSubmittingDayOff, setIsSubmittingDayOff] = useState(false);
  const [busyScheduleId, setBusyScheduleId] = useState(null);
  const [busyDayOffId, setBusyDayOffId] = useState(null);
  const [notice, setNotice] = useState(null);
  const endTimeOptions = TIME_OPTIONS.filter((option) => option.value > availabilityForm.startTime);
  const breakStartOptions = TIME_OPTIONS.filter(
    (option) => option.value > availabilityForm.startTime && option.value < availabilityForm.endTime
  );
  const breakEndOptions = TIME_OPTIONS.filter(
    (option) =>
      Boolean(availabilityForm.breakStartTime) &&
      option.value > availabilityForm.breakStartTime &&
      option.value < availabilityForm.endTime
  );

  async function loadAvailabilityState() {
    const [scheduleResponse, dayOffResponse] = await Promise.all([
      doctorApi.listSchedules(auth.token),
      doctorApi.listDayOffs(auth.token),
    ]);

    setScheduleMode(scheduleResponse.scheduleMode);
    setSchedules(scheduleResponse.schedules);
    setDayOffs(dayOffResponse.dayOffs);
    setAvailabilityForm(buildFormFromSchedules(scheduleResponse.scheduleMode, scheduleResponse.schedules));
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
    async function initializeAvailability() {
      setLoadingAvailability(true);

      try {
        await loadAvailabilityState();
      } catch (requestError) {
        setNotice({ type: "error", text: requestError.message });
      } finally {
        setLoadingAvailability(false);
      }
    }

    initializeAvailability();
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

  function handleAvailabilityFieldChange(event) {
    const { name, value } = event.target;

    setAvailabilityForm((current) => {
      if (name === "mode") {
        return {
          ...DEFAULT_AVAILABILITY_FORM,
          mode: value,
          startTime: current.startTime,
          endTime:
            current.endTime > current.startTime ? current.endTime : DEFAULT_AVAILABILITY_FORM.endTime,
        };
      }

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

  function toggleWeekday(weekday) {
    setAvailabilityForm((current) => {
      const weekdays = current.weekdays.includes(weekday)
        ? current.weekdays.filter((value) => value !== weekday)
        : WEEKDAY_OPTIONS.map((option) => option.value).filter((value) =>
            [...current.weekdays, weekday].includes(value)
          );

      return {
        ...current,
        weekdays,
      };
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

  async function handleSaveAvailability(event) {
    event.preventDefault();
    setIsSubmittingAvailability(true);
    setNotice(null);

    try {
      await doctorApi.createSchedule(auth.token, availabilityForm);
      await Promise.all([loadAvailabilityState(), loadAppointmentSections()]);
      setNotice({
        type: "success",
        text:
          availabilityForm.mode === "DAILY"
            ? "Daily availability saved successfully."
            : "Weekly availability saved successfully.",
      });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    } finally {
      setIsSubmittingAvailability(false);
    }
  }

  async function handleDeleteSchedule(scheduleId) {
    setBusyScheduleId(scheduleId);
    setNotice(null);

    try {
      await doctorApi.deleteSchedule(auth.token, scheduleId);
      await Promise.all([loadAvailabilityState(), loadAppointmentSections()]);
      setNotice({ type: "success", text: "Availability block removed." });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    } finally {
      setBusyScheduleId(null);
    }
  }

  async function handleCreateDayOff(event) {
    event.preventDefault();
    setIsSubmittingDayOff(true);
    setNotice(null);

    try {
      await doctorApi.createDayOff(auth.token, dayOffForm);
      await Promise.all([loadAvailabilityState(), loadAppointmentSections()]);
      setDayOffForm(DEFAULT_DAY_OFF_FORM);
      setNotice({ type: "success", text: "Day off added successfully." });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    } finally {
      setIsSubmittingDayOff(false);
    }
  }

  async function handleDeleteDayOff(dayOffId) {
    setBusyDayOffId(dayOffId);
    setNotice(null);

    try {
      await doctorApi.deleteDayOff(auth.token, dayOffId);
      await loadAvailabilityState();
      setNotice({ type: "success", text: "Day off removed." });
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message });
    } finally {
      setBusyDayOffId(null);
    }
  }

  const activeModeText =
    scheduleMode === "WEEKLY" ? "Weekly mode is active." : scheduleMode === "DAILY" ? "Daily mode is active." : "No recurring availability saved yet.";

  return (
    <DashboardLayout
      title="Doctor Dashboard"
      subtitle="Manage recurring availability with daily or weekly mode, add day offs, and keep appointments aligned with the active schedule."
    >
      <div className="full-span">
        <StatusMessage notice={notice} />
      </div>

      <SectionCard title="Recurring Availability">
        <form className="stack gap-sm" onSubmit={handleSaveAvailability}>
          <p className="muted-text">
            Choose one recurring mode at a time. Saving this form replaces the current recurring
            availability. Daily applies the same blocks every day. Weekly applies the same blocks
            to the selected weekdays. Breaks still split one window into two blocks.
          </p>

          <label>
            Mode
            <select
              name="mode"
              value={availabilityForm.mode}
              onChange={handleAvailabilityFieldChange}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </label>

          {availabilityForm.mode === "WEEKLY" ? (
            <div>
              <span className="field-label">Weekdays</span>
              <div className="chip-row">
                {WEEKDAY_OPTIONS.map((weekday) => (
                  <button
                    key={weekday.value}
                    type="button"
                    className={
                      availabilityForm.weekdays.includes(weekday.value)
                        ? "secondary-button active chip-button"
                        : "secondary-button chip-button"
                    }
                    onClick={() => toggleWeekday(weekday.value)}
                  >
                    {weekday.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label>
            Start time
            <select
              name="startTime"
              value={availabilityForm.startTime}
              onChange={handleAvailabilityFieldChange}
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
              value={availabilityForm.endTime}
              onChange={handleAvailabilityFieldChange}
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
            <select
              name="breakStartTime"
              value={availabilityForm.breakStartTime}
              onChange={handleAvailabilityFieldChange}
            >
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
              value={availabilityForm.breakEndTime}
              onChange={handleAvailabilityFieldChange}
              disabled={!availabilityForm.breakStartTime}
            >
              <option value="">
                {availabilityForm.breakStartTime ? "Select break end" : "Set break start first"}
              </option>
              {breakEndOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={isSubmittingAvailability}>
            {isSubmittingAvailability ? "Saving..." : "Save recurring availability"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Current Availability">
        <p className="muted-text">{activeModeText}</p>
        {loadingAvailability ? (
          <p className="empty-state">Loading availability...</p>
        ) : schedules.length === 0 ? (
          <p className="empty-state">No recurring availability has been saved yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Day</th>
                  <th>Start</th>
                  <th>End</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>{schedule.mode === "DAILY" ? "Daily" : "Weekly"}</td>
                    <td>{formatScheduleDay(schedule)}</td>
                    <td>{formatTimeLabel(schedule.startTime)}</td>
                    <td>{formatTimeLabel(schedule.endTime)}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        disabled={busyScheduleId === schedule.id}
                      >
                        {busyScheduleId === schedule.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Day Off">
        <form className="stack gap-sm" onSubmit={handleCreateDayOff}>
          <p className="muted-text">
            Add a full-day override when the doctor is unavailable on a specific date. Active
            booked appointments on that date must be cleared first.
          </p>

          <label>
            Date
            <input
              name="date"
              type="date"
              value={dayOffForm.date}
              min={getTodayDateValue()}
              onChange={(event) => setDayOffForm({ date: event.target.value })}
              required
            />
          </label>

          <button type="submit" disabled={isSubmittingDayOff}>
            {isSubmittingDayOff ? "Saving..." : "Add day off"}
          </button>
        </form>

        <div className="table-wrapper top-gap">
          {loadingAvailability ? (
            <p className="empty-state">Loading day offs...</p>
          ) : dayOffs.length === 0 ? (
            <p className="empty-state">No day offs have been added.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dayOffs.map((dayOff) => (
                  <tr key={dayOff.id}>
                    <td>{dayOff.date}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleDeleteDayOff(dayOff.id)}
                        disabled={busyDayOffId === dayOff.id}
                      >
                        {busyDayOffId === dayOff.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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

            <button
              type="button"
              className="secondary-button filter-button"
              onClick={clearHistoryFilters}
            >
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
